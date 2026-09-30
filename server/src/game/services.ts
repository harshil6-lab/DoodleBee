/**
 * The service container (`server-state-writer-map.md` section 1 rule 5).
 *
 * Ownership is expressed by construction: each component that writes an
 * authoritative field is instantiated exactly once here, and the shared
 * `commit` path is the only place a `version` is assigned.
 */

import type { Redis } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';
import { ROOM_TTL_SECONDS } from '../../../shared/contract/constants.js';
import { nextVersion, readVersion, refreshRoomTtl } from '../redis/roomState.js';
import { RateLimiter } from '../security/rateLimit.js';
import type { DatabaseHandle } from '../db/client.js';
import type { Bus } from './bus.js';
import type { Clock } from './clock.js';
import type { IdSource } from './ids.js';
import type { RoomAggregate, RoomMember } from './types.js';
import { DEFAULT_SCORE_TABLE, type ScoreTable } from './scoring.js';
import { commitRoom } from './lock.js';
import { selectDrawer } from './drawerSelector.js';
import { SessionService } from './sessionService.js';
import { WordSelector } from './wordSelector.js';
import { ScoreService } from './scoreService.js';
import { HostTransferService } from './hostTransferService.js';
import { ChatService } from './chatService.js';
import { HintService } from './hintService.js';
import { DrawingGateway } from './drawingGateway.js';
import { SnapshotProjector } from './snapshotProjector.js';
import { GuessService } from './guessService.js';
import { RoundService } from './roundService.js';
import { GameStateMachine } from './gameStateMachine.js';
import { GameFinalizer } from './gameFinalizer.js';
import { RoomService } from './roomService.js';
import { ConnectionRegistry } from './connectionRegistry.js';

export interface CommitResult<T> {
  version: number;
  result: T;
}

export interface Services {
  redis: Redis;
  db: DatabaseHandle;
  clock: Clock;
  ids: IdSource;
  logger: FastifyBaseLogger;
  scoreTable: ScoreTable;
  bus: Bus;
  limiter: RateLimiter;
  activeRooms: Set<string>;
  commit<T>(
    roomId: string,
    fn: (version: number) => Promise<T>,
  ): Promise<CommitResult<T>>;
  readVersion(roomId: string): Promise<number>;
  selectDrawerForNextRound(
    members: readonly RoomMember[],
    aggregate: RoomAggregate,
  ): string | null;
  sweep(): Promise<void>;
  session: SessionService;
  words: WordSelector;
  scores: ScoreService;
  presence: ConnectionRegistry;
  hostTransfer: HostTransferService;
  chat: ChatService;
  hints: HintService;
  drawing: DrawingGateway;
  guesses: GuessService;
  projector: SnapshotProjector;
  rounds: RoundService;
  finalizer: GameFinalizer;
  rooms: RoomService;
  stateMachine: GameStateMachine;
}

export interface EngineDeps {
  redis: Redis;
  db: DatabaseHandle;
  clock: Clock;
  ids: IdSource;
  logger: FastifyBaseLogger;
  bus: Bus;
  scoreTable?: ScoreTable;
}

export function createServices(deps: EngineDeps): Services {
  const services = {} as Services;
  services.redis = deps.redis;
  services.db = deps.db;
  services.clock = deps.clock;
  services.ids = deps.ids;
  services.logger = deps.logger;
  services.scoreTable = deps.scoreTable ?? DEFAULT_SCORE_TABLE;
  services.bus = deps.bus;
  services.limiter = new RateLimiter(deps.redis);
  services.activeRooms = new Set<string>();
  services.commit = (roomId, fn) =>
    commitRoom(
      roomId,
      () => nextVersion(deps.redis, roomId),
      async (version) => {
        const result = await fn(version);
        await refreshRoomTtl(deps.redis, roomId, ROOM_TTL_SECONDS);
        return result;
      },
    );
  services.readVersion = (roomId) => readVersion(deps.redis, roomId);
  services.selectDrawerForNextRound = (members, aggregate) =>
    selectDrawer(members, aggregate.drawerPlayerId, deps.ids);

  services.session = new SessionService(services);
  services.words = new WordSelector(services);
  services.scores = new ScoreService(services);
  services.hostTransfer = new HostTransferService();
  services.chat = new ChatService(services);
  services.hints = new HintService(services);
  services.drawing = new DrawingGateway(services);
  services.projector = new SnapshotProjector(services);
  services.guesses = new GuessService(services);
  services.rounds = new RoundService(services);
  services.stateMachine = new GameStateMachine(services);
  services.finalizer = new GameFinalizer(services);
  services.rooms = new RoomService(services);
  services.presence = new ConnectionRegistry(services);

  services.sweep = async () => {
    await services.presence.sweep();
    await services.stateMachine.sweep();
    await services.rounds.sweep();
  };
  return services;
}
