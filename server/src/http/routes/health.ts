/**
 * `GET /health` (`api-contract.md` section 3.7).
 *
 * Returns `503` rather than `200` with a flag so a load balancer can act
 * without parsing the body. No version string is exposed.
 */

import type { FastifyInstance } from 'fastify';
import type { Services } from '../../game/services.js';

export function registerHealthRoutes(
  app: FastifyInstance,
  services: Services,
): void {
  app.get('/health', async (_request, reply) => {
    const [postgres, redis] = await Promise.all([
      services.db.ping(),
      services.redis.ping().then((value) => value === 'PONG'),
    ]);
    const status = postgres && redis ? 'ok' : 'down';
    return reply.code(status === 'ok' ? 200 : 503).send({
      status,
      uptimeSeconds: Math.floor(process.uptime()),
      dependencies: {
        postgres: postgres ? 'ok' : 'down',
        redis: redis ? 'ok' : 'down',
      },
    });
  });
}
