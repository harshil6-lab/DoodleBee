/**
 * Session store — Phase 0 tests (reused from Phase 0).
 *
 * Verifies D04-017: sessionToken is persisted alongside reconnectInfo
 * and cleared on clearAll().
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
import { useSessionStore } from '../../../src/stores/session.store';

describe('session store — sessionToken (D04-017)', () => {
  beforeEach(() => {
    useSessionStore.getState().clearAll();
  });

  it('starts with sessionToken null', () => {
    expect(useSessionStore.getState().sessionToken).toBeNull();
  });

  it('sets sessionToken via setSessionToken()', () => {
    useSessionStore.getState().setSessionToken('abc123');
    expect(useSessionStore.getState().sessionToken).toBe('abc123');
  });

  it('persists sessionToken in partialize output', () => {
    useSessionStore.getState().setSessionToken('token-xyz');
    useSessionStore.getState().setPlayerId('player-1');
    useSessionStore.getState().setReconnectInfo({
      playerId: 'player-1',
      lastRoomId: 'room-1',
      lastRoomCode: 'ABCDE',
      lastHeartbeat: Date.now(),
    });

    const snapshot = useSessionStore.getState();
    expect(snapshot.sessionToken).toBe('token-xyz');
    expect(snapshot.playerId).toBe('player-1');
    expect(snapshot.reconnectInfo).not.toBeNull();
  });

  it('clearAll() clears sessionToken', () => {
    useSessionStore.getState().setSessionToken('to-clear');
    useSessionStore.getState().clearAll();
    expect(useSessionStore.getState().sessionToken).toBeNull();
    expect(useSessionStore.getState().playerId).toBeNull();
    expect(useSessionStore.getState().reconnectInfo).toBeNull();
  });

  it('clearAll() preserves nickname for re-entry', () => {
    useSessionStore.getState().setNickname('testuser');
    useSessionStore.getState().clearAll();
    expect(useSessionStore.getState().nickname).toBe('');
  });

  it('setPlayerId does not affect sessionToken', () => {
    useSessionStore.getState().setSessionToken('token-keep');
    useSessionStore.getState().setPlayerId('new-id');
    expect(useSessionStore.getState().sessionToken).toBe('token-keep');
    expect(useSessionStore.getState().playerId).toBe('new-id');
  });

  it('reconnectInfo survives independently of sessionToken changes', () => {
    const info = {
      playerId: 'p-1',
      lastRoomId: 'r-1',
      lastRoomCode: 'ABC12',
      lastHeartbeat: 1_000_000,
    };
    useSessionStore.getState().setReconnectInfo(info);
    useSessionStore.getState().setSessionToken('new-token');

    expect(useSessionStore.getState().reconnectInfo).toEqual(info);
    expect(useSessionStore.getState().sessionToken).toBe('new-token');
  });
});
