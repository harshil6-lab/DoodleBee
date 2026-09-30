/**
 * Zod schemas for every server -> client payload (`realtime-contract.md`
 * section 7, with the payload shapes from section 9).
 *
 * Why schemas for payloads the client receives: they are the registry the
 * secret-word scan test walks (`security-model.md` S-06), and they let the
 * server validate what it is about to emit in tests.
 *
 * `drawer:selected` is the ONE payload with a role-split shape. The public
 * variant has no `secretWord` property at all - not null, not empty, absent
 * (D03-015).
 */

import { z } from 'zod';
import { CONNECTION_LOST_CODES } from './errors.js';
import { PointSchema, RoomConfigSchema } from './schemas.js';
import {
  CHAT_MESSAGE_TYPES,
  GAME_PHASES,
  ROLES,
  ROUND_END_REASONS,
  ROOM_STATUSES,
} from './types.js';
import type { Stroke } from './types.js';
import type { StateSnapshot } from './snapshot.js';

const VersionSchema = z.number().int();
const ServerNowSchema = z.number();

export const PublicPlayerSchema = z.object({
  playerId: z.string(),
  nickname: z.string(),
  score: z.number().int(),
  isConnected: z.boolean(),
  isHost: z.boolean(),
  seatOrder: z.number().int(),
});

export const StrokeSchema = z.object({
  strokeId: z.string(),
  color: z.string(),
  brushSize: z.number().int(),
  points: z.array(PointSchema),
});

export interface ChatMessagePayload {
  type: 'chat:message';
  id: string;
  messageType: (typeof CHAT_MESSAGE_TYPES)[number];
  senderPlayerId: string | null;
  senderNickname: string | null;
  text: string;
  createdAt: number;
  version: number;
}

export const ChatMessagePayloadSchema = z.object({
  type: z.literal('chat:message'),
  id: z.string(),
  messageType: z.enum(CHAT_MESSAGE_TYPES),
  senderPlayerId: z.string().nullable(),
  senderNickname: z.string().nullable(),
  text: z.string(),
  createdAt: z.number(),
  version: VersionSchema,
});

export const RoomJoinedPayloadSchema = z.object({
  type: z.literal('room:joined'),
  version: VersionSchema,
  serverNow: ServerNowSchema,
  room: z.object({
    roomId: z.string(),
    roomCode: z.string(),
    roomName: z.string(),
    status: z.enum(ROOM_STATUSES),
    hostPlayerId: z.string(),
    config: RoomConfigSchema,
  }),
  players: z.array(PublicPlayerSchema),
  you: z.object({
    playerId: z.string(),
    nickname: z.string(),
    role: z.enum(ROLES),
    score: z.number().int(),
    hasGuessedCorrectly: z.boolean(),
  }),
});

export const PlayerJoinedPayloadSchema = z.object({
  type: z.literal('player:joined'),
  player: PublicPlayerSchema,
  version: VersionSchema,
});

export const PlayerLeftPayloadSchema = z.object({
  type: z.literal('player:left'),
  playerId: z.string(),
  reason: z.enum(['LEFT', 'KICKED']),
  version: VersionSchema,
});

export const HostTransferredPayloadSchema = z.object({
  type: z.literal('host:transferred'),
  hostPlayerId: z.string(),
  version: VersionSchema,
});

export const GameStartedPayloadSchema = z.object({
  type: z.literal('game:started'),
  gameId: z.string(),
  roundNumber: z.number().int(),
  roundsPlanned: z.number().int(),
  startingDeadline: z.number(),
  serverNow: ServerNowSchema,
  players: z.array(PublicPlayerSchema),
  version: VersionSchema,
});

export const RoundStartedPayloadSchema = z.object({
  type: z.literal('round:started'),
  roomId: z.string(),
  roundNumber: z.number().int(),
  drawerPlayerId: z.string(),
  maskedWord: z.string(),
  hintsRemaining: z.number().int(),
  timer: z.object({ roundEndTime: z.number() }),
  serverNow: ServerNowSchema,
  version: VersionSchema,
});

/** Drawer-only variant. Carries the word; emitted to the drawer socket only. */
export const DrawerSelectedPrivateSchema = z.object({
  type: z.literal('drawer:selected'),
  playerId: z.string(),
  secretWord: z.string(),
  maskedWord: z.string(),
  roundNumber: z.number().int(),
  version: VersionSchema,
});

