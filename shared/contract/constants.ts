/**
 * Shared constants (Stage 03 decision D03-028).
 *
 * PROVISIONAL VALUES
 * ------------------
 * Every value tagged `PROPOSED` is a placeholder chosen to unblock
 * implementation. It is NOT a PRD requirement. Open condition OC-4 requires
 * the product owner to confirm or replace each one (C-01, C-02, C-05, C-06).
 * Do not present a PROPOSED value as a product decision.
 */

// ------------------------------------------------------------ room limits ---

/** PROPOSED (D03-027, C-02). Mirrors the locked Stage 02 client constant. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 20;
export const MIN_ROUND_DURATION_SECONDS = 30;
export const MAX_ROUND_DURATION_SECONDS = 300;
export const MIN_HINTS = 0;
export const MAX_HINTS = 5;
export const ROOM_NAME_MIN_LENGTH = 1;
export const ROOM_NAME_MAX_LENGTH = 30;

// ------------------------------------------------------------- user input ---

export const NICKNAME_MIN_LENGTH = 1;
export const NICKNAME_MAX_LENGTH = 20;
export const NICKNAME_REGEX = /^[a-zA-Z0-9_]+$/;
export const MAX_GUESS_LENGTH = 100;
export const MAX_CHAT_MESSAGE_LENGTH = 200;

// ------------------------------------------------------------- room codes ---

/** Mirrors the locked client `ROOM_CODE_ALPHABET` (30 symbols, no O/0/I/1). */
export const ROOM_CODE_ALPHABET = 'ABCDEGHJKLMNPQRSTVWXYZ23456789';
export const ROOM_CODE_MIN_LENGTH = 5;
export const ROOM_CODE_MAX_LENGTH = 6;
export const ROOM_CODE_REGEX = new RegExp(
  '^[' + ROOM_CODE_ALPHABET + ']+$',
  'i',
);

// --------------------------------------------------------------- drawing ----

export const DRAW_MOVE_BATCH_SIZE = 10;
export const MAX_POINTS_PER_STROKE = 300;
export const STROKE_HISTORY_MS = 30_000;
/** The chat ring buffer size (`data-model.md` section 3: last 50). */
export const CHAT_RING_SIZE = 50;
export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 20;
export const STROKE_ID_MAX_LENGTH = 64;
export const STROKE_COLOR_REGEX = /^#[0-9a-fA-F]{3,8}$/;

// ------------------------------------------------------- session / tokens ---

export const EVENT_ID_MAX_LENGTH = 128;

// --------------------------------------------------- timings (PROPOSED) -----

/** PROPOSED (D03-028, C-05): `STARTING` countdown window. */
export const STARTING_WINDOW_MS = 3_000;
/** PROPOSED (D03-028): results window before `NEXT_ROUND`/`GAME_FINISHED`. */
export const RESULTS_WINDOW_MS = 8_000;
/** PROPOSED (D03-020, D03-028, C-05): drawer grace period. */
export const DRAWER_GRACE_MS = 15_000;
/** PROPOSED (D03-020, D03-028): guesser grace period. */
export const GUESSER_GRACE_MS = 30_000;
/** PROPOSED (D03-028): idle room TTL, also the Redis room key TTL. */
export const ROOM_TTL_SECONDS = 30 * 60;
/** PROPOSED (D03-028, D03-019): session token TTL. */
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

// ------------------------------------------------------------ soft limits ---

/** PROPOSED: `security-model.md` section 6 token buckets. */
export const RATE_LIMITS = {
  sessionCreatePerMinutePerIp: 10,
  roomCreatePerMinutePerSession: 5,
  roomCreatePerHourPerIp: 30,
  roomJoinPerMinutePerSession: 10,
  configUpdatePerMinutePerRoom: 10,
  chatPer5s: 5,
  chatBurst: 8,
  guessPer10s: 10,
  drawPerSecond: 60,
  drawBurst: 120,
  snapshotPerMinutePerSocket: 6,
} as const;

// ------------------------------------------------------ transport bounds ---

/**
 * Per-player LRU size for applied `eventId`s
 * (`realtime-contract.md` section 11: "a bounded per-player LRU of applied
 * `eventId`s (~64 entries)"). It is transport plumbing, not game state
 * (`server-state-writer-map.md` section 2.5).
 */
export const EVENT_ID_DEDUPE_CAPACITY = 64;

/**
 * PROPOSED (`security-model.md` section 6: "Socket.IO `maxHttpBufferSize`
 * bounded"). No approved document states a byte value. A drawing batch is at
 * most `DRAW_MOVE_BATCH_SIZE` points, so 256 KiB leaves ample headroom while
 * keeping an oversized payload from reaching a handler.
 */
export const MAX_HTTP_BUFFER_SIZE = 256 * 1024;

/**
 * PROPOSED (`security-model.md` section 6: "Repeated protocol violations are
 * counted per socket; a threshold triggers a disconnect"). No approved
 * document states the threshold.
 */
export const PROTOCOL_VIOLATION_LIMIT = 20;


/**
 * PROPOSED (`decision.md`: round expiry "is enforced by a sweep that compares
 * `now` to `roundEndTime`"). No approved document states how often the sweep
 * runs, only that expiry is deadline-driven rather than tick-driven. One second
 * bounds the observable lag of a round ending without busy-looping; the value
 * is a scheduling choice, not a product decision.
 */
export const SWEEPER_INTERVAL_MS = 1_000;