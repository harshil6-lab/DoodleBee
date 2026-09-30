/**
 * Room REST surface (`api-contract.md` section 3.3-3.5).
 *
 * REST handles request/response only. Admission lives here; presence and
 * gameplay live on the socket.
 */

import { SESSION_TTL_SECONDS } from '../../../../shared/contract/constants.js';
import {
  RoomCodeSchema,
  RoomConfigPatchSchema,
  RoomConfigSchema,
} from '../../../../shared/contract/schemas.js';
import { AppError } from '../../errors.js';
import { authenticate } from '../auth.js';
import { RULES } from '../../security/rules.js';
import { bindSessionRoom, readAggregate } from '../../redis/roomState.js';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../../game/services.js';

export function registerRoomRoutes(
  app: FastifyInstance,
  services: Services,
): void {
  app.post('/rooms', async (request, reply) => {
    const { session } = await authenticate(services, request);
    const now = services.clock.now();
    const perSession = await services.limiter.consume(
      'roomCreate:session',
      session.userId,
      RULES.roomCreateSession,
      now,
    );
    const perIp = await services.limiter.consume(
      'roomCreate:ip',
      request.ip,
      RULES.roomCreateIp,
      now,
    );
    if (!perSession || !perIp) throw new AppError('RATE_LIMITED');

    const parsed = RoomConfigSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR');
    const nickname = await services.session.nicknameOf(session.userId);
    const created = await services.rooms.createRoom(
      { playerId: session.playerId, userId: session.userId, nickname },
      parsed.data,
    );
    return reply.code(201).send(created);
  });

  app.post('/rooms/join', async (request) => {
    const { session, token } = await authenticate(services, request);
    const allowed = await services.limiter.consume(
      'roomJoin',
      session.userId,
      RULES.roomJoin,
      services.clock.now(),
    );
    if (!allowed) throw new AppError('RATE_LIMITED');
    const body = (request.body ?? {}) as { roomCode?: unknown };
    const parsed = RoomCodeSchema.safeParse(body.roomCode);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR');
    const nickname = await services.session.nicknameOf(session.userId);
    const result = await services.rooms.admit(parsed.data, {
      playerId: session.playerId,
      userId: session.userId,
      nickname,
    });
    await bindSessionRoom(
      services.redis,
      token,
      result.room.roomId,
      SESSION_TTL_SECONDS,
    );
    return result;
  });

  app.put('/rooms/:id/config', async (request) => {
    const { session } = await authenticate(services, request);
    const params = request.params as { id: string };
    const allowed = await services.limiter.consume(
      'configUpdate',
      params.id,
      RULES.configUpdate,
      services.clock.now(),
    );
    if (!allowed) throw new AppError('RATE_LIMITED');
    const patch = RoomConfigPatchSchema.safeParse(request.body);
    if (!patch.success) throw new AppError('VALIDATION_ERROR');
    const aggregate = await readAggregate(services.redis, params.id);
    if (aggregate === null) throw new AppError('ROOM_NOT_FOUND');
    const merged = RoomConfigSchema.safeParse({
      ...aggregate.config,
      ...patch.data,
    });
    if (!merged.success) throw new AppError('VALIDATION_ERROR');
    const config = await services.rooms.updateConfig(
      params.id,
      session.playerId,
      merged.data,
    );
    return { config };
  });
}
