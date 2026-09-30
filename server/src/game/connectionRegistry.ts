/**
 * Presence and grace periods (`reconnect-protocol.md` sections 6 and 7,
 * `server-state-writer-map.md` section 2.2).
 *
 * The single writer of `player.isConnected`, `player.graceDeadline` and
 * `player.socketIds[]`. A disconnect is not a leave: the seat, role and score
 * survive, and `room_players.left_at` is never set here.
 */

import {
  DRAWER_GRACE_MS,
  GUESSER_GRACE_MS,
} from '../../../shared/contract/constants.js';
import {
  readAggregate,
  readMember,
  readMembers,
  removeSocket,
  writeAggregate,
  writeMember,
} from '../redis/roomState.js';
import { pauseRoundTimer } from './roundTimer.js';
import type { Services } from './services.js';

export class ConnectionRegistry {
  constructor(private readonly services: Services) {}

  /**
   * Handle one socket dropping. Only the last live socket for a player ends
   * their presence; an overlapping reconnect keeps them connected.
   */
  async handleDisconnect(
    roomId: string,
    playerId: string,
    socketId: string,
  ): Promise<void> {
    const remaining = await removeSocket(
      this.services.redis,
      roomId,
      playerId,
      socketId,
    );
    if (remaining.length > 0) return;

    const members = await readMembers(this.services.redis, roomId);
    const member = members.find((entry) => entry.playerId === playerId);
    if (member === undefined) return;

    const now = this.services.clock.now();
    let hostTransfer: string | null = null;
    let graceDeadline = now + GUESSER_GRACE_MS;
    const { version } = await this.services.commit(roomId, async () => {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null) return null;
      const isDrawer =
        aggregate.drawerPlayerId === playerId &&
        aggregate.phase === 'ROUND_ACTIVE';
      graceDeadline = now + (isDrawer ? DRAWER_GRACE_MS : GUESSER_GRACE_MS);

      const stored = await readMember(this.services.redis, roomId, playerId);
      if (stored === null) return null;
      stored.isConnected = false;
      stored.graceDeadline = graceDeadline;
      await writeMember(this.services.redis, roomId, stored);

      if (aggregate.hostPlayerId === playerId) {
        const projected = members.map((entry) =>
          entry.playerId === playerId
            ? { ...entry, isConnected: false }
            : entry,
        );
        hostTransfer = this.services.hostTransfer.applyTransfer(
          aggregate,
          projected,
        );
      }
      if (isDrawer) pauseRoundTimer(aggregate, now);
      await writeAggregate(this.services.redis, aggregate);
      return null;
    });

    this.services.bus.toRoom(roomId, 'player:disconnected', {
      type: 'player:disconnected',
      playerId,
      graceDeadline,
      version,
    });
    if (hostTransfer !== null) {
      this.services.bus.toRoom(roomId, 'host:transferred', {
        type: 'host:transferred',
        hostPlayerId: hostTransfer,
        version,
      });
    }
  }

  /**
   * Expire grace periods. A guesser's seat is kept silently; a drawer's expiry
   * ends the round as `DRAWER_ABANDONED` (`reconnect-protocol.md` section 6.2).
   */
  async sweep(): Promise<void> {
    for (const roomId of [...this.services.activeRooms]) {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null) continue;
      const members = await readMembers(this.services.redis, roomId);
      const now = this.services.clock.now();
      for (const member of members) {
        if (
          member.isConnected ||
          member.graceDeadline === null ||
          now < member.graceDeadline
        ) {
          continue;
        }
        if (
          aggregate.drawerPlayerId === member.playerId &&
          aggregate.phase === 'ROUND_ACTIVE'
        ) {
          await this.services.rounds.endRound(roomId, 'DRAWER_ABANDONED');
          break;
        }
        await this.services.commit(roomId, async () => {
          const stored = await readMember(
            this.services.redis,
            roomId,
            member.playerId,
          );
          if (stored === null) return null;
          stored.graceDeadline = null;
          await writeMember(this.services.redis, roomId, stored);
          return null;
        });
      }
    }
  }
}
