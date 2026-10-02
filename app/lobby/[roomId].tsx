/**
 * Route: /lobby/:roomId
 *
 * Entry: after successful create-room or join-room (or reconnect).
 * Exit: `game:started` → /game/:roomId; manual leave → /
 *
 * Displays authoritative server state from room store + socket listeners.
 * Host sees "Start Game" button (enabled when >= MIN_PLAYERS).
 * Guests see "Leave Room" only.
 */
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSessionStore } from '@/stores/session.store';
import { useRoomStore } from '@/stores/room.store';
import { useConnectionStore } from '@/stores/connection.store';
import {
  emitWithoutAck,
  isConnected,
  joinRoom as joinRoomSocket,
  leaveRoom as leaveRoomSocket,
  on,
} from '@/realtime/socket';
import { tokens } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { PlayerCard } from '@/components/PlayerCard';
import { MIN_PLAYERS } from '@/validation/schemas';
import { env } from '@/config/env';

// ---------------------------------------------------------------- Component --

export default function LobbyScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  const playerId = useSessionStore((s) => s.playerId);
  const sessionToken = useSessionStore((s) => s.sessionToken);
  const room = useRoomStore((s) => s.room);
  const players = useRoomStore((s) => s.players);
  const host = useRoomStore((s) => s.host);
  const connectionStatus = useConnectionStore((s) => s.status);

  // Subscribe to realtime events relevant to the lobby.
  useEffect(() => {
    if (!env.isSocketConfigured || !roomId) return;

    const unsubPlayerJoined = on('player:joined', (_payload: unknown) => {
      // Handled by dispatcher.
    });
    const unsubPlayerLeft = on('player:left', (_payload: unknown) => {
      // Handled by dispatcher.
    });
    const unsubHostTransferred = on('host:transferred', (payload: unknown) => {
      const p = payload as { hostPlayerId: string; version: number };
      useRoomStore.getState().setHost(p.hostPlayerId);
    });
    const unsubGameStarted = on('game:started', () => {
      router.replace(`/game/${roomId}`);
    });
    const unsubConnectionLost = on('connection:lost', (payload: unknown) => {
      const p = payload as { code?: string };
      if (p.code === 'SESSION_EXPIRED') {
        useSessionStore.getState().clearAll();
        router.replace('/nickname');
      }
    });

    return () => {
      unsubPlayerJoined();
      unsubPlayerLeft();
      unsubHostTransferred();
      unsubGameStarted();
      unsubConnectionLost();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Join the room socket on mount.
  useEffect(() => {
    if (!env.isSocketConfigured || !sessionToken || !roomId) return;
    if (!isConnected()) {
      joinRoomSocket(roomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guard: no roomId means deep-link mismatch → back to join.
  if (!roomId) {
    return <Redirect href="/join-room" />;
  }

  // If no session, go to nickname.
  if (!playerId) {
    return <Redirect href="/nickname" />;
  }

  const isHost = host === playerId;
  const playerCount = players.length;
  const roomReady = playerCount >= MIN_PLAYERS;

  async function handleStartGame() {
    if (!isHost || !roomReady) return;
    emitWithoutAck('game:start', {});
  }

  function handleLeave() {
    leaveRoomSocket();
    useSessionStore.getState().clearRoom();
    useRoomStore.getState().leaveRoom();
    router.replace('/');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Connection banner */}
      {connectionStatus !== 'connected' &&
      connectionStatus !== 'reconnected' ? (
        <View style={[styles.banner, getBannerStyle(connectionStatus)]}>
          <Text style={styles.bannerText}>
            {getConnectionMessage(connectionStatus)}
          </Text>
        </View>
      ) : null}

      {/* Room header */}
      <View style={styles.header}>
        <Text style={styles.title}>Lobby</Text>
        {room ? (
          <View style={styles.roomCodeRow}>
            <Text style={styles.roomCodeLabel}>Room Code</Text>
            <Text style={styles.roomCodeValue} testID="room-code-display">
              {room.roomCode}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Player roster */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Players ({playerCount}/{room?.config.maxPlayers ?? '—'})
        </Text>
        {players.map((p) => (
          <PlayerCard
            key={p.playerId}
            player={{ ...p }}
            state={
              p.playerId === playerId
                ? 'YOU'
                : p.isHost
                  ? 'HOST'
                  : p.isConnected
                    ? 'NORMAL'
                    : 'DISCONNECTED'
            }
            testID={`player-${p.playerId}`}
          />
        ))}
        {players.length === 0 ? (
          <Text style={styles.emptyText}>Waiting for players…</Text>
        ) : null}
      </View>

      {/* Room config summary */}
      {room ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Text style={styles.configText}>
            {`Rounds: ${room.config.rounds}  •  Duration: ${room.config.roundDuration}s  •  Hints: ${room.config.hints}`}
          </Text>
        </View>
      ) : null}

      {/* Host / guest actions */}
      <View style={styles.actions}>
        {isHost ? (
          <>
            <Button
              label={
                roomReady
                  ? 'Start Game'
                  : `Need ${MIN_PLAYERS - playerCount} more player${
                      MIN_PLAYERS - playerCount > 1 ? 's' : ''
                    }`
              }
              onPress={handleStartGame}
              disabled={!roomReady}
              variant={roomReady ? 'primary' : 'ghost'}
              testID="start-game-button"
            />
          </>
        ) : (
          <Text style={styles.guestHint}>Waiting for the host to start…</Text>
        )}
        <Button
          label="Leave Room"
          onPress={handleLeave}
          variant="ghost"
          testID="leave-room-button"
        />
      </View>
    </ScrollView>
  );
}

// --------------------------------------------------------- Helpers ----------

function getConnectionMessage(status: string): string {
  switch (status) {
    case 'disconnected':
      return 'Connection lost.';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'expired':
      return 'Session expired.';
    default:
      return '';
  }
}

function getBannerStyle(status: string): object {
  switch (status) {
    case 'disconnected':
      return { backgroundColor: tokens.colors.danger };
    case 'reconnecting':
      return { backgroundColor: tokens.colors.warning };
    case 'expired':
      return { backgroundColor: tokens.colors.danger };
    default:
      return {};
  }
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
    gap: tokens.spacing.lg,
  },
  banner: {
    width: '100%',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    marginBottom: tokens.spacing.md,
    alignItems: 'center',
  },
  bannerText: {
    color: tokens.colors.textInverse,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600' as const,
  },
  header: {
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  title: {
    fontSize: tokens.typography.heading.fontSize,
    fontWeight: tokens.typography.heading.fontWeight,
    color: tokens.colors.textPrimary,
  },
  roomCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  roomCodeLabel: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textSecondary,
  },
  roomCodeValue: {
    fontSize: tokens.typography.heading.fontSize,
    fontWeight: tokens.typography.heading.fontWeight,
    color: tokens.colors.primary,
    letterSpacing: 4,
  },
  section: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600' as const,
    color: tokens.colors.textSecondary,
    marginBottom: tokens.spacing.sm,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  configText: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
  },
  emptyText: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    fontStyle: 'italic',
  },
  actions: {
    width: '100%',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.lg,
  },
  guestHint: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
  },
});
