/**
 * Server-internal aggregate types.
 *
 * These describe the live Redis aggregate (`data-model.md` section 3) and the
 * server-only views of it. Nothing here is a wire type: the wire types live in
 * `shared/contract`, and the snapshot projector is the only place the two meet.
 *
 * Secret-aware note: `RoomSecret` is the ONLY structure in this module that
 * carries the literal word, and it is only ever read by `WordSelector`,
 * `HintService` and the drawer projection.
 */

import type {
  GamePhase,
  RoomConfig,
  RoomStatus,
  RoundEndReason,
} from '../../../shared/contract/types.js';

/** `games.status` (`data-model.md` section 2.5). */
export const GAME_STATUSES = [
  'STARTING',
  'IN_PROGRESS',
  'FINISHED',
  'ABANDONED',
] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

/** `rounds.status` (`data-model.md` section 2.6). */
export const ROUND_STATUSES = ['ACTIVE', 'FINISHED', 'ABANDONED'] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];

/** One `room.rounds[]` row while a round is live. */
export interface RoundState {
  roundId: string;
  roundNumber: number;
  drawerPlayerId: string;
  wordId: string;
  maskedWordFinal: string | null;
  status: RoundStatus;
  endReason: RoundEndReason | null;
  startedAt: number;
  endedAt: number | null;
}

/**
 * The authoritative room aggregate (`room:{id}:state`).
 *
 * `data-model.md` section 3 lists the summary fields; the ones added beyond
 * that list are required by decisions elsewhere in the stage:
 * - `previousDrawerPlayerId` - D03-011's "never the same drawer twice" must
 *   survive a process restart, so it cannot be in-process state.
 * - `startingDeadline` / `resultsDeadline` - `state-machine.md` section 8.
 * - `roundStartedAt` / `pausedAt` - D03-020 needs the paused duration to
 *   extend `roundEndTime` on resume.
 * - `gameStatus` - mirrors `games.status` for the live phase decisions.
 */
export interface RoomAggregate {
  roomId: string;
  code: string;
  status: RoomStatus;
  hostPlayerId: string;
  config: RoomConfig;
  phase: GamePhase;
  gameId: string | null;
  gameStatus: GameStatus | null;
  roundId: string | null;
  roundNumber: number;
  roundsPlanned: number;
  drawerPlayerId: string | null;
  previousDrawerPlayerId: string | null;
  nextDrawerPlayerId: string | null;
  wordId: string | null;
  roundEndTime: number | null;
  roundTimerPaused: boolean;
  roundStartedAt: number | null;
  pausedAt: number | null;
  startingDeadline: number | null;
  resultsDeadline: number | null;
  hintsRemaining: number;
  revealedPositions: number[];
  endReason: RoundEndReason | null;
}

/**
 * A roster entry (`room:{id}:members`).
 *
 * `score` is deliberately absent: it lives once, in `room:{id}:scores`, and is
 * joined in at projection time (`server-state-writer-map.md` section 2.4).
 * `isHost` is likewise absent: `room.hostPlayerId` is the single authority.
 * `joinedAt` is present because the documented host-transfer tie-break
 * (`server-state-writer-map.md` section 4) needs it.
 */
export interface RoomMember {
  playerId: string;
  userId: string;
  nickname: string;
  seatOrder: number;
  isConnected: boolean;
  graceDeadline: number | null;
  /**
   * Connectivity history, not state authority: `true` once the member's socket
   * has bound at least once. It lets `join:room` distinguish a first presence
   * (`player:joined`) from a returning one (`player:reconnected`) even after the
   * grace window expired and `graceDeadline` was cleared
   * (`reconnect-protocol.md` section 7). `RoomService.bindSocket` sets it.
   */
  hasBound: boolean;
  joinedAt: number;
}

/** `room:{id}:secret` - the one structure allowed to hold the literal word. */
export interface RoomSecret {
  wordId: string;
  secretWord: string;
  maskedWord: string;
}

/** One entry of `room:{id}:strokes` (a rolling window of drawing operations). */
export type StrokeOp =
  | {
      op: 'start';
      t: number;
      strokeId: string;
      strokeSeq: number;
      color: string;
      brushSize: number;
      points: { x: number; y: number; pressure?: number }[];
    }
  | {
      op: 'move';
      t: number;
      strokeId: string;
      pointIndex: number;
      points: { x: number; y: number; pressure?: number }[];
    }
  | { op: 'end'; t: number; strokeId: string };

/** `session:{token}` (`data-model.md` section 3). */
export interface SessionRecord {
  playerId: string;
  userId: string;
  roomId: string | null;
  createdAt: number;
}

/** A correct guesser, in the server-assigned rank order. */
export interface CorrectGuesser {
  playerId: string;
  rank: number;
}

/** The reason a round ended, or `null` while it is live. */
export type { RoundEndReason };
