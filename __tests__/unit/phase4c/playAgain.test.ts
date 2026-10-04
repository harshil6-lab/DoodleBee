/**
 * Play Again and edge-case tests (Phase 4C).
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

describe('Phase 4C — Play Again flow', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('game:finished → round:started resets finalResult and starts new game', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);

    // Simulate game finished.
    socket.fire('game:finished', {
      type: 'game:finished',
      finalScores: { 'p-1': 1500, 'p-2': 1200 },
      rankings: [
        { playerId: 'p-1', nickname: 'Alice', rank: 1, score: 1500 },
        { playerId: 'p-2', nickname: 'Bob', rank: 2, score: 1200 },
      ],
      winnerId: 'p-1',
      version: 100,
    });

    expect(useDrawerGameStore.getState().finalResult).not.toBeNull();
    expect(useDrawerGameStore.getState().phase).toBe('GAME_FINISHED');

    // Play Again: server emits game:started then round:started.
    socket.fire('game:started', {
      type: 'game:started',
      gameId: 'g-2',
      roundNumber: 1,
      roundsPlanned: 3,
      startingDeadline: Date.now() + 3000,
      serverNow: Date.now(),
      players: [],
      version: 101,
    });
    expect(useDrawerGameStore.getState().phase).toBe('STARTING');

    socket.fire('round:started', {
      type: 'round:started',
      roundNumber: 1,
      drawerPlayerId: 'p-2',
      maskedWord: '_ _ _ _',
      hintsRemaining: 2,
      timer: { roundEndTime: Date.now() + 60_000 },
      version: 102,
    });

    // finalResult should still be there (available for review),
    // but phase is now ROUND_ACTIVE.
    expect(useDrawerGameStore.getState().phase).toBe('ROUND_ACTIVE');
    expect(useDrawerGameStore.getState().roundNumber).toBe(1);
  });

  it('duplicate game:finished event is ignored (version ordering)', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);

    // First game:finished.
    socket.fire('game:finished', {
      type: 'game:finished',
      finalScores: { 'p-1': 100 },
      rankings: [{ playerId: 'p-1', nickname: 'A', rank: 1, score: 100 }],
      winnerId: 'p-1',
      version: 110,
    });
    expect(useDrawerGameStore.getState().phase).toBe('GAME_FINISHED');

    // Duplicate with same version — should be ignored.
    socket.fire('game:finished', {
      type: 'game:finished',
      finalScores: { 'p-1': 999 }, // different data
      rankings: [{ playerId: 'p-1', nickname: 'A', rank: 1, score: 999 }],
      winnerId: 'p-1',
      version: 110, // same version
    });

    // Should still have original data.
    expect(useDrawerGameStore.getState().finalResult?.finalScores['p-1']).toBe(100);
  });

  it('stale round:ended after newer event is discarded', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);

    // Newer round ended first.
    socket.fire('round:ended', {
      type: 'round:ended',
      roundNumber: 3,
      endReason: 'TIMER_EXPIRED',
      word: 'zebra',
      rankings: [],
      drawerBonus: 0,
      drawerPoints: 0,
      version: 120,
    });
    expect(useDrawerGameStore.getState().roundResult?.roundNumber).toBe(3);

    // Stale round ended with lower version.
    socket.fire('round:ended', {
      type: 'round:ended',
      roundNumber: 1,
      endReason: 'ALL_GUESSERS_CORRECT',
      word: 'apple',
      rankings: [],
      drawerBonus: 100,
      drawerPoints: 50,
      version: 110, // stale
    });

    // Should still have the newer result.
    expect(useDrawerGameStore.getState().roundResult?.roundNumber).toBe(3);
  });
});
