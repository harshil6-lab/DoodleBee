/**
 * Secret-word security tests — Phase 2 extension.
 *
 * Verifies that the dispatcher's game handlers maintain the secret-word
 * boundary: private payload goes to drawer store; public payload does not
 * write secretWord anywhere. Snapshot restoration also preserves the boundary.
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
import {
  assertNoSecretWord,
  useGuesserGameStore,
} from '../../../src/stores/guesser.store';
import { useDrawerGameStore } from '../../../src/stores/drawer.store';

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
  useGuesserGameStore.getState().clearGuessed();
  useGuesserGameStore.getState().resetForRound();
  resetVersionTracker();
}

// ---------------------------------------------------------------- Tests ----

describe('security — secretWord boundary during game handlers', () => {
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('drawer:selected (private) sets secretWord on drawer store only', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('drawer:selected', {
      type: 'drawer:selected',
      secretWord: 'cabinet',
      maskedWord: '_ _ _ _ _ _ _',
      version: 1,
    });

    expect(useDrawerGameStore.getState().secretWord).toBe('cabinet');
    expect('secretWord' in useGuesserGameStore.getState()).toBe(false);
    expect(() =>
      assertNoSecretWord(useGuesserGameStore.getState()),
    ).not.toThrow();
  });

  it('drawer:selected (public/no secretWord) does not set secretWord on either store', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('drawer:selected', {
      type: 'drawer:selected',
      maskedWord: '_ _ _ _',
      version: 2,
    });

    expect(useDrawerGameStore.getState().secretWord).toBe('');
    expect('secretWord' in useGuesserGameStore.getState()).toBe(false);
  });

  it('response:state:snapshot for guesser does not expose secretWord', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    socket.fire('response:state:snapshot', {
      type: ServerToClientEvent.StateSnapshot,
      version: 10,
      serverNow: Date.now(),
      you: { role: 'GUESSER', playerId: 'p-guesser' },
      game: {
        gameId: 'g-1',
        phase: 'ROUND_ACTIVE',
        roundNumber: 1,
        roundsPlanned: 3,
      },
      round: {
        roundId: 'r-1',
        drawerPlayerId: 'p-drawer',
        maskedWord: '_ _ _ _ _',
        revealedPositions: [],
        hintsRemaining: 2,
        timer: { roundEndTime: Date.now() + 60_000, paused: false },
      },
      strokes: [],
      scores: {},
    } as unknown);

    expect(useGuesserGameStore.getState().phase).toBe('ROUND_ACTIVE');
    expect(useGuesserGameStore.getState().drawer).toBe('p-drawer');
    expect('secretWord' in useGuesserGameStore.getState()).toBe(false);
    expect(() =>
      assertNoSecretWord(useGuesserGameStore.getState()),
    ).not.toThrow();
  });

  it('response:state:snapshot for drawer restores secretWord from snapshot', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);
    const snapshot = {
      type: ServerToClientEvent.StateSnapshot,
      version: 11,
      serverNow: Date.now(),
      you: {
        role: 'DRAWER',
        playerId: 'p-drawer',
        nickname: 'Drawer',
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
        drawerPlayerId: 'p-drawer',
        maskedWord: '_ _ _ _',
        revealedPositions: [],
        hintsRemaining: 2,
        timer: { roundEndTime: Date.now() + 60_000, paused: false },
        secretWord: 'elephant',
      },
      strokes: [],
      scores: {},
    };

    socket.fire('response:state:snapshot', snapshot as unknown);

    expect(useDrawerGameStore.getState().secretWord).toBe('elephant');
    expect(useDrawerGameStore.getState().phase).toBe('ROUND_ACTIVE');
    expect(useDrawerGameStore.getState().maskedWord).toBe('_ _ _ _');
  });

  it('public events (draw:start, draw:move, etc.) never carry secretWord', () => {
    registerDispatcher(socket as unknown as import('socket.io-client').Socket);

    // Fire each drawing-related event — none should leak secretWord.
    const drawingEvents = [
      [
        'draw:start',
        {
          type: 'draw:start',
          strokeId: 's-1',
          color: '#000',
          brushSize: 4,
          points: [],
          version: 1,
        },
      ],
      [
        'draw:move',
        {
          type: 'draw:move',
          strokeId: 's-1',
          pointIndex: 0,
          points: [{ x: 0.5, y: 0.5 }],
          version: 2,
        },
      ],
      ['draw:end', { type: 'draw:end', strokeId: 's-1', version: 3 }],
      [
        'canvas:cleared',
        { type: 'canvas:cleared', roundNumber: 1, version: 4 },
      ],
      [
        'guess:correct',
        {
          type: 'guess:correct',
          playerId: 'p-1',
          nickname: 'A',
          rank: 1,
          points: 100,
          correctCount: 1,
          version: 5,
        },
      ],
      [
        'hint:revealed',
        {
          type: 'hint:revealed',
          maskedWord: '__',
          revealedPositions: [0],
          hintsRemaining: 1,
          version: 6,
        },
      ],
    ] as const;

    for (const [eventName, payload] of drawingEvents) {
      socket.fire(eventName, payload);
      // After each event, verify guesser store has no secretWord.
      expect('secretWord' in useGuesserGameStore.getState()).toBe(false);
    }
  });
});
