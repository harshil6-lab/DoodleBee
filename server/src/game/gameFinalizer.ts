/**
 * Game completion (`state-machine.md` section 3.6, D03-012).
 *
 * The single writer of `game.finalRankings[]` and `game.winnerId`. Rankings are
 * deterministic (`server-state-writer-map.md` section 4): score, then 1st-place
 * round finishes, then total guess points, then lowest `playerId`. The
 * tie-break inputs come from the persisted `scores` rows, so the emitted
 * `game:finished` matches what was written.
 */

import { eq } from 'drizzle-orm';
import { gameResults, games, scores as scoresTable } from '../db/schema.js';
import { AppError } from '../errors.js';
import {
  appendOutbox,
  readAggregate,
  readMembers,
  readScores,
  writeAggregate,
} from '../redis/roomState.js';
import type { Services } from './services.js';

interface Tiebreak {
  firsts: number;
  guessPoints: number;
}

export class GameFinalizer {
  constructor(private readonly services: Services) {}

  async finishGame(roomId: string): Promise<void> {
    const members = await readMembers(this.services.redis, roomId);
    const tiebreak = new Map<string, Tiebreak>();
    const { version, result } = await this.services.commit(roomId, async (v) => {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null) throw new AppError('ROOM_NOT_FOUND');
      const gameId = aggregate.gameId;
      if (gameId === null) throw new AppError('BAD_STATE');
      const finalScores = await readScores(this.services.redis, roomId);

      const rows = await this.services.db.db
        .select({
          userId: scoresTable.userId,
          points: scoresTable.points,
          rank: scoresTable.rankInRound,
        })
        .from(scoresTable)
        .where(eq(scoresTable.gameId, gameId));
      for (const row of rows) {
        if (row.rank === null || row.rank === 0) continue;
        const entry = tiebreak.get(row.userId) ?? { firsts: 0, guessPoints: 0 };
        if (row.rank === 1) entry.firsts += 1;
        entry.guessPoints += row.points;
        tiebreak.set(row.userId, entry);
      }

      const ordered = members
        .map((member) => ({
          playerId: member.playerId,
          nickname: member.nickname,
          score: finalScores[member.playerId] ?? 0,
          firsts: tiebreak.get(member.playerId)?.firsts ?? 0,
          guessPoints: tiebreak.get(member.playerId)?.guessPoints ?? 0,
        }))
        .sort(
          (left, right) =>
            right.score - left.score ||
            right.firsts - left.firsts ||
            right.guessPoints - left.guessPoints ||
            left.playerId.localeCompare(right.playerId),
        );
      const rankings = ordered.map((entry, index) => ({
        playerId: entry.playerId,
        nickname: entry.nickname,
        rank: index + 1,
        score: entry.score,
      }));
      const winnerId = rankings[0]?.playerId ?? '';

      aggregate.phase = 'GAME_FINISHED';
      aggregate.status = 'WAITING';
      aggregate.gameStatus = 'FINISHED';
      aggregate.resultsDeadline = null;
      aggregate.roundEndTime = null;
      aggregate.roundTimerPaused = false;
      await writeAggregate(this.services.redis, aggregate);

      const now = new Date(this.services.clock.now());
      try {
        await this.services.db.db.transaction(async (tx) => {
          await tx
            .update(games)
            .set({ endedAt: now, status: 'FINISHED' })
            .where(eq(games.id, gameId));
          await tx
            .insert(gameResults)
            .values(
              rankings.map((entry) => ({
                gameId,
                userId: entry.playerId,
                finalScore: entry.score,
                finalRank: entry.rank,
                isWinner: entry.playerId === winnerId,
              })),
            )
            .onConflictDoNothing();
        });
      } catch (error) {
        this.services.logger.error(
          { err: error, roomId, gameId },
          'game-end persistence failed; queued in outbox',
        );
        await appendOutbox(this.services.redis, roomId, { kind: 'game-end', gameId });
      }

      this.services.bus.toRoom(roomId, 'game:finished', {
        type: 'game:finished',
        finalScores,
        rankings,
        winnerId,
        version: v,
      });
      return rankings;
    });
    void version;
    void result;
  }
}
