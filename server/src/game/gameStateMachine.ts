/**
 * Game phase transitions (`state-machine.md` sections 2 and 4).
 *
 * The single writer of the `WAITING`/`STARTING`/`NEXT_ROUND` phase values and
 * of `startingDeadline` / `resultsDeadline`. Every transition runs inside one
 * commit, and the guard predicates live in `stateMachine.ts` so a transition
 * cannot be performed without its guard.
 */

import {
  MIN_PLAYERS,
  STARTING_WINDOW_MS,
} from '../../../shared/contract/constants.js';
import { games } from '../db/schema.js';
import { AppError } from '../errors.js';
import {
  readAggregate,
  readMembers,
  writeAggregate,
} from '../redis/roomState.js';
import { canStartGame, shouldAbortStarting } from './stateMachine.js';
import type { TransitionContext } from './stateMachine.js';
import type { RoomAggregate, RoomMember } from './types.js';
import type { Services } from './services.js';

export class GameStateMachine {
  constructor(private readonly services: Services) {}

  private context(
    aggregate: RoomAggregate,
    members: readonly RoomMember[],
  ): TransitionContext {
    return {
      phase: aggregate.phase,
      roomStatus: aggregate.status,
      connectedRosterSize: members.filter((member) => member.isConnected).length,
      now: this.services.clock.now(),
      startingDeadline: aggregate.startingDeadline,
      resultsDeadline: aggregate.resultsDeadline,
      roundNumber: aggregate.roundNumber,
      roundsPlanned: aggregate.roundsPlanned,
      drawerPlayerId: aggregate.drawerPlayerId,
      wordId: aggregate.wordId,
      roundTimerPaused: aggregate.roundTimerPaused,
      roundEndTime: aggregate.roundEndTime,
    };
  }

  /** `WAITING | GAME_FINISHED -> STARTING`. Host-only, roster >= MIN_PLAYERS. */
  async startGame(roomId: string, requesterPlayerId: string): Promise<void> {
    const members = await readMembers(this.services.redis, roomId);
    await this.services.commit(roomId, async () => {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null) throw new AppError('ROOM_NOT_FOUND');
      if (aggregate.hostPlayerId !== requesterPlayerId) {
        throw new AppError('FORBIDDEN');
      }
      const ctx = this.context(aggregate, members);
      if (ctx.phase !== 'WAITING' && ctx.phase !== 'GAME_FINISHED') {
        throw new AppError('BAD_STATE');
      }
      if (!canStartGame({ ...ctx, phase: 'WAITING', roomStatus: 'WAITING' })) {
        throw new AppError('BAD_STATE');
      }
      const inserted = await this.services.db.db
        .insert(games)
        .values({
          roomId,
          roundsPlanned: aggregate.config.rounds,
          status: 'STARTING',
        })
        .returning({ id: games.id });
      const gameRow = inserted[0];
      if (gameRow === undefined) throw new AppError('INTERNAL_ERROR');

      aggregate.phase = 'STARTING';
      aggregate.status = 'IN_GAME';
      aggregate.gameStatus = 'STARTING';
      aggregate.gameId = gameRow.id;
      aggregate.roundNumber = 1;
      aggregate.roundsPlanned = aggregate.config.rounds;
      aggregate.roundId = null;
      aggregate.drawerPlayerId = null;
      aggregate.previousDrawerPlayerId = null;
      aggregate.nextDrawerPlayerId = null;
      aggregate.wordId = null;
      aggregate.roundEndTime = null;
      aggregate.roundTimerPaused = false;
      aggregate.roundStartedAt = null;
      aggregate.pausedAt = null;
      aggregate.endReason = null;
      aggregate.revealedPositions = [];
      aggregate.hintsRemaining = aggregate.config.hints;
      aggregate.startingDeadline = this.services.clock.now() + STARTING_WINDOW_MS;
      aggregate.resultsDeadline = null;
      await writeAggregate(this.services.redis, aggregate);
      await this.services.rooms.resetRoomTransientState(roomId);
      return null;
    });

