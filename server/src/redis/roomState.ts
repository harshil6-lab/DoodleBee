/**
 * The live aggregate in Redis (`data-model.md` section 3).
 *
 * This module is deliberately dumb storage: it reads and writes the documented
 * keys and nothing else. Ownership of *which* field may be written is enforced
 * by the components in `game/` (`server-state-writer-map.md` section 1 rule 5),
 * not by hiding a mutator here.
 */

import type { Redis } from 'ioredis';
import type { ChatEntry } from '../../../shared/contract/server-payloads.js';
import { CHAT_RING_SIZE } from '../../../shared/contract/constants.js';
import {
  ADMISSION,
  CAPACITY_ADMISSION_SCRIPT,
  GUESS_RANK_SCRIPT,
} from './scripts.js';
import { ROOM_KEYS, roomScopedKeys, sessionKey } from './keys.js';
import type {
  CorrectGuesser,
  RoomAggregate,
  RoomMember,
  RoomSecret,
  SessionRecord,
  StrokeOp,
} from '../game/types.js';
import {
  GAME_PHASES,
  ROOM_STATUSES,
  type GamePhase,
  type RoomConfig,
  type RoomStatus,
  type RoundTimerState,
} from '../../../shared/contract/types.js';

// ------------------------------------------------------------ primitives ---

const encNum = (value: number | null): string =>
  value === null ? '' : String(value);
const decNum = (value: string | undefined): number | null =>
  value === undefined || value === '' ? null : Number(value);

const encBool = (value: boolean): string => (value ? '1' : '0');
const decBool = (value: string | undefined): boolean => value === '1';

const encStr = (value: string | null): string => value ?? '';
const decStr = (value: string | undefined): string | null =>
  value === undefined || value === '' ? null : value;

/**
 * Decode a bare-string enum. Values are written unquoted by `writeAggregate`,
 * but a JSON-quoted value from older data is tolerated so a mixed keyspace can
 * never silently fall back to the default.
 */
function decStringUnion<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = decStr(value);
  if (raw === null) return fallback;
  const plain = raw.startsWith('"') ? decJson<string>(raw, raw) : raw;
  return (allowed as readonly string[]).includes(plain) ? (plain as T) : fallback;
}

