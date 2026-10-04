/**
 * Route: /create-room
 *
 * Entry: user taps "Create Room" from home.
 * Exit: POST /rooms -> store room info -> connect socket + join:room -> /lobby/:roomId
 *
 * Visual reference: Figma Make "DoodleBee" screens `create-empty` / `create-set`
 * / `create-err`. Behaviour is unchanged: form bounds come from GET /settings
 * (D04-016) and the server stays authoritative for all values.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionStore } from '@/stores/session.store';
import { useRoomStore } from '@/stores/room.store';
import { createRoom, getSettings } from '@/api/endpoints';
import { joinRoom as joinRoomSocket } from '@/realtime/socket';
import { RoomConfigSchema } from '@/validation/schemas';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PaperBackground } from '@/components/ui/PaperBackground';
import { ComicSurface } from '@/components/ui/ComicSurface';
import { tokens } from '@/theme';
import { env } from '@/config/env';

// ------------------------------------------------------------------ Types ----

interface FormState {
  roomName: string;
  maxPlayers: number;
  rounds: number;
  roundDuration: number;
  hints: number;
}

// ---------------------------------------------------------------- Component --

const Stepper = ({
  label,
  description,
  value,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
  testID,
}: {
  label: string;
  description: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
  testID?: string;
}) => (
  <ComicSurface
    variant="sticker"
    style={styles.row}
    contentStyle={styles.rowInner}
  >
    <View style={styles.rowText}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowDescription}>{description}</Text>
    </View>
    <View style={styles.stepper} testID={testID}>
      <Pressable
        onPress={onDec}
        disabled={decDisabled}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        style={[styles.stepBtn, decDisabled && styles.stepBtnDisabled]}
      >
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        onPress={onInc}
        disabled={incDisabled}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        style={[styles.stepBtn, incDisabled && styles.stepBtnDisabled]}
      >
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  </ComicSurface>
);

export default function CreateRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setRoomId = useSessionStore((s) => s.setRoomId);
  const setReconnectInfo = useSessionStore((s) => s.setReconnectInfo);
  const setRoomJoined = useRoomStore((s) => s.setRoomJoined);

  const [form, setForm] = useState<FormState>({
    roomName: '',
    maxPlayers: 4,
    rounds: 3,
    roundDuration: 60,
    hints: 2,
  });
  const [limits, setLimits] = useState<{
    minPlayers: number;
    maxPlayers: number;
    minRounds: number;
    maxRounds: number;
    minRoundDuration: number;
    maxRoundDuration: number;
    minHints: number;
    maxHints: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load server-provided bounds on mount.
  useEffect(() => {
    if (!env.isApiConfigured) return;
    getSettings()
      .then((resp) => setLimits(resp.limits))
      .catch(() => {
        // Bounds unavailable - fall back to hardcoded minimums.
        // This is a degraded state, not a hard failure.
      });
  }, []);

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const validationError = (() => {
    const result = RoomConfigSchema.safeParse(form);
    if (!result.success) return result.error.issues[0]?.message ?? null;
    return null;
  })();

  async function handleCreate() {
    if (validationError) return;
    if (!env.isApiConfigured) {
      setError('Server not configured. Set EXPO_PUBLIC_API_URL.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await createRoom(form);
      setRoomId(response.roomId);
      const myPlayerId = useSessionStore.getState().playerId;
      if (!myPlayerId) {
        setError('Session not found. Please re-enter your nickname.');
        return;
      }
      setReconnectInfo({
        playerId: myPlayerId,
        lastRoomId: response.roomId,
        lastRoomCode: response.roomCode,
        lastHeartbeat: Date.now(),
      });
      setRoomJoined(
        {
          roomId: response.roomId,
          roomCode: response.roomCode,
          config: response.config,
          players: [],
          host: useSessionStore.getState().playerId ?? '',
        },
        [],
        useSessionStore.getState().playerId ?? '',
      );
      // Connect socket and join room.
      const token = useSessionStore.getState().sessionToken;
      if (token) {
        joinRoomSocket(response.roomId);
      }
      router.replace(`/lobby/${response.roomId}`);
    } catch (err) {
      if (err instanceof Error && 'status' in err) {
        const apiErr = err as unknown as {
          status: number;
          userMessage: () => string;
        };
        setError(apiErr.userMessage());
      } else {
        setError('Failed to create room. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Derive selectable bounds from server limits (or fallback defaults).
  const mpMin = limits?.minPlayers ?? 2;
  const mpMax = limits?.maxPlayers ?? 8;
  const rMin = limits?.minRounds ?? 1;
  const rMax = limits?.maxRounds ?? 20;
  const durMin = limits?.minRoundDuration ?? 30;
  const durMax = limits?.maxRoundDuration ?? 300;
  const hMin = limits?.minHints ?? 0;
  const hMax = limits?.maxHints ?? 5;

  const durationOptions = [30, 60, 90, 120, 180, 240, 300].filter(
    (d) => d >= durMin && d <= durMax,
  );

  const adjustDuration = (delta: number) => {
    const idx = durationOptions.indexOf(form.roundDuration);
    const base = idx === -1 ? 0 : idx;
    const nextIdx = Math.max(
      0,
      Math.min(durationOptions.length - 1, base + delta),
    );
    updateField('roundDuration', durationOptions[nextIdx]);
  };

  return (
    <View style={styles.root}>
      <PaperBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + tokens.spacing.sm },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          onBack={() => router.replace('/')}
          testID="create-room-back"
        />

        <Text style={styles.header}>CREATE YOUR{'\n'}CHAOS 🎨</Text>
        <Text style={styles.subtitle}>
          Your friends won&apos;t know what hit them.
        </Text>

        <Text style={styles.fieldLabel}>🏷 Room Name</Text>
        <Text style={styles.fieldDescription}>
          Something chaotic and iconic
        </Text>
        <Input
          value={form.roomName}
          onChangeText={(v) => updateField('roomName', v)}
          placeholder="E.g. Friday Night Chaos..."
          maxLength={30}
          testID="room-name-input"
        />

        <Stepper
          label="👥 Max Players"
          description="How many chaotic artists?"
          value={`${form.maxPlayers}`}
          onDec={() =>
            updateField('maxPlayers', Math.max(mpMin, form.maxPlayers - 1))
          }
          onInc={() =>
            updateField('maxPlayers', Math.min(mpMax, form.maxPlayers + 1))
          }
          decDisabled={form.maxPlayers <= mpMin}
          incDisabled={form.maxPlayers >= mpMax}
          testID="max-players-selector"
        />

        <Stepper
          label="🔄 Rounds"
          description="More rounds = more suffering 😈"
          value={`${form.rounds}`}
          onDec={() => updateField('rounds', Math.max(rMin, form.rounds - 1))}
          onInc={() => updateField('rounds', Math.min(rMax, form.rounds + 1))}
          decDisabled={form.rounds <= rMin}
          incDisabled={form.rounds >= rMax}
          testID="rounds-selector"
        />

        <Stepper
          label="⏱ Round Timer"
          description="Seconds per drawing"
          value={`${form.roundDuration}s`}
          onDec={() => adjustDuration(-1)}
          onInc={() => adjustDuration(1)}
          decDisabled={durationOptions.indexOf(form.roundDuration) <= 0}
          incDisabled={
            durationOptions.indexOf(form.roundDuration) ===
            durationOptions.length - 1
          }
          testID="duration-selector"
        />

        <Stepper
          label="💡 Hints"
          description="Clues for the artistically challenged"
          value={`${form.hints}`}
          onDec={() => updateField('hints', Math.max(hMin, form.hints - 1))}
          onInc={() => updateField('hints', Math.min(hMax, form.hints + 1))}
          decDisabled={form.hints <= hMin}
          incDisabled={form.hints >= hMax}
          testID="hints-selector"
        />

        {validationError || error ? (
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.sm}
            backgroundColor={tokens.colors.cheek}
            style={styles.errorCard}
            contentStyle={styles.errorInner}
          >
            <Text style={styles.errorText} testID="create-room-error">
              ★ {validationError ?? error}
            </Text>
          </ComicSurface>
        ) : null}

        <Button
          label="🎨 CREATE ROOM"
          variant="primary"
          fullWidth
          onPress={handleCreate}
          disabled={!!validationError || submitting}
          isLoading={submitting}
          testID="create-room-submit"
          style={styles.submitButton}
        />
      </ScrollView>
    </View>
  );
}

// --------------------------------------------------------- Styles ----------

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
  },
  header: {
    marginTop: tokens.spacing.md,
    fontFamily: tokens.typography.display.fontFamily,
    fontSize: tokens.typography.display.fontSize,
    lineHeight: tokens.typography.display.lineHeight,
    letterSpacing: tokens.typography.display.letterSpacing,
    color: tokens.colors.ink,
  },
  subtitle: {
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.lg,
    fontFamily: tokens.typography.body.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
  },
  fieldLabel: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.ink,
  },
  fieldDescription: {
    marginBottom: tokens.spacing.sm,
    fontFamily: tokens.typography.caption.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textSecondary,
  },
  row: {
    marginTop: tokens.spacing.md,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
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
    color: tokens.colors.textSecondary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: tokens.radius.xs,
    borderWidth: tokens.border.sticker,
    borderColor: tokens.colors.ink,
    backgroundColor: tokens.colors.beeYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  stepBtnText: {
    fontFamily: tokens.typography.subheading.fontFamily,
    fontSize: 20,
    lineHeight: 22,
    color: tokens.colors.ink,
  },
  stepValue: {
    minWidth: 40,
    textAlign: 'center',
    fontFamily: tokens.typography.subheading.fontFamily,
    fontSize: tokens.typography.subheading.fontSize,
    color: tokens.colors.ink,
  },
  errorCard: {
    marginTop: tokens.spacing.md,
  },
  errorInner: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  errorText: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.ink,
  },
  submitButton: {
    marginTop: tokens.spacing.xl,
  },
});
