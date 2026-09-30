/**
 * The acknowledgement envelope and transport-level idempotency
 * (`realtime-contract.md` sections 5.2, 10.1 and 11).
 *
 * Every client event is answered with exactly one envelope. A duplicated
 * `eventId` does not re-run the action: the cached envelope is replayed
 * (`realtime-contract.md` section 11), which is what makes a client retry safe.
 *
 * The cache lives in process memory on purpose. `server-state-writer-map.md`
 * section 2.5 lists the dedupe LRU as transport plumbing rather than game
 * state, so losing it on a restart can only cost one re-applied action whose
 * ack had already been delivered.
 */

import { EVENT_ID_DEDUPE_CAPACITY } from '../../../shared/contract/constants.js';
import {
  ERROR_RETRYABLE,
  ERROR_USER_MESSAGE,
  type ErrorCode,
} from '../../../shared/contract/errors.js';
import { isAppError } from '../errors.js';

/** `realtime-contract.md` section 5.2: the success half of an ack. */
export interface AckSuccess {
  ok: true;
  eventId: string;
  version: number;
}

/** `realtime-contract.md` section 10.1: the failure half of an ack. */
export interface AckFailure {
  ok: false;
  eventId: string;
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

/** A handler's result: extra fields are merged into the success envelope. */
export type Ack = (AckSuccess & Record<string, unknown>) | AckFailure;

export function ackOk(
  eventId: string,
  version: number,
  fields?: Record<string, unknown>,
): Ack {
  return { ok: true, eventId, version, ...(fields ?? {}) };
}

/**
 * The single place a thrown value becomes a user-safe failure envelope.
 *
 * Internal detail is never returned: an unexpected error collapses to
 * `INTERNAL_ERROR` with the shared user-safe message
 * (`api-contract.md` section 5.1, `docs/AGENTS.md` section 13).
 */
export function ackError(eventId: string, error: unknown): AckFailure {
  if (isAppError(error)) {
    return {
      ok: false,
      eventId,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  }
  return {
    ok: false,
    eventId,
    code: 'INTERNAL_ERROR',
    message: ERROR_USER_MESSAGE.INTERNAL_ERROR,
    retryable: ERROR_RETRYABLE.INTERNAL_ERROR,
  };
}

export function isFailure(ack: Ack): ack is AckFailure {
  return ack.ok === false;
}

/**
 * Bounded per-player LRU of applied `eventId`s
 * (`realtime-contract.md` section 11: ~64 entries per player).
 */
export class RecentEventIds {
  private readonly perPlayer = new Map<string, Map<string, Ack>>();

  /** The envelope a duplicate `eventId` must be answered with, if any. */
  recall(playerId: string, eventId: string): Ack | undefined {
    return this.perPlayer.get(playerId)?.get(eventId);
  }

  remember(playerId: string, eventId: string, ack: Ack): void {
    let entries = this.perPlayer.get(playerId);
    if (entries === undefined) {
      entries = new Map<string, Ack>();
      this.perPlayer.set(playerId, entries);
    }
    // Re-insert so the entry becomes the most recently used one.
    entries.delete(eventId);
    entries.set(eventId, ack);
    while (entries.size > EVENT_ID_DEDUPE_CAPACITY) {
      const oldest = entries.keys().next();
      if (oldest.done === true) break;
      entries.delete(oldest.value);
    }
  }

  /** Drop a player's cache (used when their last socket goes away). */
  forget(playerId: string): void {
    this.perPlayer.delete(playerId);
  }

  size(playerId: string): number {
    return this.perPlayer.get(playerId)?.size ?? 0;
  }
}