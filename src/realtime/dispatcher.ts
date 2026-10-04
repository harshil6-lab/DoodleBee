/**
 * Realtime event dispatcher (D04-002).
 *
 * One centralized module that registers handlers for every server→client
 * event from `realtime-contract.md` §7. Each handler dispatches to the exact
 * Zustand store field specified by `server-state-writer-map.md` §2.
 *
 * Secret-word rule (D04-004): payloads carrying `secretWord` may ONLY reach
 * drawer-private code paths. This dispatcher never passes a secret-bearing
 * payload to any store other than the drawer store singleton.
 */
import type { Socket } from 'socket.io-client';
import type {
  GamePhase,
  RoundEndReason,
  SnapshotStroke,
  Stroke,
} from '../types';
import { useConnectionStore } from '../stores/connection.store';
import { useDrawerGameStore } from '../stores/drawer.store';
import { useGuesserGameStore } from '../stores/guesser.store';
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
  _payload: unknown,
): void {
  logger.warn({
    event: 'unimplemented-handler',
    eventName,
  });
}

// Event-specific stubs that log the event name for traceability.
const stubRoomJoined = (_p: unknown) => stubHandler('room:joined', _p);
const stubPlayerJoined = (_p: unknown) => stubHandler('player:joined', _p);
const stubPlayerLeft = (_p: unknown) => stubHandler('player:left', _p);
const stubHostTransferred = (_p: unknown) =>
  stubHandler('host:transferred', _p);
const stubRoomConfigUpdated = (_p: unknown) =>
  stubHandler('room:config:updated', _p);
const stubGameStarted = (_p: unknown) => stubHandler('game:started', _p);
const stubRoundStarted = (_p: unknown) => stubHandler('round:started', _p);
const stubDrawerSelected = (_p: unknown) => stubHandler('drawer:selected', _p);
const stubDrawStart = (_p: unknown) => stubHandler('draw:start', _p);
const stubDrawMove = (_p: unknown) => stubHandler('draw:move', _p);
const stubDrawEnd = (_p: unknown) => stubHandler('draw:end', _p);
const stubCanvasCleared = (_p: unknown) => stubHandler('canvas:cleared', _p);
const stubGuessSubmitted = (_p: unknown) => stubHandler('guess:submitted', _p);
const stubGuessCorrect = (_p: unknown) => stubHandler('guess:correct', _p);
const stubHintRevealed = (_p: unknown) => stubHandler('hint:revealed', _p);
const stubRoundEnded = (_p: unknown) => stubHandler('round:ended', _p);
const stubScoreUpdated = (_p: unknown) => stubHandler('score:updated', _p);
const stubGameFinished = (_p: unknown) => stubHandler('game:finished', _p);
const stubPlayerDisconnected = (_p: unknown) =>
  stubHandler('player:disconnected', _p);
const stubPlayerReconnected = (_p: unknown) =>
  stubHandler('player:reconnected', _p);
