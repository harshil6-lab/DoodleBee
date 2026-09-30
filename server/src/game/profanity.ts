/**
 * Display-only profanity masking (`security-model.md` section 5).
 *
 * Applied to text a client will render. It is deliberately NOT applied to the
 * guess-matching path: filtering a guess could turn a correct answer into a
 * false negative. The word list is PROPOSED and intentionally tiny; a curated
 * list is a product/ops concern, not an architecture decision.
 */

const BLOCKED = ['damn', 'hell', 'crap', 'idiot', 'stupid'];

const MASK = '\u2022';

/** Replace each blocked term (whole word, case-insensitive) with mask glyphs. */
export function profanityMask(text: string): string {
  let output = text;
  for (const term of BLOCKED) {
    const pattern = new RegExp('\\b' + term + '\\b', 'gi');
    output = output.replace(pattern, (match) => MASK.repeat(match.length));
  }
  return output;
}
