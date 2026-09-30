/**
 * The Socket.IO transport (`realtime-contract.md` sections 1, 2, 5 and 11).
 *
 * This module is deliberately thin. It resolves identity once at handshake
 * time, then hands every event to `createHandlers`, which owns validation,
 * authorization and the single ack envelope. Nothing here reads or writes game
 * state, so the transport can never become a second source of truth
 * (`server-state-writer-map.md` section 2.5).
 *
 * The one piece of state the transport keeps is the socket's own channel
 * membership. It mirrors `session.roomId`; `room:{roomId}` membership is the
 * only thing `io.to(...)` needs, and losing it costs a re-`join:room`.
 */

import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  MAX_HTTP_BUFFER_SIZE,
  PROTOCOL_VIOLATION_LIMIT,
} from '../../../shared/contract/constants.js';
import type { ConnectionLostCode, ErrorCode } from '../../../shared/contract/errors.js';
import { ERROR_USER_MESSAGE } from '../../../shared/contract/errors.js';
import {
  CLIENT_TO_SERVER_EVENTS,
  type ClientToServerEventName,
} from '../../../shared/contract/events.js';
import type { Services } from '../game/services.js';
import { readSockets } from '../redis/roomState.js';
import type { Ack } from './envelope.js';
import { RecentEventIds } from './envelope.js';
import { createHandlers, type ClientSession } from './handlers.js';
import { roomChannel } from './ioBus.js';

/** Everything stashed on the socket. Identity only; never authoritative. */
interface SocketData {
  playerId?: string;
  userId?: string;
  token?: string;
  roomId?: string | null;
  /** Set by the handshake middleware when the token cannot be trusted. */
  rejection?: ConnectionLostCode;
}

export interface RealtimeServerHandle {
  readonly io: Server;
  /** Tell every live socket the server is going away, then stop listening. */
  shutdown(): Promise<void>;
}

function connectionLost(code: ConnectionLostCode, retryable: boolean) {
  return { type: 'connection:lost' as const, code, retryable };
}

/** The `eventId` a cached envelope belongs to; `''` when the body is unusable. */
function eventIdOf(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'eventId' in payload) {
    const value = (payload as { eventId?: unknown }).eventId;
    if (typeof value === 'string') return value;
  }
  return '';
}

/**
 * The failures that count toward the per-socket violation threshold. Malformed
 * payloads (F-19) and unauthorized drawing (F-18) are the two the testing
 * strategy names; a legitimately rejected gameplay action is not a violation.
 */
function isProtocolViolation(code: ErrorCode): boolean {
  return code === 'VALIDATION_ERROR' || code === 'NOT_DRAWER';
}

function dataOf(socket: Socket): SocketData {
  return socket.data as SocketData;
}

function reply(socket: Socket, ack: unknown, envelope: Ack): void {
  if (typeof ack !== 'function') return;
  try {
    (ack as (value: Ack) => void)(envelope);
  } catch (error) {
    // The peer vanished between receipt and reply. The action was still
    // applied and remembered, so a retry with the same `eventId` replays the
    // envelope instead of re-applying it (`realtime-contract.md` section 11).
    void error;
  }
}

/**
 * Create the Socket.IO server on the Fastify HTTP server.
 *
 * `connectionStateRecovery` is intentionally NOT enabled. It is only an
 * optimisation (`realtime-contract.md` section 2.2); the contract requires
 * `join:room` on every (re)connect, and a recovered socket that skipped the
 * middlewares would bypass the room binding. The authoritative restore path is
 * `request:state:snapshot`, which is enough on its own.
 */
export function createSocketIoServer(httpServer: HttpServer): Server {
  return new Server(httpServer, {
    // The transport half of the same bound the Zod schemas enforce
    // (`security-model.md` section 6).
    maxHttpBufferSize: MAX_HTTP_BUFFER_SIZE,
  });
}

