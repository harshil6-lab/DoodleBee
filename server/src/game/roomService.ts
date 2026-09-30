/**
 * Room lifecycle (`state-machine.md` sections 3.1 and 4,
 * `server-state-writer-map.md` section 2.1).
 *
 * The single writer of `room.members[]`, `room.config`, and `room.status`'s
 * `CLOSED` value. Admission is the persistence half of joining; the socket
 * `join:room` is the realtime half and refuses a player with no admission
 * record.
 */

import { and, eq, sql } from 'drizzle-orm';
import { ROOM_TTL_SECONDS } from '../../../shared/contract/constants.js';
import { roomPlayers, rooms } from '../db/schema.js';
import { AppError } from '../errors.js';
import {
  admitMember,
  blockPlayer,
  clearChat,
  clearCorrect,
  clearScores,
  clearStrokes,
  clearUsedWords,
  deleteMember,
  deleteRoomKeys,
  isBlocked,
  readAggregate,
  readAllSockets,
  readMember,
  readMembers,
  readScores,
  readVersion,
  refreshRoomTtl,
  addSocket,
  writeAggregate,
  writeMember,
} from '../redis/roomState.js';
import { ADMISSION } from '../redis/scripts.js';
import { resumeRoundTimer } from './roundTimer.js';
import type { RoomConfig, PublicPlayer } from '../../../shared/contract/types.js';
import type { RoomAggregate, RoomMember } from './types.js';
import type { Services } from './services.js';

export interface RoomOwner {
  playerId: string;
  userId: string;
  nickname: string;
}

export interface RoomJoinView {
  roomId: string;
  roomCode: string;
  config: RoomConfig;
  players: PublicPlayer[];
  host: string;
}

export interface JoinResult {
  room: RoomJoinView;
  isHost: boolean;
  admittedAt: string;
}

export interface RoomJoinedPayload {
  type: 'room:joined';
  version: number;
  serverNow: number;
  room: {
    roomId: string;
    roomCode: string;
    roomName: string;
    status: RoomAggregate['status'];
    hostPlayerId: string;
    config: RoomConfig;
  };
  players: PublicPlayer[];
  you: {
    playerId: string;
    nickname: string;
    role: 'DRAWER' | 'GUESSER';
    score: number;
    hasGuessedCorrectly: boolean;
  };
}

export interface BindResult {
  payload: RoomJoinedPayload;
  wasReconnect: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

export class RoomService {
  constructor(private readonly services: Services) {}

  // ------------------------------------------------------------- create ---

  private freshAggregate(
    roomId: string,
    code: string,
    hostPlayerId: string,
    config: RoomConfig,
  ): RoomAggregate {
    return {
      roomId,
      code,
      status: 'WAITING',
      hostPlayerId,
      config,
      phase: 'WAITING',
      gameId: null,
      gameStatus: null,
      roundId: null,
      roundNumber: 0,
      roundsPlanned: config.rounds,
      drawerPlayerId: null,
      previousDrawerPlayerId: null,
      nextDrawerPlayerId: null,
      wordId: null,
      roundEndTime: null,
      roundTimerPaused: false,
      roundStartedAt: null,
      pausedAt: null,
      startingDeadline: null,
      resultsDeadline: null,
      hintsRemaining: config.hints,
      revealedPositions: [],
      endReason: null,
    };
  }

