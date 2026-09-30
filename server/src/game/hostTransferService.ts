/**
 * Host transfer (FR-026, `state-machine.md` section 6.3).
 *
 * The single writer of `room.hostPlayerId`. The rule (earliest `joinedAt`,
 * then lowest `playerId`) is a PROPOSED resolution of FR-026: no approved
 * document defines "eligible". The old host never regains the role on return.
 */

import type { RoomAggregate, RoomMember } from './types.js';

export class HostTransferService {
  /** The next host among connected members, or `null` when nobody is online. */
  selectNextHost(members: readonly RoomMember[]): string | null {
    const connected = members.filter((member) => member.isConnected);
    if (connected.length === 0) return null;
    const sorted = [...connected].sort((left, right) => {
      if (left.joinedAt !== right.joinedAt) return left.joinedAt - right.joinedAt;
      return left.playerId < right.playerId
        ? -1
        : left.playerId > right.playerId
          ? 1
          : 0;
    });
    return sorted[0]?.playerId ?? null;
  }

  /**
   * Apply a transfer inside the caller's commit. Returns the new host id, or
   * `null` when no transfer is needed (no connected candidate, or the current
   * host is still the right answer).
   */
  applyTransfer(
    aggregate: RoomAggregate,
    members: readonly RoomMember[],
  ): string | null {
    const candidate = this.selectNextHost(members);
    if (candidate === null || candidate === aggregate.hostPlayerId) return null;
    aggregate.hostPlayerId = candidate;
    return candidate;
  }
}
