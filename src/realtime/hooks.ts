/**
 * Realtime hooks (D04-001).
 *
 * Provides the approved client lifecycle integration:
 * - `useSocketLifecycle`: connects/disconnects the singleton socket, wires
 *   the dispatcher, and tracks reconnection state.
 *
 * Hooks must not:
 * - create multiple socket connections
 * - contain game business logic
 * - become a second state authority
 * - bypass the dispatcher
 */
import { useEffect, useRef } from 'react';
import { useConnectionStore } from '../stores/connection.store';
import { useSessionStore } from '../stores/session.store';
import {
  connectSocket,
  disconnectSocket,
  isConnected,
  onDisconnect,
  onReconnect,
  onReconnectFailed,
} from './socket';
import { registerDispatcher } from './dispatcher';

// ----------------------------------------------------------------- Hook -------

/**
 * Root-level hook that manages the Socket.IO lifecycle.
 *
 * Call once at the app root (e.g. in `_layout.tsx` or a root provider).
 * The hook connects immediately if a session token is available, otherwise
 * stays in `expired` state until `connectWithToken()` is called externally.
 */
export function useSocketLifecycle(autoConnect = true): void {
  const connectCalled = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const connection = useConnectionStore();

  useEffect(() => {
    const token = useSessionStore.getState().sessionToken;

    if (autoConnect && token) {
      doConnect(token);
    }

    return () => {
      doDisconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function doConnect(token: string): void {
    if (isConnected() || connectCalled.current) return;
    connectCalled.current = true;

    connection.setReconnecting();
    try {
      const socket = connectSocket(token);

      if (!cleanupRef.current) {
        cleanupRef.current = registerDispatcher(socket);
      }

      onDisconnect((reason: string) => {
        connection.setDisconnected(reason);
      });
      onReconnect(() => {
        connection.setReconnected();
      });
      onReconnectFailed(() => {
        connection.setExpired();
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      connection.setDisconnected(message);
    }
  }

  function doDisconnect(): void {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    disconnectSocket();
    connectCalled.current = false;
  }

  // Expose disconnect for external callers (leave-room, session expiry).
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useSocketLifecycle as any)._doDisconnect = doDisconnect;
  });
}

// ------------------------------------------------------------------ Helpers ---

/** Read persisted reconnect info from the session store. */
export function getReconnectInfo() {
  return useSessionStore.getState().reconnectInfo;
}

/** Check whether the socket is currently connected. */
export function isSocketConnected(): boolean {
  return isConnected();
}
