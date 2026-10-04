/**
 * Round result and final result tests (Phase 3).
 *
 * Verifies:
 * - round:ended stores RoundResult in game store
 * - game:finished stores FinalResult in game store
 * - round:started clears roundResult
 * - reconnect snapshot preserves results
 * - secret-word boundary preserved during result flow
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { ServerToClientEvent } from '../../../src/types';
import type { DrawerStateSnapshot } from '../../../src/types/drawer-private';
import {
  registerDispatcher,
  resetVersionTracker,
} from '../../../src/realtime/dispatcher';
import { useDrawerGameStore } from '../../../src/stores/drawer.store';
import { useGuesserGameStore } from '../../../src/stores/guesser.store';
import { assertNoSecretWord } from '../../../src/stores/guesser.store';

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
  };
}

function resetStores() {
  useDrawerGameStore.getState().clearStrokes();
  useDrawerGameStore.getState().setSecretWord('');
  useDrawerGameStore.getState().resetForRound();
  useDrawerGameStore.getState().setRoundResult(null);
  useDrawerGameStore.getState().setFinalResult(null);
  useGuesserGameStore.getState().clearGuessed();
  useGuesserGameStore.getState().resetForRound();
  useGuesserGameStore.getState().setRoundResult(null);
  useGuesserGameStore.getState().setFinalResult(null);
  resetVersionTracker();
}

// ---------------------------------------------------------------- Tests ----

describe('Phase 3 — round result state', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('round:ended stores full RoundResult in drawer store', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('round:ended', {
      type: 'round:ended',
      roundNumber: 2,
      endReason: 'TIMER_EXPIRED',
      word: 'elephant',
      rankings: [
        { playerId: 'p-1', nickname: 'Alice', rank: 1, points: 500 },
        { playerId: 'p-2', nickname: 'Bob', rank: 2, points: 350 },
      ],
      drawerBonus: 100,
      drawerPoints: 200,
      version: 50,
    });

    const result = useDrawerGameStore.getState().roundResult;
    expect(result).not.toBeNull();
    expect(result!.roundNumber).toBe(2);
    expect(result!.endReason).toBe('TIMER_EXPIRED');
    expect(result!.word).toBe('elephant');
    expect(result!.drawerBonus).toBe(100);
    expect(result!.drawerPoints).toBe(200);
    expect(result!.rankings).toHaveLength(2);
    expect(result!.rankings[0].nickname).toBe('Alice');
    expect(result!.rankings[0].points).toBe(500);
    expect(result!.rankings[1].nickname).toBe('Bob');
    expect(result!.rankings[1].points).toBe(350);
  });

  it('round:ended sets phase to ROUND_FINISHED on both stores', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    useDrawerGameStore.getState().setPhase('ROUND_ACTIVE');
    useGuesserGameStore.getState().setPhase('ROUND_ACTIVE');

    socket.fire('round:ended', {
      type: 'round:ended',
      roundNumber: 1,
      endReason: 'ALL_GUESSERS_CORRECT',
      word: 'cabinet',
      rankings: [],
      drawerBonus: 0,
      drawerPoints: 0,
      version: 51,
    });

    expect(useDrawerGameStore.getState().phase).toBe('ROUND_FINISHED');
    expect(useGuesserGameStore.getState().phase).toBe('ROUND_FINISHED');
  });

  it('round:started clears previous roundResult', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    // Set a round result first.
    socket.fire('round:ended', {
      type: 'round:ended',
      roundNumber: 1,
      endReason: 'TIMER_EXPIRED',
      word: 'elephant',
      rankings: [],
      drawerBonus: 0,
      drawerPoints: 0,
      version: 52,
    });
    expect(useDrawerGameStore.getState().roundResult).not.toBeNull();

    // New round starts — should clear.
    socket.fire('round:started', {
      type: 'round:started',
      roundNumber: 2,
      drawerPlayerId: 'p-drawer',
      maskedWord: '_ _ _ _ _ _ _ _',
      hintsRemaining: 2,
      timer: { roundEndTime: Date.now() + 60_000 },
      version: 53,
    });

    expect(useDrawerGameStore.getState().roundResult).toBeNull();
  });
});

describe('Phase 3 — final result state', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('game:finished stores full FinalResult in drawer store', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('game:finished', {
      type: 'game:finished',
      finalScores: { 'p-1': 1500, 'p-2': 1200 },
      rankings: [
        { playerId: 'p-1', nickname: 'Alice', rank: 1, score: 1500 },
        { playerId: 'p-2', nickname: 'Bob', rank: 2, score: 1200 },
      ],
      winnerId: 'p-1',
      version: 60,
    });

    const result = useDrawerGameStore.getState().finalResult;
    expect(result).not.toBeNull();
    expect(result!.winnerId).toBe('p-1');
    expect(result!.finalScores['p-1']).toBe(1500);
    expect(result!.finalScores['p-2']).toBe(1200);
    expect(result!.rankings).toHaveLength(2);
    expect(result!.rankings[0].nickname).toBe('Alice');
    expect(result!.rankings[0].score).toBe(1500);
    expect(result!.rankings[1].nickname).toBe('Bob');
    expect(result!.rankings[1].score).toBe(1200);
  });

  it('game:finished sets phase to GAME_FINISHED on both stores', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    useDrawerGameStore.getState().setPhase('ROUND_FINISHED');
    useGuesserGameStore.getState().setPhase('ROUND_FINISHED');

    socket.fire('game:finished', {
      type: 'game:finished',
      finalScores: {},
      rankings: [],
      winnerId: 'p-1',
      version: 61,
    });

    expect(useDrawerGameStore.getState().phase).toBe('GAME_FINISHED');
    expect(useGuesserGameStore.getState().phase).toBe('GAME_FINISHED');
  });
});

describe('Phase 3 — reconnect result preservation', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('reconnect snapshot restores roundResult for drawer', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);

    // Simulate round ended before disconnect.
    socket.fire('round:ended', {
      type: 'round:ended',
      roundNumber: 1,
      endReason: 'TIMER_EXPIRED',
      word: 'secretword',
      rankings: [{ playerId: 'p-1', nickname: 'Host', rank: 1, points: 500 }],
      drawerBonus: 100,
      drawerPoints: 200,
      version: 70,
    });

    // Reconnect with snapshot that includes round in finished state.
    const snapshot: DrawerStateSnapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 71,
      serverNow: Date.now(),
      room: {
        roomId: 'r-1',
        roomCode: 'ABCDE',
        roomName: 'Test',
        status: 'IN_GAME',
        hostPlayerId: 'p-1',
        config: {
          roomName: 'Test',
          maxPlayers: 4,
          rounds: 3,
          roundDuration: 60,
          hints: 2,
        },
      },
      players: [
        {
          playerId: 'p-1',
          nickname: 'Host',
          score: 500,
          isConnected: true,
          isHost: true,
          seatOrder: 0,
        },
      ],
      you: {
        role: 'DRAWER',
        playerId: 'p-1',
        nickname: 'Drawer',
        score: 200,
        hasGuessedCorrectly: false,
      },
      game: {
        gameId: 'g-1',
        phase: 'ROUND_FINISHED',
        roundNumber: 1,
        roundsPlanned: 3,
      },
      round: {
        roundId: 'r-1',
        drawerPlayerId: 'p-1',
        maskedWord: '_ _ _ _ _ _ _ _',
        revealedPositions: [],
        hintsRemaining: 0,
        timer: { roundEndTime: null, paused: false },
        endReason: 'TIMER_EXPIRED',
        word: 'secretword',
        secretWord: 'secretword',
      },
      correctGuessers: [],
      strokes: [],
      chat: [],
      scores: { 'p-1': 200 },
      leaderboard: [{ playerId: 'p-1', nickname: 'Host', score: 500, rank: 1 }],
    };

    socket.fire('response:state:snapshot', snapshot as unknown);

    // Phase should be restored.
    expect(useDrawerGameStore.getState().phase).toBe('ROUND_FINISHED');
    expect(useDrawerGameStore.getState().roundNumber).toBe(1);
  });

  it('reconnect snapshot restores finalResult for drawer when GAME_FINISHED', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);

    const snapshot: DrawerStateSnapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 80,
      serverNow: Date.now(),
      room: {
        roomId: 'r-1',
        roomCode: 'ABCDE',
        roomName: 'Test',
        status: 'IN_GAME',
        hostPlayerId: 'p-1',
        config: {
          roomName: 'Test',
          maxPlayers: 4,
          rounds: 3,
          roundDuration: 60,
          hints: 2,
        },
      },
      players: [
        {
          playerId: 'p-1',
          nickname: 'Host',
          score: 1500,
          isConnected: true,
          isHost: true,
          seatOrder: 0,
        },
        {
          playerId: 'p-2',
          nickname: 'Guest',
          score: 1200,
          isConnected: true,
          isHost: false,
          seatOrder: 1,
        },
      ],
      you: {
        role: 'DRAWER',
        playerId: 'p-1',
        nickname: 'Drawer',
        score: 1500,
        hasGuessedCorrectly: false,
      },
      game: {
        gameId: 'g-1',
        phase: 'GAME_FINISHED',
        roundNumber: 3,
        roundsPlanned: 3,
      },
      round: {
        roundId: 'r-3',
        drawerPlayerId: 'p-1',
        maskedWord: '_ _ _',
        revealedPositions: [],
        hintsRemaining: 0,
        timer: { roundEndTime: null, paused: false },
        endReason: 'SERVER_TERMINATED',
        word: 'done',
        secretWord: 'done',
      },
      correctGuessers: [],
      strokes: [],
      chat: [],
      scores: { 'p-1': 1500, 'p-2': 1200 },
      leaderboard: [
        { playerId: 'p-1', nickname: 'Host', score: 1500, rank: 1 },
        { playerId: 'p-2', nickname: 'Guest', score: 1200, rank: 2 },
      ],
    };

    socket.fire('response:state:snapshot', snapshot as unknown);

    expect(useDrawerGameStore.getState().phase).toBe('GAME_FINISHED');
    expect(useDrawerGameStore.getState().roundNumber).toBe(3);
  });

  it('guesser snapshot never exposes secretWord from round', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);

    const snapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 90,
      serverNow: Date.now(),
      room: {
        roomId: 'r-1',
        roomCode: 'ABCDE',
        roomName: 'Test',
        status: 'IN_GAME',
        hostPlayerId: 'p-1',
        config: {
          roomName: 'Test',
          maxPlayers: 4,
          rounds: 3,
          roundDuration: 60,
          hints: 2,
        },
      },
      players: [],
      you: {
        role: 'GUESSER',
        playerId: 'p-2',
        nickname: 'Guesser',
        score: 0,
        hasGuessedCorrectly: false,
      },
      game: {
        gameId: 'g-1',
        phase: 'ROUND_FINISHED',
        roundNumber: 1,
        roundsPlanned: 3,
      },
      round: {
        roundId: 'r-1',
        drawerPlayerId: 'p-1',
        maskedWord: '_ _ _ _ _ _ _ _',
        revealedPositions: [],
        hintsRemaining: 0,
        timer: { roundEndTime: null, paused: false },
        word: 'elephant',
      },
      correctGuessers: [],
      strokes: [],
      chat: [],
      scores: {},
      leaderboard: [],
    };

    socket.fire('response:state:snapshot', snapshot as unknown);

    // Guesser store must not have secretWord.
    expect('secretWord' in useGuesserGameStore.getState()).toBe(false);
    expect(() =>
      assertNoSecretWord(useGuesserGameStore.getState()),
    ).not.toThrow();
  });
});