/** Room variant. Has NO `secretWord` property at all. */
export const DrawerSelectedPublicSchema = z.object({
  type: z.literal('drawer:selected'),
  playerId: z.string(),
  maskedWord: z.string(),
  roundNumber: z.number().int(),
  version: VersionSchema,
});

export const DrawStartBroadcastSchema = z.object({
  type: z.literal('draw:start'),
  strokeId: z.string(),
  strokeSeq: z.number().int(),
  color: z.string(),
  brushSize: z.number().int(),
  points: z.array(PointSchema),
  version: VersionSchema,
});

export const DrawMoveBroadcastSchema = z.object({
  type: z.literal('draw:move'),
  strokeId: z.string(),
  pointIndex: z.number().int(),
  points: z.array(PointSchema),
  version: VersionSchema,
});

export const DrawEndBroadcastSchema = z.object({
  type: z.literal('draw:end'),
  strokeId: z.string(),
  version: VersionSchema,
});

export const CanvasClearedPayloadSchema = z.object({
  type: z.literal('canvas:cleared'),
  roundNumber: z.number().int(),
  version: VersionSchema,
});

export const GuessSubmittedPayloadSchema = z.object({
  type: z.literal('guess:submitted'),
  playerId: z.string(),
  nickname: z.string(),
  text: z.string(),
  result: z.enum(['WRONG', 'CLOSE']),
  version: VersionSchema,
});

/**
 * A chat-ring entry (`realtime-contract.md` section 12).
 *
 * `game.chats` is written by BOTH `chat:message` and `guess:submitted`, so the
 * ring buffer - and therefore the snapshot `chat` array - holds either shape.
 * Neither carries the secret word: a `guess:submitted` entry holds the guesser's
 * own (by definition wrong) text (`security-model.md` section 3.3).
 */
export const ChatEntrySchema = z.union([
  ChatMessagePayloadSchema,
  GuessSubmittedPayloadSchema,
]);
export type ChatEntry = ChatMessagePayload | GuessSubmittedPayload;

export const GuessCorrectPayloadSchema = z.object({
  type: z.literal('guess:correct'),
  playerId: z.string(),
  nickname: z.string(),
  rank: z.number().int(),
  points: z.number().int(),
  correctCount: z.number().int(),
  version: VersionSchema,
});

export const HintRevealedPayloadSchema = z.object({
  type: z.literal('hint:revealed'),
  maskedWord: z.string(),
  revealedPositions: z.array(z.number().int()),
  hintsRemaining: z.number().int(),
  version: VersionSchema,
});

export const RoundEndedPayloadSchema = z.object({
  type: z.literal('round:ended'),
  roundNumber: z.number().int(),
  endReason: z.enum(ROUND_END_REASONS),
  word: z.string(),
  rankings: z.array(
    z.object({
      playerId: z.string(),
      nickname: z.string(),
      rank: z.number().int(),
      points: z.number().int(),
    }),
  ),
  drawerBonus: z.number().int(),
  drawerPoints: z.number().int(),
  version: VersionSchema,
});

export const ScoreUpdatedPayloadSchema = z.object({
  type: z.literal('score:updated'),
  scores: z.record(z.string(), z.number().int()),
  version: VersionSchema,
});

export const GameFinishedPayloadSchema = z.object({
  type: z.literal('game:finished'),
  finalScores: z.record(z.string(), z.number().int()),
  rankings: z.array(
    z.object({
      playerId: z.string(),
      nickname: z.string(),
      rank: z.number().int(),
      score: z.number().int(),
    }),
  ),
  winnerId: z.string(),
  version: VersionSchema,
});

export const ConnectionLostPayloadSchema = z.object({
  type: z.literal('connection:lost'),
  code: z.enum(CONNECTION_LOST_CODES),
  retryable: z.boolean(),
});

export const RoomConfigUpdatedPayloadSchema = z.object({
  type: z.literal('room:config:updated'),
  config: RoomConfigSchema,
  version: VersionSchema,
});

export const PlayerDisconnectedPayloadSchema = z.object({
  type: z.literal('player:disconnected'),
  playerId: z.string(),
  graceDeadline: z.number(),
  version: VersionSchema,
});

export const PlayerReconnectedPayloadSchema = z.object({
  type: z.literal('player:reconnected'),
  playerId: z.string(),
  version: VersionSchema,
});

