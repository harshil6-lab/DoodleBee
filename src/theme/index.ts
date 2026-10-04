/**
 * Theme barrel. Components consume design tokens only (ADR AD-010) - no
 * hardcoded colors, spacing, radii, or timings in component files.
 */
export { tokens, fonts } from './tokens';
export type { Token } from './tokens';
export { fontAssets } from './fonts';
