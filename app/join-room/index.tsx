/**
 * Route: /join-room
 *
 * Entry: user taps "Join Room" from home.
 * Exit: POST /rooms/join -> store room info -> connect socket + join:room -> /lobby/:roomId
 *
 * Error states are inline banners (D04-011), not separate routes.
 *
 * Visual reference: Figma Make "DoodleBee" `join-empty`, `join-invalid` and
 * `join-full`. Behaviour (validation gate, REST + socket join, error mapping)
 * is unchanged from the functional baseline.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionStore } from '@/stores/session.store';
import { useRoomStore } from '@/stores/room.store';
import { joinRoomByCode } from '@/api/endpoints';
import { joinRoom as joinRoomSocket } from '@/realtime/socket';
import type { RoomJoinResponse } from '@/types';
import { RoomCodeSchema } from '@/validation/schemas';
import { Button } from '@/components/Button';
import { CodeInput } from '@/components/CodeInput';
import { FeedbackCard } from '@/components/FeedbackCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PaperBackground } from '@/components/ui/PaperBackground';
import { ComicSurface } from '@/components/ui/ComicSurface';
import { tokens } from '@/theme';
import { env } from '@/config/env';

// ------------------------------------------------------------------ Types ----

type JoinError =
  | 'INVALID_CODE'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_ALREADY_STARTED'
  | 'NETWORK_ERROR'
  | null;

interface FeedbackVisual {
  icon: string;
  title?: string;
  message?: string;
}

/**
 * Copy for the server-mapped error states. `INVALID_CODE` and `ROOM_NOT_FOUND`
 * share the approved "that code doesn't exist" banner. The two states the
 * approved screens do not cover (already started, network failure) reuse the
 * existing client copy with no invented headline.
 */
const FEEDBACK: Record<Exclude<JoinError, null>, FeedbackVisual> = {
  INVALID_CODE: {
    icon: '🤔',
    title: "That code doesn't exist!",
    message: 'Double-check with your host and try again.',
  },
  ROOM_NOT_FOUND: {
    icon: '🤔',
    title: "That code doesn't exist!",
    message: 'Double-check with your host and try again.',
  },
  ROOM_FULL: {
    icon: '😭',
    title: "ROOM'S PACKED",
    message: 'This room is full. Tell your friends to make room for you 👊',
  },
  GAME_ALREADY_STARTED: {
    icon: '⏰',
    message: 'The game has already started.',
  },
  NETWORK_ERROR: {
    icon: '📡',
    message: 'Connection failed. Check your network and retry.',
  },
};

/** The approved design renders six slots; the domain allows 5 or 6 chars. */
const CODE_LENGTH = 6;

// ---------------------------------------------------------------- Component --

