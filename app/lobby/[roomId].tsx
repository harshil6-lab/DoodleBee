/**
 * Route: /lobby/:roomId
 *
 * Entry: after successful create-room or join-room (or reconnect).
 * Exit: `game:started` -> /game/:roomId; manual leave -> /
 *
 * Displays authoritative server state from room store + socket listeners.
 * Host sees "Start Game" (enabled when >= MIN_PLAYERS). Guests see a waiting
 * hint. Behaviour is unchanged from the functional baseline.
 *
 * Visual reference: Figma Make "DoodleBee" `lobby-host` / `lobby-guest`.
 */
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { tokens } from '@/theme';
import { Button } from '@/components/Button';
import { PlayerCard } from '@/components/PlayerCard';
import { PaperBackground } from '@/components/ui/PaperBackground';
import { ComicSurface } from '@/components/ui/ComicSurface';
import { MIN_PLAYERS } from '@/validation/schemas';
import { env } from '@/config/env';

// ---------------------------------------------------------------- Component --

export default function LobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // Guard: no roomId means deep-link mismatch -> back to join.
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
  const maxPlayers = room?.config.maxPlayers ?? 8;

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

  const showConnectionBanner =
    connectionStatus !== 'connected' && connectionStatus !== 'reconnected';

  return (
    <View style={styles.root}>
      <PaperBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + tokens.spacing.sm },
        ]}
      >
        {/* Connection banner */}
        {showConnectionBanner ? (
          <View style={[styles.banner, getBannerStyle(connectionStatus)]}>
            <Text style={styles.bannerText}>
              {getConnectionMessage(connectionStatus)}
            </Text>
          </View>
        ) : null}

        {/* Brand row */}
        <View style={styles.brandRow}>
          <Text style={styles.brandStar}>★</Text>
          <Text style={styles.brand}>DOODLEBEE</Text>
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.full}
            backgroundColor={tokens.colors.mint}
            contentStyle={styles.livePill}
          >
            <Text style={styles.liveText}>LIVE</Text>
          </ComicSurface>
        </View>

        {/* Role line */}
        <Text style={styles.role}>
          {isHost ? "👑 You're the host" : '⏳ Guest player'}
        </Text>

        {/* Room name + count */}
        {room ? (
          <View style={styles.roomRow}>
            <Text style={styles.roomName} numberOfLines={1}>
              {room.config.roomName}
            </Text>
            <Text style={styles.roomCount}>
              {playerCount}/{maxPlayers}
            </Text>
          </View>
        ) : null}

        {/* Shareable room code */}
        {room ? (
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.lg}
            backgroundColor={tokens.colors.beeYellow}
            style={styles.codeCard}
            contentStyle={styles.codeCardInner}
          >
            <Text style={styles.codeValue} testID="room-code-display">
              {room.roomCode}
            </Text>
            <Text style={styles.codeCopy}>📋</Text>
          </ComicSurface>
        ) : null}

        <ComicSurface
          variant="sticker"
          radius={tokens.radius.sm}
          backgroundColor={tokens.colors.white}
          contentStyle={styles.stripInner}
        >
          <Text style={styles.stripText}>
            📋 SHARE THIS CODE WITH YOUR FRIENDS 🔗
          </Text>
        </ComicSurface>

        {/* Roster header */}
        <View style={styles.rosterHeader}>
          <Text style={styles.rosterTitle}>THE CREW IS GATHERING 👀</Text>
          <Text style={styles.rosterCount}>
            {playerCount} / {maxPlayers} PLAYERS
          </Text>
        </View>

        {/* Player grid */}
        <View style={styles.grid}>
          {players.map((p) => (
            <View key={p.playerId} style={styles.gridItem}>
              <PlayerCard
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
            </View>
          ))}
          {players.length === 0 ? (
            <Text style={styles.emptyText}>Waiting…</Text>
          ) : null}
        </View>

        {/* Room config summary */}
        {room ? (
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.sm}
            backgroundColor={tokens.colors.white}
            contentStyle={styles.stripInner}
          >
            <Text style={styles.configText}>
              {`🔄 ${room.config.rounds} rounds   ⏱ ${room.config.roundDuration}s   💡 ${room.config.hints} hints   👥 ${room.config.maxPlayers} max`}
            </Text>
          </ComicSurface>
        ) : null}

        {/* Host / guest actions */}
        <View style={styles.actions}>
          {isHost ? (
            <Button
              label={
                roomReady
                  ? '🎮 START GAME'
                  : `NEED ${MIN_PLAYERS - playerCount} MORE`
              }
              onPress={handleStartGame}
              disabled={!roomReady}
              variant={roomReady ? 'primary' : 'ghost'}
              fullWidth
              testID="start-game-button"
            />
          ) : (
            <Text style={styles.guestHint}>⏳ Waiting for the host…</Text>
          )}
          <Button
            label="LEAVE ROOM"
            onPress={handleLeave}
            variant="ghost"
            fullWidth
            testID="leave-room-button"
          />
        </View>
      </ScrollView>
    </View>
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
      return { backgroundColor: tokens.colors.hotPink };
    case 'reconnecting':
      return { backgroundColor: tokens.colors.tangerine };
    case 'expired':
      return { backgroundColor: tokens.colors.hotPink };
    default:
      return {};
  }
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
    gap: tokens.spacing.md,
  },
  banner: {
    width: '100%',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
  },
  bannerText: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.white,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandStar: {
    fontSize: 20,
    color: tokens.colors.hotPink,
  },
  brand: {
    fontFamily: tokens.typography.logo.fontFamily,
    fontSize: tokens.typography.logo.fontSize,
    lineHeight: tokens.typography.logo.lineHeight,
    letterSpacing: tokens.typography.logo.letterSpacing,
    color: tokens.colors.ink,
  },
  livePill: {
    paddingVertical: tokens.spacing.xxs,
    paddingHorizontal: tokens.spacing.sm,
  },
  liveText: {
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
    letterSpacing: 1.2,
    color: tokens.colors.white,
  },
  role: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.purple,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  roomName: {
    flex: 1,
    fontFamily: tokens.typography.heading.fontFamily,
    fontSize: tokens.typography.heading.fontSize,
    lineHeight: tokens.typography.heading.lineHeight,
    color: tokens.colors.ink,
  },
  roomCount: {
    fontFamily: tokens.typography.subheading.fontFamily,
    fontSize: tokens.typography.subheading.fontSize,
    color: tokens.colors.ink,
  },
  codeCard: {
    width: '100%',
  },
  codeCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  codeValue: {
    fontFamily: tokens.typography.display.fontFamily,
    fontSize: tokens.typography.display.fontSize,
    lineHeight: tokens.typography.display.lineHeight,
    letterSpacing: 6,
    color: tokens.colors.ink,
  },
  codeCopy: {
    fontSize: 22,
  },
  stripInner: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    alignItems: 'center',
  },
  stripText: {
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
    letterSpacing: 0.8,
    color: tokens.colors.ink,
    textAlign: 'center',
  },
  rosterHeader: {
    marginTop: tokens.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  rosterTitle: {
    flex: 1,
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.ink,
  },
  rosterCount: {
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    letterSpacing: 0.8,
    color: tokens.colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
  },
  gridItem: {
    width: '47%',
  },
  emptyText: {
    fontFamily: tokens.typography.body.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textMuted,
  },
  configText: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.ink,
    textAlign: 'center',
  },
  actions: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  guestHint: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
});
