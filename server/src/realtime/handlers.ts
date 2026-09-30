/**
 * Client event handling (`realtime-contract.md` sections 5, 6, 10 and 11).
 *
 * The order is fixed and each step exists for a reason:
 *   1. Zod validation - a malformed payload never reaches a service;
 *   2. identity from the authenticated session, never from the payload
 *      (`realtime-contract.md` section 3);
 *   3. `eventId` dedupe - a duplicate replays the cached envelope instead of
 *      re-applying the action;
 *   4. authorization and membership, from server-held state only;
 *   5. the owning service performs the mutation inside the room commit, so the
 *      version bump and the broadcast happen in one critical section
 *      (`server-state-writer-map.md` section 3);
 *   6. exactly one ack envelope.
 *
 * The handlers take a `ClientSession` rather than a socket, so the whole event
 * surface is testable without a transport.
 */

import { SESSION_TTL_SECONDS } from '../../../shared/contract/constants.js';
import {
  ClearCanvasPayloadSchema,
  DrawEndPayloadSchema,
  DrawMovePayloadSchema,
  DrawStartPayloadSchema,
  GameStartPayloadSchema,
  HintRequestPayloadSchema,
  JoinRoomPayloadSchema,
  LeaveRoomPayloadSchema,
  RequestStateSnapshotPayloadSchema,
  SendChatPayloadSchema,
  SubmitGuessPayloadSchema,
} from '../../../shared/contract/schemas.js';
import { CLIENT_TO_SERVER_EVENTS, type ClientToServerEventName } from '../../../shared/contract/events.js';
import type { PublicPlayer } from '../../../shared/contract/types.js';
import { AppError } from '../errors.js';
import { bindSessionRoom, readAggregate, readMember } from '../redis/roomState.js';
import { RULES } from '../security/rules.js';
import { ackError, ackOk, type Ack, type RecentEventIds } from './envelope.js';
import { roomChannel } from './ioBus.js';
import type { Services } from '../game/services.js';
import type { Redis } from 'ioredis';

/**
 * The server's view of one live socket. `roomId` is set only by `join:room`;
 * presence begins there and nowhere earlier (`realtime-contract.md` section 2).
 */
export interface ClientSession {
  readonly playerId: string;
  readonly userId: string;
  readonly socketId: string;
  readonly token: string;
  roomId: string | null;
}

export interface RealtimeHandlers {
  handle(
    session: ClientSession,
    event: ClientToServerEventName,
    payload: unknown,
  ): Promise<Ack>;
}

interface ZodLike<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

function parseOrThrow<T>(schema: ZodLike<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('VALIDATION_ERROR');
  return parsed.data;
}

/** The `eventId` to correlate a failure ack with, even when the body is bad. */
function eventIdOf(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'eventId' in payload) {
    const value = (payload as { eventId?: unknown }).eventId;
    if (typeof value === 'string') return value;
  }
  return '';
}

/**
 * AD-004 instrumentation only (`testing-strategy.md` section 7.2). When the
 * client sends `_probe`, the ack echoes `t0` together with the server's receipt
 * (`t1`) and post-emit (`t2`) timestamps. Nothing reads these values, and a
 * client that omits `_probe` receives the unchanged ack.
 *
 * `t2` is taken after the owning service returns, i.e. after the broadcast was
 * issued: the emit is fire-and-forget, so there is no observable instant
 * "before" it from here. This is recorded as a deviation in `Execution.md`;
 * AD-004 remains unmeasured and nothing depends on the exact boundary.
 */
function probeFields(
  probe: { t0: number } | undefined,
  t1: number,
  t2: number,
): Record<string, unknown> {
  if (probe === undefined) return {};
  return { probe: { t0: probe.t0, t1, t2 } };
}