export default function JoinRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setRoomId = useSessionStore((s) => s.setRoomId);
  const setReconnectInfo = useSessionStore((s) => s.setReconnectInfo);
  const setRoomJoined = useRoomStore((s) => s.setRoomJoined);

  const [code, setCode] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<JoinError>(null);
  const [joining, setJoining] = useState(false);

  const validationError = (() => {
    const result = RoomCodeSchema.safeParse(code);
    if (!result.success) return result.error.issues[0]?.message ?? null;
    return null;
  })();

  function mapApiError(status: number): JoinError {
    switch (status) {
      case 404:
        return 'ROOM_NOT_FOUND';
      case 409:
        // Distinguish room-full vs game-already-started if possible.
        // The server uses 409 for both - we fall back to ROOM_FULL.
        return 'ROOM_FULL';
      case 0:
        return 'NETWORK_ERROR';
      default:
        return 'INVALID_CODE';
    }
  }

  async function handleJoin() {
    if (validationError) {
      setJoinError(null);
      setInputError(validationError);
      return;
    }
    setJoining(true);
    setInputError(null);
    setJoinError(null);

    try {
      const response: RoomJoinResponse = await joinRoomByCode({
        roomCode: code,
      });
      setRoomId(response.room.roomId);
      const myPlayerId = useSessionStore.getState().playerId;
      if (!myPlayerId) {
        setJoinError('NETWORK_ERROR');
        return;
      }
      setReconnectInfo({
        playerId: myPlayerId,
        lastRoomId: response.room.roomId,
        lastRoomCode: response.room.roomCode,
        lastHeartbeat: Date.now(),
      });
      setRoomJoined(response.room, response.room.players, response.room.host);

      // Connect socket and join the room.
      const token = useSessionStore.getState().sessionToken;
      if (token && env.isSocketConfigured) {
        joinRoomSocket(response.room.roomId);
      }

      router.replace(`/lobby/${response.room.roomId}`);
    } catch (err) {
      if (err instanceof Error && 'status' in err) {
        const apiErr = err as unknown as {
          status: number;
          userMessage: () => string;
        };
        setJoinError(mapApiError(apiErr.status));
      } else {
        setJoinError('NETWORK_ERROR');
      }
    } finally {
      setJoining(false);
    }
  }

  const goBack = () => router.replace('/');

  const hasError = !!inputError || joinError !== null;

  const feedback: FeedbackVisual | null = joinError
    ? joinError === 'INVALID_CODE' && inputError
      ? { ...FEEDBACK.INVALID_CODE, message: inputError }
      : FEEDBACK[joinError]
    : null;

  const remaining = CODE_LENGTH - code.length;
  const helper = inputError
    ? inputError
    : remaining > 0
      ? `Enter ${remaining} more char${remaining === 1 ? '' : 's'}…`
      : null;

  const clearCode = () => {
    setCode('');
    setInputError(null);
    setJoinError(null);
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
        <ScreenHeader onBack={goBack} testID="join-room-back" />

        <Text style={styles.headline}>
          WHAT&apos;S THE{'\n'}SECRET CODE? 🗝️
        </Text>
        <Text style={styles.subtitle}>
          Ask your host for the {CODE_LENGTH}-character code.
        </Text>

        <View style={styles.codeWrap}>
          <CodeInput
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase());
              setInputError(null);
              setJoinError(null);
            }}
            length={CODE_LENGTH}
            autoFocus
            hasError={hasError}
            onSubmitEditing={handleJoin}
            testID="room-code-input"
          />
        </View>

        <View style={styles.helperRow}>
          <Text style={styles.helperLeft}>Letters and numbers only</Text>
          {code.length > 0 ? (
            <Pressable
              onPress={clearCode}
              hitSlop={8}
              accessibilityRole="button"
              testID="join-clear"
            >
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {feedback ? (
          <FeedbackCard
            icon={feedback.icon}
            title={feedback.title}
            message={feedback.message}
            style={styles.feedback}
            testID="join-error"
          />
        ) : null}

        <ComicSurface
          variant="sticker"
          radius={tokens.radius.sm}
          backgroundColor={tokens.colors.hotPink}
          style={styles.hint}
          contentStyle={styles.hintInner}
        >
          <Text style={styles.hintText}>
            ★ Only share the code with the people you actually like.
          </Text>
        </ComicSurface>

        {helper ? (
          <Text
            style={[styles.helper, inputError ? styles.helperError : null]}
            testID="join-helper"
          >
            {helper}
          </Text>
        ) : (
          <View style={styles.helperSpacer} />
        )}

        <Button
          label="🔑 JOIN ROOM"
          variant="primary"
          fullWidth
          onPress={handleJoin}
          disabled={!!validationError || joining}
          isLoading={joining}
          testID="join-room-submit"
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
  headline: {
    marginTop: tokens.spacing.md,
    fontFamily: tokens.typography.display.fontFamily,
    fontSize: tokens.typography.display.fontSize,
    lineHeight: tokens.typography.display.lineHeight,
    letterSpacing: tokens.typography.display.letterSpacing,
    color: tokens.colors.ink,
  },
  subtitle: {
    marginTop: tokens.spacing.sm,
    fontFamily: tokens.typography.body.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.textSecondary,
  },
  codeWrap: {
    marginTop: tokens.spacing.lg,
  },
  helperRow: {
    marginTop: tokens.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helperLeft: {
    fontFamily: tokens.typography.caption.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
  },
  clear: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.purple,
  },
  feedback: {
    marginTop: tokens.spacing.lg,
  },
  hint: {
    marginTop: tokens.spacing.lg,
  },
  hintInner: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  hintText: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    lineHeight: tokens.typography.caption.lineHeight,
    color: tokens.colors.white,
  },
  helper: {
    marginTop: tokens.spacing.sm,
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.textSecondary,
  },
  helperError: {
    color: tokens.colors.tangerine,
  },
  helperSpacer: {
    height: tokens.spacing.lg,
  },
});
