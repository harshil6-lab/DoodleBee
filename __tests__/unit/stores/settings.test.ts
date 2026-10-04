/**
 * Settings store tests (Phase 4A).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { useSettingsStore } from '../../../src/stores/settings.store';

describe('settings store', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it('defaults are all enabled', () => {
    const s = useSettingsStore.getState();
    expect(s.soundEnabled).toBe(true);
    expect(s.musicEnabled).toBe(true);
    expect(s.vibrationEnabled).toBe(true);
  });

  it('toggles update correctly', () => {
    useSettingsStore.getState().setSoundEnabled(false);
    useSettingsStore.getState().setMusicEnabled(false);
    useSettingsStore.getState().setVibrationEnabled(false);

    const s = useSettingsStore.getState();
    expect(s.soundEnabled).toBe(false);
    expect(s.musicEnabled).toBe(false);
    expect(s.vibrationEnabled).toBe(false);
  });

  it('resetToDefaults restores all values', () => {
    useSettingsStore.getState().setSoundEnabled(false);
    useSettingsStore.getState().resetToDefaults();
    expect(useSettingsStore.getState().soundEnabled).toBe(true);
  });
});
