/**
 * The one snapshot projector (`reconnect-protocol.md` section 4).
 *
 * One projector, one role parameter, applied at send time. It is a READER: it
 * is not a writer in `server-state-writer-map.md`. The only mutation it
 * performs is `delete snapshot.round.secretWord` for a non-drawer, so the
 * property is absent rather than null (`security-model.md` section 3.1).
 */

import { readAggregate, readAllSockets, readChat, readCorrect, readMembers, readScore, readScores, readSecret, readVersion } from '../redis/roomState.js';
import type { StateSnapshot, SnapshotRound } from '../../../shared/contract/snapshot.js';
import type { PublicPlayer, LeaderboardEntry } from '../../../shared/contract/types.js';
import type { Services } from './services.js';

export class SnapshotProjector {
  constructor(private readonly services: Services) {}

  async project(roomId: string, requesterPlayerId: string): Promise<StateSnapshot | null> {
    const aggregate = await readAggregate(this.services.redis, roomId);
    if (aggregate === null) return null;
    const [members, secret, scores, correct, chat, version, sockets] =
      await Promise.all([
        readMembers(this.services.redis, roomId),
        readSecret(this.services.redis, roomId),
        readScores(this.services.redis, roomId),
        readCorrect(this.services.redis, roomId),
        readChat(this.services.redis, roomId),
        readVersion(this.services.redis, roomId),
        readAllSockets(this.services.redis, roomId),
      ]);

    const nicknameOf = (playerId: string): string =>
      members.find((member) => member.playerId === playerId)?.nickname ?? '';

    const ordered = [...members].sort((left, right) => left.seatOrder - right.seatOrder);
    const players: PublicPlayer[] = ordered.map((member) => ({
      playerId: member.playerId,
      nickname: member.nickname,
      score: scores[member.playerId] ?? 0,
      isConnected: member.isConnected,
      isHost: member.playerId === aggregate.hostPlayerId,
      seatOrder: member.seatOrder,
    }));

    const leaderboard: LeaderboardEntry[] = [...players]
      .sort((left, right) => right.score - left.score || left.playerId.localeCompare(right.playerId))
      .map((player, index) => ({
        playerId: player.playerId,
        nickname: player.nickname,
        score: player.score,
        rank: index + 1,
      }));

    const isDrawer = aggregate.drawerPlayerId === requesterPlayerId;
    const youScore = await readScore(this.services.redis, roomId, requesterPlayerId);

    const round: SnapshotRound = {
      roundId: aggregate.roundId,
      drawerPlayerId: aggregate.drawerPlayerId,
      maskedWord: secret?.maskedWord ?? '',
      revealedPositions: aggregate.revealedPositions,
      hintsRemaining: aggregate.hintsRemaining,
      timer: {
        roundEndTime: aggregate.roundEndTime,
        paused: aggregate.roundTimerPaused,
      },
    };
    if (aggregate.endReason !== null) round.endReason = aggregate.endReason;
    if (aggregate.phase === 'ROUND_FINISHED' && secret !== null) {
      round.word = secret.secretWord;
    }
    if (aggregate.phase === 'STARTING' && aggregate.startingDeadline !== null) {
      round.startingDeadline = aggregate.startingDeadline;
    }
    if (aggregate.phase === 'ROUND_FINISHED' && aggregate.resultsDeadline !== null) {
      round.resultsDeadline = aggregate.resultsDeadline;
    }
    if (aggregate.phase === 'NEXT_ROUND' && aggregate.nextDrawerPlayerId !== null) {
      round.nextDrawerPlayerId = aggregate.nextDrawerPlayerId;
    }
    if (isDrawer && aggregate.phase === 'ROUND_ACTIVE' && secret !== null) {
      round.secretWord = secret.secretWord;
    }

    const snapshot: StateSnapshot = {
      type: 'response:state:snapshot',
      version,
      serverNow: this.services.clock.now(),
      room: {
        roomId: aggregate.roomId,
        roomCode: aggregate.code,
        roomName: aggregate.config.roomName,
        status: aggregate.status,
        hostPlayerId: aggregate.hostPlayerId,
        config: aggregate.config,
      },
      players,
      you: {
        playerId: requesterPlayerId,
        nickname: nicknameOf(requesterPlayerId),
        role: isDrawer && aggregate.phase === 'ROUND_ACTIVE' ? 'DRAWER' : 'GUESSER',
        score: youScore,
        hasGuessedCorrectly: correct.some((entry) => entry.playerId === requesterPlayerId),
      },
      game: {
        gameId: aggregate.gameId,
        phase: aggregate.phase,
        roundNumber: aggregate.roundNumber,
        roundsPlanned: aggregate.roundsPlanned,
      },
      round,
      correctGuessers: correct.map((entry) => ({
        playerId: entry.playerId,
        nickname: nicknameOf(entry.playerId),
        rank: entry.rank,
        points: 0,
      })),
      strokes: [],
      chat,
      scores,
      leaderboard,
    };

    // The one deletion step: never null the word, remove the property.
    if (!(isDrawer && aggregate.phase === 'ROUND_ACTIVE')) {
      delete snapshot.round.secretWord;
    }
    void sockets;
    return snapshot;
  }
}