function decJson<T>(value: string | undefined, fallback: T): T {
  if (value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function decEntry<T>(raw: string | null): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ------------------------------------------------------- room aggregate ---

export async function readAggregate(
  redis: Redis,
  roomId: string,
): Promise<RoomAggregate | null> {
  const raw = await redis.hgetall(ROOM_KEYS.state(roomId));
  if (Object.keys(raw).length === 0) return null;
  return {
    roomId: decStr(raw['roomId']) ?? roomId,
    code: decStr(raw['code']) ?? '',
    // `status`/`phase` are written as bare strings by `writeAggregate`, so they
    // must be read as bare strings too (`decStr`), not JSON-parsed: a JSON read
    // would turn `IN_GAME` back into `WAITING` through the parse fallback.
    status: decStringUnion<RoomStatus>(
      raw['status'],
      ROOM_STATUSES,
      'WAITING',
    ),
    hostPlayerId: decStr(raw['hostPlayerId']) ?? '',
    config: decJson<RoomConfig>(raw['config'], {
      roomName: '',
      maxPlayers: 2,
      rounds: 1,
      roundDuration: 60,
      hints: 0,
    }),
    phase: decStringUnion<GamePhase>(raw['phase'], GAME_PHASES, 'WAITING'),
    gameId: decStr(raw['gameId']),
    gameStatus: decStr(raw['gameStatus']) as RoomAggregate['gameStatus'],
    roundId: decStr(raw['roundId']),
    roundNumber: decNum(raw['roundNumber']) ?? 0,
    roundsPlanned: decNum(raw['roundsPlanned']) ?? 0,
    drawerPlayerId: decStr(raw['drawerPlayerId']),
    previousDrawerPlayerId: decStr(raw['previousDrawerPlayerId']),
    nextDrawerPlayerId: decStr(raw['nextDrawerPlayerId']),
    wordId: decStr(raw['wordId']),
    roundEndTime: decNum(raw['roundEndTime']),
    roundTimerPaused: decBool(raw['roundTimerPaused']),
    roundStartedAt: decNum(raw['roundStartedAt']),
    pausedAt: decNum(raw['pausedAt']),
    startingDeadline: decNum(raw['startingDeadline']),
    resultsDeadline: decNum(raw['resultsDeadline']),
    hintsRemaining: decNum(raw['hintsRemaining']) ?? 0,
    revealedPositions: decJson<number[]>(raw['revealedPositions'], []),
    endReason: decStr(raw['endReason']) as RoomAggregate['endReason'],
  };
}

export async function writeAggregate(
  redis: Redis,
  aggregate: RoomAggregate,
): Promise<void> {
  await redis.hset(ROOM_KEYS.state(aggregate.roomId), {
    roomId: aggregate.roomId,
    code: aggregate.code,
    status: aggregate.status,
    hostPlayerId: aggregate.hostPlayerId,
    config: JSON.stringify(aggregate.config),
    phase: aggregate.phase,
    gameId: encStr(aggregate.gameId),
    gameStatus: encStr(aggregate.gameStatus),
    roundId: encStr(aggregate.roundId),
    roundNumber: String(aggregate.roundNumber),
    roundsPlanned: String(aggregate.roundsPlanned),
    drawerPlayerId: encStr(aggregate.drawerPlayerId),
    previousDrawerPlayerId: encStr(aggregate.previousDrawerPlayerId),
    nextDrawerPlayerId: encStr(aggregate.nextDrawerPlayerId),
    wordId: encStr(aggregate.wordId),
    roundEndTime: encNum(aggregate.roundEndTime),
    roundTimerPaused: encBool(aggregate.roundTimerPaused),
    roundStartedAt: encNum(aggregate.roundStartedAt),
    pausedAt: encNum(aggregate.pausedAt),
    startingDeadline: encNum(aggregate.startingDeadline),
    resultsDeadline: encNum(aggregate.resultsDeadline),
    hintsRemaining: String(aggregate.hintsRemaining),
    revealedPositions: JSON.stringify(aggregate.revealedPositions),
    endReason: encStr(aggregate.endReason),
  });
}

// ------------------------------------------------------------- members ---

export async function readMembers(
  redis: Redis,
  roomId: string,
): Promise<RoomMember[]> {
  const raw = await redis.hgetall(ROOM_KEYS.members(roomId));
  const members: RoomMember[] = [];
  for (const [playerId, json] of Object.entries(raw)) {
    const member = decEntry<RoomMember>(json);
    if (member !== null) members.push({ ...member, playerId });
  }
  members.sort((a, b) => a.seatOrder - b.seatOrder);
  return members;
}

export async function readMember(
  redis: Redis,
  roomId: string,
  playerId: string,
): Promise<RoomMember | null> {
  const raw = await redis.hget(ROOM_KEYS.members(roomId), playerId);
  const member = decEntry<RoomMember>(raw);
  return member === null ? null : { ...member, playerId };
}

export async function writeMember(
  redis: Redis,
  roomId: string,
  member: RoomMember,
): Promise<void> {
  await redis.hset(
    ROOM_KEYS.members(roomId),
    member.playerId,
    JSON.stringify({ ...member, playerId: undefined }),
  );
}

export async function deleteMember(
  redis: Redis,
  roomId: string,
  playerId: string,
): Promise<void> {
  await redis.hdel(ROOM_KEYS.members(roomId), playerId);
}

/**
 * Atomic capacity-checked admission (`scripts.ts`). Returns the outcome so the
 * caller can distinguish "full" from "already a member".
 */
export async function admitMember(
  redis: Redis,
  roomId: string,
  member: RoomMember,
  maxPlayers: number,
): Promise<(typeof ADMISSION)[keyof typeof ADMISSION]> {
  const result = (await redis.eval(
    CAPACITY_ADMISSION_SCRIPT,
    1,
    ROOM_KEYS.members(roomId),
    member.playerId,
    String(maxPlayers),
    JSON.stringify({ ...member, playerId: undefined }),
  )) as number;
  if (result === ADMISSION.FULL) return ADMISSION.FULL;
  if (result === ADMISSION.ALREADY_MEMBER) return ADMISSION.ALREADY_MEMBER;
  return ADMISSION.ADMITTED;
}

// ------------------------------------------------------------- sockets ---

export async function readSockets(
  redis: Redis,
  roomId: string,
  playerId: string,
): Promise<string[]> {
  const raw = await redis.hget(ROOM_KEYS.sockets(roomId), playerId);
  return decJson<string[]>(raw ?? undefined, []);
}

export async function readAllSockets(
  redis: Redis,
  roomId: string,
): Promise<Map<string, string[]>> {
  const raw = await redis.hgetall(ROOM_KEYS.sockets(roomId));
  const map = new Map<string, string[]>();
  for (const [playerId, json] of Object.entries(raw)) {
    const ids = decJson<string[]>(json, []);
    if (ids.length > 0) map.set(playerId, ids);
  }
  return map;
}

export async function addSocket(
  redis: Redis,
  roomId: string,
  playerId: string,
  socketId: string,
): Promise<void> {
  const current = await readSockets(redis, roomId, playerId);
  if (!current.includes(socketId)) current.push(socketId);
  await redis.hset(
    ROOM_KEYS.sockets(roomId),
    playerId,
    JSON.stringify(current),
  );
}

export async function removeSocket(
  redis: Redis,
  roomId: string,
  playerId: string,
  socketId: string,
): Promise<string[]> {
  const current = await readSockets(redis, roomId, playerId);
  const next = current.filter((id) => id !== socketId);
  if (next.length === 0) {
    await redis.hdel(ROOM_KEYS.sockets(roomId), playerId);
  } else {
    await redis.hset(ROOM_KEYS.sockets(roomId), playerId, JSON.stringify(next));
  }
  return next;
}

// -------------------------------------------------------------- secret ---

export async function readSecret(
  redis: Redis,
  roomId: string,
): Promise<RoomSecret | null> {
  const raw = await redis.hgetall(ROOM_KEYS.secret(roomId));
  const secretWord = decStr(raw['secretWord']);
  const wordId = decStr(raw['wordId']);
  if (secretWord === null || wordId === null) return null;
  return {
    wordId,
    secretWord,
    maskedWord: decStr(raw['maskedWord']) ?? '',
  };
}

export async function writeSecret(
  redis: Redis,
  roomId: string,
  secret: RoomSecret,
): Promise<void> {
  await redis.hset(ROOM_KEYS.secret(roomId), {
    wordId: secret.wordId,
    secretWord: secret.secretWord,
    maskedWord: secret.maskedWord,
  });
}

export async function clearSecret(redis: Redis, roomId: string): Promise<void> {
  await redis.del(ROOM_KEYS.secret(roomId));
}

// -------------------------------------------------------------- version ---

export async function readVersion(
  redis: Redis,
  roomId: string,
): Promise<number> {
  const raw = await redis.get(ROOM_KEYS.version(roomId));
  return raw === null ? 0 : Number(raw);
}

/** The single version writer; only the room commit path calls this. */
export async function nextVersion(
  redis: Redis,
  roomId: string,
): Promise<number> {
  return redis.incr(ROOM_KEYS.version(roomId));
}

// -------------------------------------------------------------- scores ---

export async function readScores(
  redis: Redis,
  roomId: string,
): Promise<Record<string, number>> {
  const raw = await redis.hgetall(ROOM_KEYS.scores(roomId));
  const scores: Record<string, number> = {};
  for (const [playerId, value] of Object.entries(raw)) {
    scores[playerId] = Number(value);
  }
  return scores;
}

export async function readScore(
  redis: Redis,
  roomId: string,
  playerId: string,
): Promise<number> {
  const raw = await redis.hget(ROOM_KEYS.scores(roomId), playerId);
  return raw === null ? 0 : Number(raw);
}

export async function addScore(
  redis: Redis,
  roomId: string,
  playerId: string,
  delta: number,
): Promise<number> {
  return redis.hincrby(ROOM_KEYS.scores(roomId), playerId, delta);
}

export async function clearScores(redis: Redis, roomId: string): Promise<void> {
  await redis.del(ROOM_KEYS.scores(roomId));
}

// ------------------------------------------------------------- correct ---

export async function readCorrect(
  redis: Redis,
  roomId: string,
): Promise<CorrectGuesser[]> {
  const ids = await redis.lrange(ROOM_KEYS.correct(roomId), 0, -1);
  return ids.map((playerId, index) => ({ playerId, rank: index + 1 }));
}

/** Atomic rank assignment (`scripts.ts`, D03-017). 0 means already correct. */
export async function assignGuessRank(
  redis: Redis,
  roomId: string,
  playerId: string,
): Promise<number> {
  return (await redis.eval(
    GUESS_RANK_SCRIPT,
    1,
    ROOM_KEYS.correct(roomId),
    playerId,
  )) as number;
}

export async function clearCorrect(
  redis: Redis,
  roomId: string,
): Promise<void> {
  await redis.del(ROOM_KEYS.correct(roomId));
}

// ---------------------------------------------------------------- chat ---

export async function readChat(
  redis: Redis,
  roomId: string,
): Promise<ChatEntry[]> {
  const raw = await redis.lrange(ROOM_KEYS.chat(roomId), 0, -1);
  const entries: ChatEntry[] = [];
  for (const item of raw) {
    const entry = decEntry<ChatEntry>(item);
    if (entry !== null) entries.push(entry);
  }
  return entries;
}

export async function appendChat(
  redis: Redis,
  roomId: string,
  entry: ChatEntry,
): Promise<void> {
  const key = ROOM_KEYS.chat(roomId);
  await redis
    .multi()
    .rpush(key, JSON.stringify(entry))
    .ltrim(key, -CHAT_RING_SIZE, -1)
    .exec();
}

export async function clearChat(
  redis: Redis,
  roomId: string,
): Promise<void> {
  await redis.del(ROOM_KEYS.chat(roomId));
}

// ------------------------------------------------------------- strokes ---

export async function readStrokeOps(
  redis: Redis,
  roomId: string,
): Promise<StrokeOp[]> {
  const raw = await redis.lrange(ROOM_KEYS.strokes(roomId), 0, -1);
  const ops: StrokeOp[] = [];
  for (const item of raw) {
    const op = decEntry<StrokeOp>(item);
    if (op !== null) ops.push(op);
  }
  return ops;
}

export async function appendStrokeOp(
  redis: Redis,
  roomId: string,
  op: StrokeOp,
): Promise<void> {
  const key = ROOM_KEYS.strokes(roomId);
  await redis
    .multi()
    .rpush(key, JSON.stringify(op))
    .ltrim(key, -STROKE_OP_CAP, -1)
    .exec();
}

export async function clearStrokes(
  redis: Redis,
  roomId: string,
): Promise<void> {
  await redis.del(ROOM_KEYS.strokes(roomId));
}

/**
 * A hard bound on the op list. The 30 s window is applied on read
 * (`game/drawingGateway.ts`); this cap only stops a runaway list.
 */
export const STROKE_OP_CAP = 4000;

// ----------------------------------------------------------- usedwords ---

export async function addUsedWord(
  redis: Redis,
  roomId: string,
  wordId: string,
): Promise<void> {
  await redis.sadd(ROOM_KEYS.usedWords(roomId), wordId);
}

export async function readUsedWords(
  redis: Redis,
  roomId: string,
): Promise<string[]> {
  return redis.smembers(ROOM_KEYS.usedWords(roomId));
}

export async function clearUsedWords(
  redis: Redis,
  roomId: string,
): Promise<void> {
  await redis.del(ROOM_KEYS.usedWords(roomId));
}

// ------------------------------------------------------------- blocked ---

export async function blockPlayer(
  redis: Redis,
  roomId: string,
  playerId: string,
): Promise<void> {
  await redis.sadd(ROOM_KEYS.blocked(roomId), playerId);
}

export async function isBlocked(
  redis: Redis,
  roomId: string,
  playerId: string,
): Promise<boolean> {
  return (await redis.sismember(ROOM_KEYS.blocked(roomId), playerId)) === 1;
}

// --------------------------------------------------------------- muted ---

export async function mutePlayer(
  redis: Redis,
  roomId: string,
  playerId: string,
): Promise<void> {
  await redis.sadd(ROOM_KEYS.muted(roomId), playerId);
}

export async function unmutePlayer(
  redis: Redis,
  roomId: string,
  playerId: string,
): Promise<void> {
  await redis.srem(ROOM_KEYS.muted(roomId), playerId);
}

export async function isMuted(
  redis: Redis,
  roomId: string,
  playerId: string,
): Promise<boolean> {
  return (await redis.sismember(ROOM_KEYS.muted(roomId), playerId)) === 1;
}

// -------------------------------------------------------------- outbox ---

export async function appendOutbox(
  redis: Redis,
  roomId: string,
  entry: unknown,
): Promise<void> {
  await redis.rpush(ROOM_KEYS.outbox(roomId), JSON.stringify(entry));
}

export async function readOutbox(
  redis: Redis,
  roomId: string,
): Promise<unknown[]> {
  const raw = await redis.lrange(ROOM_KEYS.outbox(roomId), 0, -1);
  return raw.map((item) => decEntry<unknown>(item)).filter((v) => v !== null);
}

export async function removeOutboxEntry(
  redis: Redis,
  roomId: string,
  entry: unknown,
): Promise<void> {
  await redis.lrem(ROOM_KEYS.outbox(roomId), 1, JSON.stringify(entry));
}

// ------------------------------------------------------------- session ---

export async function readSession(
  redis: Redis,
  token: string,
): Promise<SessionRecord | null> {
  const raw = await redis.hgetall(sessionKey(token));
  if (Object.keys(raw).length === 0) return null;
  const playerId = decStr(raw['playerId']);
  if (playerId === null) return null;
  return {
    playerId,
    userId: decStr(raw['userId']) ?? playerId,
    roomId: decStr(raw['roomId']),
    createdAt: decNum(raw['createdAt']) ?? 0,
  };
}

export async function writeSession(
  redis: Redis,
  token: string,
  session: SessionRecord,
  ttlSeconds: number,
): Promise<void> {
  const key = sessionKey(token);
  await redis
    .multi()
    .hset(key, {
      playerId: session.playerId,
      userId: session.userId,
      roomId: encStr(session.roomId),
      createdAt: String(session.createdAt),
    })
    .expire(key, ttlSeconds)
    .exec();
}

export async function bindSessionRoom(
  redis: Redis,
  token: string,
  roomId: string,
  ttlSeconds: number,
): Promise<void> {
  const key = sessionKey(token);
  await redis
    .multi()
    .hset(key, { roomId })
    .expire(key, ttlSeconds)
    .exec();
}

export async function deleteSession(
  redis: Redis,
  token: string,
): Promise<void> {
  await redis.del(sessionKey(token));
}

// ------------------------------------------------------------- room ttl ---

/**
 * Refresh the idle TTL on every room-scoped key. Called at the end of each
 * commit so an active room never expires and a dead one always does.
 */
export async function refreshRoomTtl(
  redis: Redis,
  roomId: string,
  ttlSeconds: number,
): Promise<void> {
  const pipeline = redis.pipeline();
  for (const key of roomScopedKeys(roomId)) {
    pipeline.expire(key, ttlSeconds);
  }
  await pipeline.exec();
}

/** Drop every room-scoped key on an explicit close. */
export async function deleteRoomKeys(
  redis: Redis,
  roomId: string,
): Promise<void> {
  const keys = roomScopedKeys(roomId);
  if (keys.length > 0) await redis.del(...keys);
}

/** What the projector needs to render a snapshot. */
export interface AggregateSnapshot {
  aggregate: RoomAggregate;
  members: RoomMember[];
  secret: RoomSecret | null;
  scores: Record<string, number>;
  correct: CorrectGuesser[];
  chat: ChatEntry[];
  strokes: StrokeOp[];
  version: number;
  sockets: Map<string, string[]>;
  timer: RoundTimerState;
}
