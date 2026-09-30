/**
 * Scoring authority (D03-013, `server-state-writer-map.md` section 2.4).
 *
 * The single writer of `player.score`. It applies point *deltas* only; the
 * delta is computed from the PRD table in `scoring.ts` and nowhere else. Guess
 * points are awarded when the rank is assigned (so `guess:correct` can carry
 * them); the drawer bonus is awarded once at round end.
 */

import { addScore } from '../redis/roomState.js';
import { drawerPointsFor, pointsForRank } from './scoring.js';
import type { RoundEndReason } from '../../../shared/contract/types.js';
import type { Services } from './services.js';

export class ScoreService {
  constructor(private readonly services: Services) {}

  /** Points a correct guesser earns at `rank`, applied immediately. */
  async awardGuess(
    roomId: string,
    playerId: string,
    rank: number,
  ): Promise<number> {
    const points = pointsForRank(rank, this.services.scoreTable);
    if (points !== 0) {
      await addScore(this.services.redis, roomId, playerId, points);
    }
    return points;
  }

  /** The drawer bonus, applied once at round end (0 on `DRAWER_ABANDONED`). */
  async awardDrawer(
    roomId: string,
    drawerPlayerId: string,
    correctCount: number,
    endReason: RoundEndReason,
  ): Promise<number> {
    const points = drawerPointsFor(
      correctCount,
      endReason,
      this.services.scoreTable,
    );
    if (points !== 0) {
      await addScore(this.services.redis, roomId, drawerPlayerId, points);
    }
    return points;
  }
}
