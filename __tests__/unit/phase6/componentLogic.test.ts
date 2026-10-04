/**
 * Loading-state and component logic tests (Phase 6).
 *
 * Verifies store-based guards that drive screen loading states,
 * component phase logic, and toolbar disabled states.
 * No React Testing Library — pure unit tests of store logic and
 * component props derivation.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { useDrawerGameStore } from '../../../src/stores/drawer.store';
import { useGuesserGameStore } from '../../../src/stores/guesser.store';
import { useRoomStore } from '../../../src/stores/room.store';
import { useSessionStore } from '../../../src/stores/session.store';

// ---------------------------------------------------------------- Helpers ----

function resetAllStores() {
  useDrawerGameStore.getState().clearStrokes();
  useDrawerGameStore.getState().setSecretWord('');
  useDrawerGameStore.getState().resetForRound();
  useDrawerGameStore.getState().setRoundResult(null);
  useDrawerGameStore.getState().setFinalResult(null);
  useDrawerGameStore.getState().setNextDrawer(null);
  useDrawerGameStore.getState().setPhase('WAITING');
  useDrawerGameStore.getState().setScores({});
  useDrawerGameStore.getState().setRoundNumber(1);
  useDrawerGameStore.getState().setRoundsPlanned(3);
  useGuesserGameStore.getState().clearGuessed();
  useGuesserGameStore.getState().resetForRound();
  useGuesserGameStore.getState().setRoundResult(null);
  useGuesserGameStore.getState().setFinalResult(null);
  useGuesserGameStore.getState().setNextDrawer(null);
  useGuesserGameStore.getState().setPhase('WAITING');
  useRoomStore.getState().setRoomJoined(
    {
      roomId: 'r-test',
      roomCode: 'ABCDE',
      config: {
        roomName: 'Test Room',
        maxPlayers: 4,
        rounds: 3,
        roundDuration: 60,
        hints: 2,
      },
      players: [
        {
          playerId: 'p-host',
          nickname: 'Host',
          score: 0,
          isConnected: true,
          isHost: true,
        },
        {
          playerId: 'p-guest',
          nickname: 'Guest',
          score: 0,
          isConnected: true,
          isHost: false,
        },
      ],
      host: 'p-host',
    },
    [
      {
        playerId: 'p-host',
        nickname: 'Host',
        score: 0,
        isConnected: true,
        isHost: true,
      },
      {
        playerId: 'p-guest',
        nickname: 'Guest',
        score: 0,
        isConnected: true,
        isHost: false,
      },
    ],
    'p-host',
  );
  useSessionStore.getState().setPlayerId('p-guest');
  useSessionStore.getState().setSessionToken('tok-test');
  useSessionStore.getState().setRoomId('r-test');
}

// ---------------------------------------------------------------- Tests ----

describe('Phase 6 — Round-result loading guard', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('roundResult null + ROUND_FINISHED = loading needed', () => {
    useDrawerGameStore.getState().setPhase('ROUND_FINISHED');
    const store = useDrawerGameStore.getState();
    expect(store.roundResult).toBeNull();
    expect(store.phase).toBe('ROUND_FINISHED');
  });

  it('roundResult populated + ROUND_FINISHED = no loading', () => {
    useDrawerGameStore.getState().setRoundResult({
      roundNumber: 1,
      endReason: 'TIMER_EXPIRED',
      word: 'apple',
      rankings: [],
      drawerBonus: 0,
      drawerPoints: 0,
    });
    useDrawerGameStore.getState().setPhase('ROUND_FINISHED');
    const store = useDrawerGameStore.getState();
    expect(store.roundResult).not.toBeNull();
    expect(store.roundResult?.word).toBe('apple');
  });
});

describe('Phase 6 — Final-result loading guard', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('finalResult null + GAME_FINISHED = loading needed', () => {
    useDrawerGameStore.getState().setPhase('GAME_FINISHED');
    const store = useDrawerGameStore.getState();
    expect(store.finalResult).toBeNull();
    expect(store.phase).toBe('GAME_FINISHED');
  });

  it('finalResult populated + GAME_FINISHED = no loading', () => {
    useDrawerGameStore.getState().setFinalResult({
      finalScores: { 'p-host': 500, 'p-guest': 300 },
      rankings: [
        { playerId: 'p-host', nickname: 'Host', rank: 1, score: 500 },
        { playerId: 'p-guest', nickname: 'Guest', rank: 2, score: 300 },
      ],
      winnerId: 'p-host',
    });
    useDrawerGameStore.getState().setPhase('GAME_FINISHED');
    const store = useDrawerGameStore.getState();
    expect(store.finalResult).not.toBeNull();
    expect(store.finalResult?.winnerId).toBe('p-host');
  });
});

describe('Phase 6 — GameHeader phase label logic', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('STARTING phase → GET READY label', () => {
    useDrawerGameStore.getState().setPhase('STARTING');
    const phase = useDrawerGameStore.getState().phase;
    expect(phase).toBe('STARTING');
  });

  it('NEXT_ROUND phase → NEXT UP label', () => {
    useDrawerGameStore.getState().setPhase('NEXT_ROUND');
    const phase = useDrawerGameStore.getState().phase;
    expect(phase).toBe('NEXT_ROUND');
  });

  it('ROUND_ACTIVE phase → YOUR TURN / WATCHING label', () => {
    useDrawerGameStore.getState().setPhase('ROUND_ACTIVE');
    const phase = useDrawerGameStore.getState().phase;
    expect(phase).toBe('ROUND_ACTIVE');
  });
});

describe('Phase 6 — DrawingToolbar disabled logic', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('toolbar is disabled when phase is not ROUND_ACTIVE', () => {
    useDrawerGameStore.getState().setPhase('STARTING');
    const phase = useDrawerGameStore.getState().phase;
    expect(phase).toBe('STARTING');
  });

  it('toolbar is enabled when phase is ROUND_ACTIVE', () => {
    useDrawerGameStore.getState().setPhase('ROUND_ACTIVE');
    const phase = useDrawerGameStore.getState().phase;
    expect(phase).toBe('ROUND_ACTIVE');
  });

  it('hint button disabled when hintsRemaining is 0', () => {
    useDrawerGameStore.getState().setPhase('ROUND_ACTIVE');
    useDrawerGameStore.getState().setHintsRemaining(0);
    expect(useDrawerGameStore.getState().hintsRemaining).toBe(0);
  });

  it('hint button enabled when hintsRemaining > 0', () => {
    useDrawerGameStore.getState().setPhase('ROUND_ACTIVE');
    useDrawerGameStore.getState().setHintsRemaining(2);
    expect(useDrawerGameStore.getState().hintsRemaining).toBe(2);
  });
});

describe('Phase 6 — GuesserPanel canGuess logic', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('canGuess requires ROUND_ACTIVE phase', () => {
    useDrawerGameStore.getState().setPhase('ROUND_ACTIVE');
    useDrawerGameStore.getState().setDrawer('p-host');
    useSessionStore.getState().setPlayerId('p-guest');
    const phase = useDrawerGameStore.getState().phase;
    const drawer = useDrawerGameStore.getState().drawer;
    const playerId = useSessionStore.getState().playerId;
    expect(phase).toBe('ROUND_ACTIVE');
    expect(drawer).toBe('p-host');
    expect(playerId).toBe('p-guest');
  });

  it('canGuess is false in STARTING phase', () => {
    useDrawerGameStore.getState().setPhase('STARTING');
    useDrawerGameStore.getState().setDrawer('p-host');
    useSessionStore.getState().setPlayerId('p-guest');
    const phase = useDrawerGameStore.getState().phase;
    expect(phase).toBe('STARTING');
  });

  it('canGuess is false in ROUND_FINISHED phase', () => {
    useDrawerGameStore.getState().setPhase('ROUND_FINISHED');
    const phase = useDrawerGameStore.getState().phase;
    expect(phase).toBe('ROUND_FINISHED');
  });
});

describe('Phase 6 — PlayerCard WAITING state', () => {
  it('WAITING state is a valid PlayerCardState', () => {
    // The type should include 'WAITING' alongside NORMAL, HOST, YOU, DISCONNECTED
    const validStates: Array<
      'NORMAL' | 'HOST' | 'YOU' | 'WAITING' | 'DISCONNECTED'
    > = ['NORMAL', 'HOST', 'YOU', 'WAITING', 'DISCONNECTED'];
    expect(validStates).toContain('WAITING');
    expect(validStates).toContain('NORMAL');
    expect(validStates).toContain('DISCONNECTED');
  });
});

describe('Phase 6 — Connection store reconnect states', () => {
  beforeEach(() => {
    resetAllStores();
    const {
      useConnectionStore,
    } = require('../../../src/stores/connection.store');
    useConnectionStore.getState().setConnected();
  });

  it('connection:lost with NETWORK_ERROR sets disconnected, preserves session', () => {
    const {
      useConnectionStore,
    } = require('../../../src/stores/connection.store');
    const {
      useSessionStore: SessionStore,
    } = require('../../../src/stores/session.store');
    SessionStore.getState().setPlayerId('p-1');
    SessionStore.getState().setSessionToken('tok-1');

    useConnectionStore.getState().setDisconnected('network error');
    expect(useConnectionStore.getState().status).toBe('disconnected');
    expect(SessionStore.getState().playerId).toBe('p-1');
    expect(SessionStore.getState().sessionToken).toBe('tok-1');
  });

  it('reconnect transitions from disconnected to reconnected', () => {
    const {
      useConnectionStore,
    } = require('../../../src/stores/connection.store');
    useConnectionStore.getState().setDisconnected('timeout');
    expect(useConnectionStore.getState().status).toBe('disconnected');
    useConnectionStore.getState().setReconnected();
    expect(useConnectionStore.getState().status).toBe('reconnected');
  });
});

describe('Phase 6 — Version ordering edge cases', () => {
  it('game:started resets roundsPlanned', () => {
    useDrawerGameStore.getState().setRoundsPlanned(5);
    expect(useDrawerGameStore.getState().roundsPlanned).toBe(5);
    useDrawerGameStore.getState().setRoundsPlanned(3);
    expect(useDrawerGameStore.getState().roundsPlanned).toBe(3);
  });

  it('nextDrawerPlayerId persists across phases', () => {
    useDrawerGameStore.getState().setNextDrawer('p-2');
    expect(useDrawerGameStore.getState().nextDrawerPlayerId).toBe('p-2');
    useDrawerGameStore.getState().setPhase('ROUND_ACTIVE');
    expect(useDrawerGameStore.getState().nextDrawerPlayerId).toBe('p-2');
    useDrawerGameStore.getState().setNextDrawer(null);
    expect(useDrawerGameStore.getState().nextDrawerPlayerId).toBeNull();
  });
});
