/**
 * Route: /
 * Home screen — branding, nickname display, create/join entry points.
 *
 * Uses real session state (no fake data). Redirects to /nickname when no
 * session exists. Shows create/join buttons when a session is present.
 * Connection status is read from the connection store for the banner.
 */
import { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSessionStore } from '@/stores/session.store';
import { useConnectionStore } from '@/stores/connection.store';
import { useSocketLifecycle } from '@/realtime/hooks';
import { tokens } from '@/theme/tokens';

/**
 * Root hook that wires up the Socket.IO lifecycle.
 * Placed here so the connection is established as soon as the app mounts.
 * The hook is idempotent — multiple mounts do not create duplicate sockets.
 */
useSocketLifecycle(true);

export default function IndexScreen() {
  const router = useRouter();
  const { playerId, nickname, roomId } = useSessionStore();
  const { status: connectionStatus } = useConnectionStore();

  // If no session exists, redirect to nickname entry.
  if (!playerId) {
    return <Redirect href="/nickname" />;
  }

  // If the player is already in a room, go straight to lobby.
  if (roomId) {
    return <Redirect href={`/lobby/${roomId}`} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Connection banner — shown at top when not connected */}
      {connectionStatus !== 'connected' && (
        <View style={[styles.banner, { backgroundColor: getBannerColor(connectionStatus) }]}>
          <Text style={styles.bannerText}>{getConnectionMessage(connectionStatus)}</Text>
        </View>
      )}

      {/* Branding */}
      <View style={styles.branding}>
        <Text style={styles.logo}>🐝 DoodleBee</Text>
        <Text style={styles.tagline}>Draw. Guess. Buzz.</Text>
      </View>

      {/* Player identity */}
      <View style={styles.identity}>
        <Text style={styles.welcome}>Welcome back,</Text>
        <Text style={styles.nickname}>{nickname || 'Player'}</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.createButton]}
          onPress={() => router.push('/create-room')}
        >
          <Text style={styles.buttonText}>Create Room</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.joinButton]}
          onPress={() => router.push('/join-room')}
        >
          <Text style={styles.buttonText}>Join Room</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.settingsButton]}
          onPress={() => router.push('/settings')}
        >
          <Text style={[styles.buttonText, styles.settingsText]}>Settings</Text>
        </Pressable>
      </View>

      {/* Game info */}
      <View style={styles.info}>
        <Text style={styles.infoText}>
          {'2–8 players • Private rooms • Real-time drawing'}
        </Text>
      </View>
    </ScrollView>
  );
}

// --------------------------------------------------------- Helpers ----------

function getConnectionMessage(status: string): string {
  switch (status) {
    case 'disconnected':
      return 'Your connection disappeared.';
    case 'reconnecting':
      return 'Finding your friends...';
    case 'reconnected':
      return 'Welcome back!';
    case 'expired':
      return 'Session expired.';
    default:
      return '';
  }
}

function getBannerColor(status: string): string {
  switch (status) {
    case 'disconnected':
      return tokens.colors.danger;
    case 'reconnecting':
      return tokens.colors.warning;
    case 'reconnected':
      return tokens.colors.success;
    case 'expired':
      return tokens.colors.danger;
    default:
      return tokens.colors.textSecondary;
  }
}

// --------------------------------------------------------- Styles -----------

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
  },
  banner: {
    width: '100%',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    marginBottom: tokens.spacing.lg,
    alignItems: 'center',
  },
  bannerText: {
    color: tokens.colors.textInverse,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600' as const,
  },
  branding: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xxl,
  },
  logo: {
    fontSize: tokens.typography.display.fontSize,
    fontWeight: tokens.typography.display.fontWeight,
    color: tokens.colors.textPrimary,
    letterSpacing: tokens.typography.display.letterSpacing,
  },
  tagline: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
    marginTop: tokens.spacing.xs,
  },
  identity: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xxl,
  },
  welcome: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
  },
  nickname: {
    fontSize: tokens.typography.heading.fontSize,
    fontWeight: tokens.typography.heading.fontWeight,
    color: tokens.colors.primary,
    marginTop: tokens.spacing.xs,
  },
  actions: {
    width: '100%',
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.xxl,
  },
  button: {
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
  },
  createButton: {
    backgroundColor: tokens.colors.primary,
  },
  joinButton: {
    backgroundColor: tokens.colors.secondary,
  },
  settingsButton: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  buttonText: {
    fontSize: tokens.typography.button.fontSize,
    fontWeight: tokens.typography.button.fontWeight,
    color: tokens.colors.textInverse,
    letterSpacing: tokens.typography.button.letterSpacing,
  },
  settingsText: {
    color: tokens.colors.textPrimary,
  },
  info: {
    alignItems: 'center',
  },
  infoText: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    textAlign: 'center',
  },
});
