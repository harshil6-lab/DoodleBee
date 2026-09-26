/**
 * UI store — local UI state, no server synchronization.
 * Writer: Component-level interactions only.
 * Not persisted across navigations (except where explicitly designed).
 */
import { create } from 'zustand';

export type ModalType = 'clearCanvas' | 'hintConfirm' | 'leaveRoom' | null;

interface UiState {
  chatExpanded: boolean;
  modal: ModalType;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;

  toggleChat: () => void;
  setChatExpanded: (expanded: boolean) => void;
  openModal: (type: ModalType) => void;
  closeModal: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: () => void;
  reset: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  chatExpanded: false,
  modal: null,
  toast: null,

  toggleChat: () => set((state) => ({ chatExpanded: !state.chatExpanded })),
  setChatExpanded: (chatExpanded) => set({ chatExpanded }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  dismissToast: () => set({ toast: null }),
  reset: () =>
    set({
      chatExpanded: false,
      modal: null,
      toast: null,
    }),
}));
