/**
 * Dispatcher game-event handler tests (Phase 2).
 *
 * Verifies that every game-phase server event correctly writes to the
 * appropriate Zustand store per `server-state-writer-map.md` §2.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { ServerToClientEvent } from '../../../src/types';
import {
  registerDispatcher,
  resetVersionTracker,
} from '../../../src/realtime/dispatcher';
import { useDrawerGameStore } from '../../../src/stores/drawer.store';
import { useGuesserGameStore } from '../../../src/stores/guesser.store';
import { useRoomStore } from '../../../src/stores/room.store';
import { useConnectionStore } from '../../../src/stores/connection.store';

// ---------------------------------------------------------------- Mocks ----

function makeMockSocket() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    on(event: string, handler: (...args: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
    },
    off(event: string, handler: (...args: unknown[]) => void) {
      const arr = listeners.get(event);
      if (arr) {
        const idx = arr.indexOf(handler);
        if (idx !== -1) arr.splice(idx, 1);
      }
    },
    emit(_event: string, _payload?: unknown, _callback?: unknown) {},
    fire(event: string, ...args: unknown[]) {
      const arr = listeners.get(event) ?? [];
      for (const h of arr) h(...args);
    },
    registeredEvents(): string[] {
      return Array.from(listeners.keys());
    },
  };
}

// ---------------------------------------------------------------- Helpers ---

function resetStores() {
  useDrawerGameStore.getState().clearStrokes();
  useDrawerGameStore.getState().setSecretWord('');
  useDrawerGameStore.getState().resetForRound();
  useGuesserGameStore.getState().clearGuessed();
  useGuesserGameStore.getState().resetForRound();
  useRoomStore.getState().leaveRoom();
  useConnectionStore.getState().setExpired();
  resetVersionTracker();
}

// ---------------------------------------------------------------- Tests ----

describe('dispatcher — game event handlers', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  // ── round:started ───────────────────────────────────────────────────
  it('round:started sets phase, drawer, maskedWord, hintsRemaining, timer, roundNumber on both stores', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('round:started', {
      type: 'round:started',
      roundNumber: 2,
      drawerPlayerId: 'p-drawer',
      maskedWord: '_ _ _ _',
      hintsRemaining: 3,
      timer: { roundEndTime: 1_700_000_100_000 },
      version: 10,
    });

    const drawer = useDrawerGameStore.getState();
    expect(drawer.phase).toBe('ROUND_ACTIVE');
    expect(drawer.drawer).toBe('p-drawer');
    expect(drawer.maskedWord).toBe('_ _ _ _');
    expect(drawer.hintsRemaining).toBe(3);
    expect(drawer.timer.roundEndTime).toBe(1_700_000_100_000);
    expect(drawer.roundNumber).toBe(2);

    const guesser = useGuesserGameStore.getState();
    expect(guesser.phase).toBe('ROUND_ACTIVE');
    expect(guesser.drawer).toBe('p-drawer');
    expect(guesser.maskedWord).toBe('_ _ _ _');
    expect(guesser.roundNumber).toBe(2);
  });

  // ── drawer:selected (private variant) ───────────────────────────────
  it('drawer:selected with secretWord writes secretWord to drawer store only', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('drawer:selected', {
      type: 'drawer:selected',
      secretWord: 'elephant',
      maskedWord: '_ _ _ _ _ _ _ _',
      version: 5,
    });

    expect(useDrawerGameStore.getState().secretWord).toBe('elephant');
    expect(useDrawerGameStore.getState().maskedWord).toBe('_ _ _ _ _ _ _ _');
    // Guesser store must never receive secretWord.
    expect('secretWord' in useGuesserGameStore.getState()).toBe(false);
    expect(() =>
      (require('../../../src/stores/guesser.store') as any).assertNoSecretWord(
        useGuesserGameStore.getState(),
      ),
    ).not.toThrow();
  });

  it('drawer:selected without secretWord updates maskedWord on both stores', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('drawer:selected', {
      type: 'drawer:selected',
      maskedWord: '_ _ _ _',
      version: 6,
    });

    expect(useDrawerGameStore.getState().maskedWord).toBe('_ _ _ _');
    expect(useGuesserGameStore.getState().maskedWord).toBe('_ _ _ _');
  });

  // ── draw:start ──────────────────────────────────────────────────────
  it('draw:start adds a stroke to drawer store', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('draw:start', {
      type: 'draw:start',
      strokeId: 's-1',
      color: '#FF0000',
      brushSize: 8,
      points: [{ x: 0.1, y: 0.2 }],
      version: 7,
    });

    const strokes = useDrawerGameStore.getState().strokes;
    expect(strokes).toHaveLength(1);
    expect(strokes[0].id).toBe('s-1');
    expect(strokes[0].color).toBe('#FF0000');
    expect(strokes[0].brushSize).toBe(8);
    expect(strokes[0].points).toEqual([{ x: 0.1, y: 0.2 }]);
  });

  // ── draw:move ───────────────────────────────────────────────────────
  it('draw:move appends points to existing stroke', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    // Add initial stroke.
    useDrawerGameStore.getState().addStroke({
      id: 's-1',
      points: [{ x: 0.1, y: 0.1 }],
      color: '#000000',
      brushSize: 4,
      erased: false,
    });

    socket.fire('draw:move', {
      type: 'draw:move',
      strokeId: 's-1',
      pointIndex: 1,
      points: [{ x: 0.2, y: 0.3 }],
      version: 8,
    });

    const strokes = useDrawerGameStore.getState().strokes;
    expect(strokes[0].points).toHaveLength(2);
    expect(strokes[0].points[1]).toEqual({ x: 0.2, y: 0.3 });
  });

  it('draw:move ignores unknown strokeId defensively', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    const before = useDrawerGameStore.getState().strokes.length;
    socket.fire('draw:move', {
      type: 'draw:move',
      strokeId: 'nonexistent',
      pointIndex: 0,
      points: [{ x: 0.5, y: 0.5 }],
      version: 9,
    });
    expect(useDrawerGameStore.getState().strokes.length).toBe(before);
  });

  // ── draw:end ────────────────────────────────────────────────────────
  it('draw:end logs but does not mutate store (stroke already added)', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    const before = useDrawerGameStore.getState().strokes.length;
    expect(() =>
      socket.fire('draw:end', {
        type: 'draw:end',
        strokeId: 's-1',
        version: 10,
      }),
    ).not.toThrow();
    expect(useDrawerGameStore.getState().strokes.length).toBe(before);
  });

  // ── canvas:cleared ──────────────────────────────────────────────────
  it('canvas:cleared empties strokes on drawer store', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    useDrawerGameStore.getState().addStroke({
      id: 's-1',
      points: [{ x: 0.1, y: 0.1 }],
      color: '#000000',
      brushSize: 4,
      erased: false,
    });
    expect(useDrawerGameStore.getState().strokes.length).toBe(1);

    socket.fire('canvas:cleared', {
      type: 'canvas:cleared',
      roundNumber: 1,
      version: 11,
    });
    expect(useDrawerGameStore.getState().strokes).toHaveLength(0);
  });

  // ── guess:correct ───────────────────────────────────────────────────
  it('guess:correct marks guessed and adds score', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('guess:correct', {
      type: 'guess:correct',
      playerId: 'p-guesser',
      nickname: 'Guesser',
      rank: 1,
      points: 500,
      correctCount: 1,
      version: 12,
    });

    expect(useGuesserGameStore.getState().hasGuessed.has('p-guesser')).toBe(
      true,
    );
    expect(useDrawerGameStore.getState().scores['p-guesser']).toBe(500);
  });

  // ── guess:submitted ─────────────────────────────────────────────────
  it('guess:submitted logs without mutating store', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    expect(() =>
      socket.fire('guess:submitted', {
        type: 'guess:submitted',
        playerId: 'p-guesser',
        nickname: 'Guesser',
        text: 'wrong guess',
        result: 'WRONG',
        version: 13,
      }),
    ).not.toThrow();
  });

  // ── hint:revealed ───────────────────────────────────────────────────
  it('hint:revealed updates maskedWord and hintsRemaining on both stores', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('hint:revealed', {
      type: 'hint:revealed',
      maskedWord: 'a__e____',
      revealedPositions: [0, 3],
      hintsRemaining: 1,
      version: 14,
    });

    expect(useDrawerGameStore.getState().maskedWord).toBe('a__e____');
    expect(useDrawerGameStore.getState().hintsRemaining).toBe(1);
    expect(useGuesserGameStore.getState().maskedWord).toBe('a__e____');
    expect(useGuesserGameStore.getState().hintsRemaining).toBe(1);
  });

  // ── score:updated ───────────────────────────────────────────────────
  it('score:updated sets scores on both role stores', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('score:updated', {
      type: 'score:updated',
      scores: { 'p-1': 100, 'p-2': 200 },
      version: 15,
    });

    expect(useDrawerGameStore.getState().scores).toEqual({
      'p-1': 100,
      'p-2': 200,
    });
    expect(useGuesserGameStore.getState().scores).toEqual({
      'p-1': 100,
      'p-2': 200,
    });
  });

  // ── version ordering ────────────────────────────────────────────────
  it('old versions are discarded', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('score:updated', {
      type: 'score:updated',
      scores: { 'p-1': 100 },
      version: 20,
    });
    socket.fire('score:updated', {
      type: 'score:updated',
      scores: { 'p-1': 999 },
      version: 15, // stale
    });
    expect(useDrawerGameStore.getState().scores['p-1']).toBe(100);
  });

  it('duplicate versions are discarded', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('score:updated', {
      type: 'score:updated',
      scores: { 'p-1': 100 },
      version: 21,
    });
    socket.fire('score:updated', {
      type: 'score:updated',
      scores: { 'p-1': 999 },
      version: 21, // duplicate
    });
    expect(useDrawerGameStore.getState().scores['p-1']).toBe(100);
  });

  // ── player:disconnected / player:reconnected ────────────────────────
  it('player:disconnected sets isConnected=false', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    useRoomStore.getState().setRoomJoined(
      {
        roomId: 'r-1',
        roomCode: 'ABCDE',
        config: {
          roomName: 'Test',
          maxPlayers: 4,
          rounds: 3,
          roundDuration: 60,
          hints: 2,
        },
        players: [],
        host: 'p-1',
      },
      [
        {
          playerId: 'p-1',
          nickname: 'Host',
          isHost: true,
          score: 0,
          isConnected: true,
        },
      ],
      'p-1',
    );

    socket.fire('player:disconnected', {
      type: 'player:disconnected',
      playerId: 'p-1',
      graceDeadline: Date.now() + 15000,
      version: 22,
    });

    const players = useRoomStore.getState().players;
    expect(players.find((p) => p.playerId === 'p-1')?.isConnected).toBe(false);
  });

  it('player:reconnected sets isConnected=true', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    useRoomStore.getState().setRoomJoined(
      {
        roomId: 'r-1',
        roomCode: 'ABCDE',
        config: {
          roomName: 'Test',
          maxPlayers: 4,
          rounds: 3,
          roundDuration: 60,
          hints: 2,
        },
        players: [],
        host: 'p-1',
      },
      [
        {
          playerId: 'p-1',
          nickname: 'Host',
          isHost: true,
          score: 0,
          isConnected: false,
        },
      ],
      'p-1',
    );

    socket.fire('player:reconnected', {
      type: 'player:reconnected',
      playerId: 'p-1',
      version: 23,
    });

    const players = useRoomStore.getState().players;
    expect(players.find((p) => p.playerId === 'p-1')?.isConnected).toBe(true);
  });
});
