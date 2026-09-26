/**
 * Room store - shared by all players IN the room.
 * Writer: realtime events (room:joined, player:joined, player:left,
 * host:transferred, room config updates). No persistence.
 *
 * Domain shapes come from `src/types` (single definition - ADR section 3.2).
 */
import { create } from 'zustand';
import type { Player, Room, RoomConfig } from '../types';

interface RoomState {
  room: Room | null;
  players: Player[];
  /** playerId of the current host. */
  host: string | null;

  setRoomJoined: (room: Room, players: Player[], host: string) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updatePlayerScore: (playerId: string, score: number) => void;
  setHost: (hostId: string) => void;
  updateConfig: (config: Partial<RoomConfig>) => void;
  leaveRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  players: [],
  host: null,

  setRoomJoined: (room, players, host) => set({ room, players, host }),
  addPlayer: (player) =>
    set((state) => ({
      players: [...state.players, player],
    })),
  removePlayer: (playerId) =>
    set((state) => ({
      players: state.players.filter((p) => p.playerId !== playerId),
    })),
  updatePlayerScore: (playerId, score) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.playerId === playerId ? { ...p, score } : p,
      ),
    })),
  setHost: (hostId) => set({ host: hostId }),
  updateConfig: (config) =>
    set((state) =>
      state.room
        ? {
            room: {
              ...state.room,
              config: { ...state.room.config, ...config },
            },
          }
        : {},
    ),
  leaveRoom: () =>
    set({
      room: null,
      players: [],
      host: null,
    }),
}));
