/**
 * Transition guards (`state-machine.md` section 4).
 *
 * Pure predicates only: they decide whether a transition is allowed, never
 * perform it. Each transition's single writer lives in `gameStateMachine.ts`'
 * callers (`RoomService`, `RoundService`, `GameFinalizer`), so a guard cannot
 * accidentally become a second writer.
 */

import { MIN_PLAYERS } from '../../../shared/contract/constants.js';
import type { GamePhase, RoomStatus } from '../../../shared/contract/types.js';

export interface TransitionContext {
  phase: GamePhase;
  roomStatus: RoomStatus;
  connectedRosterSize: number;
  now: number;
  startingDeadline: number | null;
  resultsDeadline: number | null;
  roundNumber: number;
  roundsPlanned: number;
  drawerPlayerId: string | null;
  wordId: string | null;
  roundTimerPaused: boolean;
  roundEndTime: number | null;
}

/** `WAITING -> STARTING`: host accepted and enough connected players. */
export function canStartGame(ctx: TransitionContext): boolean {
  return (
    ctx.phase === 'WAITING' &&
    ctx.roomStatus === 'WAITING' &&
    ctx.connectedRosterSize >= MIN_PLAYERS
  );
}

/** `STARTING -> ROUND_ACTIVE`: the countdown elapsed and a roster remains. */
export function canEnterRoundActive(ctx: TransitionContext): boolean {
  return (
    ctx.phase === 'STARTING' &&
    ctx.startingDeadline !== null &&
    ctx.now >= ctx.startingDeadline &&
    ctx.connectedRosterSize >= MIN_PLAYERS
  );
}

/** `STARTING -> WAITING`: the roster collapsed before the countdown elapsed. */
export function shouldAbortStarting(ctx: TransitionContext): boolean {
  return ctx.phase === 'STARTING' && ctx.connectedRosterSize < MIN_PLAYERS;
}

/** `ROUND_FINISHED -> NEXT_ROUND | GAME_FINISHED`: the results window elapsed. */
export function canLeaveRoundFinished(ctx: TransitionContext): boolean {
  return (
    ctx.phase === 'ROUND_FINISHED' &&
    ctx.resultsDeadline !== null &&
    ctx.now >= ctx.resultsDeadline
  );
}

/** Which state the elapsed results window leads to. */
export function resultsDestination(
  ctx: TransitionContext,
): 'NEXT_ROUND' | 'GAME_FINISHED' {
  return ctx.roundNumber >= ctx.roundsPlanned ? 'GAME_FINISHED' : 'NEXT_ROUND';
}

/** `NEXT_ROUND -> ROUND_ACTIVE`: a drawer and a word were selected. */
export function canStartRound(ctx: TransitionContext): boolean {
  return (
    ctx.phase === 'NEXT_ROUND' &&
    ctx.drawerPlayerId !== null &&
    ctx.wordId !== null
  );
}

/** The timer may only be compared against the clock while live and unpaused. */
export function isRoundTimerExpired(ctx: TransitionContext): boolean {
  return (
    ctx.phase === 'ROUND_ACTIVE' &&
    !ctx.roundTimerPaused &&
    ctx.roundEndTime !== null &&
    ctx.now >= ctx.roundEndTime
  );
}

/** Drawing and guessing are only legal while the round is live. */
export function isRoundActive(ctx: TransitionContext): boolean {
  return ctx.phase === 'ROUND_ACTIVE';
}
