/**
 * Zod schemas for every client -> server boundary.
 *
 * `docs/AGENTS.md` section 12: validate at boundaries. Runtime validation is
 * Zod at the server boundary (D02-014); these schemas are mirrored on the
 * client so both sides agree (D03-023).
 *
 * Note on drawing geometry: coordinates are validated as finite numbers only.
 * Bounding them to 0..1 would be server-side geometry validation, which
 * D03-016 explicitly rejects ("caught by authorization and sequence, not by
 * geometry").
 */

import { z } from 'zod';
import {
  DRAW_MOVE_BATCH_SIZE,
  EVENT_ID_MAX_LENGTH,
  MAX_BRUSH_SIZE,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_GUESS_LENGTH,
  MAX_HINTS,
  MAX_PLAYERS,
  MAX_ROUND_DURATION_SECONDS,
  MAX_ROUNDS,
  MIN_BRUSH_SIZE,
  MIN_HINTS,
  MIN_PLAYERS,
  MIN_ROUND_DURATION_SECONDS,
  MIN_ROUNDS,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NICKNAME_REGEX,
  ROOM_CODE_MAX_LENGTH,
  ROOM_CODE_MIN_LENGTH,
  ROOM_CODE_REGEX,
  ROOM_NAME_MAX_LENGTH,
  ROOM_NAME_MIN_LENGTH,
  STROKE_COLOR_REGEX,
  STROKE_ID_MAX_LENGTH,
} from './constants.js';
import { ERROR_CODES } from './errors.js';

const EventIdSchema = z.string().min(1).max(EVENT_ID_MAX_LENGTH);

/** AD-004 instrumentation only. Never read by game logic. */
const ProbeSchema = z.object({ t0: z.number() }).optional();

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
  pressure: z.number().optional(),
});

// ------------------------------------------------------------- room codes ---

/** Mirrors the locked client `RoomCodeSchema` exactly. */
export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(
    ROOM_CODE_MIN_LENGTH,
    'Room code must be at least ' + ROOM_CODE_MIN_LENGTH + ' characters',
  )
  .max(
    ROOM_CODE_MAX_LENGTH,
    'Room code must be at most ' + ROOM_CODE_MAX_LENGTH + ' characters',
  )
  .regex(ROOM_CODE_REGEX, 'Room code contains invalid characters');

/** Mirrors the locked client `NicknameSchema` exactly. */
export const NicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH, 'Nickname is required')
  .max(
    NICKNAME_MAX_LENGTH,
    'Nickname must be ' + NICKNAME_MAX_LENGTH + ' characters or fewer',
  )
  .regex(
    NICKNAME_REGEX,
    'Nickname can only contain letters, numbers, and underscores',
  );

/** Mirrors the locked client `RoomConfigSchema` exactly. */
export const RoomConfigSchema = z.object({
  roomName: z
    .string()
    .trim()
    .min(ROOM_NAME_MIN_LENGTH, 'Room name is required')
    .max(
      ROOM_NAME_MAX_LENGTH,
      'Room name must be ' + ROOM_NAME_MAX_LENGTH + ' characters or fewer',
    ),
  maxPlayers: z
    .number()
    .int()
    .min(MIN_PLAYERS, 'At least ' + MIN_PLAYERS + ' players are required')
    .max(MAX_PLAYERS, 'At most ' + MAX_PLAYERS + ' players are allowed'),
  rounds: z.number().int().min(MIN_ROUNDS).max(MAX_ROUNDS),
  roundDuration: z
    .number()
    .int()
    .min(MIN_ROUND_DURATION_SECONDS)
    .max(MAX_ROUND_DURATION_SECONDS),
  hints: z.number().int().min(MIN_HINTS).max(MAX_HINTS),
});

export const RoomConfigPatchSchema = RoomConfigSchema.partial();

export const GuessSchema = z
  .string()
  .trim()
  .min(1, 'Guess cannot be empty')
  .max(
    MAX_GUESS_LENGTH,
    'Guess must be ' + MAX_GUESS_LENGTH + ' characters or fewer',
  );

export const ChatMessageSchema = z
  .string()
  .trim()
  .min(1, 'Message cannot be empty')
  .max(
    MAX_CHAT_MESSAGE_LENGTH,
    'Message must be ' + MAX_CHAT_MESSAGE_LENGTH + ' characters or fewer',
  );

// ------------------------------------------------------ client -> server ---

