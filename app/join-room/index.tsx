/**
 * Route: /join-room
 *
 * Entry: user taps "Join Room" from home.
 * Exit: POST /rooms/join → store room info → connect socket + join:room → /lobby/:roomId
 *
 * Error states are inline banners (D04-011), not separate routes.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '@/stores/session.store';
import { useRoomStore } from '@/stores/room.store';
import { joinRoomByCode } from '@/api/endpoints';
import { joinRoom as joinRoomSocket } from '@/realtime/socket';
import type { RoomJoinResponse } from '@/types';
import { RoomCodeSchema } from '@/validation/schemas';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { tokens } from '@/theme/tokens';
import { env } from '@/config/env';

// ------------------------------------------------------------------ Types ----

type JoinError =
  | 'INVALID_CODE'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_ALREADY_STARTED'
  | 'NETWORK_ERROR'
  | null;

// ---------------------------------------------------------------- Component --

export default function JoinRoomScreen() {
  const router = useRouter();
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
        // The server uses 409 for both — we fall back to ROOM_FULL.
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

  const errorMsg =
    joinError === 'INVALID_CODE'
      ? (inputError ?? 'Enter a valid room code')
      : joinError === 'ROOM_NOT_FOUND'
        ? 'Room not found. Check the code and try again.'
        : joinError === 'ROOM_FULL'
          ? 'This room is full.'
          : joinError === 'GAME_ALREADY_STARTED'
            ? 'The game has already started.'
            : joinError === 'NETWORK_ERROR'
              ? 'Connection failed. Check your network and retry.'
              : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.branding}>
        <Text style={styles.logo}>🐝 DoodleBee</Text>
        <Text style={styles.tagline}>Enter the room code to join</Text>
      </View>

      <Input
        value={code}
        onChangeText={(v) => {
          setCode(v.toUpperCase());
          setInputError(null);
          setJoinError(null);
        }}
        placeholder="ABCDE"
        autoCapitalize="none"
        keyboardType="default"
        maxLength={6}
        returnKeyType="go"
        onSubmitEditing={handleJoin}
        autoFocus
        errorMessage={inputError ?? undefined}
        testID="room-code-input"
      />

      {errorMsg ? (
        <Text style={styles.errorText} testID="join-error">
          {errorMsg}
        </Text>
      ) : null}

      <Button
        label="Join Room"
        onPress={handleJoin}
        disabled={!!validationError || joining}
        isLoading={joining}
        testID="join-room-submit"
        style={styles.submitButton}
      />
    </ScrollView>
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
    alignItems: 'center',
    gap: tokens.spacing.lg,
  },
  branding: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xxl,
  },
  logo: {
    fontSize: tokens.typography.display.fontSize,
    fontWeight: tokens.typography.display.fontWeight,
    color: tokens.colors.textPrimary,
  },
  tagline: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
    marginTop: tokens.spacing.xs,
  },
  errorText: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.danger,
    textAlign: 'center',
    minHeight: 20,
  },
  submitButton: {
    width: '100%',
    marginTop: tokens.spacing.md,
  },
});
