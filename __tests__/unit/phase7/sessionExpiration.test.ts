/**
 * Session-expired navigation logic tests (Phase 7).
 *
 * Verifies the session cleanup and navigation trigger behavior
 * that mirrors the Effect in _layout.tsx without requiring full
 * React component rendering.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { useConnectionStore } from '../../../src/stores/connection.store';
import { useSessionStore } from '../../../src/stores/session.store';

// ---------------------------------------------------------------- Helpers ----

function resetStores() {
  useConnectionStore.getState().setExpired();
  useSessionStore.getState().clearAll();
}

/**
 * Core navigation logic extracted from _layout.tsx RootLayout expired effect.
 * Mutates the session store directly and returns whether navigation was triggered.
 */
function evaluateExpiredNavigation(playerId: string | null): {
  navigated: boolean;
  playerIdAfter: string | null;
} {
  const sessStore = useSessionStore.getState();
  const connStore = useConnectionStore.getState();

  if (connStore.status !== 'expired') {
    return { navigated: false, playerIdAfter: playerId };
  }
  if (playerId === null) {
    // Already at home with no session — skip to avoid loops.
    return { navigated: false, playerIdAfter: null };
  }
  sessStore.clearAll();
  return { navigated: true, playerIdAfter: null };
}

// ---------------------------------------------------------------- Tests ----

describe('Phase 7 — Session-expired navigation', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('navigates when expired and player has active session (Game screen)', () => {
    useSessionStore.getState().setPlayerId('p-game');
    useConnectionStore.getState().setExpired();
    const result = evaluateExpiredNavigation('p-game');
    expect(result.navigated).toBe(true);
    expect(result.playerIdAfter).toBeNull();
    expect(useSessionStore.getState().playerId).toBeNull();
  });

  it('navigates when expired and player is in lobby', () => {
    useSessionStore.getState().setPlayerId('p-lobby');
    useConnectionStore.getState().setExpired();
    const result = evaluateExpiredNavigation('p-lobby');
    expect(result.navigated).toBe(true);
    expect(result.playerIdAfter).toBeNull();
  });

  it('does NOT re-navigate when already on home with no session', () => {
    useConnectionStore.getState().setExpired();
    const result = evaluateExpiredNavigation(null);
    expect(result.navigated).toBe(false);
    expect(result.playerIdAfter).toBeNull();
  });

  it('does NOT navigate when status is connected', () => {
    useSessionStore.getState().setPlayerId('p-game');
    useConnectionStore.getState().setConnected();
    const result = evaluateExpiredNavigation('p-game');
    expect(result.navigated).toBe(false);
  });

  it('does NOT navigate when status is disconnected (not expired)', () => {
    useSessionStore.getState().setPlayerId('p-game');
    useConnectionStore.getState().setDisconnected('timeout');
    const result = evaluateExpiredNavigation('p-game');
    expect(result.navigated).toBe(false);
  });

  it('session state is fully cleared on navigation', () => {
    useSessionStore.getState().setPlayerId('p-clear');
    useSessionStore.getState().setSessionToken('tok-clear');
    useSessionStore.getState().setRoomId('room-clear');
    useConnectionStore.getState().setExpired();
    evaluateExpiredNavigation('p-clear');
    expect(useSessionStore.getState().playerId).toBeNull();
    expect(useSessionStore.getState().sessionToken).toBeNull();
    expect(useSessionStore.getState().roomId).toBeNull();
  });
});

describe('Phase 7 — Duplicate expiration events', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('second expired event after first does not cause double-clear', () => {
    useSessionStore.getState().setPlayerId('p-dup');
    useConnectionStore.getState().setExpired();
    evaluateExpiredNavigation('p-dup');
    expect(useSessionStore.getState().playerId).toBeNull();

    // Second expired event while already null.
    evaluateExpiredNavigation(null);
    expect(useSessionStore.getState().playerId).toBeNull();
  });
});

describe('Phase 7 — Recovery navigation after session restored', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('expired → reconnected restores player state for fresh login flow', () => {
    // Simulate expired + navigation.
    useSessionStore.getState().setPlayerId('p-old');
    useConnectionStore.getState().setExpired();
    evaluateExpiredNavigation('p-old');
    expect(useSessionStore.getState().playerId).toBeNull();

    // User reconnects and gets new session.
    useConnectionStore.getState().setConnected();
    useSessionStore.getState().setPlayerId('p-new');
    useSessionStore.getState().setSessionToken('tok-new');
    expect(useSessionStore.getState().playerId).toBe('p-new');
    expect(useConnectionStore.getState().status).toBe('connected');
  });
});

describe('Phase 7 — Connection lifecycle guards', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('reconnecting status does not trigger navigation', () => {
    useSessionStore.getState().setPlayerId('p-game');
    useConnectionStore.getState().setReconnecting();
    const result = evaluateExpiredNavigation('p-game');
    expect(result.navigated).toBe(false);
    expect(useConnectionStore.getState().status).toBe('reconnecting');
  });

  it('reconnected status does not trigger navigation', () => {
    useSessionStore.getState().setPlayerId('p-game');
    useConnectionStore.getState().setReconnected();
    const result = evaluateExpiredNavigation('p-game');
    expect(result.navigated).toBe(false);
    expect(useConnectionStore.getState().status).toBe('reconnected');
  });
});
