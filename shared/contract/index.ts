/**
 * DoodleBee shared contract (Stage 03 decision D03-023).
 *
 * This directory is the single source of truth for the client/server contract.
 * It is consumed directly by the server and copied VERBATIM into the client by
 * `scripts/contract.mjs` (`npm run contract:sync`), with `contract:check`
 * failing CI on any drift.
 *
 * Rules:
 * - no imports outside `zod` (the client must be able to compile the copy);
 * - no secret-bearing field outside the two allow-listed payloads
 *   (`security-model.md` section 3);
 * - generated copies must not be hand-edited.
 */

export * from './constants.js';
export * from './errors.js';
export * from './events.js';
export * from './schemas.js';
export * from './server-payloads.js';
export * from './snapshot.js';
export * from './types.js';