  async createRoom(
    owner: RoomOwner,
    config: RoomConfig,
  ): Promise<{ roomId: string; roomCode: string; config: RoomConfig }> {
    let roomId: string | null = null;
    let code = '';
    for (let attempt = 0; attempt < 5 && roomId === null; attempt += 1) {
      code = this.services.ids.roomCode();
      try {
        const inserted = await this.services.db.db
          .insert(rooms)
          .values({
            code,
            name: config.roomName,
            hostUserId: owner.userId,
            maxPlayers: config.maxPlayers,
            rounds: config.rounds,
            roundDuration: config.roundDuration,
            hints: config.hints,
            status: 'WAITING',
          })
          .returning({ id: rooms.id });
        roomId = inserted[0]?.id ?? null;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    if (roomId === null) throw new AppError('INTERNAL_ERROR');

    await this.services.db.db.insert(roomPlayers).values({
      roomId,
      userId: owner.userId,
      seatOrder: 0,
      isHostStart: true,
    });

    const aggregate = this.freshAggregate(roomId, code, owner.playerId, config);
    await writeAggregate(this.services.redis, aggregate);
    await writeMember(this.services.redis, roomId, {
      playerId: owner.playerId,
      userId: owner.userId,
      nickname: owner.nickname,
      seatOrder: 0,
      isConnected: false,
      graceDeadline: null,
      hasBound: false,
      joinedAt: this.services.clock.now(),
    });
    await refreshRoomTtl(this.services.redis, roomId, ROOM_TTL_SECONDS);
    this.services.activeRooms.add(roomId);
    return { roomId, roomCode: code, config };
  }

  // -------------------------------------------------------------- admit ---

  async findActiveRoomByCode(
    roomCode: string,
  ): Promise<{ id: string; status: string } | null> {
    const rows = await this.services.db.db
      .select({ id: rooms.id, status: rooms.status })
      .from(rooms)
      .where(eq(rooms.code, roomCode))
      .orderBy(sql`case when ${rooms.status} = 'CLOSED' then 1 else 0 end`)
      .limit(1);
    return rows[0] ?? null;
  }

  async admit(roomCode: string, member: RoomOwner): Promise<JoinResult> {
    const room = await this.findActiveRoomByCode(roomCode);
    if (room === null) throw new AppError('ROOM_NOT_FOUND');
    if (room.status === 'CLOSED') throw new AppError('ROOM_CLOSED');
    if (room.status === 'IN_GAME') throw new AppError('ROOM_ALREADY_STARTED');

    const aggregate = await readAggregate(this.services.redis, room.id);
    if (aggregate === null) throw new AppError('ROOM_CLOSED');
    if (await isBlocked(this.services.redis, room.id, member.playerId)) {
      throw new AppError('FORBIDDEN');
    }

    const existing = await readMember(this.services.redis, room.id, member.playerId);
    if (existing === null) {
      const members = await readMembers(this.services.redis, room.id);
      const seatRows = await this.services.db.db
        .select({ count: sql<number>`count(*)::int` })
        .from(roomPlayers)
        .where(eq(roomPlayers.roomId, room.id));
      const seatOrder = seatRows[0]?.count ?? members.length;
      const record: RoomMember = {
        playerId: member.playerId,
        userId: member.userId,
        nickname: member.nickname,
        seatOrder,
        isConnected: false,
        graceDeadline: null,
        hasBound: false,
        joinedAt: this.services.clock.now(),
      };
      const outcome = await admitMember(
        this.services.redis,
        room.id,
        record,
        aggregate.config.maxPlayers,
      );
      if (outcome === ADMISSION.FULL) throw new AppError('ROOM_FULL');
      try {
        await this.services.db.db
          .insert(roomPlayers)
          .values({ roomId: room.id, userId: member.userId, seatOrder })
          .onConflictDoNothing();
      } catch (error) {
        await deleteMember(this.services.redis, room.id, member.playerId);
        throw error;
      }
    }

    await refreshRoomTtl(this.services.redis, room.id, ROOM_TTL_SECONDS);
    this.services.activeRooms.add(room.id);
    const members = await readMembers(this.services.redis, room.id);
    const players = await this.publicPlayers(room.id, aggregate, members);
    return {
      room: {
        roomId: aggregate.roomId,
        roomCode: aggregate.code,
        config: aggregate.config,
        players,
        host: aggregate.hostPlayerId,
      },
      isHost: aggregate.hostPlayerId === member.playerId,
      admittedAt: new Date(this.services.clock.now()).toISOString(),
    };
  }

  // --------------------------------------------------------------- bind ---

  async bindSocket(
    roomId: string,
    playerId: string,
    socketId: string,
  ): Promise<BindResult> {
    const aggregate = await readAggregate(this.services.redis, roomId);
    if (aggregate === null) throw new AppError('ROOM_CLOSED');
    if (await isBlocked(this.services.redis, roomId, playerId)) {
      throw new AppError('FORBIDDEN');
    }
    const member = await readMember(this.services.redis, roomId, playerId);
    if (member === null) throw new AppError('NOT_ADMITTED');
    // `isConnected` is false both for a member who was never present and for one
    // whose grace expired, so presence history - not connectivity - decides which
    // announcement the room hears (`reconnect-protocol.md` section 7).
    const wasReconnect = member.hasBound;

    await addSocket(this.services.redis, roomId, playerId, socketId);
    const now = this.services.clock.now();
    await this.services.commit(roomId, async () => {
      const stored = await readMember(this.services.redis, roomId, playerId);
      if (stored === null) return null;
      stored.isConnected = true;
      stored.graceDeadline = null;
      stored.hasBound = true;
      await writeMember(this.services.redis, roomId, stored);
      const live = await readAggregate(this.services.redis, roomId);
      if (live !== null && live.roundTimerPaused) {
        resumeRoundTimer(live, now);
        await writeAggregate(this.services.redis, live);
      }
      return null;
    });
    this.services.activeRooms.add(roomId);

    const live = await readAggregate(this.services.redis, roomId);
    const members = await readMembers(this.services.redis, roomId);
    const version = await readVersion(this.services.redis, roomId);
    const scores = await readScores(this.services.redis, roomId);
    const payload: RoomJoinedPayload = {
      type: 'room:joined',
      version,
      serverNow: now,
      room: {
        roomId: aggregate.roomId,
        roomCode: aggregate.code,
        roomName: aggregate.config.roomName,
        status: live?.status ?? aggregate.status,
        hostPlayerId: live?.hostPlayerId ?? aggregate.hostPlayerId,
        config: aggregate.config,
      },
      players: await this.publicPlayers(roomId, live ?? aggregate, members),
      you: {
        playerId,
        nickname: member.nickname,
        role:
          live?.drawerPlayerId === playerId && live?.phase === 'ROUND_ACTIVE'
            ? 'DRAWER'
            : 'GUESSER',
        score: scores[playerId] ?? 0,
        hasGuessedCorrectly: false,
      },
    };
    return { payload, wasReconnect };
  }

  // ------------------------------------------------------- roster views ---

  async readMembers(roomId: string): Promise<RoomMember[]> {
    return readMembers(this.services.redis, roomId);
  }

  async publicPlayers(
    roomId: string,
    aggregate: RoomAggregate,
    members: readonly RoomMember[],
  ): Promise<PublicPlayer[]> {
    const scores = await readScores(this.services.redis, roomId);
    return [...members]
      .sort((left, right) => left.seatOrder - right.seatOrder)
      .map((member) => ({
        playerId: member.playerId,
        nickname: member.nickname,
        score: scores[member.playerId] ?? 0,
        isConnected: member.isConnected,
        isHost: member.playerId === aggregate.hostPlayerId,
        seatOrder: member.seatOrder,
      }));
  }

  /** Scores, correct list, strokes, chat and used words are per-game state. */
  async resetRoomTransientState(roomId: string): Promise<void> {
    await clearScores(this.services.redis, roomId);
    await clearCorrect(this.services.redis, roomId);
    await clearStrokes(this.services.redis, roomId);
    await clearChat(this.services.redis, roomId);
    await clearUsedWords(this.services.redis, roomId);
    this.services.drawing.reset(roomId);
  }

  // ---------------------------------------------------------- mutations ---

  async updateConfig(
    roomId: string,
    requesterPlayerId: string,
    config: RoomConfig,
  ): Promise<RoomConfig> {
    const { version } = await this.services.commit(roomId, async (v) => {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null) throw new AppError('ROOM_NOT_FOUND');
      if (aggregate.hostPlayerId !== requesterPlayerId) {
        throw new AppError('FORBIDDEN');
      }
      if (aggregate.phase !== 'WAITING') throw new AppError('BAD_STATE');
      aggregate.config = config;
      aggregate.roundsPlanned = config.rounds;
      await writeAggregate(this.services.redis, aggregate);
      await this.services.db.db
        .update(rooms)
        .set({
          name: config.roomName,
          maxPlayers: config.maxPlayers,
          rounds: config.rounds,
          roundDuration: config.roundDuration,
          hints: config.hints,
        })
        .where(eq(rooms.id, roomId));
      this.services.bus.toRoom(roomId, 'room:config:updated', {
        type: 'room:config:updated',
        config,
        version: v,
      });
      return config;
    });
    void version;
    return config;
  }

  async leave(roomId: string, playerId: string): Promise<void> {
    const members = await readMembers(this.services.redis, roomId);
    const member = members.find((entry) => entry.playerId === playerId);
    if (member === undefined) return;
    let newHost: string | null = null;
    const { version } = await this.services.commit(roomId, async () => {
      const aggregate = await readAggregate(this.services.redis, roomId);
      if (aggregate === null) return null;
      await deleteMember(this.services.redis, roomId, playerId);
      if (aggregate.hostPlayerId === playerId) {
        newHost = this.services.hostTransfer.applyTransfer(
          aggregate,
          members.filter((entry) => entry.playerId !== playerId),
        );
      }
      await writeAggregate(this.services.redis, aggregate);
      return null;
    });
    await this.services.db.db
      .update(roomPlayers)
      .set({ leftAt: new Date(this.services.clock.now()) })
      .where(
        and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, playerId)),
      );
    this.services.bus.toRoom(roomId, 'player:left', {
      type: 'player:left',
      playerId,
      reason: 'LEFT',
      version,
    });
    if (newHost !== null) {
      this.services.bus.toRoom(roomId, 'host:transferred', {
        type: 'host:transferred',
        hostPlayerId: newHost,
        version,
      });
    }
  }

