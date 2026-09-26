/**
 * Drawer store - drawer-facing state ONLY (ADR section 9.1).
 *
 * Import this module ONLY from drawer-facing code. It holds the single
 * client-side `secretWord` accessor in the application.
 *
 * Writers:
 * - `secretWord`: realtime `drawer:selected` (drawer-only payload, see
 *   `src/types/drawer-private.ts`)
 * - `strokes` / `selectedColor` / `brushSize`: local drawer interaction
 */
import { create } from 'zustand';
import type { Stroke } from '../types';
import {
  createGameBaseSlice,
  type GameBaseActions,
  type GameBaseState,
} from './game.store';

export interface DrawerSecretState {
  /** SECRET - drawer only. Never readable from the guesser store. */
  secretWord: string;
}

export interface DrawerToolState {
  strokes: Stroke[];
  selectedColor: string;
  brushSize: number;
}

export interface DrawerActions {
  setSecretWord: (word: string) => void;
  addStroke: (stroke: Stroke) => void;
  clearStrokes: () => void;
  setSelectedColor: (color: string) => void;
  setBrushSize: (size: number) => void;
}

export type DrawerState = GameBaseState & DrawerSecretState & DrawerToolState;
export type DrawerStore = DrawerState & GameBaseActions & DrawerActions;

export const createDrawerStore = () =>
  create<DrawerStore>((set) => ({
    ...createGameBaseSlice<DrawerStore>(set),

    secretWord: '',
    strokes: [],
    selectedColor: '#000000',
    brushSize: 8,

    setSecretWord: (secretWord) => set({ secretWord }),
    addStroke: (stroke) =>
      set((state) => ({ strokes: [...state.strokes, stroke] })),
    clearStrokes: () => set({ strokes: [] }),
    setSelectedColor: (selectedColor) => set({ selectedColor }),
    setBrushSize: (brushSize) => set({ brushSize }),
  }));

/**
 * Drawer-scoped singleton used by drawer-facing components (ADR section 7,
 * rule 5). Deliberately NOT re-exported from `src/stores/index.ts`.
 */
export const useDrawerGameStore = createDrawerStore();
