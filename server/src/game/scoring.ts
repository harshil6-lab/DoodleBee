/**
 * Scoring authority (D03-013, `server-state-writer-map.md` section 2.4).
 *
 * Pure and deterministic: no clock, no I/O, no randomness. The point table is
 * the PRD's default (`docs/projectInfo.md` section 12). The drawer bonus
 * *magnitude* is PROPOSED (C-07, D03-013) and lives in one place so a product
 * decision changes exactly one constant. The *rule* that `DRAWER_ABANDONED`
 * pays 0 is decided (D03-012).
 */

import type { RoundEndReason } from '../../../shared/contract/types.js';

/** The PRD default rank table, 1st through 8th. */
export const DEFAULT_RANK_POINTS: readonly number[] = Object.freeze([
  500, 350, 100, 50, 15, 2, 0, 0,
]);

export interface ScoreTable {
  readonly rankPoints: readonly number[];
  /** PROPOSED (C-07): the drawer earns this per correct guesser. */
  readonly drawerBonusPerGuesser: number;
}

export const DEFAULT_SCORE_TABLE: ScoreTable = Object.freeze({
  rankPoints: DEFAULT_RANK_POINTS,
  drawerBonusPerGuesser: 50,
});

/**
 * Points for a 1-based guess rank. A rank beyond the table scores 0 rather than
 * throwing: an 8-player room has 7 guessers, and a 7th/8th place score of 0 is
 * the PRD's own value.
 */
export function pointsForRank(
  rank: number,
  table: ScoreTable = DEFAULT_SCORE_TABLE,
): number {
  if (!Number.isInteger(rank) || rank < 1) return 0;
  return table.rankPoints[rank - 1] ?? 0;
}

/** The drawer's round points, including the abandonment rule (D03-012). */
export function drawerPointsFor(
  correctCount: number,
  endReason: RoundEndReason,
  table: ScoreTable = DEFAULT_SCORE_TABLE,
): number {
  if (endReason === 'DRAWER_ABANDONED') return 0;
  const safeCount = Number.isFinite(correctCount) ? Math.max(0, correctCount) : 0;
  return safeCount * table.drawerBonusPerGuesser;
}