export const JoinRoomPayloadSchema = z.object({
  eventId: EventIdSchema,
  roomCode: RoomCodeSchema,
  _probe: ProbeSchema,
});

export const LeaveRoomPayloadSchema = z.object({
  eventId: EventIdSchema,
  _probe: ProbeSchema,
});

export const SubmitGuessPayloadSchema = z.object({
  eventId: EventIdSchema,
  guess: GuessSchema,
  _probe: ProbeSchema,
});

export const SendChatPayloadSchema = z.object({
  eventId: EventIdSchema,
  text: ChatMessageSchema,
  _probe: ProbeSchema,
});

export const HintRequestPayloadSchema = z.object({
  eventId: EventIdSchema,
  _probe: ProbeSchema,
});

export const GameStartPayloadSchema = z.object({
  eventId: EventIdSchema,
  _probe: ProbeSchema,
});

export const DrawStartPayloadSchema = z.object({
  eventId: EventIdSchema,
  strokeId: z.string().min(1).max(STROKE_ID_MAX_LENGTH),
  strokeSeq: z.number().int().min(0),
  color: z.string().regex(STROKE_COLOR_REGEX),
  brushSize: z.number().int().min(MIN_BRUSH_SIZE).max(MAX_BRUSH_SIZE),
  points: z.array(PointSchema).min(1).max(DRAW_MOVE_BATCH_SIZE),
  _probe: ProbeSchema,
});

export const DrawMovePayloadSchema = z.object({
  eventId: EventIdSchema,
  strokeId: z.string().min(1).max(STROKE_ID_MAX_LENGTH),
  pointIndex: z.number().int().min(0),
  points: z.array(PointSchema).min(1).max(DRAW_MOVE_BATCH_SIZE),
  _probe: ProbeSchema,
});

export const DrawEndPayloadSchema = z.object({
  eventId: EventIdSchema,
  strokeId: z.string().min(1).max(STROKE_ID_MAX_LENGTH),
  _probe: ProbeSchema,
});

export const ClearCanvasPayloadSchema = z.object({
  eventId: EventIdSchema,
  _probe: ProbeSchema,
});

export const RequestStateSnapshotPayloadSchema = z.object({
  eventId: EventIdSchema,
  lastVersion: z.number().int().min(0).optional(),
  _probe: ProbeSchema,
});

/** The registry every transport handler validates against. */
export const CLIENT_TO_SERVER_SCHEMAS = {
  'join:room': JoinRoomPayloadSchema,
  'leave:room': LeaveRoomPayloadSchema,
  'guess:submit': SubmitGuessPayloadSchema,
  'chat:message': SendChatPayloadSchema,
  'hint:request': HintRequestPayloadSchema,
  'game:start': GameStartPayloadSchema,
  'draw:start': DrawStartPayloadSchema,
  'draw:move': DrawMovePayloadSchema,
  'draw:end': DrawEndPayloadSchema,
  'canvas:clear': ClearCanvasPayloadSchema,
  'request:state:snapshot': RequestStateSnapshotPayloadSchema,
} as const;

// ------------------------------------------------------------- ack envelope --

export const ErrorCodeSchema = z.enum(ERROR_CODES);

export const AckFailureSchema = z.object({
  ok: z.literal(false),
  eventId: z.string(),
  code: ErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
});

export const AckSuccessBaseSchema = z.object({
  ok: z.literal(true),
  eventId: z.string(),
  version: z.number().int(),
});

export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;
export type LeaveRoomPayload = z.infer<typeof LeaveRoomPayloadSchema>;
export type SubmitGuessPayload = z.infer<typeof SubmitGuessPayloadSchema>;
export type SendChatPayload = z.infer<typeof SendChatPayloadSchema>;
export type HintRequestPayload = z.infer<typeof HintRequestPayloadSchema>;
export type GameStartPayload = z.infer<typeof GameStartPayloadSchema>;
export type DrawStartPayload = z.infer<typeof DrawStartPayloadSchema>;
export type DrawMovePayload = z.infer<typeof DrawMovePayloadSchema>;
export type DrawEndPayload = z.infer<typeof DrawEndPayloadSchema>;
export type ClearCanvasPayload = z.infer<typeof ClearCanvasPayloadSchema>;
export type RequestStateSnapshotPayload = z.infer<
  typeof RequestStateSnapshotPayloadSchema
>;
