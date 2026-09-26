/**
 * Barrel for boundary validation schemas (ADR sections 14 and 20.2).
 */
export {
  ChatMessageSchema,
  GuessSchema,
  NicknameSchema,
  RoomCodeSchema,
  RoomConfigSchema,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_MAX_LENGTH,
  ROOM_CODE_MIN_LENGTH,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_GUESS_LENGTH,
  MAX_HINTS,
  MAX_PLAYERS,
  MAX_ROUND_DURATION_SECONDS,
  MAX_ROUNDS,
  MIN_HINTS,
  MIN_PLAYERS,
  MIN_ROUND_DURATION_SECONDS,
  MIN_ROUNDS,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  ROOM_NAME_MAX_LENGTH,
} from './schemas';

export type {
  ChatMessageInput,
  GuessInput,
  NicknameInput,
  RoomCodeInput,
  RoomConfigInput,
} from './schemas';
