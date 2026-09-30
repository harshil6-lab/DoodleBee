/**
 * Shared error taxonomy.
 *
 * Source of truth: Stage 03 `api-contract.md` section 5 and
 * `realtime-contract.md` section 10.2 (decision D03-022).
 *
 * One vocabulary serves both transports. The codes map onto the HTTP statuses
 * the Stage 02 client already switches on (`ApiError.userMessage()`), so the
 * server does not get to invent a new vocabulary (D03-022).
 */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_ADMITTED',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_ALREADY_STARTED',
  'ROOM_CLOSED',
  'BAD_STATE',
  'NOT_DRAWER',
  'DRAWER_CANNOT_GUESS',
  'ALREADY_GUESSED',
  'RATE_LIMITED',
  'MUTED',
  'SESSION_EXPIRED',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * `connection:lost` codes (`realtime-contract.md` section 2.3).
 *
 * The shutdown notice uses `SERVER_SHUTDOWN`, which is a *transport* condition
 * and therefore not part of the 16-code gameplay taxonomy in section 10.2. It
 * is enumerated here explicitly rather than by widening `ERROR_CODES`, so the
 * gameplay vocabulary stays exactly as the contract locks it.
 */
export const CONNECTION_LOST_CODES = [...ERROR_CODES, 'SERVER_SHUTDOWN'] as const;
export type ConnectionLostCode = (typeof CONNECTION_LOST_CODES)[number];

/** `realtime-contract.md` section 10.2: may the client retry? */
export const ERROR_RETRYABLE: Record<ErrorCode, boolean> = {
  VALIDATION_ERROR: false,
  UNAUTHENTICATED: false,
  FORBIDDEN: false,
  NOT_ADMITTED: false,
  ROOM_NOT_FOUND: false,
  ROOM_FULL: false,
  ROOM_ALREADY_STARTED: false,
  ROOM_CLOSED: false,
  BAD_STATE: true,
  NOT_DRAWER: false,
  DRAWER_CANNOT_GUESS: false,
  ALREADY_GUESSED: false,
  RATE_LIMITED: true,
  MUTED: false,
  SESSION_EXPIRED: false,
  INTERNAL_ERROR: true,
};

/** `api-contract.md` section 5.2: the HTTP status each code maps onto. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  ROOM_NOT_FOUND: 404,
  NOT_ADMITTED: 404,
  ROOM_FULL: 409,
  ROOM_ALREADY_STARTED: 409,
  ROOM_CLOSED: 409,
  BAD_STATE: 409,
  NOT_DRAWER: 409,
  DRAWER_CANNOT_GUESS: 409,
  ALREADY_GUESSED: 409,
  MUTED: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * User-safe text (docs/AGENTS.md section 13).
 *
 * Mirrors the vocabulary of the client's `ApiError.userMessage()` so the
 * client needs no new user-facing strings.
 */
export const ERROR_USER_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Invalid request. Please check your input.',
  UNAUTHENTICATED: 'Session expired. Please re-enter your nickname.',
  SESSION_EXPIRED: 'Session expired. Please re-enter your nickname.',
  FORBIDDEN: 'You are not allowed to do that.',
  NOT_ADMITTED: 'Room not found. Check the room code and try again.',
  ROOM_NOT_FOUND: 'Room not found. Check the room code and try again.',
  ROOM_FULL: 'Room is full or the game has already started.',
  ROOM_ALREADY_STARTED: 'Room is full or the game has already started.',
  ROOM_CLOSED: 'That room has closed.',
  BAD_STATE: 'That is not allowed right now.',
  NOT_DRAWER: 'Only the drawer can do that.',
  DRAWER_CANNOT_GUESS: 'The drawer cannot guess.',
  ALREADY_GUESSED: 'You have already guessed correctly.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment.',
  MUTED: 'The host muted you.',
  INTERNAL_ERROR: 'Server error. Please try again.',
};

/** The REST error envelope from `api-contract.md` section 5.1. */
export interface ErrorEnvelope {
  error: { code: ErrorCode; message: string };
}
