/**
 * Barrel for the role-agnostic Zustand domains.
 *
 * Domain boundaries (ADR section 4): session, room, game, connection, ui.
 *
 * The two role stores are intentionally NOT re-exported here, so that no
 * single module hands out a drawer (secret-bearing) accessor:
 * - drawer-facing code imports `src/stores/drawer.store.ts`
 * - guesser-facing code imports `src/stores/guesser.store.ts`
 *
 * Domain types are defined once in `src/types`.
 */
export { useSessionStore } from './session.store';
export type { ReconnectInfo } from './session.store';

export { useConnectionStore } from './connection.store';
export type { ConnectionStatus } from './connection.store';

export { useRoomStore } from './room.store';

export { createGameBaseStore, createGameBaseSlice } from './game.store';
export type {
  GameBaseActions,
  GameBaseState,
  GameBaseStore,
  RoundResult,
  FinalResult,
} from './game.store';

export { useUiStore } from './ui.store';
export type { ModalType } from './ui.store';
