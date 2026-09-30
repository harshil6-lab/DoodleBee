/**
 * Drawer selection (D03-011, `state-machine.md` section 6.1).
 *
 * Uniform random over an eligible pool that excludes the immediately previous
 * drawer, with a documented fallback when that leaves nobody. The pool is
 * ordered before selection so the same inputs produce the same pool; the choice
 * is random so a player cannot count turns.
 */

import type { IdSource } from './ids.js';
import type { RoomMember } from './types.js';

/** Connected players, ordered, excluding the previous drawer when possible. */
export function eligibleDrawerPool(
  members: readonly RoomMember[],
  previousDrawerPlayerId: string | null,
): string[] {
  const connected = members
    .filter((member) => member.isConnected)
    .map((member) => member.playerId)
    .sort();
  const withoutPrevious = connected.filter(
    (playerId) => playerId !== previousDrawerPlayerId,
  );
  return withoutPrevious.length > 0 ? withoutPrevious : connected;
}

/** The next drawer, or `null` when nobody is connected. */
export function selectDrawer(
  members: readonly RoomMember[],
  previousDrawerPlayerId: string | null,
  ids: IdSource,
): string | null {
  const pool = eligibleDrawerPool(members, previousDrawerPlayerId);
  if (pool.length === 0) return null;
  const index = ids.randomInt(pool.length);
  return pool[Math.min(index, pool.length - 1)] ?? null;
}

/** Connected players who are not the drawer (`state-machine.md` section 6.2). */
export function eligibleGuessers(
  members: readonly RoomMember[],
  drawerPlayerId: string | null,
): RoomMember[] {
  return members.filter(
    (member) => member.isConnected && member.playerId !== drawerPlayerId,
  );
}
