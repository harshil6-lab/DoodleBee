/**
 * Zod schemas for every external boundary (ADR section 20.2):
 * REST responses, realtime payloads, and user form input.
 *
 * Bounds mirror the approved domain rules:
 * - room code: 5-6 chars, case-insensitive, no ambiguous O/0 or I/1
 *   (projectInfo.md section 4)
 * - room capacity: 2-8 players (projectInfo.md section 6)
 */
import { z } from 'zod';

export const NICKNAME_MIN_LENGTH = 1;
export const NICKNAME_MAX_LENGTH = 20;

export const ROOM_CODE_MIN_LENGTH = 5;
export const ROOM_CODE_MAX_LENGTH = 6;
/** Case-insensitive alphabet with ambiguous characters (O, 0, I, 1) removed. */
export const ROOM_CODE_ALPHABET = 'ABCDEGHJKLMNPQRSTVWXYZ23456789';
export const ROOM_CODE_REGEX = new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`, 'i');

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 20;
export const MIN_ROUND_DURATION_SECONDS = 30;
export const MAX_ROUND_DURATION_SECONDS = 300;
export const MIN_HINTS = 0;
export const MAX_HINTS = 5;

export const ROOM_NAME_MAX_LENGTH = 30;
export const MAX_GUESS_LENGTH = 100;
export const MAX_CHAT_MESSAGE_LENGTH = 200;

export const NicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH, 'Nickname is required')
  .max(
    NICKNAME_MAX_LENGTH,
    `Nickname must be ${NICKNAME_MAX_LENGTH} characters or fewer`,
  )
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Nickname can only contain letters, numbers, and underscores',
  );

export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(
    ROOM_CODE_MIN_LENGTH,
    `Room code must be at least ${ROOM_CODE_MIN_LENGTH} characters`,
  )
  .max(
    ROOM_CODE_MAX_LENGTH,
    `Room code must be at most ${ROOM_CODE_MAX_LENGTH} characters`,
  )
  .regex(ROOM_CODE_REGEX, 'Room code contains invalid characters');

export const RoomConfigSchema = z.object({
  roomName: z
    .string()
    .trim()
    .min(1, 'Room name is required')
    .max(
      ROOM_NAME_MAX_LENGTH,
      `Room name must be ${ROOM_NAME_MAX_LENGTH} characters or fewer`,
    ),
  maxPlayers: z
    .number()
    .int()
    .min(MIN_PLAYERS, `At least ${MIN_PLAYERS} players are required`)
    .max(MAX_PLAYERS, `At most ${MAX_PLAYERS} players are allowed`),
  rounds: z.number().int().min(MIN_ROUNDS).max(MAX_ROUNDS),
  roundDuration: z
    .number()
    .int()
    .min(MIN_ROUND_DURATION_SECONDS)
    .max(MAX_ROUND_DURATION_SECONDS),
  hints: z.number().int().min(MIN_HINTS).max(MAX_HINTS),
});

export const GuessSchema = z
  .string()
  .trim()
  .min(1, 'Guess cannot be empty')
  .max(
    MAX_GUESS_LENGTH,
    `Guess must be ${MAX_GUESS_LENGTH} characters or fewer`,
  );

export const ChatMessageSchema = z
  .string()
  .trim()
  .min(1, 'Message cannot be empty')
  .max(
    MAX_CHAT_MESSAGE_LENGTH,
    `Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer`,
  );

export type NicknameInput = z.infer<typeof NicknameSchema>;
export type RoomCodeInput = z.infer<typeof RoomCodeSchema>;
export type RoomConfigInput = z.infer<typeof RoomConfigSchema>;
export type GuessInput = z.infer<typeof GuessSchema>;
export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;
