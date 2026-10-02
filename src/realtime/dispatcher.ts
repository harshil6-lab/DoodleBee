/**
 * Realtime event dispatcher (D04-002).
 *
 * One centralized module that registers handlers for every server→client
 * event from `realtime-contract.md` §7. Each handler dispatches to the exact
 * Zustand store field specified by `server-state-writer-map.md` §2.
 *
 * Phase 0 implements handlers for events needed by the foundation layer
 * (connection lifecycle). Additional handlers are stubbed with WARN logs
 * so missing coverage is visible in dev builds.
 *
 * Secret-word rule (D04-004): payloads carrying `secretWord` may ONLY reach
 * drawer-private code paths. This dispatcher never passes a secret-bearing
 * payload to any store other than the drawer store singleton.
 */
import type { Socket } from 'socket.io-client';
import { useConnectionStore } from '../stores/connection.store';
import { useRoomStore } from '../stores/room.store';
import { useSessionStore } from '../stores/session.store';
import type { ServerToClientEventName } from '../../shared/contract/events';
import { logger } from '../utils/logger';

// ------------------------------------------------------------------ Version ---

let lastAppliedVersion = 0;

/**
 * Apply a payload only when its version is >= lastAppliedVersion.
 * Returns true if the payload was applied, false if stale/duplicate.
 */
function shouldApply(version: number): boolean {
  if (version < lastAppliedVersion) {
    logger.warn({ event: 'stale-payload', version, lastAppliedVersion });
    return false;
  }
  if (version === lastAppliedVersion) {
    logger.debug({ event: 'duplicate-payload', version });
    return false;
  }
  lastAppliedVersion = version;
  return true;
}

// ------------------------------------------------ Connection lifecycle --------

function handleConnect(): void {
  logger.info({ event: 'socket-connect' });
  useConnectionStore.getState().setConnected();
}

function handleDisconnect(reason: string): void {
  logger.warn({ event: 'socket-disconnect', reason });
  useConnectionStore.getState().setDisconnected(reason);
}

function handleReconnect(_reason: unknown): void {
  logger.info({ event: 'socket-reconnect' });
  useConnectionStore.getState().setReconnected();
}

function handleReconnectFailed(): void {
  logger.error({ event: 'socket-reconnect-failed' });
  useConnectionStore.getState().setExpired();
}

// --------------------------------------------------- Stub handlers -----------

/** Log a warning for an unimplemented handler. Filled in later phases. */
function stubHandler(
  eventName: ServerToClientEventName,
  ...args: unknown[]
): void {
  logger.warn({
    event: 'unimplemented-handler',
    eventName,
    argCount: args.length,
  });
}

// Event-specific stubs that log the event name for traceability.
const stubRoomJoined = (...args: unknown[]) =>
  stubHandler('room:joined', ...args);
const stubPlayerJoined = (...args: unknown[]) =>
  stubHandler('player:joined', ...args);
const stubPlayerLeft = (...args: unknown[]) =>
  stubHandler('player:left', ...args);
const stubHostTransferred = (...args: unknown[]) =>
  stubHandler('host:transferred', ...args);
const stubRoomConfigUpdated = (...args: unknown[]) =>
  stubHandler('room:config:updated', ...args);
const stubGameStarted = (...args: unknown[]) =>
  stubHandler('game:started', ...args);
const stubRoundStarted = (...args: unknown[]) =>
  stubHandler('round:started', ...args);
const stubDrawerSelected = (...args: unknown[]) =>
  stubHandler('drawer:selected', ...args);
const stubDrawStart = (...args: unknown[]) =>
  stubHandler('draw:start', ...args);
const stubDrawMove = (...args: unknown[]) => stubHandler('draw:move', ...args);
const stubDrawEnd = (...args: unknown[]) => stubHandler('draw:end', ...args);
const stubCanvasCleared = (...args: unknown[]) =>
  stubHandler('canvas:cleared', ...args);
const stubGuessSubmitted = (...args: unknown[]) =>
  stubHandler('guess:submitted', ...args);
const stubGuessCorrect = (...args: unknown[]) =>
  stubHandler('guess:correct', ...args);
const stubHintRevealed = (...args: unknown[]) =>
  stubHandler('hint:revealed', ...args);
const stubRoundEnded = (...args: unknown[]) =>
  stubHandler('round:ended', ...args);
const stubScoreUpdated = (...args: unknown[]) =>
  stubHandler('score:updated', ...args);
const stubGameFinished = (...args: unknown[]) =>
  stubHandler('game:finished', ...args);
const stubPlayerDisconnected = (...args: unknown[]) =>
  stubHandler('player:disconnected', ...args);
const stubPlayerReconnected = (...args: unknown[]) =>
  stubHandler('player:reconnected', ...args);
const stubConnectionLost = (_payload: unknown): void => {
  const { setDisconnected } = useConnectionStore.getState();
  logger.warn({ event: 'connection-lost-stub' });
  setDisconnected('connection lost');
};
const stubChatMessage = (...args: unknown[]) =>
  stubHandler('chat:message', ...args);
const stubResponseStateSnapshot = (...args: unknown[]) =>
  stubHandler('response:state:snapshot', ...args);