/** Wire auth, event dispatch and presence onto an existing Socket.IO server. */
export function attachRealtime(
  io: Server,
  services: Services,
): RealtimeServerHandle {
  const recent = new RecentEventIds();
  const handlers = createHandlers(services, recent);

  io.use((socket, next) => {
    const raw = (socket.handshake.auth as { token?: unknown }).token;
    const token = typeof raw === 'string' ? raw.trim() : '';
    if (token.length === 0) {
      dataOf(socket).rejection = 'UNAUTHENTICATED';
      next();
      return;
    }
    services.session
      .resolve(token)
      .then((session) => {
        if (session === null) {
          dataOf(socket).rejection = 'SESSION_EXPIRED';
        } else {
          const data = dataOf(socket);
          data.playerId = session.playerId;
          data.userId = session.userId;
          data.token = token;
          data.roomId = session.roomId;
        }
        next();
      })
      .catch((error: unknown) => {
        services.logger.error({ err: error }, 'socket handshake failed');
        dataOf(socket).rejection = 'INTERNAL_ERROR';
        next();
      });
  });

  io.on('connection', (socket) => {
    const data = dataOf(socket);
    // A rejected handshake is told why and closed before any handler exists,
    // so it can never reach a room or a game handler
    // (`realtime-contract.md` section 2.1 rule 3).
    if (data.rejection !== undefined) {
      socket.emit('connection:lost', connectionLost(data.rejection, false));
      socket.disconnect(true);
      return;
    }
    attachSocket(socket, services, handlers, recent);
  });

  return {
    io,
    async shutdown() {
      const notice = connectionLost('SERVER_SHUTDOWN', true);
      for (const socket of io.sockets.sockets.values()) {
        socket.emit('connection:lost', notice);
      }
      // Let the queued frames reach the transport before it is torn down.
      await new Promise<void>((resolve) => setImmediate(resolve));
      io.disconnectSockets(true);
      // Closes Engine.IO only; the HTTP server stays owned by Fastify.
      io.engine.close();
    },
  };
}

function attachSocket(
  socket: Socket,
  services: Services,
  handlers: ReturnType<typeof createHandlers>,
  recent: RecentEventIds,
): void {
  const data = dataOf(socket);
  const session: ClientSession = {
    playerId: data.playerId ?? '',
    userId: data.userId ?? '',
    socketId: socket.id,
    token: data.token ?? '',
    roomId: data.roomId ?? null,
  };
  let joinedRoomId: string | null = null;
  let violations = 0;

  /** Mirror `session.roomId` onto Socket.IO channel membership. */
  async function syncMembership(): Promise<void> {
    const next = session.roomId;
    if (next === joinedRoomId) return;
    if (joinedRoomId !== null) await socket.leave(roomChannel(joinedRoomId));
    if (next !== null) await socket.join(roomChannel(next));
    joinedRoomId = next;
    data.roomId = next;
  }

  async function dispatch(
    event: ClientToServerEventName,
    payload: unknown,
    ack: unknown,
  ): Promise<void> {
    const eventId = eventIdOf(payload);
    const cached =
      eventId.length > 0 ? recent.recall(session.playerId, eventId) : undefined;
    if (cached !== undefined) {
      reply(socket, ack, cached);
      return;
    }

    let envelope: Ack;
    try {
      envelope = await handlers.handle(session, event, payload);
    } catch (error) {
      // `handle` already converts every expected failure; this is the last
      // line of defence so one bad event cannot kill the process.
      services.logger.error({ err: error, event }, 'realtime handler crashed');
      envelope = {
        ok: false,
        eventId,
        code: 'INTERNAL_ERROR',
        message: ERROR_USER_MESSAGE.INTERNAL_ERROR,
        retryable: true,
      };
    }

    try {
      await syncMembership();
    } catch (error) {
      services.logger.error({ err: error }, 'channel membership update failed');
    }

    if (envelope.ok === false && isProtocolViolation(envelope.code)) {
      // A malformed payload (or repeated unauthorized drawing) is a protocol
      // violation; a client that keeps sending them is disconnected rather
      // than served (`security-model.md` section 6, `testing-strategy.md`
      // F-18/F-19).
      violations += 1;
      if (violations >= PROTOCOL_VIOLATION_LIMIT) {
        services.logger.warn(
          { socketId: socket.id, violations },
          'protocol violation limit reached',
        );
        socket.disconnect(true);
        return;
      }
    }
    reply(socket, ack, envelope);
  }

  for (const event of CLIENT_TO_SERVER_EVENTS) {
    socket.on(event, (payload: unknown, ack: unknown) => {
      void dispatch(event, payload, ack);
    });
  }

  socket.on('disconnect', () => {
    void (async () => {
      const roomId = session.roomId;
      if (roomId === null) return;
      try {
        await services.presence.handleDisconnect(
          roomId,
          session.playerId,
          socket.id,
        );
        const remaining = await readSockets(
          services.redis,
          roomId,
          session.playerId,
        );
        // Presence has ended, so the dedupe cache for this player can go: a
        // new socket re-admits and starts a fresh `eventId` space.
        if (remaining.length === 0) recent.forget(session.playerId);
      } catch (error) {
        services.logger.error({ err: error }, 'disconnect handling failed');
      }
    })();
  });
}