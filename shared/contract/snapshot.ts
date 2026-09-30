/**
 * `response:state:snapshot` (`reconnect-protocol.md` section 3).
 *
 * Role-scoping rule (section 4): `round.secretWord` is present only when the
 * requester is the current drawer AND the phase is `ROUND_ACTIVE`. It is
 * deleted from the object (never nulled) so a guesser cannot observe it.
 */

import type {
  GamePhase,
  LeaderboardEntry,
  PublicPlayer,
  RoomConfig,
  RoomStatus,
  Role,
  RoundEndReason,
  RoundTimerState,
  Stroke,
} from './types.js';
import type { ChatEntry } from './server-payloads.js';

export interface SnapshotRoom {
  roomId: string;
  roomCode: string;
  roomName: string;
  status: RoomStatus;
  hostPlayerId: string;
  config: RoomConfig;
}

export interface SnapshotYou {
  playerId: string;
  nickname: string;
  role: Role;
  score: number;
  hasGuessedCorrectly: boolean;
}

export interface SnapshotGame {
  gameId: string | null;
  phase: GamePhase;
  roundNumber: number;
  roundsPlanned: number;
}

export interface SnapshotRound {
  roundId: string | null;
  drawerPlayerId: string | null;
  maskedWord: string;
  revealedPositions: number[];
  hintsRemaining: number;
  timer: RoundTimerState;
  endReason?: RoundEndReason;
  /** `ROUND_FINISHED` only: the round is over, so the word is safe. */
  word?: string;
  /** PRESENT ONLY WHEN `you.role === 'DRAWER'` AND `ROUND_ACTIVE`. */
  secretWord?: string;
  startingDeadline?: number;
  resultsDeadline?: number;
  nextDrawerPlayerId?: string;
}

export interface CorrectGuesserEntry {
  playerId: string;
  nickname: string;
  rank: number;
  points: number;
}

export interface StateSnapshot {
  type: 'response:state:snapshot';
  version: number;
  serverNow: number;
  room: SnapshotRoom;
  players: PublicPlayer[];
  you: SnapshotYou;
  game: SnapshotGame;
  round: SnapshotRound;
  correctGuessers: CorrectGuesserEntry[];
  strokes: Stroke[];
  chat: ChatEntry[];
  scores: Record<string, number>;
  leaderboard: LeaderboardEntry[];
}
