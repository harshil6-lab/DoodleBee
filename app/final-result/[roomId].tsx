/**
 * Route: /final-result/[roomId]
 *
 * Displays the final game results: winner, full leaderboard with scores,
 * and actions (return home). Driven by `game.finalResult` store state.
 *
 * No realtime events — pure passive display after game:finished.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { tokens } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { useDrawerGameStore } from '@/stores/drawer.store';
import { useSessionStore } from '@/stores/session.store';
import { useRoomStore } from '@/stores/room.store';
import { emitWithoutAck, on } from '@/realtime/socket';
import { ServerToClientEvent, ClientToServerEvent } from '@/types';

// ---------------------------------------------------------------- Component --

export default function FinalResultScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  const playerId = useSessionStore((s) => s.playerId);
  const finalResult = useDrawerGameStore((s) => s.finalResult);
  const phase = useDrawerGameStore((s) => s.phase);

  // All hooks before any early return.
  const host = useRoomStore((s) => s.host);
  const isHost = playerId !== null && host === playerId;

  // Subscribe to game:started for auto-navigation back to game.
  React.useEffect(() => {
    const unsub = on(ServerToClientEvent.GameStarted, () => {
      router.replace('/game/' + roomId);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Guard: no roomId.
  if (!roomId) {
    return <Redirect href="/" />;
  }

  // Guard: no final result yet (waiting for server).
  if (!finalResult) {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading final results...</Text>
        </View>
      </View>
    );
  }

  // Guard: not in GAME_FINISHED phase.
  if (phase !== 'GAME_FINISHED') {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Preparing results...</Text>
        </View>
      </View>
    );
  }

  const isWinner = finalResult.winnerId === playerId;

  function handleReturnHome() {
    router.replace('/');
  }

  return (
    <View style={styles.container} testID="final-result-screen">
      {/* Winner celebration */}
      <View style={styles.heroSection}>
        <Text style={styles.heroEmoji}>🏆</Text>
        <Text style={styles.heroTitle}>
          {isWinner ? 'You Won!' : 'Game Over'}
        </Text>
        {isWinner ? (
          <Text style={styles.heroSubtitle}>Congratulations, champion!</Text>
        ) : (
          <Text style={styles.heroSubtitle}>
            Winner:{' '}
            {finalResult.rankings.find(
              (r) => r.playerId === finalResult.winnerId,
            )?.nickname ?? '—'}
          </Text>
        )}
      </View>

      {/* Final leaderboard */}
      <View style={styles.leaderboard}>
        <Text style={styles.sectionTitle}>Final Standings</Text>
        {finalResult.rankings.map((entry) => {
          const isYou = entry.playerId === playerId;
          const isWinningEntry = entry.playerId === finalResult.winnerId;
          return (
            <View
              key={entry.playerId}
              style={[
                styles.rankRow,
                isWinningEntry && styles.rankFirst,
                isYou && styles.rankYou,
              ]}
              testID={`final-rank-${entry.rank}`}
            >
              <Text
                style={[
                  styles.rankBadge,
                  isWinningEntry && styles.rankFirstBadge,
                ]}
              >
                #{entry.rank}
              </Text>
              <Text
                style={[styles.rankName, isYou && styles.rankYouName]}
                numberOfLines={1}
              >
                {entry.nickname}
                {isYou ? ' (you)' : ''}
              </Text>
              <Text style={styles.rankScore}>{entry.score}</Text>
            </View>
          );
        })}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {isHost ? (
          <Button
            label="Play Again"
            onPress={() => {
              emitWithoutAck(ClientToServerEvent.StartGame, {});
            }}
            variant="secondary"
            testID="play-again-button"
          />
        ) : null}
        <Button
          label="Return Home"
          onPress={handleReturnHome}
          variant="primary"
          testID="return-home-button"
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.xxxl,
    paddingHorizontal: tokens.spacing.xxl,
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderLight,
  },
  heroEmoji: {
    fontSize: 64,
  },
  heroTitle: {
    fontSize: tokens.typography.display.fontSize,
    fontWeight: tokens.typography.display.fontWeight,
    color: tokens.colors.textPrimary,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
  leaderboard: {
    flex: 1,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xl,
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
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderLight,
  },
  rankFirst: {
    backgroundColor: `${tokens.colors.accentYellow}15`,
    borderColor: tokens.colors.accentYellow,
  },
  rankYou: {
    borderWidth: 2,
    borderColor: tokens.colors.primary,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700' as const,
    color: tokens.colors.textPrimary,
  },
  rankFirstBadge: {
    backgroundColor: tokens.colors.accentYellow,
    color: tokens.colors.textInverse,
  },
  rankName: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textPrimary,
    fontWeight: '600' as const,
  },
  rankYouName: {
    color: tokens.colors.primary,
    fontWeight: '700' as const,
  },
  rankScore: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.accentMint,
    fontWeight: '700' as const,
  },
  actions: {
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.lg,
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
});