export function createHandlers(
  services: Services,
  recent: RecentEventIds,
): RealtimeHandlers {
  const redis: Redis = services.redis;

  /** The room the socket is bound to, or `NOT_ADMITTED`. */
  function requireRoom(session: ClientSession): string {
    if (session.roomId === null) throw new AppError('NOT_ADMITTED');
    return session.roomId;
  }

  /** Membership is re-checked from Redis, never assumed from the socket. */
  async function requireNickname(
    session: ClientSession,
    roomId: string,
  ): Promise<string> {
    const member = await readMember(redis, roomId, session.playerId);
    if (member === null) throw new AppError('NOT_ADMITTED');
    return member.nickname;
  }

  /** The drawer-only precondition for every `draw:*` and `canvas:clear`. */
  async function requireDrawer(
    session: ClientSession,
    roomId: string,
  ): Promise<void> {
    const aggregate = await readAggregate(redis, roomId);
    if (aggregate === null) throw new AppError('ROOM_NOT_FOUND');
    if (aggregate.phase !== 'ROUND_ACTIVE') throw new AppError('BAD_STATE');
    if (aggregate.drawerPlayerId !== session.playerId) {
      throw new AppError('NOT_DRAWER');
    }
  }

  async function joinRoom(
    session: ClientSession,
    payload: unknown,
  ): Promise<Ack> {
    const body = parseOrThrow(JoinRoomPayloadSchema, payload);
    const room = await services.rooms.findActiveRoomByCode(body.roomCode);
    if (room === null) throw new AppError('ROOM_NOT_FOUND');
    if (room.status === 'CLOSED') throw new AppError('ROOM_CLOSED');

    // Only an admitted member may bind: a socket never admits itself.
    const bound = await services.rooms.bindSocket(
      room.id,
      session.playerId,
      session.socketId,
    );
    session.roomId = room.id;
    await bindSessionRoom(redis, session.token, room.id, SESSION_TTL_SECONDS);

    const version = await services.readVersion(room.id);
    const me: PublicPlayer | undefined = bound.payload.players.find(
      (player) => player.playerId === session.playerId,
    );
    if (me !== undefined) {
      const notice = bound.wasReconnect
        ? {
            type: 'player:reconnected' as const,
            playerId: session.playerId,
            version,
          }
        : { type: 'player:joined' as const, player: me, version };
      services.bus.toRoom(
        room.id,
        bound.wasReconnect ? 'player:reconnected' : 'player:joined',
        notice,
      );
    }
    return ackOk(body.eventId, version, {
      channel: roomChannel(room.id),
      room: bound.payload.room,
      you: bound.payload.you,
      reconnected: bound.wasReconnect,
    });
  }

  async function leaveRoom(
    session: ClientSession,
    payload: unknown,
  ): Promise<Ack> {
    const body = parseOrThrow(LeaveRoomPayloadSchema, payload);
    const roomId = session.roomId;
    if (roomId === null) {
      // Leaving twice is not an error; it is already true.
      return ackOk(body.eventId, 0, { left: false });
    }
    await services.rooms.leave(roomId, session.playerId);
    session.roomId = null;
    return ackOk(body.eventId, await services.readVersion(roomId), {
      left: true,
    });
  }

  async function startGame(
    session: ClientSession,
    payload: unknown,
  ): Promise<Ack> {
    const body = parseOrThrow(GameStartPayloadSchema, payload);
    const roomId = requireRoom(session);
    await requireNickname(session, roomId);
    await services.stateMachine.startGame(roomId, session.playerId);
    return ackOk(body.eventId, await services.readVersion(roomId));
  }

  async function requestHint(
    session: ClientSession,
    payload: unknown,
  ): Promise<Ack> {
    const body = parseOrThrow(HintRequestPayloadSchema, payload);
    const roomId = requireRoom(session);
    const { version, result } = await services.commit(
      roomId,
      async (commitVersion) =>
        services.hints.request(roomId, session.playerId, commitVersion),
    );
    return ackOk(body.eventId, version, {
      maskedWord: result.maskedWord,
      revealedPositions: result.revealedPositions,
      hintsRemaining: result.hintsRemaining,
    });
  }

  async function submitGuess(
    session: ClientSession,
    payload: unknown,
  ): Promise<Ack> {
    const body = parseOrThrow(SubmitGuessPayloadSchema, payload);
    const roomId = requireRoom(session);
    const nickname = await requireNickname(session, roomId);
    const { version, result } = await services.commit(
      roomId,
      async (commitVersion) =>
        services.guesses.evaluate(
          roomId,
          session.playerId,
          nickname,
          body.guess,
          commitVersion,
        ),
    );
    return ackOk(body.eventId, version, {
      result: result.result,
      rank: result.rank,
      points: result.points,
      correctCount: result.correctCount,
    });
  }

  async function sendChat(
    session: ClientSession,
    payload: unknown,
  ): Promise<Ack> {
    const body = parseOrThrow(SendChatPayloadSchema, payload);
    const roomId = requireRoom(session);
    const nickname = await requireNickname(session, roomId);
    const { version, result } = await services.commit(
      roomId,
      async (commitVersion) =>
        services.chat.send(
          roomId,
          session.playerId,
          nickname,
          body.text,
          commitVersion,
        ),
    );
    return ackOk(body.eventId, version, { messageId: result.id });
  }

  async function drawStart(
    session: ClientSession,
    payload: unknown,
  ): Promise<Ack> {
    const body = parseOrThrow(DrawStartPayloadSchema, payload);
    const roomId = requireRoom(session);
    await requireDrawer(session, roomId);
    const receivedAt = services.clock.now();
    const version = await services.readVersion(roomId);
    const applied = await services.drawing.start(
      roomId,
      {
        strokeId: body.strokeId,
        strokeSeq: body.strokeSeq,
        color: body.color,
        brushSize: body.brushSize,
        points: body.points,
      },
      version,
      session.playerId,
    );
    return ackOk(body.eventId, version, {
      applied,
      ...probeFields(body._probe, receivedAt, services.clock.now()),
    });
  }

  async function drawMove(
    session: ClientSession,
    payload: unknown,
  ): Promise<Ack> {
    const body = parseOrThrow(DrawMovePayloadSchema, payload);
    const roomId = requireRoom(session);
    await requireDrawer(session, roomId);
    const receivedAt = services.clock.now();
    const version = await services.readVersion(roomId);
    const applied = await services.drawing.move(
      roomId,
      {
        strokeId: body.strokeId,
        pointIndex: body.pointIndex,
        points: body.points,
      },
      version,
    );
    return ackOk(body.eventId, version, {
      applied,
      ...probeFields(body._probe, receivedAt, services.clock.now()),
    });
  }

  async function drawEnd(
    session: ClientSession,
    payload: unknown,
  ): Promise<Ack> {
    const body = parseOrThrow(DrawEndPayloadSchema, payload);
    const roomId = requireRoom(session);
    await requireDrawer(session, roomId);
    const version = await services.readVersion(roomId);
    const applied = await services.drawing.end(
      roomId,
      body.strokeId,
      version,
    );
    return ackOk(body.eventId, version, { applied });
  }

  async function clearCanvas(
    session: ClientSession,
    payload: unknown,
  ): Promise<Ack> {
    const body = parseOrThrow(ClearCanvasPayloadSchema, payload);
    const roomId = requireRoom(session);
    await requireDrawer(session, roomId);
    const aggregate = await readAggregate(redis, roomId);
    const roundNumber = aggregate?.roundNumber ?? 0;
    const version = await services.readVersion(roomId);
    await services.drawing.clear(roomId, version, roundNumber, session.playerId);
    return ackOk(body.eventId, version, { cleared: true });
  }

  async function requestSnapshot(
    session: ClientSession,
    payload: unknown,
  ): Promise<Ack> {
    const body = parseOrThrow(RequestStateSnapshotPayloadSchema, payload);
    const roomId = requireRoom(session);
    const allowed = await services.limiter.consume(
      'snapshot',
      session.socketId,
      RULES.snapshot,
      services.clock.now(),
    );
    if (!allowed) throw new AppError('RATE_LIMITED');
    const snapshot = await services.projector.project(
      roomId,
      session.playerId,
    );
    if (snapshot === null) throw new AppError('ROOM_CLOSED');
    // The snapshot is always re-sent, so a lost frame is self-healing; the
    // client applies it only when `version >= lastAppliedVersion`.
    services.bus.toSocket(session.socketId, 'response:state:snapshot', snapshot);
    void body.lastVersion;
    return ackOk(body.eventId, snapshot.version, {
      serverNow: snapshot.serverNow,
    });
  }

  const routes: Record<
    ClientToServerEventName,
    (session: ClientSession, payload: unknown) => Promise<Ack>
  > = {
    'join:room': joinRoom,
    'leave:room': leaveRoom,
    'game:start': startGame,
    'hint:request': requestHint,
    'guess:submit': submitGuess,
    'chat:message': sendChat,
    'draw:start': drawStart,
    'draw:move': drawMove,
    'draw:end': drawEnd,
    'canvas:clear': clearCanvas,
    'request:state:snapshot': requestSnapshot,
  };

  return {
    async handle(session, event, payload) {
      const eventId = eventIdOf(payload);
      let ack: Ack;
      try {
        if (!isClientEvent(event)) throw new AppError('VALIDATION_ERROR');
        ack = await routes[event](session, payload);
      } catch (error) {
        ack = ackError(eventId, error);
      }
      // A retryable failure is deliberately NOT cached: the client is invited
      // to retry it, and replaying the failure would defeat the retry
      // (`realtime-contract.md` section 11).
      if (ack.ok === true || ack.retryable === false) {
        recent.remember(session.playerId, eventId, ack);
      }
      return ack;
    },
  };
}

export function isClientEvent(value: string): value is ClientToServerEventName {
  return (CLIENT_TO_SERVER_EVENTS as readonly string[]).includes(value);
}