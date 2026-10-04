/**
 * Next drawer and game:started dispatcher tests (Phase 4A).
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

describe('Phase 4A — game:started handler', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('game:started sets phase to STARTING and stores roundsPlanned', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('game:started', {
      type: 'game:started',
      gameId: 'g-1',
      roundNumber: 1,
      roundsPlanned: 5,
      startingDeadline: Date.now() + 3000,
      serverNow: Date.now(),
      players: [],
      version: 10,
    });

    expect(useDrawerGameStore.getState().phase).toBe('STARTING');
    expect(useDrawerGameStore.getState().roundsPlanned).toBe(5);
    expect(useGuesserGameStore.getState().phase).toBe('STARTING');
    expect(useGuesserGameStore.getState().roundsPlanned).toBe(5);
  });
});

describe('Phase 4A — nextDrawerPlayerId snapshot restoration', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('snapshot with NEXT_ROUND phase restores nextDrawerPlayerId for drawer', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    const snapshot: DrawerStateSnapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 20,
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
        secretWord: 'elephant',
        endReason: 'ALL_GUESSERS_CORRECT',
        nextDrawerPlayerId: 'p-2',
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

  it('snapshot for guesser with NEXT_ROUND also restores nextDrawerPlayerId', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    const snapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 21,
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
        role: 'GUESSER',
        playerId: 'p-2',
        nickname: 'Guest',
        score: 300,
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
        endReason: 'TIMER_EXPIRED',
        nextDrawerPlayerId: 'p-1',
      },
      correctGuessers: [],
      strokes: [],
      chat: [],
      scores: { 'p-1': 500, 'p-2': 300 },
      leaderboard: [],
    };

    socket.fire('response:state:snapshot', snapshot as unknown);

    expect(useGuesserGameStore.getState().nextDrawerPlayerId).toBe('p-1');
    expect(useGuesserGameStore.getState().phase).toBe('NEXT_ROUND');
  });

  it('round:started clears nextDrawerPlayerId on both stores', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    // Set nextDrawer first via snapshot.
    socket.fire('response:state:snapshot', {
      type: ServerToClientEvent.StateSnapshot,
      version: 22,
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
        phase: 'NEXT_ROUND',
        roundNumber: 2,
        roundsPlanned: 3,
      },
      round: {
        roundId: 'r-2',
        drawerPlayerId: 'p-1',
        maskedWord: '_ _',
        revealedPositions: [],
        hintsRemaining: 0,
        timer: { roundEndTime: null, paused: false },
        word: 'done',
        endReason: 'SERVER_TERMINATED',
        nextDrawerPlayerId: 'p-2',
      },
      correctGuessers: [],
      strokes: [],
      chat: [],
      scores: {},
      leaderboard: [],
    } as unknown);

    expect(useDrawerGameStore.getState().nextDrawerPlayerId).toBe('p-2');

    // New round starts → should clear.
    socket.fire('round:started', {
      type: 'round:started',
      roundNumber: 3,
      drawerPlayerId: 'p-2',
      maskedWord: '_ _ _ _',
      hintsRemaining: 2,
      timer: { roundEndTime: Date.now() + 60_000 },
      version: 23,
    });

    expect(useDrawerGameStore.getState().nextDrawerPlayerId).toBeNull();
    expect(useDrawerGameStore.getState().phase).toBe('ROUND_ACTIVE');
  });
});

describe('Phase 4A — RoundTimer paused field', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('round:started sets timer with paused=false', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('round:started', {
      type: 'round:started',
      roundNumber: 1,
      drawerPlayerId: 'p-1',
      maskedWord: '_ _ _ _',
      hintsRemaining: 2,
      timer: { roundEndTime: Date.now() + 60_000, paused: false },
      version: 30,
    });

    const timer = useDrawerGameStore.getState().timer;
    expect(timer.roundEndTime).toBeGreaterThan(0);
    expect(timer.paused).toBe(false);
  });

  it('snapshot timer with paused=true is preserved', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    const snapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 31,
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
        timer: { roundEndTime: Date.now() + 30_000, paused: true },
      },
      correctGuessers: [],
      strokes: [],
      chat: [],
      scores: {},
      leaderboard: [],
    };

    socket.fire('response:state:snapshot', snapshot as unknown);

    const timer = useDrawerGameStore.getState().timer;
    expect(timer.paused).toBe(true);
  });
});

describe('Phase 4A — security regression', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('guesser snapshot never exposes secretWord even when nextDrawerPlayerId present', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    const { assertNoSecretWord } =
      require('../../../src/stores/guesser.store') as {
        assertNoSecretWord: (s: object) => void;
      };

    const snapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 40,
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
        endReason: 'TIMER_EXPIRED',
        nextDrawerPlayerId: 'p-2',
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
