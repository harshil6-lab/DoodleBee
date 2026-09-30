/**
 * Round timer (`state-machine.md` section 8, D03-020).
 *
 * This module is the single writer of `round.roundEndTime` and
 * `round.roundTimerPaused`. Every timer is an absolute server-clock instant,
 * never a stored countdown, so a process restart neither loses nor drifts the
 * remaining time.
 *
 * The pause behaviour (drawer grace extends the clock on resume) is a
 * PROPOSED value recorded as C-06: the PRD is silent on it.
 */

import type { RoomAggregate } from './types.js';

/** Write `roundEndTime` on round entry. */
export function startRoundTimer(
  aggregate: RoomAggregate,
  now: number,
  durationMs: number,
): void {
  aggregate.roundEndTime = now + durationMs;
  aggregate.roundTimerPaused = false;
  aggregate.roundStartedAt = now;
  aggregate.pausedAt = null;
}

/** Pause on drawer disconnect. Returns false when it was already paused. */
export function pauseRoundTimer(
  aggregate: RoomAggregate,
  now: number,
): boolean {
  if (aggregate.roundTimerPaused) return false;
  aggregate.roundTimerPaused = true;
  aggregate.pausedAt = now;
  return true;
}

/**
 * Resume on drawer reconnect, extending `roundEndTime` by the paused duration.
 * The clock is never shortened.
 */
export function resumeRoundTimer(
  aggregate: RoomAggregate,
  now: number,
): boolean {
  if (!aggregate.roundTimerPaused) return false;
  const pausedAt = aggregate.pausedAt ?? now;
  const pausedFor = Math.max(0, now - pausedAt);
  aggregate.roundEndTime = (aggregate.roundEndTime ?? now) + pausedFor;
  aggregate.roundTimerPaused = false;
  aggregate.pausedAt = null;
  return true;
}
