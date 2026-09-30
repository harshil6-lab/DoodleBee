/**
 * Guess correctness and near-match (`CLOSE`) computation (D03-017,
 * `security-model.md` section 3.4).
 *
 * Pure and shared by the live path and any offline verification, so the two can
 * never disagree. Nothing here returns or logs the word: `isCloseGuess` yields a
 * boolean only, which is why a near-miss cannot be used to read the answer out
 * one character at a time.
 */

/** NFKC, case-fold, punctuation -> space, collapse, trim. */
export function normalizeForMatch(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Exact match against the word or any curated alias (D03-017). */
export function isCorrectGuess(
  guess: string,
  word: string,
  aliases: readonly string[] = [],
): boolean {
  const normalized = normalizeForMatch(guess);
  if (normalized.length === 0) return false;
  if (normalized === normalizeForMatch(word)) return true;
  return aliases.some((alias) => normalizeForMatch(alias) === normalized);
}

/** Standard Levenshtein distance over code points. */
export function levenshtein(a: string, b: string): number {
  const left = [...a];
  const right = [...b];
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    const current: number[] = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const substitution =
        (previous[j - 1] ?? 0) + (left[i - 1] === right[j - 1] ? 0 : 1);
      const insertion = (current[j - 1] ?? 0) + 1;
      const deletion = (previous[j] ?? 0) + 1;
      current.push(Math.min(substitution, insertion, deletion));
    }
    previous = current;
  }
  return previous[right.length] ?? 0;
}

/**
 * PROPOSED (C-09): the distance that counts as "close". No approved value
 * exists; it scales with word length so short words are not swamped.
 */
export function closeThreshold(wordLength: number): number {
  if (wordLength <= 4) return 1;
  if (wordLength <= 8) return 2;
  return 3;
}

/**
 * A near-match. A correct guess is never merely close, so the response can only
 * ever distinguish "close" from "not close" for the submitter's own text.
 */
export function isCloseGuess(
  guess: string,
  word: string,
  aliases: readonly string[] = [],
): boolean {
  if (isCorrectGuess(guess, word, aliases)) return false;
  const normalized = normalizeForMatch(guess);
  if (normalized.length === 0) return false;
  const target = normalizeForMatch(word);
  if (target.length === 0) return false;
  return levenshtein(normalized, target) <= closeThreshold(target.length);
}
