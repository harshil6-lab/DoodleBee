/**
 * Guesser store - guesser-facing state ONLY (ADR section 9.1).
 *
 * This store extends the shared game base state and deliberately has NO
 * `secretWord` field. Accessing one is a compile-time error (ADR section 9.2)
 * and is asserted at runtime by the Stage 02 secret-word tests.
 *
 * Writer: realtime events exclusively.
 */
import { create } from 'zustand';
import {
  createGameBaseSlice,
  type GameBaseActions,
  type GameBaseState,
} from './game.store';

export interface GuesserState extends GameBaseState {
  /** playerIds who already guessed correctly in the current round. */
  hasGuessed: Set<string>;
}

export interface GuesserActions {
  markGuessed: (playerId: string) => void;
  clearGuessed: () => void;
}

export type GuesserStore = GuesserState & GameBaseActions & GuesserActions;

export const createGuesserStore = () =>
  create<GuesserStore>((set) => ({
    ...createGameBaseSlice<GuesserStore>(set),

    hasGuessed: new Set<string>(),

    markGuessed: (playerId) =>
      set((state) => {
        const next = new Set(state.hasGuessed);
        next.add(playerId);
        return { hasGuessed: next };
      }),
    clearGuessed: () => set({ hasGuessed: new Set<string>() }),
  }));

/**
 * Guesser-scoped singleton used by guesser-facing components (ADR section 7,
 * rule 5). Deliberately NOT re-exported from `src/stores/index.ts`.
 */
export const useGuesserGameStore = createGuesserStore();

/**
 * Runtime guard for the secret-word boundary. Throws if the supplied state
 * object exposes a `secretWord` field.
 */
export function assertNoSecretWord(state: object): void {
  if ('secretWord' in state) {
    throw new Error(
      'CRITICAL: guesser-facing state must not contain secretWord',
    );
  }
}
