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
import type { GamePhase, RoundTimer } from '../types';

export interface GameBaseState {
  phase: GamePhase;
  /** playerId of the current drawer. */
  drawer: string | null;
  maskedWord: string;
  /** playerId -> score. */
  scores: Record<string, number>;
  hintsRemaining: number;
  timer: RoundTimer;
}

export interface GameBaseActions {
  setPhase: (phase: GamePhase) => void;
  setDrawer: (drawerId: string | null) => void;
  setMaskedWord: (word: string) => void;
  setScores: (scores: Record<string, number>) => void;
  setHintsRemaining: (count: number) => void;
  setTimer: (timer: RoundTimer) => void;
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
  timer: { roundEndTime: null },

  setPhase: (phase) => set({ phase } as Partial<TState>),
  setDrawer: (drawer) => set({ drawer } as Partial<TState>),
  setMaskedWord: (maskedWord) => set({ maskedWord } as Partial<TState>),
  setScores: (scores) => set({ scores } as Partial<TState>),
  setHintsRemaining: (hintsRemaining) =>
    set({ hintsRemaining } as Partial<TState>),
  setTimer: (timer) => set({ timer } as Partial<TState>),
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
      timer: { roundEndTime: null },
    } as Partial<TState>),
});

/**
 * Standalone role-agnostic base store. Prefer the role stores
 * (`src/stores/drawer.store.ts`, `src/stores/guesser.store.ts`) in components.
 */
export const createGameBaseStore = () =>
  create<GameBaseStore>((set) => createGameBaseSlice<GameBaseStore>(set));
