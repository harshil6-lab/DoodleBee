/**
 * Lua scripts for the operations that must be atomic
 * (`server-state-writer-map.md` section 3, D03-017).
 *
 * Only three things need true atomicity:
 * 1. guess rank assignment - two correct guesses must never share rank 1;
 * 2. capacity admission - a join must not overshoot `maxPlayers`;
 * 3. the version bump - `INCR` is already atomic, so it needs no script.
 *
 * Everything else is serialized by `withRoomLock` (`game/lock.ts`).
 */

/**
 * Assign a correct-guess rank.
 * KEYS[1] = room:{id}:correct   ARGV[1] = playerId
 * Returns the 1-based rank, or 0 when the player was already present.
 */
export const GUESS_RANK_SCRIPT = `
local key = KEYS[1]
local playerId = ARGV[1]
if redis.call('LPOS', key, playerId) then
  return 0
end
return redis.call('RPUSH', key, playerId)
`;

/**
 * Admit a member without exceeding capacity.
 * KEYS[1] = room:{id}:members
 * ARGV[1] = playerId, ARGV[2] = maxPlayers, ARGV[3] = member JSON
 * Returns 1 admitted, 2 already a member (rebind/rejoin), 0 room full.
 */
export const CAPACITY_ADMISSION_SCRIPT = `
local members = KEYS[1]
local playerId = ARGV[1]
local maxPlayers = tonumber(ARGV[2])
local payload = ARGV[3]
if redis.call('HEXISTS', members, playerId) == 1 then
  redis.call('HSET', members, playerId, payload)
  return 2
end
if redis.call('HLEN', members) >= maxPlayers then
  return 0
end
redis.call('HSET', members, playerId, payload)
return 1
`;

/** Admission outcomes mirrored in TypeScript. */
export const ADMISSION = {
  FULL: 0,
  ADMITTED: 1,
  ALREADY_MEMBER: 2,
} as const;

/**
 * A token bucket (`security-model.md` section 6).
 * KEYS[1] = ratelimit:{scope}:{id}
 * ARGV[1] = capacity, ARGV[2] = refill per second, ARGV[3] = now (ms),
 * ARGV[4] = ttl seconds.
 * Returns 1 when a token was consumed, 0 when the bucket was empty.
 */
export const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then tokens = capacity; ts = now end
local elapsed = math.max(0, now - ts) / 1000
tokens = math.min(capacity, tokens + elapsed * refill)
local allowed = 0
if tokens >= 1 then tokens = tokens - 1; allowed = 1 end
redis.call('HSET', key, 'tokens', tostring(tokens), 'ts', tostring(now))
redis.call('EXPIRE', key, ttl)
return allowed
`;