// ------------------------------------------------------ Registration ---------

/**
 * Register all event listeners on the given socket.
 * Returns a cleanup function that removes all listeners.
 */
export function registerDispatcher(socket: Socket): () => void {
  const handlers: Partial<
    Record<ServerToClientEventName, (...args: unknown[]) => void>
  > = {
    'room:joined': stubRoomJoined,
    'player:joined': stubPlayerJoined,
    'player:left': stubPlayerLeft,
    'host:transferred': stubHostTransferred,
    'room:config:updated': stubRoomConfigUpdated,
    'game:started': stubGameStarted,
    'round:started': stubRoundStarted,
    'drawer:selected': stubDrawerSelected,
    'draw:start': stubDrawStart,
    'draw:move': stubDrawMove,
    'draw:end': stubDrawEnd,
    'canvas:cleared': stubCanvasCleared,
    'guess:submitted': stubGuessSubmitted,
    'guess:correct': stubGuessCorrect,
    'hint:revealed': stubHintRevealed,
    'round:ended': stubRoundEnded,
    'score:updated': stubScoreUpdated,
    'game:finished': stubGameFinished,
    'player:disconnected': stubPlayerDisconnected,
    'player:reconnected': stubPlayerReconnected,
    'connection:lost': stubConnectionLost,
    'chat:message': stubChatMessage,
    'response:state:snapshot': stubResponseStateSnapshot,
  };

  // Override stubs with real handlers where available.
  const realHandlers: Partial<
    Record<ServerToClientEventName, (...args: unknown[]) => void>
  > = {
    'room:joined': (_payload: unknown) => {
      logger.info({ event: 'room-joined' });
    },
    'player:joined': (payload: unknown) => {
      const p = payload as {
        player?: {
          playerId: string;
          nickname: string;
          isHost: boolean;
          score: number;
          isConnected: boolean;
        };
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      if (!p.player) return; // defensive: malformed payload
      useRoomStore.getState().addPlayer({
        playerId: p.player.playerId,
        nickname: p.player.nickname,
        isHost: p.player.isHost,
        score: p.player.score,
        isConnected: p.player.isConnected,
      });
      logger.info({ event: 'player-joined', playerId: p.player.playerId });
    },
    'player:left': (payload: unknown) => {
      const p = payload as { playerId: string; version: number };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useRoomStore.getState().removePlayer(p.playerId);
      logger.info({ event: 'player-left', playerId: p.playerId });
    },
    'host:transferred': (payload: unknown) => {
      const p = payload as { hostPlayerId: string; version: number };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useRoomStore.getState().setHost(p.hostPlayerId);
      logger.info({ event: 'host-transferred', hostPlayerId: p.hostPlayerId });
    },
    'room:config:updated': (payload: unknown) => {
      const p = payload as {
        config: {
          roomName?: string;
          maxPlayers?: number;
          rounds?: number;
          roundDuration?: number;
          hints?: number;
        };
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useRoomStore.getState().updateConfig({
        roomName: p.config.roomName,
        maxPlayers: p.config.maxPlayers,
        rounds: p.config.rounds,
        roundDuration: p.config.roundDuration,
        hints: p.config.hints,
      });
      logger.info({ event: 'room-config-updated' });
    },
    'connection:lost': (payload: unknown) => {
      const p = payload as { code?: string; version?: number };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      if (p.code === 'SESSION_EXPIRED') {
        useSessionStore.getState().clearAll();
        useConnectionStore.getState().setExpired();
        logger.warn({ event: 'session-expired', action: 'cleared-all' });
      } else {
        useConnectionStore.getState().setDisconnected(p.code ?? 'unknown');
      }
    },
  };

  for (const [event, handler] of Object.entries(handlers)) {
    const real = realHandlers[event as ServerToClientEventName];
    if (real) {
      (socket as Socket).on(event, real);
    } else if (handler) {
      (socket as Socket).on(event, handler);
    }
  }

  // Lifecycle events (not in the event name map).
  (socket as Socket).on('connect', handleConnect);
  (socket as Socket).on(
    'disconnect',
    handleDisconnect as (...args: unknown[]) => void,
  );
  (socket as Socket).on(
    'reconnect',
    handleReconnect as (...args: unknown[]) => void,
  );
  (socket as Socket).on(
    'reconnect_failed',
    handleReconnectFailed as (...args: unknown[]) => void,
  );

  return () => {
    for (const [event, handler] of Object.entries(handlers)) {
      if (handler) {
        (socket as Socket).off(event, handler);
      }
    }
    (socket as Socket).off('connect', handleConnect);
    (socket as Socket).off(
      'disconnect',
      handleDisconnect as (...args: unknown[]) => void,
    );
    (socket as Socket).off(
      'reconnect',
      handleReconnect as (...args: unknown[]) => void,
    );
    (socket as Socket).off(
      'reconnect_failed',
      handleReconnectFailed as (...args: unknown[]) => void,
    );
  };
}

/** Reset version tracker (call on fresh connect after explicit disconnect). */
export function resetVersionTracker(): void {
  lastAppliedVersion = 0;
}
