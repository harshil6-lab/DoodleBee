/**
 * Word matching (`testing-strategy.md` section 2, "Word matching" and
 * "Near-match (CLOSE)").
 *
 * The CLOSE threshold is PROPOSED (C-09); the rules tested here are the
 * documented ones: normalization, aliases, and "a correct guess is never merely
 * close".
 */

import { describe, expect, it } from 'vitest';
import {
  closeThreshold,
  isCloseGuess,
  isCorrectGuess,
  levenshtein,
  normalizeForMatch,
} from '../../src/game/wordMatch.js';

describe('normalizeForMatch', () => {
  it('case folds and collapses whitespace', () => {
    expect(normalizeForMatch('  Ice   CREAM ')).toBe('ice cream');
  });

  it('strips trailing punctuation', () => {
    expect(normalizeForMatch('bicycle!')).toBe('bicycle');
  });

  it('applies NFKC normalization', () => {
    expect(normalizeForMatch('\uFB01re')).toBe('fire');
  });
});

describe('isCorrectGuess', () => {
  it('accepts an exact match', () => {
    expect(isCorrectGuess('bicycle', 'bicycle')).toBe(true);
  });

  it('accepts different case and spacing', () => {
    expect(isCorrectGuess('  BICYCLE! ', 'bicycle')).toBe(true);
    expect(isCorrectGuess('icecream', 'ice cream')).toBe(false);
    expect(isCorrectGuess('ice  cream', 'ice cream')).toBe(true);
  });

  it('accepts a configured alias', () => {
    expect(isCorrectGuess('bike', 'bicycle', ['bike'])).toBe(true);
    expect(isCorrectGuess('bike', 'bicycle')).toBe(false);
  });

  it('rejects a wrong word', () => {
    expect(isCorrectGuess('tricycle', 'bicycle')).toBe(false);
  });
});

describe('isCloseGuess', () => {
  it('never classifies a correct guess as merely close', () => {
    expect(isCloseGuess('bicycle', 'bicycle')).toBe(false);
    expect(isCloseGuess('Bicycle!', 'bicycle')).toBe(false);
    expect(isCloseGuess('bike', 'bicycle', ['bike'])).toBe(false);
  });

  it('accepts a one-edit mistake on a short word', () => {
    expect(isCloseGuess('catt', 'cats')).toBe(true);
  });

  it('scales the threshold with the target length', () => {
    expect(closeThreshold(3)).toBe(1);
    expect(closeThreshold(5)).toBe(2);
    expect(closeThreshold(12)).toBe(3);
  });

  it('rejects an unrelated word and an empty guess', () => {
    expect(isCloseGuess('elephant', 'cats')).toBe(false);
    expect(isCloseGuess('', 'cats')).toBe(false);
  });
});

describe('levenshtein', () => {
  it('is symmetric and zero only for equal strings', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('sitting', 'kitten')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});