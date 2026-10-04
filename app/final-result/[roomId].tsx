/**
 * Route: /final-result/[roomId]
 *
 * Displays the final game results: winner celebration, full leaderboard with
 * scores, and actions (play again / return home). Driven by the final-result
 * store state.
 *
 * No realtime events - pure passive display after `game:finished`, plus the
 * `game:started` subscription that follows a host "Play Again".
 *
 * Visual reference: Figma Make "DoodleBee" `final-winner` / `final-loser`.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme';
import { Button } from '@/components/Button';
import { PaperBackground } from '@/components/ui/PaperBackground';
import { ComicSurface } from '@/components/ui/ComicSurface';
import { useDrawerGameStore } from '@/stores/drawer.store';
import { useSessionStore } from '@/stores/session.store';
import { useRoomStore } from '@/stores/room.store';
import { emitWithoutAck, on } from '@/realtime/socket';
import { ServerToClientEvent, ClientToServerEvent } from '@/types';

// ---------------------------------------------------------------- Helpers ---

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}`;
}

// ---------------------------------------------------------------- Component --

export default function FinalResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  const playerId = useSessionStore((s) => s.playerId);
  const finalResult = useDrawerGameStore((s) => s.finalResult);
  const phase = useDrawerGameStore((s) => s.phase);
  const roundsPlanned = useDrawerGameStore((s) => s.roundsPlanned);

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
        <ComicSurface contentStyle={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading final results…</Text>
        </ComicSurface>
      </View>
    );
  }

  // Guard: not in GAME_FINISHED phase.
  if (phase !== 'GAME_FINISHED') {
    return (
      <View style={styles.centered}>
        <ComicSurface contentStyle={styles.loadingCard}>
          <Text style={styles.loadingText}>Preparing results…</Text>
        </ComicSurface>
      </View>
    );
  }

  const isWinner = finalResult.winnerId === playerId;
  const winnerEntry = finalResult.rankings.find(
    (r) => r.playerId === finalResult.winnerId,
  );
  const winnerName = winnerEntry?.nickname ?? '—';

  function handleReturnHome() {
    router.replace('/');
  }

  return (
    <View style={styles.root} testID="final-result-screen">
      <PaperBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + tokens.spacing.sm },
        ]}
      >
        <Text style={styles.kicker}>★ GAME OVER · {roundsPlanned} ROUNDS</Text>

        {isWinner ? (
          <>
            <Text style={styles.heroTitle}>
              And the chaos{'\n'}champion is… 🏆
            </Text>
            <ComicSurface
              variant="sticker"
              radius={tokens.radius.lg}
              backgroundColor={tokens.colors.beeYellow}
              style={styles.winnerCard}
              contentStyle={styles.winnerInner}
            >
              <Text style={styles.winnerAvatarText}>
                {winnerName.slice(0, 2).toUpperCase()}
              </Text>
              <Text style={styles.winnerName} numberOfLines={1}>
                {winnerName}
              </Text>
              <Text style={styles.winnerScore}>
                {winnerEntry?.score ?? 0} PTS
              </Text>
            </ComicSurface>
            <Text style={styles.heroSubtitle}>
              Congratulations, champion! 🎉
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.heroTitle}>CHAOS{'\n'}CHAMPION 👑</Text>
            <ComicSurface
              variant="sticker"
              radius={tokens.radius.lg}
              backgroundColor={tokens.colors.beeYellow}
              style={styles.winnerCard}
              contentStyle={styles.winnerInner}
            >
              <Text style={styles.winnerAvatarText}>
                {winnerName.slice(0, 2).toUpperCase()}
              </Text>
              <Text style={styles.winnerName} numberOfLines={1}>
                {winnerName}
              </Text>
              <Text style={styles.winnerScore}>{winnerEntry?.score ?? 0}</Text>
            </ComicSurface>
            <Text style={styles.heroSubtitle}>Better luck next time! 🐝</Text>
          </>
        )}

        {/* Final leaderboard */}
        <Text style={styles.sectionTitle}>Final Standings</Text>
        <View style={styles.leaderboard}>
          {finalResult.rankings.map((entry) => {
            const isYou = entry.playerId === playerId;
            const isWinningEntry = entry.playerId === finalResult.winnerId;
            return (
              <ComicSurface
                key={entry.playerId}
                variant="sticker"
                radius={tokens.radius.md}
                backgroundColor={
                  isWinningEntry ? tokens.colors.beeYellow : tokens.colors.white
                }
                borderColor={isYou ? tokens.colors.purple : tokens.colors.ink}
                style={styles.rankRow}
                contentStyle={styles.rankInner}
                testID={`final-rank-${entry.rank}`}
              >
                <Text style={styles.rankMedal}>{rankMedal(entry.rank)}</Text>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {entry.nickname.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.rankName} numberOfLines={1}>
                  {entry.nickname}
                  {isYou ? ' (you)' : ''}
                </Text>
                <Text style={styles.rankScore}>{entry.score}</Text>
              </ComicSurface>
            );
          })}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {isHost ? (
            <Button
              label="PLAY AGAIN 🔥"
              onPress={() => {
                emitWithoutAck(ClientToServerEvent.StartGame, {});
              }}
              variant="secondary"
              fullWidth
              testID="play-again-button"
            />
          ) : null}
          <Button
            label="RETURN HOME"
            onPress={handleReturnHome}
            variant="primary"
            fullWidth
            testID="return-home-button"
          />
        </View>
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
  kicker: {
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    letterSpacing: 1.2,
    color: tokens.colors.textMuted,
  },
  heroTitle: {
    fontFamily: tokens.typography.display.fontFamily,
    fontSize: tokens.typography.display.fontSize,
    lineHeight: tokens.typography.display.lineHeight,
    letterSpacing: tokens.typography.display.letterSpacing,
    color: tokens.colors.ink,
  },
  winnerCard: {
    width: '100%',
  },
  winnerInner: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  winnerAvatarText: {
    fontFamily: tokens.typography.display.fontFamily,
    fontSize: tokens.typography.display.fontSize,
    lineHeight: tokens.typography.display.lineHeight,
    color: tokens.colors.ink,
  },
  winnerName: {
    fontFamily: tokens.typography.heading.fontFamily,
    fontSize: tokens.typography.heading.fontSize,
    lineHeight: tokens.typography.heading.lineHeight,
    color: tokens.colors.ink,
  },
  winnerScore: {
    fontFamily: tokens.typography.subheading.fontFamily,
    fontSize: tokens.typography.subheading.fontSize,
    color: tokens.colors.ink,
  },
  heroSubtitle: {
    fontFamily: tokens.typography.body.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: tokens.spacing.sm,
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.ink,
  },
  leaderboard: {
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
  rankName: {
    flex: 1,
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.ink,
  },
  rankScore: {
    fontFamily: tokens.typography.subheading.fontFamily,
    fontSize: tokens.typography.subheading.fontSize,
    color: tokens.colors.ink,
  },
  actions: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
});
