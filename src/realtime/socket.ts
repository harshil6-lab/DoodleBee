/**
 * Socket.IO client foundation (D04-001).
 *
 * One singleton Socket.IO instance per app lifecycle, default namespace `/`,
 * auth token passed as `handshake.auth.token`. No duplicate instances.
 * Safe cleanup via disconnect().
 *
 * Event names are exact literals from `shared/contract/events.ts` — never
 * invented or renamed. Payload shapes follow `realtime-contract.md` §6.
 */
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEventName,
  ServerToClientEventName,
} from '../../shared/contract/events';
import { env } from '../config/env';

// --------------------------------------------------------------------- Types ----

/** Ack envelope for every client→server event (`realtime-contract.md` §10.1). */
export interface AckResponseBase {
  ok: true;
  eventId: string;
  version: number;
}

/** Generic ack that extends the base with event-specific data. */
export type AckResponse<TData = object> = AckResponseBase & TData;

export interface AckError {
  ok: false;
  eventId: string;
  code: string;
  message: string;
  retryable: boolean;
}

export type AckResult<TData = unknown> = AckResponse<TData> | AckError;

/** Callback shape passed to every outgoing emit. */
export type AckCallback<TData = unknown> = (result: AckResult<TData>) => void;

// ---------------------------------------------------------------- Singleton ---

let _socket: Socket | null = null;

/**
 * The single Socket.IO instance. Never called twice without a prior
 * disconnect — callers must check `isConnected()` first.
 */
function getSocket(): Socket {
  if (!_socket) {
    throw new Error(
      'Socket not initialized. Call connectSocket(token) before using the client.',
    );
  }
  return _socket;
}

// ------------------------------------------------------------------ Connect ----

/**
 * Create (or reuse if already connected) the singleton socket.
 *
 * @param token - opaque bearer token from POST /session (D04-017).
 *   Pass empty string to connect anonymously (e.g. health-check paths).
 */
export function connectSocket(token: string): Socket {
  if (_socket && _socket.connected) {
    return _socket;
  }

  // Close any stale instance (reconnect after explicit disconnect).
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }

  const url = env.socketUrl;
  if (!url) {
    throw new Error(
      'Socket URL not configured. Set EXPO_PUBLIC_SOCKET_URL in your environment.',
    );
  }

  _socket = io(url, {
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 20000,
  });

  return _socket;
}

// ------------------------------------------------------------------- Disconnect -

/**
 * Disconnect and release the singleton. Safe to call when already disconnected.
 * Clears all listeners to prevent memory leaks.
 */
export function disconnectSocket(): void {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
}

// ------------------------------------------------------------------- Status ----

export function isConnected(): boolean {
  return _socket !== null && _socket.connected;
}

// ---------------------------------------------------------- Outgoing events ---

/**
 * Emit a client→server event with an optional ack callback.
 * Auto-generates `eventId` for idempotency (D03-005).
 *
 * Type-safe: `event` is constrained to `ClientToServerEventName`.
 */
export function emit<Event extends ClientToServerEventName>(
  event: Event,
  payload: unknown,
  callback?: AckCallback,
): string {
  const socket = getSocket();
  const eventId = crypto.randomUUID();
  const enriched = { eventId, ...(payload as Record<string, unknown>) };
  socket.emit(event, enriched, callback);
  return eventId;
}

/** Emit without waiting for an ack (fire-and-forget). */
export function emitWithoutAck<Event extends ClientToServerEventName>(
  event: Event,
  payload: unknown,
): string {
  return emit(event, payload);
}

// -------------------------------------------------------- Room membership ----

/** Join the given room. Server binds the socket to `room:{roomId}`. */
export function joinRoom(roomId: string): string {
  return emit('join:room', { roomCode: roomId } as unknown);
}

/** Leave the current room. */
export function leaveRoom(): string {
  return emit('leave:room', {});
}

// --------------------------------------------------- Incoming event helpers --

/**
 * Register a listener for a single server→client event.
 * Returns a cleanup function.
 */
export function on<Event extends ServerToClientEventName>(
  event: Event,
  handler: (...args: unknown[]) => void,
): () => void {
  const socket = getSocket();
  (socket as Socket).on(event as string, handler);
  return () => {
    (socket as Socket).off(event as string, handler);
  };
}

/**
 * Register handlers for multiple events at once.
 * Returns a cleanup function that removes all registered handlers.
 */
export function onMany(
  handlers: Partial<Record<ServerToClientEventName, (...args: Array<unknown>) => void>>,
): () => void {
  const socket = getSocket();
  for (const [event, handler] of Object.entries(handlers)) {
    if (handler) {
      (socket as Socket).on(event as string, handler as (...args: Array<unknown>) => void);
    }
  }
  return () => {
    for (const event of Object.keys(handlers) as ServerToClientEventName[]) {
      const h = handlers[event];
      if (h) {
        (socket as Socket).off(event, h as (...args: Array<unknown>) => void);
      }
    }
  };
}

// --------------------------------------------------------- Lifecycle events ----

/** Listen for the Socket.IO-level `connect` event. */
export function onConnect(handler: () => void): () => void {
  const socket = getSocket();
  socket.on('connect', handler);
  return () => socket.off('connect', handler);
}

/** Listen for the Socket.IO-level `disconnect` event. */
export function onDisconnect(handler: (reason: string, _description?: unknown) => void): () => void {
  const socket = getSocket();
  (socket as Socket).on('disconnect', handler as (...args: Array<unknown>) => void);
  return () => {
    (socket as Socket).off('disconnect', handler as (...args: Array<unknown>) => void);
  };
}

/** Listen for the Socket.IO-level `reconnect` event. */
export function onReconnect(handler: (reason: unknown) => void): () => void {
  const socket = getSocket();
  socket.on('reconnect', handler);
  return () => socket.off('reconnect', handler);
}

/** Listen for the Socket.IO-level `reconnect_failed` event. */
export function onReconnectFailed(handler: () => void): () => void {
  const socket = getSocket();
  socket.on('reconnect_failed', handler);
  return () => socket.off('reconnect_failed', handler);
}

// ---------------------------------------------------------- Public API -------

export { getSocket };
