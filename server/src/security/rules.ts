/**
 * Named rate-limit rules derived from the single `RATE_LIMITS` constant
 * (`api-contract.md` section 6). Every value is PROPOSED.
 */

import { RATE_LIMITS } from '../../../shared/contract/constants.js';
import type { RateLimitRule } from './rateLimit.js';

const perMinute = (count: number): RateLimitRule => ({
  capacity: count,
  refillPerSecond: count / 60,
});

const perHour = (count: number): RateLimitRule => ({
  capacity: count,
  refillPerSecond: count / 3600,
});

export const RULES = {
  sessionCreate: perMinute(RATE_LIMITS.sessionCreatePerMinutePerIp),
  roomCreateSession: perMinute(RATE_LIMITS.roomCreatePerMinutePerSession),
  roomCreateIp: perHour(RATE_LIMITS.roomCreatePerHourPerIp),
  roomJoin: perMinute(RATE_LIMITS.roomJoinPerMinutePerSession),
  configUpdate: perMinute(RATE_LIMITS.configUpdatePerMinutePerRoom),
  nickname: perMinute(10),
  snapshot: perMinute(RATE_LIMITS.snapshotPerMinutePerSocket),
} as const;
