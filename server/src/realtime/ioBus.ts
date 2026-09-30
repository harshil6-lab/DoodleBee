/**
 * The Socket.IO implementation of the `Bus` boundary
 * (`realtime-contract.md` section 4).
 *
 * The room channel is the only membership-bearing channel. `toRoomExceptPlayer`
 * resolves the excluded player's live socket ids from Redis (never from memory)
 * so the exclusion survives a reconnect overlap, and there is deliberately no
 * room whose membership is the drawer: drawer-private payloads are addressed to
 * socket ids, which Socket.IO does not enumerate to peers.
 */

import type { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import type { Bus } from '../game/bus.js';
import { readSockets } from '../redis/roomState.js';

/** The one public channel every admitted, connected member joins. */
export function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

export class SocketIoBus implements Bus {
  constructor(
    private readonly io: Server,
    private readonly redis: Redis,
  ) {}

  toRoom(roomId: string, event: string, payload: unknown): void {
    this.io.to(roomChannel(roomId)).emit(event, payload);
  }

  async toRoomExceptPlayer(
    roomId: string,
    excludePlayerId: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    const excluded = await readSockets(this.redis, roomId, excludePlayerId);
    const room = this.io.to(roomChannel(roomId));
    // `except()` returns a NEW operator instead of mutating, so the result has
    // to be reassigned - otherwise the exclusion is silently discarded and the
    // drawer receives its own strokes.
    const target = excluded.length > 0 ? room.except(excluded) : room;
    target.emit(event, payload);
  }

  async toPlayer(
    roomId: string,
    playerId: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    const socketIds = await readSockets(this.redis, roomId, playerId);
    if (socketIds.length === 0) return;
    this.io.to(socketIds).emit(event, payload);
  }

  toSocket(socketId: string, event: string, payload: unknown): void {
    this.io.to(socketId).emit(event, payload);
  }

  /**
   * Used only for the `SERVER_SHUTDOWN` notice. The transport is being torn
   * down, so every live socket is told directly rather than by enumerating
   * rooms (`realtime-contract.md` section 2.3).
   */
  toAllRooms(event: string, payload: unknown): void {
    for (const socket of this.io.sockets.sockets.values()) {
      socket.emit(event, payload);
    }
  }
}