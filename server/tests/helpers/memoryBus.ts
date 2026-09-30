/**
 * An in-memory `Bus` (`testing-strategy.md` section 2: unit tests stub at the
 * boundary). It records what the server *would* have emitted, which is how the
 * secret-word isolation tests assert on the real payloads services produce.
 */

import type { Bus } from '../../src/game/bus.js';

export type EmissionScope = 'room' | 'roomExcept' | 'player' | 'socket' | 'all';

export interface Emission {
  scope: EmissionScope;
  event: string;
  payload: unknown;
  /** The room for `room`/`roomExcept`/`player`; the socket id for `socket`. */
  target: string;
  /** The excluded player for `roomExcept`. */
  excludedPlayerId?: string;
}

export class MemoryBus implements Bus {
  readonly emissions: Emission[] = [];

  toRoom(roomId: string, event: string, payload: unknown): void {
    this.emissions.push({ scope: 'room', event, payload, target: roomId });
  }

  async toRoomExceptPlayer(
    roomId: string,
    excludePlayerId: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    this.emissions.push({
      scope: 'roomExcept',
      event,
      payload,
      target: roomId,
      excludedPlayerId: excludePlayerId,
    });
  }

  async toPlayer(
    roomId: string,
    playerId: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    this.emissions.push({ scope: 'player', event, payload, target: playerId });
  }

  toSocket(socketId: string, event: string, payload: unknown): void {
    this.emissions.push({ scope: 'socket', event, payload, target: socketId });
  }

  toAllRooms(event: string, payload: unknown): void {
    this.emissions.push({ scope: 'all', event, payload, target: '*' });
  }

  /** Every emission of one event name, in order. */
  of(event: string): Emission[] {
    return this.emissions.filter((emission) => emission.event === event);
  }

  clear(): void {
    this.emissions.length = 0;
  }
}