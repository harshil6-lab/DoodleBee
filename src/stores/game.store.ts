/**
 * Game base store slice - SHARED by the drawer and guesser role stores.
 *
 * This slice contains NO `secretWord` field. That absence is the technical
 * enforcement of the secret-word boundary (ADR section 9.1).
 *
 * Writer: realtime events exclusively (ADR section 7 state writer map).
 * Never written by REST responses or local user interaction.
 */
import { create } from 'zustand';
import type { GamePhase, RoundEndReason, RoundTimer } from '../types';

export interface RoundResult {
  roundNumber: number;
  endReason: RoundEndReason;
  word: string;
  rankings: {
    playerId: string;
    nickname: string;
    rank: number;
    points: number;
  }[];
  drawerBonus: number;
  drawerPoints: number;
}

export interface FinalResult {
  finalScores: Record<string, number>;
  rankings: {
    playerId: string;
    nickname: string;
    rank: number;
    score: number;
  }[];
  winnerId: string;
}

export interface GameBaseState {
  phase: GamePhase;
  /** playerId of the current drawer. */
  drawer: string | null;
  maskedWord: string;
  /** playerId -> score. */
  scores: Record<string, number>;
  hintsRemaining: number;
  timer: RoundTimer;
  /** Current round number (1-based). */
  roundNumber: number;
  /** Total rounds planned for this game. */
  roundsPlanned: number;
  /** Result of the most recently completed round (populated by round:ended). */
  roundResult: RoundResult | null;
  /** Result of the completed game (populated by game:finished). */
  finalResult: FinalResult | null;
  /** PlayerId of the drawer for the upcoming round (NEXT_ROUND phase only). */
  nextDrawerPlayerId: string | null;
}

export interface GameBaseActions {
  setPhase: (phase: GamePhase) => void;
  setDrawer: (drawerId: string | null) => void;
  setMaskedWord: (word: string) => void;
  setScores: (scores: Record<string, number>) => void;
  setHintsRemaining: (count: number) => void;
  setTimer: (timer: RoundTimer) => void;
  setRoundNumber: (n: number) => void;
  setRoundsPlanned: (n: number) => void;
  setRoundResult: (result: RoundResult | null) => void;
  setFinalResult: (result: FinalResult | null) => void;
  setNextDrawer: (playerId: string | null) => void;
  addScore: (playerId: string, points: number) => void;
  resetForRound: () => void;
}

export type GameBaseStore = GameBaseState & GameBaseActions;

/**
 * Minimal setter contract the slice needs. Both role stores satisfy it with
 * their own store setter, so slice actions always mutate the store that
 * composed them.
 */
export type SliceSetter<TState> = (
  partial: Partial<TState> | ((state: TState) => Partial<TState>),
) => void;

export const createGameBaseSlice = <TState extends GameBaseState>(
  set: SliceSetter<TState>,
): GameBaseStore => ({
  phase: 'WAITING',
  drawer: null,
  maskedWord: '',
  scores: {},
  hintsRemaining: 0,
  timer: { roundEndTime: null, paused: false },
  roundNumber: 1,
  roundsPlanned: 3,
  roundResult: null,
  finalResult: null,
  nextDrawerPlayerId: null,

  setPhase: (phase) => set({ phase } as Partial<TState>),
  setDrawer: (drawer) => set({ drawer } as Partial<TState>),
  setMaskedWord: (maskedWord) => set({ maskedWord } as Partial<TState>),
  setScores: (scores) => set({ scores } as Partial<TState>),
  setHintsRemaining: (hintsRemaining) =>
    set({ hintsRemaining } as Partial<TState>),
  setTimer: (timer) => set({ timer } as Partial<TState>),
  setRoundNumber: (roundNumber) => set({ roundNumber } as Partial<TState>),
  setRoundsPlanned: (roundsPlanned) =>
    set({ roundsPlanned } as Partial<TState>),
  setRoundResult: (roundResult) => set({ roundResult } as Partial<TState>),
  setFinalResult: (finalResult) => set({ finalResult } as Partial<TState>),
  setNextDrawer: (nextDrawerPlayerId) =>
    set({ nextDrawerPlayerId } as Partial<TState>),
  addScore: (playerId, points) =>
    set(
      (state) =>
        ({
          scores: {
            ...state.scores,
            [playerId]: (state.scores[playerId] ?? 0) + points,
          },
        }) as Partial<TState>,
    ),
  resetForRound: () =>
    set({
      maskedWord: '',
      hintsRemaining: 0,
      timer: { roundEndTime: null, paused: false },
    } as Partial<TState>),
});

/**
 * Standalone role-agnostic base store. Prefer the role stores
 * (`src/stores/drawer.store.ts`, `src/stores/guesser.store.ts`) in components.
 */
export const createGameBaseStore = () =>
  create<GameBaseStore>((set) => createGameBaseSlice<GameBaseStore>(set));
