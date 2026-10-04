/**
 * Route: /settings
 *
 * Player preferences: sound, music, vibration toggles.
 * Local-only persistence via AsyncStorage (zustand persist middleware).
 * No server-authoritative game settings are duplicated here.
 * Navigation: back → home (/).
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { tokens } from '@/theme/tokens';
import { useSettingsStore } from '@/stores/settings.store';

// ---------------------------------------------------------------- Helpers ---

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
  testID,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.toggleRow} testID={testID}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? (
          <Text style={styles.toggleDescription}>{description}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={onToggle}
        style={[styles.toggleSwitch, enabled && styles.toggleSwitchOn]}
        accessibilityRole="switch"
        accessibilityState={{ selected: enabled }}
        accessibilityLabel={`Toggle ${label}`}
      >
        <View style={[styles.toggleKnob, enabled && styles.toggleKnobOn]} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------- Component --

export default function SettingsScreen() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const vibrationEnabled = useSettingsStore((s) => s.vibrationEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const setMusicEnabled = useSettingsStore((s) => s.setMusicEnabled);
  const setVibrationEnabled = useSettingsStore((s) => s.setVibrationEnabled);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="settings-screen"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Toggles section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gameplay</Text>

        <ToggleRow
          label="Sound Effects"
          description="Enable sound for guesses, hints, and events"
          enabled={soundEnabled}
          onToggle={() => setSoundEnabled(!soundEnabled)}
          testID="toggle-sound"
        />

        <ToggleRow
          label="Background Music"
          description="Play ambient music during gameplay"
          enabled={musicEnabled}
          onToggle={() => setMusicEnabled(!musicEnabled)}
          testID="toggle-music"
        />

        <ToggleRow
          label="Vibration"
          description="Haptic feedback on correct guesses"
          enabled={vibrationEnabled}
          onToggle={() => setVibrationEnabled(!vibrationEnabled)}
          testID="toggle-vibration"
        />
      </View>

      {/* About section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>DoodleBee — Draw &amp; Guess</Text>
          <Text style={styles.aboutValue}>V1</Text>
        </View>
      </View>

      {/* Privacy note (placeholder link for PRD §20 requirements) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <Text style={styles.legalNote}>
          By using DoodleBee you agree to our Terms of Service and acknowledge
          our Privacy Policy.
        </Text>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xxxl,
    paddingBottom: tokens.spacing.xxxl,
    gap: tokens.spacing.lg,
  },
  header: {
    marginBottom: tokens.spacing.sm,
  },
  title: {
    fontSize: tokens.typography.display.fontSize,
    fontWeight: tokens.typography.display.fontWeight,
    color: tokens.colors.textPrimary,
  },
  section: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  sectionTitle: {
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700' as const,
    color: tokens.colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.sm,
  },
  toggleText: {
    flex: 1,
    paddingRight: tokens.spacing.md,
  },
  toggleLabel: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '600' as const,
    color: tokens.colors.textPrimary,
  },
  toggleDescription: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.colors.disabled,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchOn: {
    backgroundColor: tokens.colors.primary,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutLabel: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textPrimary,
  },
  aboutValue: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textMuted,
    fontWeight: '600' as const,
  },
  legalNote: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    lineHeight: 18,
  },
});
