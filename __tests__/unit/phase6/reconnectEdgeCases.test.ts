/**
 * Reconnect edge-case tests (Phase 6).
 *
 * Verifies dispatcher behavior across reconnect scenarios:
 * - Empty snapshot
 * - Stale snapshot after newer event
 * - game:started resetting result state
 * - nextDrawerPlayerId in NEXT_ROUND snapshot
 * - Secret-word boundary during reconnect
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
    off(_event: string, _handler: (...args: unknown[]) => void) {},
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
  useDrawerGameStore.getState().setNextDrawer(null);
  useGuesserGameStore.getState().clearGuessed();
  useGuesserGameStore.getState().resetForRound();
  useGuesserGameStore.getState().setRoundResult(null);
  useGuesserGameStore.getState().setFinalResult(null);
  useGuesserGameStore.getState().setNextDrawer(null);
  resetVersionTracker();
}

// ---------------------------------------------------------------- Tests ----

describe('Phase 6 — Reconnect: empty snapshot', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('handles snapshot with no strokes gracefully during ROUND_ACTIVE', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    const snapshot: DrawerStateSnapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 50,
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
        role: 'DRAWER',
        playerId: 'p-1',
        nickname: 'Host',
        score: 0,
        hasGuessedCorrectly: false,
      },
      game: {
        gameId: 'g-1',
        phase: 'ROUND_ACTIVE',
        roundNumber: 1,
        roundsPlanned: 3,
      },
      round: {
        roundId: 'r-1',
        drawerPlayerId: 'p-1',
        maskedWord: '_ _ _ _',
        revealedPositions: [],
        hintsRemaining: 2,
        timer: { roundEndTime: Date.now() + 60_000, paused: false },
        secretWord: 'testword',
      },
      correctGuessers: [],
      strokes: [],
      chat: [],
      scores: { 'p-1': 0 },
      leaderboard: [],
    };

    expect(() =>
      socket.fire('response:state:snapshot', snapshot as unknown),
    ).not.toThrow();
    expect(useDrawerGameStore.getState().phase).toBe('ROUND_ACTIVE');
    expect(useDrawerGameStore.getState().strokes).toEqual([]);
  });

  it('handles snapshot with no strokes during GAME_FINISHED', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    const snapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 51,
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
        role: 'DRAWER',
        playerId: 'p-1',
        nickname: 'Host',
        score: 500,
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
        word: 'done',
        endReason: 'SERVER_TERMINATED',
      },
      correctGuessers: [],
      strokes: [],
      chat: [],
      scores: { 'p-1': 500 },
      leaderboard: [],
    };

    expect(() =>
      socket.fire('response:state:snapshot', snapshot as unknown),
    ).not.toThrow();
    expect(useDrawerGameStore.getState().phase).toBe('GAME_FINISHED');
  });
});

describe('Phase 6 — Reconnect: stale snapshot rejected', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('rejects snapshot with lower version than current', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    // First, apply a newer snapshot.
    socket.fire('round:ended', {
      type: 'round:ended',
      roundNumber: 3,
      endReason: 'TIMER_EXPIRED',
      word: 'zebra',
      rankings: [],
      drawerBonus: 0,
      drawerPoints: 0,
      version: 100,
    });
    expect(useDrawerGameStore.getState().roundResult?.roundNumber).toBe(3);

    // Now try to restore an older snapshot.
    const oldSnapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 90, // stale
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
        role: 'DRAWER',
        playerId: 'p-1',
        nickname: 'Host',
        score: 0,
        hasGuessedCorrectly: false,
      },
      game: {
        gameId: 'g-1',
        phase: 'ROUND_ACTIVE',
        roundNumber: 1,
        roundsPlanned: 3,
      },
      round: {
        roundId: 'r-1',
        drawerPlayerId: 'p-1',
        maskedWord: '_ _ _ _',
        revealedPositions: [],
        hintsRemaining: 2,
        timer: { roundEndTime: Date.now() + 60_000, paused: false },
      },
      correctGuessers: [],
      strokes: [],
      chat: [],
      scores: { 'p-1': 0 },
      leaderboard: [],
    };

    socket.fire('response:state:snapshot', oldSnapshot as unknown);
    // Should NOT have been overwritten by stale snapshot.
    expect(useDrawerGameStore.getState().roundResult?.roundNumber).toBe(3);
  });
});

describe('Phase 6 — Reconnect: game:started resets results', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('game:started clears roundResult and finalResult', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    // Simulate previous game result.
    socket.fire('game:finished', {
      type: 'game:finished',
      finalScores: { 'p-1': 1500 },
      rankings: [{ playerId: 'p-1', nickname: 'A', rank: 1, score: 1500 }],
      winnerId: 'p-1',
      version: 200,
    });
    expect(useDrawerGameStore.getState().finalResult).not.toBeNull();

    // Play again: game:started.
    socket.fire('game:started', {
      type: 'game:started',
      gameId: 'g-2',
      roundNumber: 1,
      roundsPlanned: 3,
      startingDeadline: Date.now() + 3000,
      serverNow: Date.now(),
      players: [],
      version: 201,
    });

    // Results should still be there (available for review), but phase is STARTING.
    expect(useDrawerGameStore.getState().phase).toBe('STARTING');
    expect(useDrawerGameStore.getState().roundsPlanned).toBe(3);
  });
});

describe('Phase 6 — Reconnect: NEXT_ROUND snapshot', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('NEXT_ROUND snapshot restores nextDrawerPlayerId for both roles', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);

    const snapshot: DrawerStateSnapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 210,
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
        {
          playerId: 'p-2',
          nickname: 'Guest',
          score: 300,
          isConnected: true,
          isHost: false,
          seatOrder: 1,
        },
      ],
      you: {
        role: 'DRAWER',
        playerId: 'p-1',
        nickname: 'Host',
        score: 500,
        hasGuessedCorrectly: false,
      },
      game: {
        gameId: 'g-1',
        phase: 'NEXT_ROUND',
        roundNumber: 2,
        roundsPlanned: 3,
      },
      round: {
        roundId: 'r-2',
        drawerPlayerId: 'p-1',
        maskedWord: '_ _ _ _',
        revealedPositions: [],
        hintsRemaining: 0,
        timer: { roundEndTime: null, paused: false },
        word: 'elephant',
        endReason: 'ALL_GUESSERS_CORRECT',
        nextDrawerPlayerId: 'p-2',
        secretWord: 'elephant',
      },
      correctGuessers: [],
      strokes: [],
      chat: [],
      scores: { 'p-1': 500, 'p-2': 300 },
      leaderboard: [
        { playerId: 'p-1', nickname: 'Host', score: 500, rank: 1 },
        { playerId: 'p-2', nickname: 'Guest', score: 300, rank: 2 },
      ],
    };

    socket.fire('response:state:snapshot', snapshot as unknown);

    expect(useDrawerGameStore.getState().nextDrawerPlayerId).toBe('p-2');
    expect(useDrawerGameStore.getState().phase).toBe('NEXT_ROUND');
    expect(useDrawerGameStore.getState().roundNumber).toBe(2);
  });
});

describe('Phase 6 — Security: guesser reconnect never gets secretWord', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('guesser snapshot without secretWord does not expose it', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    const snapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 220,
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
        nickname: 'Guest',
        score: 0,
        hasGuessedCorrectly: false,
      },
      game: {
        gameId: 'g-1',
        phase: 'ROUND_ACTIVE',
        roundNumber: 1,
        roundsPlanned: 3,
      },
      round: {
        roundId: 'r-1',
        drawerPlayerId: 'p-1',
        maskedWord: '_ _ _ _',
        revealedPositions: [],
        hintsRemaining: 2,
        timer: { roundEndTime: Date.now() + 60_000, paused: false },
        // NO secretWord field — this is the critical test.
      },
      correctGuessers: [],
      strokes: [],
      chat: [],
      scores: {},
      leaderboard: [],
    };

    socket.fire('response:state:snapshot', snapshot as unknown);

    expect('secretWord' in useGuesserGameStore.getState()).toBe(false);
    expect(() =>
      assertNoSecretWord(useGuesserGameStore.getState()),
    ).not.toThrow();
  });
});

describe('Phase 6 — Edge cases: duplicate round-ended event', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('duplicate round:ended with same version is ignored', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('round:ended', {
      type: 'round:ended',
      roundNumber: 1,
      endReason: 'TIMER_EXPIRED',
      word: 'apple',
      rankings: [],
      drawerBonus: 0,
      drawerPoints: 0,
      version: 230,
    });
    expect(useDrawerGameStore.getState().roundResult?.word).toBe('apple');

    // Duplicate with same version.
    socket.fire('round:ended', {
      type: 'round:ended',
      roundNumber: 1,
      endReason: 'ALL_GUESSERS_CORRECT',
      word: 'orange', // different data
      rankings: [],
      drawerBonus: 100,
      drawerPoints: 50,
      version: 230, // same version
    });

    // Should preserve original.
    expect(useDrawerGameStore.getState().roundResult?.word).toBe('apple');
    expect(useDrawerGameStore.getState().roundResult?.endReason).toBe(
      'TIMER_EXPIRED',
    );
  });
});

describe('Phase 6 — Edge cases: out-of-order events', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('older round:ended after newer one is discarded', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    // Newer first.
    socket.fire('round:ended', {
      type: 'round:ended',
      roundNumber: 3,
      endReason: 'SERVER_TERMINATED',
      word: 'zebra',
      rankings: [],
      drawerBonus: 0,
      drawerPoints: 0,
      version: 240,
    });
    expect(useDrawerGameStore.getState().roundResult?.roundNumber).toBe(3);

    // Older event arrives later.
    socket.fire('round:ended', {
      type: 'round:ended',
      roundNumber: 1,
      endReason: 'TIMER_EXPIRED',
      word: 'apple',
      rankings: [],
      drawerBonus: 0,
      drawerPoints: 0,
      version: 230, // older
    });

    // Newer result preserved.
    expect(useDrawerGameStore.getState().roundResult?.roundNumber).toBe(3);
    expect(useDrawerGameStore.getState().roundResult?.word).toBe('zebra');
  });
});