  async kick(
    roomId: string,
    requesterPlayerId: string,
    targetPlayerId: string,
  ): Promise<void> {
    const aggregate = await readAggregate(this.services.redis, roomId);
    if (aggregate === null) throw new AppError('ROOM_NOT_FOUND');
    if (aggregate.hostPlayerId !== requesterPlayerId) {
      throw new AppError('FORBIDDEN');
    }
    await blockPlayer(this.services.redis, roomId, targetPlayerId);
    const members = await readMembers(this.services.redis, roomId);
    let newHost: string | null = null;
    const { version } = await this.services.commit(roomId, async () => {
      const live = await readAggregate(this.services.redis, roomId);
      if (live === null) return null;
      await deleteMember(this.services.redis, roomId, targetPlayerId);
      if (live.hostPlayerId === targetPlayerId) {
        newHost = this.services.hostTransfer.applyTransfer(
          live,
          members.filter((entry) => entry.playerId !== targetPlayerId),
        );
      }
      await writeAggregate(this.services.redis, live);
      return null;
    });
    this.services.bus.toRoom(roomId, 'player:left', {
      type: 'player:left',
      playerId: targetPlayerId,
      reason: 'KICKED',
      version,
    });
    if (newHost !== null) {
      this.services.bus.toRoom(roomId, 'host:transferred', {
        type: 'host:transferred',
        hostPlayerId: newHost,
        version,
      });
    }
  }

