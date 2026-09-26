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
  nickname: string;
  roomId: string | null;
  reconnectInfo: ReconnectInfo | null;

  setPlayerId: (id: string) => void;
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
      nickname: '',
      roomId: null,
      reconnectInfo: null,

      setPlayerId: (id) => set({ playerId: id }),
      setNickname: (name) => set({ nickname: name }),
      setRoomId: (id) => set({ roomId: id }),
      clearRoom: () => set({ roomId: null }),
      setReconnectInfo: (info) => set({ reconnectInfo: info }),
      clearReconnectInfo: () => set({ reconnectInfo: null }),
      clearAll: () =>
        set({
          playerId: null,
          nickname: '',
          roomId: null,
          reconnectInfo: null,
        }),
    }),
    {
      name: 'doodlebee-session',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist these fields (not everything)
      partialize: (state) => ({
        playerId: state.playerId,
        nickname: state.nickname,
        reconnectInfo: state.reconnectInfo,
      }),
    },
  ),
);
