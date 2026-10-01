/**
 * Session store — shared by all players.
 * Persisted via zustand/middleware persist → AsyncStorage.
 * Writers: REST (playerId, roomId), Client (nickname, reconnectInfo)
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ReconnectInfo {
  playerId: string;
  lastRoomId: string | null;
  lastRoomCode: string | null;
  lastHeartbeat: number;
}

interface SessionState {
  playerId: string | null;
  /** The opaque bearer token from POST /session. Used as handshake.auth.token. Persisted alongside reconnectInfo for app-restart reconnect (D04-017). */
  sessionToken: string | null;
  nickname: string;
  roomId: string | null;
  reconnectInfo: ReconnectInfo | null;

  setPlayerId: (id: string) => void;
  setSessionToken: (token: string) => void;
  setNickname: (name: string) => void;
  setRoomId: (id: string) => void;
  clearRoom: () => void;
  setReconnectInfo: (info: ReconnectInfo) => void;
  clearReconnectInfo: () => void;
  clearAll: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      playerId: null,
      sessionToken: null,
      nickname: '',
      roomId: null,
      reconnectInfo: null,

      setPlayerId: (id) => set({ playerId: id }),
      setSessionToken: (token) => set({ sessionToken: token }),
      setNickname: (name) => set({ nickname: name }),
      setRoomId: (id) => set({ roomId: id }),
      clearRoom: () => set({ roomId: null }),
      setReconnectInfo: (info) => set({ reconnectInfo: info }),
      clearReconnectInfo: () => set({ reconnectInfo: null }),
      clearAll: () =>
        set({
          playerId: null,
          sessionToken: null,
          nickname: '',
          roomId: null,
          reconnectInfo: null,
        }),
    }),
    {
      name: 'doodlebee-session',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist these fields (not everything)
      // sessionToken is persisted alongside reconnectInfo so reconnect works
      // across app restarts (D04-017, reconnect-protocol.md §8).
      partialize: (state) => ({
        playerId: state.playerId,
        sessionToken: state.sessionToken,
        nickname: state.nickname,
        reconnectInfo: state.reconnectInfo,
      }),
    },
  ),
);
