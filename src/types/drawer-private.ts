/**
 * DRAWER-PRIVATE contract - the secret word boundary (ADR section 9).
 *
 * This module intentionally lives OUTSIDE the public types barrel.
 * It may only be imported by drawer-facing code (the drawer store and
 * drawer screens/components). It must never be imported by guesser-facing
 * code, by the public realtime layer, or re-exported from `src/types/index.ts`.
 */
import type {
  ServerToClientEvent,
  SnapshotRound,
  StateSnapshotPayload,
} from './index';

/**
 * `drawer:selected` payload as delivered to the drawer only.
 * The server sends a different (public) payload to every other player.
 */
export interface DrawerSelectedPayload {
  type: ServerToClientEvent.DrawerSelected;
  playerId: string;
  /**
   * SECRET - drawer only. Per the state writer map this value is written
   * exclusively by the drawer store and must never enter public state,
   * public payloads, logs, or analytics.
   */
  secretWord: string;
  maskedWord: string;
}

/**
 * The drawer's own view of the round inside a reconnection snapshot. The
 * secret word is required because the server keeps it only for the current
 * drawer while the phase is `ROUND_ACTIVE` (`reconnect-protocol.md` section 4).
 */
export interface DrawerSnapshotRound extends SnapshotRound {
  /**
   * SECRET - drawer only. Never a public field, never logged, never sent to
   * analytics.
   */
  secretWord: string;
}

/**
 * The drawer-only variant of `response:state:snapshot`. This is the second and
 * last payload allowed to carry the secret word (after `DrawerSelectedPayload`)
 * and must never be re-exported from `src/types/index.ts`.
 */
export type DrawerStateSnapshot = Omit<StateSnapshotPayload, 'round'> & {
  round: DrawerSnapshotRound;
};
