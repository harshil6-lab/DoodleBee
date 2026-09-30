/**
 * `GET /settings` (`api-contract.md` section 3.6).
 *
 * Read-only defaults so the create-room form and the server agree on one set of
 * bounds. The default *values* are PROPOSED; the bounds are the shared
 * constants the server validates against.
 */

import {
  MAX_HINTS,
  MAX_PLAYERS,
  MAX_ROUND_DURATION_SECONDS,
  MAX_ROUNDS,
  MIN_HINTS,
  MIN_PLAYERS,
  MIN_ROUND_DURATION_SECONDS,
  MIN_ROUNDS,
} from '../../../../shared/contract/constants.js';
import type { FastifyInstance } from 'fastify';

export function registerSettingsRoutes(app: FastifyInstance): void {
  app.get('/settings', async () => ({
    defaults: {
      roomName: 'My Room',
      maxPlayers: 8,
      rounds: 3,
      roundDuration: 80,
      hints: 2,
    },
    limits: {
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      minRounds: MIN_ROUNDS,
      maxRounds: MAX_ROUNDS,
      minRoundDuration: MIN_ROUND_DURATION_SECONDS,
      maxRoundDuration: MAX_ROUND_DURATION_SECONDS,
      minHints: MIN_HINTS,
      maxHints: MAX_HINTS,
    },
  }));
}
