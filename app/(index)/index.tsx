/**
 * Route: /
 * Home - branding, nickname display, create/join entry points.
 *
 * Visual reference: Figma Make "DoodleBee" (fileKey Dawg8P0YDyqCvAbwdUZ9Qv)
 * screens `home-empty` / `home-ready`. Behaviour is unchanged: real session
 * state only, redirect to /nickname when no session exists, and straight to
 * the lobby when a room is already joined.
 */
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionStore } from '@/stores/session.store';
import { useConnectionStore } from '@/stores/connection.store';
import { useSocketLifecycle } from '@/realtime/hooks';
import { BeeMascot } from '@/components/BeeMascot';
import { Button } from '@/components/Button';
import { PaperBackground } from '@/components/ui/PaperBackground';
import { ComicSurface } from '@/components/ui/ComicSurface';
import { tokens } from '@/theme';

export default function IndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playerId, nickname, roomId } = useSessionStore();
  const { status: connectionStatus } = useConnectionStore();

  // Wire up Socket.IO lifecycle on mount. Idempotent - duplicates are no-ops.
  useSocketLifecycle(true);

  // If no session exists, redirect to nickname entry.
  if (!playerId) {
    return <Redirect href="/nickname" />;
  }

  // If the player is already in a room, go straight to lobby.
  if (roomId) {
    return <Redirect href={`/lobby/${roomId}`} />;
  }

  const hasNickname = !!nickname;

  return (
    <View style={styles.root}>
      <PaperBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + tokens.spacing.md },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {connectionStatus !== 'connected' && (
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.sm}
            backgroundColor={tokens.colors.beeYellow}
            style={styles.banner}
            contentStyle={styles.bannerInner}
          >
            <Text style={styles.bannerText}>
              {getConnectionMessage(connectionStatus)}
            </Text>
          </ComicSurface>
        )}

        <View style={styles.brandRow}>
          <Text style={styles.star}>★</Text>
          <Text style={styles.logo}>DoodleBee</Text>
          <View style={styles.ageBadge}>
            <Text style={styles.ageBadgeText}>18+</Text>
          </View>
        </View>

        <Text style={styles.headline}>DRAW IT. GUESS IT.{'\n'}OWN IT. ✏️</Text>

        <Text style={styles.subline}>
          {hasNickname
            ? 'Ready to make a mess? 🎉'
            : 'Your artistic career starts now.'}
        </Text>

        <FloatingBee size={190} />

        {hasNickname ? (
          <ComicSurface
            variant="sticker"
            backgroundColor={tokens.colors.white}
            style={styles.nameCard}
            contentStyle={styles.nameCardInner}
          >
            <View style={styles.nameTextWrap}>
              <Text style={styles.nameLabel}>Playing as</Text>
              <Text style={styles.nameValue} numberOfLines={1}>
                {nickname}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/nickname')} hitSlop={8}>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </ComicSurface>
        ) : (
          <Pressable onPress={() => router.push('/nickname')}>
            <ComicSurface
              variant="sticker"
              backgroundColor={tokens.colors.beeYellow}
              style={styles.nameCard}
              contentStyle={styles.nameCardInner}
            >
              <Text style={styles.pickName}>
                🎭 Tap to pick your player name…
              </Text>
            </ComicSurface>
          </Pressable>
        )}

        <View style={styles.actions}>
          <Button
            label="🎲 CREATE ROOM"
            variant="primary"
            fullWidth
            onPress={() => router.push('/create-room')}
            testID="home-create-room"
          />
          <Button
            label="🔑 JOIN ROOM"
            variant="ink"
            fullWidth
            onPress={() => router.push('/join-room')}
            testID="home-join-room"
          />
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            👥 3–10 players 🔞 18+ only 🎨 No talent needed
          </Text>
        </View>

        <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
          <Text style={styles.settingsLink}>⚙️ Settings</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// --------------------------------------------------------- Bee float -------

function FloatingBee({ size }: { size: number }) {
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: tokens.motion.floatBee / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: tokens.motion.floatBee / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -14],
  });
  const rotate = t.interpolate({
    inputRange: [0, 1],
    outputRange: ['-2deg', '2deg'],
  });

  return (
    <Animated.View
      style={[styles.beeWrap, { transform: [{ translateY }, { rotate }] }]}
    >
      <BeeMascot size={size} />
    </Animated.View>
  );
}

// --------------------------------------------------------- Helpers ----------

function getConnectionMessage(status: string): string {
  switch (status) {
    case 'disconnected':
      return '📡 Your connection disappeared. The game is paused.';
    case 'reconnecting':
      return 'Reconnecting… the bee is looking for you.';
    case 'reconnected':
      return 'Welcome back!';
    case 'expired':
      return 'Session expired.';
    default:
      return '';
  }
}

// --------------------------------------------------------- Styles -----------

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
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    marginBottom: tokens.spacing.md,
  },
  bannerInner: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  bannerText: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.ink,
    textAlign: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  star: {
    fontSize: 22,
    color: tokens.colors.purple,
  },
  logo: {
    fontFamily: tokens.typography.logo.fontFamily,
    fontSize: tokens.typography.logo.fontSize,
    lineHeight: tokens.typography.logo.lineHeight,
    color: tokens.colors.ink,
    letterSpacing: tokens.typography.logo.letterSpacing,
  },
  ageBadge: {
    backgroundColor: tokens.colors.ink,
    borderRadius: tokens.radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{ rotate: '-6deg' }],
  },
  ageBadgeText: {
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: 10,
    color: tokens.colors.cream,
  },
  headline: {
    marginTop: tokens.spacing.lg,
    fontFamily: tokens.typography.display.fontFamily,
    fontSize: tokens.typography.display.fontSize,
    lineHeight: tokens.typography.display.lineHeight,
    letterSpacing: tokens.typography.display.letterSpacing,
    color: tokens.colors.ink,
    textAlign: 'center',
  },
  subline: {
    marginTop: tokens.spacing.sm,
    fontFamily: tokens.typography.body.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
  beeWrap: {
    marginVertical: tokens.spacing.lg,
  },
  nameCard: {
    width: '100%',
  },
  nameCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  nameTextWrap: {
    flex: 1,
  },
  nameLabel: {
    fontFamily: tokens.typography.caption.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textSecondary,
  },
  nameValue: {
    fontFamily: tokens.typography.subheading.fontFamily,
    fontSize: tokens.typography.subheading.fontSize,
    lineHeight: tokens.typography.subheading.lineHeight,
    color: tokens.colors.ink,
  },
  pickName: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.ink,
    textAlign: 'center',
  },
  changeLink: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.purple,
  },
  actions: {
    width: '100%',
    gap: tokens.spacing.lg,
    marginTop: tokens.spacing.xl,
  },
  footerRow: {
    marginTop: tokens.spacing.xl,
  },
  footerText: {
    fontFamily: tokens.typography.caption.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
  settingsLink: {
    marginTop: tokens.spacing.lg,
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textSecondary,
  },
});