    const aggregate = await readAggregate(this.services.redis, roomId);
    const version = await this.services.readVersion(roomId);
    if (aggregate !== null && aggregate.gameId !== null) {
      this.services.bus.toRoom(roomId, 'game:started', {
        type: 'game:started',
        gameId: aggregate.gameId,
        roundNumber: aggregate.roundNumber,
        roundsPlanned: aggregate.roundsPlanned,
        startingDeadline: aggregate.startingDeadline ?? 0,
        serverNow: this.services.clock.now(),
        players: await this.services.rooms.publicPlayers(roomId, aggregate, members),
        version,
      });
    }
  }

  /** `STARTING -> ROUND_ACTIVE` once the countdown elapses and a roster remains. */
  async advanceStarting(roomId: string): Promise<void> {
    const members = await readMembers(this.services.redis, roomId);
    let aborted = false;
    await this.services.commit(roomId, async () => {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null || aggregate.phase !== 'STARTING') return null;
      const ctx = this.context(aggregate, members);
      if (ctx.now < (ctx.startingDeadline ?? 0)) return null;
      if (shouldAbortStarting(ctx)) {
        aggregate.phase = 'WAITING';
        aggregate.status = 'WAITING';
        aggregate.gameStatus = 'ABANDONED';
        aggregate.startingDeadline = null;
        await writeAggregate(this.services.redis, aggregate);
        aborted = true;
      }
      return null;
    });
    if (aborted) {
      const version = await this.services.readVersion(roomId);
      await this.services.chat.appendSystem(
        roomId,
        'Not enough players - returned to the lobby.',
        version,
      );
      return;
    }
    const aggregate = await readAggregate(this.services.redis, roomId);
    if (aggregate !== null && aggregate.phase === 'STARTING') {
      await this.services.rounds.startRound(roomId);
    }
  }

  /**
   * `ROUND_FINISHED -> NEXT_ROUND -> ROUND_ACTIVE`, or `-> GAME_FINISHED` when
   * the round plan is exhausted.
   */
  async advanceAfterResults(roomId: string): Promise<void> {
    const members = await readMembers(this.services.redis, roomId);
    let finish = false;
    await this.services.commit(roomId, async () => {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null || aggregate.phase !== 'ROUND_FINISHED') return null;
      if (this.services.clock.now() < (aggregate.resultsDeadline ?? 0)) return null;
      if (aggregate.roundNumber >= aggregate.roundsPlanned) {
        finish = true;
        return null;
      }
      aggregate.phase = 'NEXT_ROUND';
      aggregate.roundNumber += 1;
      aggregate.nextDrawerPlayerId = this.services.selectDrawerForNextRound(members, aggregate);
      await writeAggregate(this.services.redis, aggregate);
      return null;
    });
    if (finish) {
      await this.services.finalizer.finishGame(roomId);
      return;
    }
    const aggregate = await readAggregate(this.services.redis, roomId);
    if (aggregate !== null && aggregate.phase === 'NEXT_ROUND') {
      await this.services.rounds.startRound(roomId);
    }
  }

  /** Countdown and results-window expiry for every active room. */
  async sweep(): Promise<void> {
    for (const roomId of [...this.services.activeRooms]) {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null) {
        this.services.activeRooms.delete(roomId);
        continue;
      }
      const now = this.services.clock.now();
      if (
        aggregate.phase === 'STARTING' &&
        aggregate.startingDeadline !== null &&
        now >= aggregate.startingDeadline
      ) {
        await this.advanceStarting(roomId);
      } else if (
        aggregate.phase === 'ROUND_FINISHED' &&
        aggregate.resultsDeadline !== null &&
        now >= aggregate.resultsDeadline
      ) {
        await this.advanceAfterResults(roomId);
      }
    }
  }

  /** Test seam: the roster size a start needs, from the shared constant. */
  static requiredPlayers(): number {
    return MIN_PLAYERS;
  }
}
