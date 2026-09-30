/**
 * Round lifecycle (`state-machine.md` sections 3.3, 3.4, 5; D03-012).
 *
 * The single writer of `round.endReason`, and the component that opens a round
 * (drawer + word) and closes it on any of the three triggers. Round-end
 * PostgreSQL writes happen in one transaction that is idempotent through the
 * `scores (round_id, user_id, kind)` unique index (`data-model.md` section 4);
 * on failure the write is retried from the bounded Redis outbox.
 */

import { eq } from 'drizzle-orm';
import { RESULTS_WINDOW_MS } from '../../../shared/contract/constants.js';
import { games, rounds, scores as scoresTable } from '../db/schema.js';
import { AppError } from '../errors.js';
import {
  appendOutbox,
  clearCorrect,
  clearStrokes,
  readAggregate,
  readCorrect,
  readMembers,
  readScores,
  readSecret,
  readUsedWords,
  writeAggregate,
} from '../redis/roomState.js';
import { selectDrawer } from './drawerSelector.js';
import { pointsForRank } from './scoring.js';
import { startRoundTimer } from './roundTimer.js';
import type { RoundEndReason } from '../../../shared/contract/types.js';
import type { RoomAggregate, RoomMember } from './types.js';
import type { Services } from './services.js';

export class RoundService {
  constructor(private readonly services: Services) {}

