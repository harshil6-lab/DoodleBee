/**
 * Scoring (`testing-strategy.md` section 2, "Scoring").
 *
 * The rank table and the drawer rule are decided; the drawer bonus magnitude is
 * PROPOSED (C-07) and is asserted through the injectable table rather than by
 * hardcoding the proposal.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCORE_TABLE,
  drawerPointsFor,
  pointsForRank,
  type ScoreTable,
} from '../../src/game/scoring.js';

describe('pointsForRank', () => {
  it('matches the PRD rank table for 1st through 8th', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((rank) => pointsForRank(rank))).toEqual([
      500, 350, 100, 50, 15, 2, 0, 0,
    ]);
  });

  it('scores a rank beyond the table as 0 instead of throwing', () => {
    expect(pointsForRank(9)).toBe(0);
    expect(pointsForRank(99)).toBe(0);
  });

  it('scores a non-positive or non-integer rank as 0', () => {
    expect(pointsForRank(0)).toBe(0);
    expect(pointsForRank(-1)).toBe(0);
    expect(pointsForRank(1.5)).toBe(0);
  });

  it('honours a configured table override', () => {
    const table: ScoreTable = {
      rankPoints: [10, 5],
      drawerBonusPerGuesser: 1,
    };
    expect(pointsForRank(1, table)).toBe(10);
    expect(pointsForRank(3, table)).toBe(0);
  });
});

describe('drawerPointsFor', () => {
  it("is correctCount x bonus for a completed round", () => {
    expect(drawerPointsFor(0, 'ALL_GUESSERS_CORRECT')).toBe(0);
    expect(drawerPointsFor(3, 'ALL_GUESSERS_CORRECT')).toBe(
      3 * DEFAULT_SCORE_TABLE.drawerBonusPerGuesser,
    );
  });

  it('pays nothing when the drawer abandoned the round (D03-012)', () => {
    expect(drawerPointsFor(7, 'DRAWER_ABANDONED')).toBe(0);
  });

  it('never pays a negative amount for degenerate input', () => {
    expect(drawerPointsFor(-3, 'TIMER_EXPIRED')).toBe(0);
    expect(drawerPointsFor(Number.NaN, 'TIMER_EXPIRED')).toBe(0);
  });
});