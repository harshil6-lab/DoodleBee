/**
 * `POST /session` and `PUT /session/nickname` (`api-contract.md` section 3.1/3.2).
 */

import { NICKNAME_MAX_LENGTH } from '../../../../shared/contract/constants.js';
import { NicknameSchema } from '../../../../shared/contract/schemas.js';
import { AppError } from '../../errors.js';
import { authenticate } from '../auth.js';
import { RULES } from '../../security/rules.js';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../../game/services.js';

export function registerSessionRoutes(
  app: FastifyInstance,
  services: Services,
): void {
  app.post('/session', async (request, reply) => {
    const allowed = await services.limiter.consume(
      'session',
      request.ip,
      RULES.sessionCreate,
      services.clock.now(),
    );
    if (!allowed) throw new AppError('RATE_LIMITED');
    const created = await services.session.create();
    return reply.code(201).send({
      playerId: created.playerId,
      sessionToken: created.sessionToken,
      nickname: created.nickname,
    });
  });

  app.put('/session/nickname', async (request) => {
    const { session } = await authenticate(services, request);
    const allowed = await services.limiter.consume(
      'nickname',
      session.userId,
      RULES.nickname,
      services.clock.now(),
    );
    if (!allowed) throw new AppError('RATE_LIMITED');
    const body = (request.body ?? {}) as { nickname?: unknown };
    const parsed = NicknameSchema.safeParse(body.nickname);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR');
    const nickname = await services.session.setNickname(
      session.userId,
      parsed.data.slice(0, NICKNAME_MAX_LENGTH),
    );
    return { nickname };
  });
}