  /**
   * Open the round named by `aggregate.roundNumber`. Selects the drawer (reusing
   * the one chosen in `NEXT_ROUND` when present) and the word, inserts the
   * `rounds` row, and emits `round:started` plus the role-split
   * `drawer:selected`.
   */
  async startRound(roomId: string): Promise<void> {
    const members = await this.services.rooms.readMembers(roomId);
    const { version } = await this.services.commit(roomId, async (v) => {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null) throw new AppError('ROOM_NOT_FOUND');
      if (aggregate.gameId === null) throw new AppError('BAD_STATE');

      const drawer =
        aggregate.nextDrawerPlayerId ??
        selectDrawer(members, aggregate.drawerPlayerId, this.services.ids);
      if (drawer === null) return null;

      const used = await readUsedWords(this.services.redis, roomId);
      const secret = await this.services.words.selectForRound(roomId, used);
      if (secret === null) throw new AppError('BAD_STATE');

      const inserted = await this.services.db.db
        .insert(rounds)
        .values({
          gameId: aggregate.gameId,
          roundNumber: aggregate.roundNumber,
          drawerUserId: drawer,
          wordId: secret.wordId,
          status: 'ACTIVE',
        })
        .returning({ id: rounds.id });
      const roundRow = inserted[0];
      if (roundRow === undefined) throw new AppError('INTERNAL_ERROR');

      aggregate.phase = 'ROUND_ACTIVE';
      aggregate.status = 'IN_GAME';
      aggregate.gameStatus = 'IN_PROGRESS';
      aggregate.roundId = roundRow.id;
      aggregate.previousDrawerPlayerId = aggregate.drawerPlayerId;
      aggregate.drawerPlayerId = drawer;
      aggregate.nextDrawerPlayerId = null;
      aggregate.wordId = secret.wordId;
      aggregate.hintsRemaining = aggregate.config.hints;
      aggregate.revealedPositions = [];
      aggregate.endReason = null;
      startRoundTimer(aggregate, this.services.clock.now(), aggregate.config.roundDuration * 1000);
      await writeAggregate(this.services.redis, aggregate);
      await clearCorrect(this.services.redis, roomId);
      await clearStrokes(this.services.redis, roomId);
      this.services.drawing.reset(roomId);

      const payload = {
        type: 'round:started' as const,
        roomId,
        roundNumber: aggregate.roundNumber,
        drawerPlayerId: drawer,
        maskedWord: secret.maskedWord,
        hintsRemaining: aggregate.hintsRemaining,
        timer: { roundEndTime: aggregate.roundEndTime ?? 0 },
        serverNow: this.services.clock.now(),
        version: v,
      };
      this.services.bus.toRoom(roomId, 'round:started', payload);
      await this.services.bus.toPlayer(roomId, drawer, 'drawer:selected', {
        type: 'drawer:selected',
        playerId: drawer,
        secretWord: secret.secretWord,
        maskedWord: secret.maskedWord,
        roundNumber: aggregate.roundNumber,
        version: v,
      });
      await this.services.bus.toRoomExceptPlayer(roomId, drawer, 'drawer:selected', {
        type: 'drawer:selected',
        playerId: drawer,
        maskedWord: secret.maskedWord,
        roundNumber: aggregate.roundNumber,
        version: v,
      });
      return { drawer, secret };
    });
    void version;
  }

  /** End the live round with `reason`; no-op when the round is not live. */
  async endRound(roomId: string, reason: RoundEndReason): Promise<void> {
    const { version, result } = await this.services.commit(roomId, async (v) => {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null || aggregate.phase !== 'ROUND_ACTIVE') return null;
      const members = await readMembers(this.services.redis, roomId);
      const nicknameOf = (playerId: string): string =>
        members.find((member) => member.playerId === playerId)?.nickname ?? '';
      const correct = await readCorrect(this.services.redis, roomId);
      const secret = await readSecret(this.services.redis, roomId);
      const drawerPlayerId = aggregate.drawerPlayerId ?? '';

      const drawerPoints = await this.services.scores.awardDrawer(
        roomId,
        drawerPlayerId,
        correct.length,
        reason,
      );
      const finalScores = await readScores(this.services.redis, roomId);

      aggregate.phase = 'ROUND_FINISHED';
      aggregate.endReason = reason;
      aggregate.roundTimerPaused = false;
      aggregate.pausedAt = null;
      aggregate.resultsDeadline = this.services.clock.now() + RESULTS_WINDOW_MS;
      await writeAggregate(this.services.redis, aggregate);

      await this.persistRoundEnd(roomId, aggregate, correct, drawerPlayerId, drawerPoints, secret?.maskedWord ?? null);

      const rankings = correct.map((entry) => ({
        playerId: entry.playerId,
        nickname: nicknameOf(entry.playerId),
        rank: entry.rank,
        points: pointsForRank(entry.rank, this.services.scoreTable),
      }));
      this.services.bus.toRoom(roomId, 'round:ended', {
        type: 'round:ended',
        roundNumber: aggregate.roundNumber,
        endReason: reason,
        word: secret?.secretWord ?? '',
        rankings,
        drawerBonus: this.services.scoreTable.drawerBonusPerGuesser,
        drawerPoints,
        version: v,
      });
      this.services.bus.toRoom(roomId, 'score:updated', {
        type: 'score:updated',
        scores: finalScores,
        version: v,
      });
      return { reason };
    });
    void version;
    void result;
  }

  /**
   * Write `rounds` + `scores` in one transaction. A failure appends a bounded
   * outbox entry instead of stalling the round (`data-model.md` section 4).
   */
  private async persistRoundEnd(
    roomId: string,
    aggregate: RoomAggregate,
    correct: readonly { playerId: string; rank: number }[],
    drawerPlayerId: string,
    drawerPoints: number,
    maskedWordFinal: string | null,
  ): Promise<void> {
    const gameId = aggregate.gameId;
    const roundId = aggregate.roundId;
    if (gameId === null || roundId === null) return;
    const now = new Date(this.services.clock.now());
    try {
      await this.services.db.db.transaction(async (tx) => {
        await tx
          .update(rounds)
          .set({
            endedAt: now,
            status: 'FINISHED',
            endReason: aggregate.endReason,
            maskedWordFinal,
          })
          .where(eq(rounds.id, roundId));
        await tx
          .update(games)
          .set({ roundsCompleted: aggregate.roundNumber })
          .where(eq(games.id, gameId));
        const rows = correct.map((entry) => ({
          gameId,
          roundId,
          userId: entry.playerId,
          kind: 'guess',
          points: pointsForRank(entry.rank, this.services.scoreTable),
          rankInRound: entry.rank,
        }));
        if (drawerPlayerId !== '') {
          rows.push({
            gameId,
            roundId,
            userId: drawerPlayerId,
            kind: 'drawer',
            points: drawerPoints,
            rankInRound: 0,
          });
        }
        if (rows.length > 0) {
          await tx.insert(scoresTable).values(rows).onConflictDoNothing();
        }
      });
    } catch (error) {
      this.services.logger.error(
        { err: error, roomId, roundId },
        'round-end persistence failed; queued in outbox',
      );
      await appendOutbox(this.services.redis, roomId, {
        kind: 'round-end',
        roundId,
        gameId,
        endReason: aggregate.endReason,
        correct: correct.map((entry) => ({ ...entry, points: pointsForRank(entry.rank, this.services.scoreTable) })),
        drawerPlayerId,
        drawerPoints,
        maskedWordFinal,
        at: this.services.clock.now(),
      });
    }
  }

  /** Timer expiry for every live, unpaused room (`state-machine.md` section 5). */
  async sweep(): Promise<void> {
    for (const roomId of [...this.services.activeRooms]) {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null) {
        this.services.activeRooms.delete(roomId);
        continue;
      }
      if (
        aggregate.phase === 'ROUND_ACTIVE' &&
        !aggregate.roundTimerPaused &&
        aggregate.roundEndTime !== null &&
        this.services.clock.now() >= aggregate.roundEndTime
      ) {
        await this.endRound(roomId, 'TIMER_EXPIRED');
      }
    }
  }

  /** Exposed for tests: the members list never changes the round itself. */
  static eligibleCount(members: readonly RoomMember[], drawer: string | null): number {
    return members.filter((m) => m.isConnected && m.playerId !== drawer).length;
  }
}
