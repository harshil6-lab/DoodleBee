/**
 * Route: /round-result/[roomId]
 *
 * Displays the result of a completed round: word reveal, rankings,
 * end reason, drawer bonus/points. Driven by `game.roundResult` store state.
 *
 * Navigation: `round:started` event → back to `/game/:roomId`.
 *             Manual "Continue" tap → same.
 */
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { tokens } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { useDrawerGameStore } from '@/stores/drawer.store';
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

// ---------------------------------------------------------------- Component --

export default function RoundResultScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  const roundResult = useDrawerGameStore((s) => s.roundResult);
  const roundNumber = useDrawerGameStore((s) => s.roundNumber);
  const phase = useDrawerGameStore((s) => s.phase);
  const connectionStatus = useConnectionStore((s) => s.status);

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
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading results...</Text>
        </View>
      </View>
    );
  }

  // Guard: not in ROUND_FINISHED phase (would mean data mismatch).
  if (phase !== 'ROUND_FINISHED' && phase !== 'NEXT_ROUND') {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Entering results...</Text>
        </View>
      </View>
    );
  }

  const handleContinue = () => {
    router.replace(`/game/${roomId}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="round-result-screen"
    >
      {/* Connection banner */}
      {connectionStatus !== 'connected' &&
      connectionStatus !== 'reconnected' ? (
        <View style={[styles.banner, styles.bannerWarning]}>
          <Text style={styles.bannerText}>Reconnecting...</Text>
        </View>
      ) : null}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Round {roundNumber} Complete</Text>
        <Text style={styles.endReason}>
          {getEndReasonLabel(roundResult.endReason)}
        </Text>
      </View>

      {/* Word reveal */}
      <View style={styles.wordSection}>
        <Text style={styles.wordLabel}>The word was</Text>
        <Text style={styles.wordReveal} testID="word-reveal">
          {roundResult.word.toUpperCase()}
        </Text>
      </View>

      {/* Rankings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rankings</Text>
        {roundResult.rankings.map((entry) => (
          <View
            key={entry.playerId}
            style={[
              styles.rankRow,
              entry.rank === 1 && styles.rankFirst,
              entry.rank === 2 && styles.rankSecond,
              entry.rank === 3 && styles.rankThird,
            ]}
            testID={`rank-${entry.rank}`}
          >
            <Text style={styles.rankBadge}>{entry.rank}</Text>
            <Text style={styles.rankName} numberOfLines={1}>
              {entry.nickname}
            </Text>
            <Text style={styles.rankPoints}>+{entry.points}</Text>
          </View>
        ))}
      </View>

      {/* Drawer bonus */}
      <View style={styles.bonusSection}>
        <Text style={styles.bonusText}>
          Drawer bonus:{' '}
          <Text style={styles.bonusValue}>+{roundResult.drawerBonus}</Text>
        </Text>
        <Text style={styles.bonusSubtext}>
          Drawer points this round: {roundResult.drawerPoints}
        </Text>
      </View>

      {/* Next round info */}
      {phase === 'NEXT_ROUND' ? (
        <View style={styles.nextRoundSection}>
          <Text style={styles.nextRoundLabel}>Next round starting soon...</Text>
          <Text style={styles.nextRoundHint}>Get ready to draw!</Text>
        </View>
      ) : null}

      {/* Continue button */}
      <View style={styles.actions}>
        <Button
          label="Continue"
          onPress={handleContinue}
          variant="primary"
          testID="continue-button"
        />
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------- Styles ---

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
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.background,
  },
  loadingCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
  },
  banner: {
    width: '100%',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    marginBottom: tokens.spacing.md,
    alignItems: 'center',
  },
  bannerWarning: {
    backgroundColor: tokens.colors.warning,
  },
  bannerText: {
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600' as const,
    color: tokens.colors.textInverse,
  },
  header: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  title: {
    fontSize: tokens.typography.display.fontSize,
    fontWeight: tokens.typography.display.fontWeight,
    color: tokens.colors.textPrimary,
    textAlign: 'center',
  },
  endReason: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
    fontStyle: 'italic',
  },
  wordSection: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xxl,
    gap: tokens.spacing.sm,
  },
  wordLabel: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  wordReveal: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: tokens.colors.primary,
    letterSpacing: 4,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700' as const,
    color: tokens.colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: tokens.spacing.xs,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderLight,
    gap: tokens.spacing.sm,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700' as const,
    color: tokens.colors.textPrimary,
  },
  rankFirst: {
    backgroundColor: `${tokens.colors.accentYellow}22`,
    borderColor: tokens.colors.accentYellow,
  },
  rankSecond: {
    backgroundColor: `${tokens.colors.textMuted}11`,
    borderColor: tokens.colors.textMuted,
  },
  rankThird: {
    backgroundColor: `${tokens.colors.secondary}11`,
    borderColor: tokens.colors.secondary,
  },
  rankName: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textPrimary,
    fontWeight: '600' as const,
  },
  rankPoints: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.accentMint,
    fontWeight: '700' as const,
  },
  bonusSection: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  bonusText: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
  },
  bonusValue: {
    fontWeight: '700' as const,
    color: tokens.colors.accentYellow,
  },
  bonusSubtext: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
  },
  nextRoundSection: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.md,
  },
  nextRoundLabel: {
    fontSize: tokens.typography.heading.fontSize,
    fontWeight: '700' as const,
    color: tokens.colors.primary,
  },
  nextRoundHint: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xs,
  },
  actions: {
    width: '100%',
    marginTop: tokens.spacing.md,
  },
});