  /** Explicit close, or room TTL expiry. */
  async closeRoom(roomId: string, reason: 'TTL' | 'EXPLICIT'): Promise<void> {
    const aggregate = await readAggregate(this.services.redis, roomId);
    const now = new Date(this.services.clock.now());
    await this.services.db.db
      .update(rooms)
      .set({ status: 'CLOSED', closedAt: now })
      .where(eq(rooms.id, roomId));
    await this.services.db.db
      .update(roomPlayers)
      .set({ leftAt: now })
      .where(eq(roomPlayers.roomId, roomId));
    if (aggregate !== null) {
      aggregate.status = 'CLOSED';
      this.services.bus.toRoom(roomId, 'connection:lost', {
        type: 'connection:lost',
        code: 'ROOM_CLOSED',
        retryable: false,
      });
    }
    this.services.activeRooms.delete(roomId);
    await deleteRoomKeys(this.services.redis, roomId);
    void reason;
  }

  /** Called by the sweeper when a room's Redis keys have vanished. */
  async onTtlExpired(roomId: string): Promise<void> {
    const now = new Date(this.services.clock.now());
    await this.services.db.db
      .update(rooms)
      .set({ status: 'CLOSED', closedAt: now })
      .where(eq(rooms.id, roomId));
    this.services.activeRooms.delete(roomId);
  }

  async readSockets(roomId: string): Promise<Map<string, string[]>> {
    return readAllSockets(this.services.redis, roomId);
  }
}
