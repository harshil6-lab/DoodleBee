/**
 * Redis key model (`data-model.md` section 3).
 *
 * Every room-scoped key is built here so the namespace cannot drift between
 * writers, and so the TTL refresh has one authoritative list of keys to touch.
 */

export const ROOM_KEYS = {
  state: (roomId: string) => `room:${roomId}:state`,
  secret: (roomId: string) => `room:${roomId}:secret`,
  version: (roomId: string) => `room:${roomId}:version`,
  members: (roomId: string) => `room:${roomId}:members`,
  sockets: (roomId: string) => `room:${roomId}:sockets`,
  strokes: (roomId: string) => `room:${roomId}:strokes`,
  chat: (roomId: string) => `room:${roomId}:chat`,
  correct: (roomId: string) => `room:${roomId}:correct`,
  usedWords: (roomId: string) => `room:${roomId}:usedwords`,
  scores: (roomId: string) => `room:${roomId}:scores`,
  blocked: (roomId: string) => `room:${roomId}:blocked`,
  /**
   * Additive key required by the moderation table (`security-model.md`
   * section 5): the writer map names `ChatService` as the mute owner but the
   * `data-model.md` key list omitted a key for it. Additive, room-scoped, TTL'd
   * with the rest of the room.
   */
  muted: (roomId: string) => `room:${roomId}:muted`,
  outbox: (roomId: string) => `room:${roomId}:outbox`,
  lock: (roomId: string) => `lock:room:${roomId}`,
} as const;

/** `session:{token}` - auth plumbing with its own TTL (never a payload). */
export const sessionKey = (token: string): string => `session:${token}`;

/** `rateLimit:{scope}:{id}` - derived; rebuilt from scratch if Redis flushes. */
export const rateLimitKey = (scope: string, id: string): string =>
  `ratelimit:${scope}:${id}`;

/** `wordpool:{category}` - a read cache over the `words` table. */
export const wordPoolKey = (category: string): string => `wordpool:${category}`;

/**
 * Every room-scoped key. Used by the TTL refresh so a crashed process cannot
 * leak a room: each of these is `EXPIRE`d on every commit.
 */
export function roomScopedKeys(roomId: string): string[] {
  return [
    ROOM_KEYS.state(roomId),
    ROOM_KEYS.secret(roomId),
    ROOM_KEYS.version(roomId),
    ROOM_KEYS.members(roomId),
    ROOM_KEYS.sockets(roomId),
    ROOM_KEYS.strokes(roomId),
    ROOM_KEYS.chat(roomId),
    ROOM_KEYS.correct(roomId),
    ROOM_KEYS.usedWords(roomId),
    ROOM_KEYS.scores(roomId),
    ROOM_KEYS.blocked(roomId),
    ROOM_KEYS.muted(roomId),
    ROOM_KEYS.outbox(roomId),
  ];
}
