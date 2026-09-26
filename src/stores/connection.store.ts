/**
 * Connection store — shared by all players.
 * Writer: WebSocket lifecycle events only.
 * No persistence (transient connection state).
 */
import { create } from 'zustand';

export type ConnectionStatus =
  'connected' | 'disconnected' | 'reconnecting' | 'reconnected' | 'expired';

interface ConnectionState {
  status: ConnectionStatus;
  lastError: string | null;

  setConnected: () => void;
  setDisconnected: (error?: string) => void;
  setReconnecting: () => void;
  setReconnected: () => void;
  setExpired: () => void;
  clearError: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'expired',
  lastError: null,

  setConnected: () => set({ status: 'connected', lastError: null }),
  setDisconnected: (error) =>
    set({
      status: 'disconnected',
      lastError: error ?? null,
    }),
  setReconnecting: () => set({ status: 'reconnecting' }),
  setReconnected: () => set({ status: 'reconnected', lastError: null }),
  setExpired: () => set({ status: 'expired', lastError: null }),
  clearError: () => set({ lastError: null }),
}));
