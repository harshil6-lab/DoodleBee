/**
 * Token-bucket rate limiting (`api-contract.md` section 6, `security-model.md`
 * section 6).
 *
 * All limits are PROPOSED (`constants.ts` -> `RATE_LIMITS`): no approved
 * document states numbers, so they live in one constant and are configuration,
 * not policy. The bucket state is derived state in Redis
 * (`server-state-writer-map.md` section 2.5) and is rebuilt from scratch if
 * Redis flushes.
 */

import type { Redis } from 'ioredis';
import { rateLimitKey } from '../redis/keys.js';
import { RATE_LIMIT_SCRIPT } from '../redis/scripts.js';

export interface RateLimitRule {
  /** Bucket size. */
  capacity: number;
  /** Sustained refill, tokens per second. */
  refillPerSecond: number;
}

export class RateLimiter {
  constructor(private readonly redis: Redis) {}

  /** Consume one token. `false` means the caller must answer `RATE_LIMITED`. */
  async consume(
    scope: string,
    id: string,
    rule: RateLimitRule,
    now: number,
  ): Promise<boolean> {
    const ttlSeconds = Math.max(
      1,
      Math.ceil(rule.capacity / Math.max(rule.refillPerSecond, 0.001)) + 1,
    );
    const allowed = (await this.redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      rateLimitKey(scope, id),
      String(rule.capacity),
      String(rule.refillPerSecond),
      String(now),
      String(ttlSeconds),
    )) as number;
    return allowed === 1;
  }
}
