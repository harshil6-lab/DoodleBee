/**
 * Hint generation (`testing-strategy.md` section 2, "Hint generation").
 *
 * The masking algorithm and format are PROPOSED (C-08); the invariants - never
 * the whole word, monotonic growth, stable positions - are what the contract
 * actually needs.
 */

import { describe, expect, it } from 'vitest';
import { maskWord, maxRevealable } from '../../src/game/hints.js';

describe('maskWord', () => {
  const word = 'elephant';

  it('hides every letter with no hints used', () => {
    const result = maskWord(word, 0);
    expect(result.maskedWord).toBe('________');
    expect(result.revealedPositions).toEqual([]);
  });

  it('never reveals the whole word, however many hints are asked for', () => {
    for (const hints of [1, 2, 3, 4, 5, 50]) {
      const { maskedWord, revealedPositions } = maskWord(word, hints);
      expect(revealedPositions.length).toBeLessThanOrEqual(
        maxRevealable(word),
      );
      expect(revealedPositions.length).toBeLessThan(word.length);
      expect(maskedWord).toContain('_');
    }
  });

  it('grows the reveal set monotonically and keeps positions stable', () => {
    // Positions are returned sorted for display, but the reveal *order* is
    // word-derived, so monotonicity is a superset relation, not a prefix.
    let previous: number[] = [];
    for (let hints = 0; hints <= 5; hints += 1) {
      const { revealedPositions } = maskWord(word, hints);
      for (const position of previous) {
        expect(revealedPositions).toContain(position);
      }
      expect(revealedPositions.length).toBeGreaterThanOrEqual(previous.length);
      previous = revealedPositions;
    }
    // And a letter, once revealed, stays revealed at a higher hint count.
    const once = maskWord(word, 1).revealedPositions;
    for (let hints = 1; hints <= 5; hints += 1) {
      for (const position of once) {
        expect(maskWord(word, hints).revealedPositions).toContain(position);
      }
    }
  });

  it('is deterministic for the same word and hint count', () => {
    expect(maskWord(word, 2)).toEqual(maskWord(word, 2));
  });

  it('preserves non-letters so a multi-word secret keeps its space', () => {
    const { maskedWord } = maskWord('ice cream', 0);
    expect(maskedWord).toBe('___ _____');
  });

  it('treats a non-positive hint count as no reveal', () => {
    expect(maskWord(word, -1).revealedPositions).toEqual([]);
    expect(maskWord(word, 0).revealedPositions).toEqual([]);
  });
});