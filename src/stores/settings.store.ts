/**
 * Settings store — local player preferences.
 *
 * Persisted via zustand/middleware persist → AsyncStorage.
 * Defaults are loaded from GET /settings on first use; local toggles
 * override server defaults after the user changes them.
 *
 * No server synchronization required — settings are local-only in V1.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocalSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
}

interface SettingsState extends LocalSettings {
  setSoundEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setVibrationEnabled: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

const DEFAULTS: LocalSettings = {
  soundEnabled: true,
  musicEnabled: true,
  vibrationEnabled: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setVibrationEnabled: (vibrationEnabled) => set({ vibrationEnabled }),
      resetToDefaults: () => set(DEFAULTS),
    }),
    {
      name: 'doodlebee-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        musicEnabled: state.musicEnabled,
        vibrationEnabled: state.vibrationEnabled,
      }),
    },
  ),
);