export const SnapshotRoundSchema = z.object({
  roundId: z.string().nullable(),
  drawerPlayerId: z.string().nullable(),
  maskedWord: z.string(),
  revealedPositions: z.array(z.number().int()),
  hintsRemaining: z.number().int(),
  timer: z.object({ roundEndTime: z.number().nullable(), paused: z.boolean() }),
  endReason: z.enum(ROUND_END_REASONS).optional(),
  word: z.string().optional(),
  secretWord: z.string().optional(),
  startingDeadline: z.number().optional(),
  resultsDeadline: z.number().optional(),
  nextDrawerPlayerId: z.string().optional(),
});

export const StateSnapshotSchema = z.object({
  type: z.literal('response:state:snapshot'),
  version: VersionSchema,
  serverNow: ServerNowSchema,
  room: z.object({
    roomId: z.string(),
    roomCode: z.string(),
    roomName: z.string(),
    status: z.enum(ROOM_STATUSES),
    hostPlayerId: z.string(),
    config: RoomConfigSchema,
  }),
  players: z.array(PublicPlayerSchema),
  you: z.object({
    playerId: z.string(),
    nickname: z.string(),
    role: z.enum(ROLES),
    score: z.number().int(),
    hasGuessedCorrectly: z.boolean(),
  }),
  game: z.object({
    gameId: z.string().nullable(),
    phase: z.enum(GAME_PHASES),
    roundNumber: z.number().int(),
    roundsPlanned: z.number().int(),
  }),
  round: SnapshotRoundSchema,
  correctGuessers: z.array(
    z.object({
      playerId: z.string(),
      nickname: z.string(),
      rank: z.number().int(),
      points: z.number().int(),
    }),
  ),
  strokes: z.array(StrokeSchema),
  chat: z.array(ChatEntrySchema),
  scores: z.record(z.string(), z.number().int()),
  leaderboard: z.array(
    z.object({
      playerId: z.string(),
      nickname: z.string(),
      score: z.number().int(),
      rank: z.number().int(),
    }),
  ),
});

/** The registry the secret-word scan walks (S-06). */
export const SERVER_TO_CLIENT_SCHEMAS = {
  'room:joined': RoomJoinedPayloadSchema,
  'player:joined': PlayerJoinedPayloadSchema,
  'player:left': PlayerLeftPayloadSchema,
  'host:transferred': HostTransferredPayloadSchema,
  'game:started': GameStartedPayloadSchema,
  'round:started': RoundStartedPayloadSchema,
  'drawer:selected': DrawerSelectedPublicSchema,
  'draw:start': DrawStartBroadcastSchema,
  'draw:move': DrawMoveBroadcastSchema,
  'draw:end': DrawEndBroadcastSchema,
  'guess:submitted': GuessSubmittedPayloadSchema,
  'guess:correct': GuessCorrectPayloadSchema,
  'hint:revealed': HintRevealedPayloadSchema,
  'round:ended': RoundEndedPayloadSchema,
  'score:updated': ScoreUpdatedPayloadSchema,
  'game:finished': GameFinishedPayloadSchema,
  'connection:lost': ConnectionLostPayloadSchema,
  'room:config:updated': RoomConfigUpdatedPayloadSchema,
  'chat:message': ChatMessagePayloadSchema,
  'canvas:cleared': CanvasClearedPayloadSchema,
  'player:disconnected': PlayerDisconnectedPayloadSchema,
  'player:reconnected': PlayerReconnectedPayloadSchema,
  'response:state:snapshot': StateSnapshotSchema,
} as const;

export type RoundStartedPayload = z.infer<typeof RoundStartedPayloadSchema>;
export type GuessSubmittedPayload = z.infer<typeof GuessSubmittedPayloadSchema>;
export type DrawerSelectedPrivate = z.infer<typeof DrawerSelectedPrivateSchema>;
export type DrawerSelectedPublic = z.infer<typeof DrawerSelectedPublicSchema>;
export type RoundEndedPayload = z.infer<typeof RoundEndedPayloadSchema>;
export type GameFinishedPayload = z.infer<typeof GameFinishedPayloadSchema>;
export type GuessCorrectPayload = z.infer<typeof GuessCorrectPayloadSchema>;
export type StateSnapshotPayload = StateSnapshot;
export type StrokePayload = Stroke;
