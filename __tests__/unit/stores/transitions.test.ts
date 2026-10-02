/**
 * Room store transition tests (Phase 1).
 *
 * Verifies the Zustand writers used by the lobby screen respond correctly
 * to the realtime events wired in the dispatcher.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
import { useRoomStore } from '../../../src/stores/room.store';
import type { Player } from '../../../src/types';

describe('room store transitions', () => {
  const basePlayer: Player = {
    playerId: 'p-1',
    nickname: 'alice',
    isHost: true,
    score: 0,
    isConnected: true,
  };

  beforeEach(() => {
    useRoomStore.getState().leaveRoom();
  });

  it('setRoomJoined populates room, players, and host', () => {
    const room = {
      roomId: 'r-1',
      roomCode: 'ABCDE',
      config: {
        roomName: 'Test Room',
        maxPlayers: 4,
        rounds: 3,
        roundDuration: 60,
        hints: 2,
      },
      players: [basePlayer],
      host: 'p-1',
    };
    useRoomStore.getState().setRoomJoined(room, [basePlayer], 'p-1');

    const state = useRoomStore.getState();
    expect(state.room).not.toBeNull();
    expect(state.room!.roomId).toBe('r-1');
    expect(state.players).toHaveLength(1);
    expect(state.host).toBe('p-1');
  });

  it('addPlayer appends to players list', () => {
    useRoomStore.getState().setRoomJoined(
      {
        roomId: 'r-1',
        roomCode: 'ABCDE',
        config: {
          roomName: 'R',
          maxPlayers: 4,
          rounds: 3,
          roundDuration: 60,
          hints: 0,
        },
        players: [basePlayer],
        host: 'p-1',
      },
      [basePlayer],
      'p-1',
    );

    const newPlayer: Player = {
      playerId: 'p-2',
      nickname: 'bob',
      isHost: false,
      score: 0,
      isConnected: true,
    };
    useRoomStore.getState().addPlayer(newPlayer);

    expect(useRoomStore.getState().players).toHaveLength(2);
    expect(
      useRoomStore.getState().players.find((p) => p.playerId === 'p-2'),
    ).toEqual(newPlayer);
  });

  it('removePlayer deletes by playerId', () => {
    useRoomStore.getState().setRoomJoined(
      {
        roomId: 'r-1',
        roomCode: 'ABCDE',
        config: {
          roomName: 'R',
          maxPlayers: 4,
          rounds: 3,
          roundDuration: 60,
          hints: 0,
        },
        players: [basePlayer],
        host: 'p-1',
      },
      [basePlayer],
      'p-1',
    );

    useRoomStore.getState().removePlayer('p-1');
    expect(useRoomStore.getState().players).toHaveLength(0);
  });

  it('setHost updates the host field', () => {
    useRoomStore.getState().setRoomJoined(
      {
        roomId: 'r-1',
        roomCode: 'ABCDE',
        config: {
          roomName: 'R',
          maxPlayers: 4,
          rounds: 3,
          roundDuration: 60,
          hints: 0,
        },
        players: [basePlayer],
        host: 'p-1',
      },
      [basePlayer],
      'p-1',
    );

    useRoomStore.getState().setHost('p-2');
    expect(useRoomStore.getState().host).toBe('p-2');
  });

  it('updateConfig merges config without replacing unchanged fields', () => {
    useRoomStore.getState().setRoomJoined(
      {
        roomId: 'r-1',
        roomCode: 'ABCDE',
        config: {
          roomName: 'Original',
          maxPlayers: 4,
          rounds: 3,
          roundDuration: 60,
          hints: 2,
        },
        players: [basePlayer],
        host: 'p-1',
      },
      [basePlayer],
      'p-1',
    );

    useRoomStore.getState().updateConfig({ roundDuration: 90 });
    const room = useRoomStore.getState().room!;
    expect(room.config.roundDuration).toBe(90);
    expect(room.config.maxPlayers).toBe(4); // unchanged
    expect(room.config.hints).toBe(2); // unchanged
  });

  it('leaveRoom resets all fields to initial state', () => {
    useRoomStore.getState().setRoomJoined(
      {
        roomId: 'r-1',
        roomCode: 'ABCDE',
        config: {
          roomName: 'R',
          maxPlayers: 4,
          rounds: 3,
          roundDuration: 60,
          hints: 0,
        },
        players: [basePlayer],
        host: 'p-1',
      },
      [basePlayer],
      'p-1',
    );

    useRoomStore.getState().leaveRoom();
    expect(useRoomStore.getState().room).toBeNull();
    expect(useRoomStore.getState().players).toHaveLength(0);
    expect(useRoomStore.getState().host).toBeNull();
  });
});
