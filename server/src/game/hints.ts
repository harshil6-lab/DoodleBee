/**
 * Hint masking (D03-014, `server-state-writer-map.md` section 2.3).
 *
 * `maskWord` is the single pure function used by the live hint path and by the
 * snapshot path, so the two can never disagree about what a player has seen.
 * It never reveals the whole word, and the reveal set grows monotonically.
 *
 * The algorithm and the mask string format are PROPOSED (C-08): the PRD gives
 * one worked example and no rule.
 */

export interface MaskResult {
  maskedWord: string;
  revealedPositions: number[];
}

/** FNV-1a over `text` seeded by `index`: stable across processes and restarts. */
function positionHash(word: string, index: number): number {
  let hash = 0x811c9dc5 ^ index;
  for (let i = 0; i < word.length; i += 1) {
    hash ^= word.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** A stable, word-derived reveal order, so hints are reproducible. */
function revealOrder(word: string): number[] {
  return Array.from({ length: word.length }, (_, index) => index).sort((a, b) => {
    const ha = positionHash(word, a);
    const hb = positionHash(word, b);
    return ha === hb ? a - b : ha - hb;
  });
}

/** The most letters any number of hints may reveal: never the whole word. */
export function maxRevealable(word: string): number {
  const letters = [...word].filter((ch) => /\p{L}/u.test(ch)).length;
  return Math.max(0, Math.min(letters - 1, Math.ceil(letters / 2)));
}

/**
 * The masked representation after `hintsUsed` hints.
 *
 * Format (PROPOSED): one character per position of the word, `_` for a hidden
 * letter, the letter itself when revealed, and any non-letter preserved as-is
 * so a multi-word secret keeps its space. `revealedPositions` accompanies it so
 * a client never has to parse the string.
 */
export function maskWord(word: string, hintsUsed: number): MaskResult {
  const characters = [...word];
  const limit = Math.max(0, Math.floor(hintsUsed));
  const revealCount = Math.min(limit, maxRevealable(word));
  const positions = revealOrder(word)
    .filter((index) => /\p{L}/u.test(characters[index] ?? ''))
    .slice(0, revealCount)
    .sort((a, b) => a - b);
  const revealed = new Set(positions);
  const maskedWord = characters
    .map((ch, index) => {
      if (!/\p{L}/u.test(ch)) return ch;
      return revealed.has(index) ? ch : '_';
    })
    .join('');
  return { maskedWord, revealedPositions: positions };
}
