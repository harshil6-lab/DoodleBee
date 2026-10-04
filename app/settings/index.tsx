/**
 * Route: /settings
 *
 * Player preferences: sound, music, vibration toggles.
 * Local-only persistence via AsyncStorage (zustand persist middleware).
 * No server-authoritative game settings are duplicated here.
 *
 * Visual reference: Figma Make "DoodleBee" `settings`.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import { PaperBackground } from '@/components/ui/PaperBackground';
import { ComicSurface } from '@/components/ui/ComicSurface';
import { useSettingsStore } from '@/stores/settings.store';

// ---------------------------------------------------------------- Helpers ---

function ToggleRow({
  icon,
  label,
  description,
  enabled,
  onToggle,
  testID,
}: {
  icon: string;
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? (
          <Text style={styles.rowDescription}>{description}</Text>
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

function InfoRow({
  icon,
  label,
  description,
}: {
  icon: string;
  label: string;
  description?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? (
          <Text style={styles.rowDescription}>{description}</Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <ComicSurface
      variant="sticker"
      radius={tokens.radius.lg}
      backgroundColor={tokens.colors.white}
      style={styles.section}
      contentStyle={styles.sectionInner}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </ComicSurface>
  );
}

// ---------------------------------------------------------------- Component --

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const vibrationEnabled = useSettingsStore((s) => s.vibrationEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const setMusicEnabled = useSettingsStore((s) => s.setMusicEnabled);
  const setVibrationEnabled = useSettingsStore((s) => s.setVibrationEnabled);

  return (
    <View style={styles.root}>
      <PaperBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + tokens.spacing.sm },
        ]}
        testID="settings-screen"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="settings-back"
          >
            <Text style={styles.headerStar}>★</Text>
          </Pressable>
          <Text style={styles.headerTitle}>⚙️ SETTINGS</Text>
        </View>

        <SectionCard title="Sound & Haptics">
          <ToggleRow
            icon="🔊"
            label="Sound Effects"
            description="Pops, whooshes, dings"
            enabled={soundEnabled}
            onToggle={() => setSoundEnabled(!soundEnabled)}
            testID="toggle-sound"
          />
          <ToggleRow
            icon="🎵"
            label="Background Music"
            description="Looping game soundtrack"
            enabled={musicEnabled}
            onToggle={() => setMusicEnabled(!musicEnabled)}
            testID="toggle-music"
          />
          <ToggleRow
            icon="📳"
            label="Vibration"
            description="Haptic feedback on events"
            enabled={vibrationEnabled}
            onToggle={() => setVibrationEnabled(!vibrationEnabled)}
            testID="toggle-vibration"
          />
        </SectionCard>

        <SectionCard title="Account & Privacy">
          <InfoRow
            icon="🔒"
            label="Privacy Policy"
            description="How we handle your data"
          />
          <InfoRow
            icon="📄"
            label="Terms of Service"
            description="The boring legal stuff"
          />
          <InfoRow icon="🍪" label="Cookie Preferences" />
        </SectionCard>

        <SectionCard title="Age & Content">
          <InfoRow
            icon="🔞"
            label="This app is for ages 18+"
            description="DoodleBee contains adult humor, mature themes, and user-generated content that may not be suitable for minors. Player-submitted drawings and chat are not pre-moderated."
          />
          <InfoRow
            icon="⚠️"
            label="Content Guidelines"
            description="What's allowed in the game"
          />
          <InfoRow icon="🚫" label="Profanity Filter" />
        </SectionCard>

        <SectionCard title="About">
          <InfoRow
            icon="🐝"
            label="About DoodleBee"
            description="Made with chaos and caffeine"
          />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
        </SectionCard>

        <Text style={styles.legalNote}>
          By using DoodleBee you agree to our Terms of Service and acknowledge
          our Privacy Policy.
        </Text>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.cream,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xxl,
    gap: tokens.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
  },
  headerStar: {
    fontSize: 20,
    color: tokens.colors.hotPink,
  },
  headerTitle: {
    fontFamily: tokens.typography.heading.fontFamily,
    fontSize: tokens.typography.heading.fontSize,
    lineHeight: tokens.typography.heading.lineHeight,
    color: tokens.colors.ink,
  },
  section: {
    width: '100%',
  },
  sectionInner: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    letterSpacing: 1.2,
    color: tokens.colors.textMuted,
  },
  sectionBody: {
    gap: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  rowIcon: {
    width: 28,
    fontSize: 18,
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.ink,
  },
  rowDescription: {
    marginTop: tokens.spacing.xxs,
    fontFamily: tokens.typography.caption.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
  },
  chevron: {
    fontFamily: tokens.typography.subheading.fontFamily,
    fontSize: tokens.typography.subheading.fontSize,
    color: tokens.colors.textMuted,
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.colors.disabled,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchOn: {
    backgroundColor: tokens.colors.purple,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.white,
    alignSelf: 'flex-start',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutLabel: {
    fontFamily: tokens.typography.body.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.ink,
  },
  aboutValue: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textMuted,
  },
  legalNote: {
    fontFamily: tokens.typography.caption.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    lineHeight: tokens.typography.caption.lineHeight,
    color: tokens.colors.textMuted,
    textAlign: 'center',
  },
});
