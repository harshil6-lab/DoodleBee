/**
 * Route: /round-result/[roomId]
 *
 * Displays the result of a completed round: word reveal, rankings,
 * end reason, drawer bonus/points. Driven by the round-result store state.
 *
 * Navigation: `round:started` event -> back to `/game/:roomId`.
 *             Manual "Next round" tap -> same.
 *
 * Visual reference: Figma Make "DoodleBee" `round-results`.
 */
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import { Button } from '@/components/Button';
import { PaperBackground } from '@/components/ui/PaperBackground';
import { ComicSurface } from '@/components/ui/ComicSurface';
import { useDrawerGameStore } from '@/stores/drawer.store';
import { useRoomStore } from '@/stores/room.store';
import { useConnectionStore } from '@/stores/connection.store';
import { on } from '@/realtime/socket';
import { ServerToClientEvent } from '@/types';
import { env } from '@/config/env';

// ---------------------------------------------------------------- Helpers ---

function getEndReasonLabel(reason: string): string {
  switch (reason) {
    case 'TIMER_EXPIRED':
      return "Time's up!";
    case 'ALL_GUESSERS_CORRECT':
      return 'All guessers correct!';
    case 'DRAWER_ABANDONED':
      return 'Drawer abandoned';
    case 'SERVER_TERMINATED':
      return 'Server terminated';
    default:
      return reason;
  }
}

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}`;
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

// ---------------------------------------------------------------- Component --

export default function RoundResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  const roundResult = useDrawerGameStore((s) => s.roundResult);
  const roundNumber = useDrawerGameStore((s) => s.roundNumber);
  const roundsPlanned = useDrawerGameStore((s) => s.roundsPlanned);
  const phase = useDrawerGameStore((s) => s.phase);
  const drawer = useDrawerGameStore((s) => s.drawer);
  const nextDrawerPlayerId = useDrawerGameStore((s) => s.nextDrawerPlayerId);
  const connectionStatus = useConnectionStore((s) => s.status);
  const players = useRoomStore((s) => s.players);

  // Subscribe to round:started for auto-navigation back to game.
  useEffect(() => {
    if (!env.isSocketConfigured || !roomId) return;

    const unsubRoundStarted = on(ServerToClientEvent.RoundStarted, () => {
      router.replace(`/game/${roomId}`);
    });

    return () => unsubRoundStarted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Guard: no roomId.
  if (!roomId) {
    return <Redirect href="/" />;
  }

  // Guard: no round result yet (waiting for server).
  if (!roundResult) {
    return (
      <View style={styles.centered}>
        <ComicSurface contentStyle={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading results…</Text>
        </ComicSurface>
      </View>
    );
  }

  // Guard: not in ROUND_FINISHED phase (would mean data mismatch).
  if (phase !== 'ROUND_FINISHED' && phase !== 'NEXT_ROUND') {
    return (
      <View style={styles.centered}>
        <ComicSurface contentStyle={styles.loadingCard}>
          <Text style={styles.loadingText}>Entering results…</Text>
        </ComicSurface>
      </View>
    );
  }

  const handleContinue = () => {
    router.replace(`/game/${roomId}`);
  };

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
        testID="round-result-screen"
      >
        {showConnectionBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Reconnecting…</Text>
          </View>
        ) : null}

        <Text style={styles.roundLabel}>
          ROUND {roundNumber} / {roundsPlanned}
        </Text>

        <Text style={styles.hero}>ROUND{'\n'}OVER! 🎉</Text>
        <Text style={styles.endReason}>
          {getEndReasonLabel(roundResult.endReason)}
        </Text>

        {/* Word reveal */}
        <ComicSurface
          variant="sticker"
          radius={tokens.radius.lg}
          backgroundColor={tokens.colors.beeYellow}
          style={styles.wordCard}
          contentStyle={styles.wordCardInner}
        >
          <Text style={styles.wordLabel}>The word was</Text>
          <Text style={styles.wordReveal} testID="word-reveal">
            {roundResult.word.toUpperCase()}
          </Text>
        </ComicSurface>

        {/* Rankings */}
        <Text style={styles.sectionTitle}>Round Rankings</Text>
        <View style={styles.rankings}>
          {roundResult.rankings.map((entry) => {
            const isDrawer = entry.playerId === drawer;
            const label = isDrawer
              ? 'Drawer'
              : entry.points === 0
                ? 'No guess'
                : `${ordinal(entry.rank)} Guess`;
            const isFirst = entry.rank === 1;
            return (
              <ComicSurface
                key={entry.playerId}
                variant="sticker"
                radius={tokens.radius.md}
                backgroundColor={
                  isFirst ? tokens.colors.beeYellow : tokens.colors.white
                }
                style={styles.rankRow}
                contentStyle={styles.rankInner}
                testID={`rank-${entry.rank}`}
              >
                <Text style={styles.rankMedal}>
                  {isDrawer ? '✏️' : rankMedal(entry.rank)}
                </Text>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {entry.nickname.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rankCopy}>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {entry.nickname}
                  </Text>
                  <Text style={styles.rankSub} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
                <Text style={styles.rankPoints}>
                  {entry.points > 0 ? `+${entry.points}` : '—'}
                </Text>
              </ComicSurface>
            );
          })}
        </View>

        {/* Drawer bonus */}
        <ComicSurface
          variant="sticker"
          radius={tokens.radius.md}
          backgroundColor={tokens.colors.white}
          contentStyle={styles.bonusInner}
        >
          <Text style={styles.bonusText}>
            Drawer bonus:{' '}
            <Text style={styles.bonusValue}>+{roundResult.drawerBonus}</Text>
          </Text>
          <Text style={styles.bonusSubtext}>
            Drawer points this round: {roundResult.drawerPoints}
          </Text>
        </ComicSurface>

        {/* Next round info */}
        {phase === 'NEXT_ROUND' ? (
          <View style={styles.nextRoundSection}>
            <Text style={styles.nextRoundLabel}>Next round starting soon…</Text>
            <ComicSurface
              variant="sticker"
              radius={tokens.radius.md}
              backgroundColor={tokens.colors.lavender}
              contentStyle={styles.bonusInner}
              testID="next-drawer-card"
            >
              <Text style={styles.nextDrawerLabel}>Next drawer</Text>
              <Text style={styles.nextDrawerName} testID="next-drawer-name">
                {nextDrawerPlayerId
                  ? (players.find((p) => p.playerId === nextDrawerPlayerId)
                      ?.nickname ?? '—')
                  : '—'}
              </Text>
            </ComicSurface>
          </View>
        ) : null}

        {/* Continue button */}
        <Button
          label="🚀 NEXT ROUND"
          onPress={handleContinue}
          variant="primary"
          fullWidth
          testID="continue-button"
        />
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.cream,
    paddingHorizontal: tokens.spacing.lg,
  },
  loadingCard: {
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: tokens.typography.body.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
  },
  banner: {
    width: '100%',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.tangerine,
    alignItems: 'center',
  },
  bannerText: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.white,
  },
  roundLabel: {
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    letterSpacing: 1.2,
    color: tokens.colors.textMuted,
  },
  hero: {
    fontFamily: tokens.typography.display.fontFamily,
    fontSize: tokens.typography.display.fontSize,
    lineHeight: tokens.typography.display.lineHeight,
    letterSpacing: tokens.typography.display.letterSpacing,
    color: tokens.colors.ink,
  },
  endReason: {
    fontFamily: tokens.typography.body.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
  },
  wordCard: {
    marginTop: tokens.spacing.sm,
  },
  wordCardInner: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
  },
  wordLabel: {
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    letterSpacing: 1.2,
    color: tokens.colors.ink,
  },
  wordReveal: {
    marginTop: tokens.spacing.xs,
    fontFamily: tokens.typography.display.fontFamily,
    fontSize: tokens.typography.display.fontSize,
    lineHeight: tokens.typography.display.lineHeight,
    color: tokens.colors.ink,
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: tokens.spacing.sm,
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.ink,
  },
  rankings: {
    gap: tokens.spacing.sm,
  },
  rankRow: {
    width: '100%',
  },
  rankInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
  },
  rankMedal: {
    width: 26,
    fontSize: 18,
    textAlign: 'center',
    color: tokens.colors.ink,
    fontFamily: tokens.typography.bodyBold.fontFamily,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    letterSpacing: 0.6,
    color: tokens.colors.cream,
  },
  rankCopy: {
    flex: 1,
  },
  rankName: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.ink,
  },
  rankSub: {
    fontFamily: tokens.typography.caption.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textSecondary,
  },
  rankPoints: {
    fontFamily: tokens.typography.subheading.fontFamily,
    fontSize: tokens.typography.subheading.fontSize,
    color: tokens.colors.ink,
  },
  bonusInner: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.xxs,
  },
  bonusText: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.ink,
  },
  bonusValue: {
    color: tokens.colors.mint,
  },
  bonusSubtext: {
    fontFamily: tokens.typography.caption.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textSecondary,
  },
  nextRoundSection: {
    gap: tokens.spacing.sm,
  },
  nextRoundLabel: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.ink,
  },
  nextDrawerLabel: {
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    letterSpacing: 1.2,
    color: tokens.colors.textMuted,
  },
  nextDrawerName: {
    fontFamily: tokens.typography.subheading.fontFamily,
    fontSize: tokens.typography.subheading.fontSize,
    color: tokens.colors.purple,
  },
});
