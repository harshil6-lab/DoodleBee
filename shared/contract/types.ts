/**
 * Public contract types (Stage 03).
 *
 * This module is copied verbatim into the client (D03-023). It must therefore
 * stay dependency-free apart from `zod`, and it must NEVER contain the secret
 * word or any drawer-private field.
 */

/** `state-machine.md` section 1.1. PROPOSED value set (D03-026, C-01). */
export const ROOM_STATUSES = ['WAITING', 'IN_GAME', 'CLOSED'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

/** The six PRD phases (D03-010). */
export const GAME_PHASES = [
  'WAITING',
  'STARTING',
  'ROUND_ACTIVE',
  'ROUND_FINISHED',
  'NEXT_ROUND',
  'GAME_FINISHED',
] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

export const ROLES = ['DRAWER', 'GUESSER'] as const;
export type Role = (typeof ROLES)[number];

/** The exactly-three round-end triggers (D03-012). */
export const ROUND_END_REASONS = [
  'TIMER_EXPIRED',
  'ALL_GUESSERS_CORRECT',
  'DRAWER_ABANDONED',
  'SERVER_TERMINATED',
] as const;
export type RoundEndReason = (typeof ROUND_END_REASONS)[number];

/** `realtime-contract.md` section 9.3. */
export const CHAT_MESSAGE_TYPES = [
  'NORMAL',
  'GUESS',
  'SYSTEM',
  'CORRECT_GUESS',
] as const;
export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number];

export interface RoomConfig {
  roomName: string;
  maxPlayers: number;
  rounds: number;
  /** Round length in seconds. */
  roundDuration: number;
  hints: number;
}

/** A roster entry. Contains no secret and no drawer-private field. */
export interface PublicPlayer {
  playerId: string;
  nickname: string;
  score: number;
  isConnected: boolean;
  isHost: boolean;
  seatOrder: number;
}

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

/** A stroke as replayed to peers (`reconnect-protocol.md` section 3). */
export interface Stroke {
  strokeId: string;
  color: string;
  brushSize: number;
  points: Point[];
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
}

/** The round timer, as the client renders it. Never a countdown. */
export interface RoundTimerState {
  roundEndTime: number | null;
  paused: boolean;
}