const stubConnectionLost = (_payload: unknown): void => {
  const { setDisconnected } = useConnectionStore.getState();
  logger.warn({ event: 'connection-lost-stub' });
  setDisconnected('connection lost');
};
const stubChatMessage = (_p: unknown) => stubHandler('chat:message', _p);
const stubResponseStateSnapshot = (_p: unknown) =>
  stubHandler('response:state:snapshot', _p);

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

  // Override stubs with real handlers.
  const realHandlers: Partial<
    Record<ServerToClientEventName, (...args: unknown[]) => void>
  > = {
    // ── room:joined ──────────────────────────────────────────────────
    'room:joined': (payload: unknown) => {
      const p = payload as {
        room?: {
          roomId: string;
          roomCode: string;
          config: {
            roomName?: string;
            maxPlayers?: number;
            rounds?: number;
            roundDuration?: number;
            hints?: number;
          };
        };
        players?: {
          playerId: string;
          nickname: string;
          isHost: boolean;
          score: number;
          isConnected: boolean;
        }[];
        host?: string;
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      if (p.room) {
        useRoomStore.getState().setRoomJoined(
          {
            roomId: p.room.roomId,
            roomCode: p.room.roomCode,
            config: {
              roomName: p.room.config.roomName ?? '',
              maxPlayers: p.room.config.maxPlayers ?? 8,
              rounds: p.room.config.rounds ?? 3,
              roundDuration: p.room.config.roundDuration ?? 60,
              hints: p.room.config.hints ?? 2,
            },
            players: p.players ?? [],
            host: p.host ?? '',
          },
          p.players ?? [],
          p.host ?? '',
        );
      }
      logger.info({ event: 'room-joined' });
    },

    // ── player:joined ────────────────────────────────────────────────
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
      if (!p.player) return;
      useRoomStore.getState().addPlayer({
        playerId: p.player.playerId,
        nickname: p.player.nickname,
        isHost: p.player.isHost,
        score: p.player.score,
        isConnected: p.player.isConnected,
      });
      logger.info({ event: 'player-joined', playerId: p.player.playerId });
    },

    // ── player:left ──────────────────────────────────────────────────
    'player:left': (payload: unknown) => {
      const p = payload as { playerId: string; version: number };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useRoomStore.getState().removePlayer(p.playerId);
      logger.info({ event: 'player-left', playerId: p.playerId });
    },

    // ── host:transferred ─────────────────────────────────────────────
    'host:transferred': (payload: unknown) => {
      const p = payload as { hostPlayerId: string; version: number };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useRoomStore.getState().setHost(p.hostPlayerId);
      logger.info({ event: 'host-transferred', hostPlayerId: p.hostPlayerId });
    },

    // ── room:config:updated ──────────────────────────────────────────
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

    // ── game:started ─────────────────────────────────────────────────
    'game:started': (payload: unknown) => {
      const p = payload as {
        gameId: string;
        roundNumber: number;
        roundsPlanned: number;
        startingDeadline: number;
        serverNow: number;
        players: Array<{
          playerId: string;
          nickname: string;
          isConnected: boolean;
        }>;
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useDrawerGameStore.getState().setPhase('STARTING');
      useDrawerGameStore.getState().setRoundsPlanned(p.roundsPlanned);
      useGuesserGameStore.getState().setPhase('STARTING');
      useGuesserGameStore.getState().setRoundsPlanned(p.roundsPlanned);
      logger.info({ event: 'game-started', roundsPlanned: p.roundsPlanned });
    },

    // ── round:started ────────────────────────────────────────────────
    'round:started': (payload: unknown) => {
      const p = payload as {
        roundNumber: number;
        drawerPlayerId: string;
        maskedWord: string;
        hintsRemaining: number;
        timer: { roundEndTime: number; paused: boolean };
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      const phase = 'ROUND_ACTIVE' as const;
      useDrawerGameStore.getState().setPhase(phase);
      useDrawerGameStore.getState().setDrawer(p.drawerPlayerId);
      useDrawerGameStore.getState().setMaskedWord(p.maskedWord);
      useDrawerGameStore.getState().setHintsRemaining(p.hintsRemaining);
      useDrawerGameStore.getState().setTimer(p.timer);
      useDrawerGameStore.getState().setRoundNumber(p.roundNumber);
      useGuesserGameStore.getState().setPhase(phase);
      useGuesserGameStore.getState().setDrawer(p.drawerPlayerId);
      useGuesserGameStore.getState().setMaskedWord(p.maskedWord);
      useGuesserGameStore.getState().setHintsRemaining(p.hintsRemaining);
      useGuesserGameStore.getState().setTimer(p.timer);
      useGuesserGameStore.getState().setRoundNumber(p.roundNumber);
      // Clear previous round result when a new round starts.
      useDrawerGameStore.getState().setRoundResult(null);
      useDrawerGameStore.getState().setNextDrawer(null);
      useGuesserGameStore.getState().setNextDrawer(null);
      logger.info({
        event: 'round-started',
        roundNumber: p.roundNumber,
        drawer: p.drawerPlayerId,
      });
    },

    // ── drawer:selected (private → drawer store) ─────────────────────
    'drawer:selected': (payload: unknown) => {
      const p = payload as {
        secretWord?: string;
        maskedWord: string;
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      // Private variant carries secretWord — write to drawer store only.
      if (p.secretWord) {
        useDrawerGameStore.getState().setSecretWord(p.secretWord);
        logger.info({ event: 'drawer-selected-private' });
      }
      // Public variant (no secretWord) — update maskedWord for both stores.
      useDrawerGameStore.getState().setMaskedWord(p.maskedWord);
      useGuesserGameStore.getState().setMaskedWord(p.maskedWord);
    },

    // ── draw:start (remote stroke for guesser) ───────────────────────
    'draw:start': (payload: unknown) => {
      const p = payload as {
        strokeId: string;
        color: string;
        brushSize: number;
        points: { x: number; y: number; pressure?: number }[];
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      const stroke: Stroke = {
        id: p.strokeId,
        points: p.points,
        color: p.color,
        brushSize: p.brushSize,
        erased: false,
      };
      useDrawerGameStore.getState().addStroke(stroke);
      logger.info({ event: 'draw-start', strokeId: p.strokeId });
    },

    // ── draw:move (remote stroke points) ─────────────────────────────
    'draw:move': (payload: unknown) => {
      const p = payload as {
        strokeId: string;
        pointIndex: number;
        points: { x: number; y: number; pressure?: number }[];
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useDrawerGameStore.setState((state) => {
        const idx = state.strokes.findIndex((s: Stroke) => s.id === p.strokeId);
        if (idx === -1) return state; // defensive: stroke not found
        const updated = {
          ...state.strokes[idx],
          points: [...state.strokes[idx].points, ...p.points],
        };
        const nextStrokes = [...state.strokes];
        nextStrokes[idx] = updated;
        return { strokes: nextStrokes };
      });
      logger.info({
        event: 'draw-move',
        strokeId: p.strokeId,
        pointIndex: p.pointIndex,
      });
    },

    // ── draw:end (remote stroke finalization) ────────────────────────
    'draw:end': (payload: unknown) => {
      const p = payload as { strokeId: string; version: number };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      logger.info({ event: 'draw-end', strokeId: p.strokeId });
    },

    // ── canvas:cleared ───────────────────────────────────────────────
    'canvas:cleared': (payload: unknown) => {
      const p = payload as { version: number };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useDrawerGameStore.getState().clearStrokes();
      logger.info({ event: 'canvas-cleared' });
    },

    // ── guess:submitted ──────────────────────────────────────────────
    'guess:submitted': (payload: unknown) => {
      const p = payload as {
        playerId: string;
        nickname: string;
        text: string;
        result: 'WRONG' | 'CLOSE';
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      logger.info({
        event: 'guess-submitted',
        playerId: p.playerId,
        result: p.result,
      });
    },

    // ── guess:correct ────────────────────────────────────────────────
    'guess:correct': (payload: unknown) => {
      const p = payload as {
        playerId: string;
        nickname: string;
        rank: number;
        points: number;
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useGuesserGameStore.getState().markGuessed(p.playerId);
      useDrawerGameStore.getState().addScore(p.playerId, p.points);
      logger.info({
        event: 'guess-correct',
        playerId: p.playerId,
        rank: p.rank,
      });
    },

    // ── hint:revealed ────────────────────────────────────────────────
    'hint:revealed': (payload: unknown) => {
      const p = payload as {
        maskedWord: string;
        hintsRemaining: number;
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useDrawerGameStore.getState().setMaskedWord(p.maskedWord);
      useDrawerGameStore.getState().setHintsRemaining(p.hintsRemaining);
      useGuesserGameStore.getState().setMaskedWord(p.maskedWord);
      useGuesserGameStore.getState().setHintsRemaining(p.hintsRemaining);
      logger.info({ event: 'hint-revealed', hintsRemaining: p.hintsRemaining });
    },

    // ── round:ended ──────────────────────────────────────────────────
    'round:ended': (payload: unknown) => {
      const p = payload as {
        roundNumber: number;
        endReason: string;
        word: string;
        rankings: {
          playerId: string;
          nickname: string;
          rank: number;
          points: number;
        }[];
        drawerBonus: number;
        drawerPoints: number;
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useDrawerGameStore.getState().setRoundResult({
        roundNumber: p.roundNumber,
        endReason: p.endReason as RoundEndReason,
        word: p.word,
        rankings: p.rankings,
        drawerBonus: p.drawerBonus,
        drawerPoints: p.drawerPoints,
      });
      useGuesserGameStore.getState().setRoundResult(null); // guesser store has no roundResult field
      useDrawerGameStore.getState().setPhase('ROUND_FINISHED');
      useGuesserGameStore.getState().setPhase('ROUND_FINISHED');
      logger.info({
        event: 'round-ended',
        roundNumber: p.roundNumber,
        endReason: p.endReason,
      });
    },

    // ── score:updated ────────────────────────────────────────────────
    'score:updated': (payload: unknown) => {
      const p = payload as { scores: Record<string, number>; version: number };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useDrawerGameStore.getState().setScores(p.scores);
      useGuesserGameStore.getState().setScores(p.scores);
      logger.info({
        event: 'score-updated',
        scoreCount: Object.keys(p.scores).length,
      });
    },

    // ── game:finished ────────────────────────────────────────────────
    'game:finished': (payload: unknown) => {
      const p = payload as {
        finalScores: Record<string, number>;
        rankings: {
          playerId: string;
          nickname: string;
          rank: number;
          score: number;
        }[];
        winnerId: string;
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useDrawerGameStore.getState().setFinalResult({
        finalScores: p.finalScores,
        rankings: p.rankings,
        winnerId: p.winnerId,
      });
      useDrawerGameStore.getState().setPhase('GAME_FINISHED');
      useGuesserGameStore.getState().setPhase('GAME_FINISHED');
      logger.info({ event: 'game-finished', winner: p.winnerId });
    },

    // ── player:disconnected ──────────────────────────────────────────
    'player:disconnected': (payload: unknown) => {
      const p = payload as { playerId: string; version: number };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      // Mark player as disconnected in room store.
      useRoomStore.setState((state) => ({
        players: state.players.map((pl: import('../types').Player) =>
          pl.playerId === p.playerId ? { ...pl, isConnected: false } : pl,
        ),
      }));
      logger.info({ event: 'player-disconnected', playerId: p.playerId });
    },

    // ── player:reconnected ───────────────────────────────────────────
    'player:reconnected': (payload: unknown) => {
      const p = payload as { playerId: string; version: number };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      useRoomStore.setState((state) => ({
        players: state.players.map((pl: import('../types').Player) =>
          pl.playerId === p.playerId ? { ...pl, isConnected: true } : pl,
        ),
      }));
      logger.info({ event: 'player-reconnected', playerId: p.playerId });
    },

    // ── connection:lost ──────────────────────────────────────────────
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

    // ── chat:message ─────────────────────────────────────────────────
    'chat:message': (payload: unknown) => {
      const p = payload as {
        id: string;
        messageType: string;
        senderPlayerId: string | null;
        senderNickname: string | null;
        text: string;
        createdAt: number;
        version: number;
      };
      if (p.version !== undefined && !shouldApply(p.version)) return;
      logger.info({ event: 'chat-message', sender: p.senderNickname });
    },

    // ── response:state:snapshot ──────────────────────────────────────
    'response:state:snapshot': (payload: unknown) => {
      const p = payload as {
        version: number;
        serverNow: number;
        you: { role: string; playerId: string };
        game: {
          phase: string;
          roundNumber: number;
          roundsPlanned: number;
        };
        round: {
          drawerPlayerId: string | null;
          maskedWord: string;
          hintsRemaining: number;
          timer: { roundEndTime: number | null; paused: boolean };
          secretWord?: string;
          nextDrawerPlayerId?: string;
        };
        strokes: SnapshotStroke[];
        scores: Record<string, number>;
      };
      if (!shouldApply(p.version)) return;

      const isDrawer = p.you.role === 'DRAWER';
      const phase = p.game.phase as GamePhase;
      const timer = p.round.timer;

      if (isDrawer) {
        useDrawerGameStore.getState().setPhase(phase);
        useDrawerGameStore.getState().setDrawer(p.round.drawerPlayerId);
        useDrawerGameStore.getState().setMaskedWord(p.round.maskedWord);
        useDrawerGameStore.getState().setHintsRemaining(p.round.hintsRemaining);
        useDrawerGameStore.getState().setTimer(timer);
        useDrawerGameStore.getState().setRoundNumber(p.game.roundNumber);
        useDrawerGameStore.getState().setRoundsPlanned(p.game.roundsPlanned);
        useDrawerGameStore.getState().setScores(p.scores);
        if (p.round.nextDrawerPlayerId) {
          useDrawerGameStore
            .getState()
            .setNextDrawer(p.round.nextDrawerPlayerId);
        } else {
          useDrawerGameStore.getState().setNextDrawer(null);
        }
        if (p.round.secretWord) {
          useDrawerGameStore.getState().setSecretWord(p.round.secretWord);
        }
        // Reconcile strokes from snapshot.
        const restoredStrokes: Stroke[] = (p.strokes ?? []).map((s) => ({
          id: s.strokeId,
          points: s.points,
          color: s.color,
          brushSize: s.brushSize,
          erased: false,
        }));
        useDrawerGameStore.setState({ strokes: restoredStrokes });
        logger.info({
          event: 'snapshot-restored-drawer',
          strokes: restoredStrokes.length,
          phase,
        });
      } else {
        useGuesserGameStore.getState().setPhase(phase);
        useGuesserGameStore.getState().setDrawer(p.round.drawerPlayerId);
        useGuesserGameStore.getState().setMaskedWord(p.round.maskedWord);
        useGuesserGameStore
          .getState()
          .setHintsRemaining(p.round.hintsRemaining);
        useGuesserGameStore.getState().setTimer(timer);
        useGuesserGameStore.getState().setRoundNumber(p.game.roundNumber);
        useGuesserGameStore.getState().setRoundsPlanned(p.game.roundsPlanned);
        useGuesserGameStore.getState().setScores(p.scores);
        if (p.round.nextDrawerPlayerId) {
          useGuesserGameStore
            .getState()
            .setNextDrawer(p.round.nextDrawerPlayerId);
        } else {
          useGuesserGameStore.getState().setNextDrawer(null);
        }
        logger.info({
          event: 'snapshot-restored-guesser',
          phase,
        });
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
