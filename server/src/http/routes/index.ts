/**
 * Route registration. Six endpoints, plus the one endpoint Stage 03 adds
 * (`GET /health`) - no endpoint is added "for symmetry"
 * (`api-contract.md` section 2.1).
 */

import { registerHealthRoutes } from './health.js';
import { registerRoomRoutes } from './rooms.js';
import { registerSessionRoutes } from './session.js';
import { registerSettingsRoutes } from './settings.js';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../../game/services.js';

export function registerRoutes(app: FastifyInstance, services: Services): void {
  registerSessionRoutes(app, services);
  registerRoomRoutes(app, services);
  registerSettingsRoutes(app);
  registerHealthRoutes(app, services);
}
