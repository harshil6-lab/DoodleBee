/**
 * AD-004 _probe instrumentation utilities (CONDITIONAL).
 *
 * Adds timestamp fields to drawing events for later performance measurement.
 *
 * Rules:
 * - Only active in __DEV__ builds (guarded by process.env.NODE_ENV)
 * - Does NOT alter gameplay semantics, stroke ordering, or batching
 * - Timestamps are logged but never displayed to users
 * - secretWord is never included in probe payloads (logger redacts)
 * - Instrumentation can be removed cleanly by deleting this module
 *
 * Measurement protocol (deferred to separate AD-004 pass):
 *   t0 = client send time (ms since epoch) — captured at touch start / emit
 *   t1 = server receipt time — captured in dispatcher draw handlers
 *   t2 = ack receipt time — would need callback wiring
 *   t3 = render completion — would need Skia frame callback
 *
 * Current implementation captures t0 (client send) and logs t1 (server receive).
 * t2/t3 are left as TODO stubs for the future measurement pass.
 */

/** Capture a client-side send timestamp. Returns empty object outside __DEV__. */
export function probeT0(): Record<string, unknown> {
  if (!__DEV__) return {};
  return { _probe: { t0: performance.now() } };
}

/** Capture a server-receipt timestamp in dispatcher handlers. */
export function probeT1(event: string): void {
  if (!__DEV__) return;
  // Log via existing logger so secretWord is auto-redacted.
  const { logger } = require('../utils/logger');
  logger.debug({ event: 'probe-t1', event_name: event, t1: performance.now() });
}
