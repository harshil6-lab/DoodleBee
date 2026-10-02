/**
 * Route: /create-room
 *
 * Entry: user taps "Create Room" from home.
 * Exit: POST /rooms → store room info → connect socket + join:room → /lobby/:roomId
 *
 * Form reads configurable bounds from GET /settings (D04-016).
 * Server remains authoritative for all values.
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '@/stores/session.store';
import { useRoomStore } from '@/stores/room.store';
import { createRoom, getSettings } from '@/api/endpoints';
import { joinRoom as joinRoomSocket } from '@/realtime/socket';
import { RoomConfigSchema } from '@/validation/schemas';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { tokens } from '@/theme/tokens';
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

export default function CreateRoomScreen() {
  const router = useRouter();
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
        // Bounds unavailable — fall back to hardcoded minimums.
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

  // Derive selectable options from server limits (or fallback defaults).
  const mpMin = limits?.minPlayers ?? 2;
  const mpMax = limits?.maxPlayers ?? 8;
  const rMin = limits?.minRounds ?? 1;
  const rMax = limits?.maxRounds ?? 20;
  const durMin = limits?.minRoundDuration ?? 30;
  const durMax = limits?.maxRoundDuration ?? 300;
  const hMin = limits?.minHints ?? 0;
  const hMax = limits?.maxHints ?? 5;

  const playerOptions = Array.from(
    { length: mpMax - mpMin + 1 },
    (_, i) => mpMin + i,
  );
  const roundOptions = Array.from(
    { length: rMax - rMin + 1 },
    (_, i) => rMin + i,
  );
  const durationOptions = [30, 60, 90, 120, 180, 240, 300].filter(
    (d) => d >= durMin && d <= durMax,
  );
  const hintOptions = Array.from(
    { length: hMax - hMin + 1 },
    (_, i) => hMin + i,
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Create Room</Text>

      <Input
        value={form.roomName}
        onChangeText={(v) => updateField('roomName', v)}
        placeholder="Room name (optional)"
        maxLength={30}
        testID="room-name-input"
      />

      {/* Max Players selector */}
      <Selector
        label="Players"
        value={form.maxPlayers}
        options={playerOptions}
        onSelect={(v) => updateField('maxPlayers', v)}
        testID="max-players-selector"
      />

      {/* Rounds selector */}
      <Selector
        label="Rounds"
        value={form.rounds}
        options={roundOptions}
        onSelect={(v) => updateField('rounds', v)}
        testID="rounds-selector"
      />

      {/* Duration selector */}
      <Selector
        label="Duration (s)"
        value={form.roundDuration}
        options={durationOptions}
        onSelect={(v) => updateField('roundDuration', v)}
        testID="duration-selector"
      />

      {/* Hints selector */}
      <Selector
        label="Hints"
        value={form.hints}
        options={hintOptions}
        onSelect={(v) => updateField('hints', v)}
        testID="hints-selector"
      />

      {error ? (
        <Text style={styles.errorText} testID="create-room-error">
          {error}
        </Text>
      ) : null}

      <Button
        label="Create & Join"
        onPress={handleCreate}
        disabled={!!validationError || submitting}
        isLoading={submitting}
        testID="create-room-submit"
        style={styles.submitButton}
      />
    </ScrollView>
  );
}

// ---------------------------------------------------------------- Selector --

interface SelectorProps {
  label: string;
  value: number;
  options: number[];
  onSelect: (value: number) => void;
  testID?: string;
}

function Selector({ label, value, options, onSelect, testID }: SelectorProps) {
  return (
    <View style={styles.selectorRow}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <View style={styles.selectorButtons} testID={testID}>
        {options.map((opt) => (
          <Button
            key={opt}
            label={`${opt}`}
            onPress={() => onSelect(opt)}
            variant={value === opt ? 'primary' : 'ghost'}
            style={
              value === opt
                ? { ...styles.selectorBtn, ...styles.selectorBtnActive }
                : styles.selectorBtn
            }
          />
        ))}
      </View>
    </View>
  );
}

// --------------------------------------------------------- Styles ----------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xxxl,
    paddingBottom: tokens.spacing.xxxl,
    gap: tokens.spacing.md,
  },
  title: {
    fontSize: tokens.typography.heading.fontSize,
    fontWeight: tokens.typography.heading.fontWeight,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.lg,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.sm,
  },
  selectorLabel: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
    width: 100,
  },
  selectorButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    flex: 1,
  },
  selectorBtn: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    minHeight: 32,
  },
  selectorBtnActive: {
    backgroundColor: tokens.colors.primary,
  },
  errorText: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.danger,
    marginTop: tokens.spacing.xs,
  },
  submitButton: {
    marginTop: tokens.spacing.lg,
    width: '100%',
  },
});
