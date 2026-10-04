/**
 * GameHeader - round indicator, timer, score and the round word card.
 *
 * Reads authoritative data from the drawer game store (the store the realtime
 * dispatcher writes round state into for both roles) plus the room store.
 * Timer is rendered from server-provided `roundEndTime` - never a client
 * countdown (client computes remaining time from `serverNow` offset).
 *
 * SECRET-WORD BOUNDARY: the secret word is only ever read from the
 * drawer-scoped store and is only rendered when `isDrawer` is true. The
 * boolean prop carries no secret data; the word never crosses a public prop
 * or public store boundary.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ComicSurface } from './ui/ComicSurface';
import { tokens } from '../theme/tokens';
import { useDrawerGameStore } from '../stores/drawer.store';
import { useRoomStore } from '../stores/room.store';
import { useSessionStore } from '../stores/session.store';

// ---------------------------------------------------------------- Constants ---

const LOW_TIMER_THRESHOLD_MS = 10_000;
const FINAL_SECONDS_THRESHOLD_MS = 5_000;

// ---------------------------------------------------------------- Types ---

export interface GameHeaderProps {
  /** True when the local player is the drawer. Gates the secret-word card. */
  isDrawer?: boolean;
}

// ---------------------------------------------------------------- Component --

export function GameHeader({ isDrawer = false }: GameHeaderProps) {
  const playerId = useSessionStore((s) => s.playerId);
  const phase = useDrawerGameStore((s) => s.phase);
  const roundNumber = useDrawerGameStore((s) => s.roundNumber);
  const roundsPlanned = useDrawerGameStore((s) => s.roundsPlanned);
  const maskedWord = useDrawerGameStore((s) => s.maskedWord);
  const hintsRemaining = useDrawerGameStore((s) => s.hintsRemaining);
  const scores = useDrawerGameStore((s) => s.scores);
  const timer = useDrawerGameStore((s) => s.timer);
  // Secret word lives only in the drawer-scoped store; never surfaced for a
  // guesser (the selector returns an empty string for a non-drawer).
  const secretWord = useDrawerGameStore((s) => (isDrawer ? s.secretWord : ''));

  const players = useRoomStore((s) => s.players);

  // Client-side countdown rendering via interval.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const endTime = timer.roundEndTime;

  useEffect(() => {
    if (!endTime) {
      return;
    }
    const tick = () => setRemainingMs(Math.max(0, endTime - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endTime]);

  const timerTone = useMemo(() => {
    if (remainingMs === null) return 'normal' as const;
    if (remainingMs <= FINAL_SECONDS_THRESHOLD_MS) return 'critical' as const;
    if (remainingMs <= LOW_TIMER_THRESHOLD_MS) return 'warning' as const;
    return 'normal' as const;
  }, [remainingMs]);

  const formatTime = (ms: number): string => {
    const secs = Math.ceil(ms / 1000);
    return `${secs}s`;
  };

  const isRoundActive = phase === 'ROUND_ACTIVE' || phase === 'STARTING';
  const ownScore = playerId ? (scores[playerId] ?? 0) : 0;
  const playerCount = players.length;

  return (
    <View style={styles.container} testID="game-header">
      {/* Round / timer / score */}
      <View style={styles.topRow}>
        <Text style={styles.roundText}>
          ★ ROUND {roundNumber}/{roundsPlanned}
        </Text>
        {isRoundActive && timer.roundEndTime ? (
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.sm}
            backgroundColor={
              timerTone === 'normal'
                ? tokens.colors.white
                : timerTone === 'warning'
                  ? tokens.colors.beeYellow
                  : tokens.colors.hotPink
            }
            offset={2}
            contentStyle={styles.timerFace}
          >
            <Text
              style={[
                styles.timerText,
                timerTone === 'critical' && styles.timerTextCritical,
              ]}
              testID="round-timer"
            >
              {formatTime(remainingMs ?? 0)}
            </Text>
          </ComicSurface>
        ) : (
          <View />
        )}
        <Text style={styles.scoreText} testID="own-score">
          {ownScore} PTS
        </Text>
      </View>

      {/* Role banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerLead}>
          {isDrawer ? '✏️ YOUR TURN' : '👀 WATCHING'}
        </Text>
        <Text style={styles.bannerTagline}>
          {isDrawer ? 'DON’T PANIC. JUST DRAW.' : 'WATCH CLOSELY 👀'}
        </Text>
      </View>

      {/* Word card + hints */}
      <View style={styles.wordRow}>
        {isDrawer && secretWord ? (
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.md}
            backgroundColor={tokens.colors.beeYellow}
            contentStyle={styles.secretCard}
            style={styles.wordCard}
          >
            <Text style={styles.secretLabel}>SECRET WORD</Text>
            <Text
              style={styles.secretWord}
              numberOfLines={1}
              adjustsFontSizeToFit
              testID="secret-word"
            >
              {secretWord}
            </Text>
          </ComicSurface>
        ) : maskedWord ? (
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.md}
            backgroundColor={tokens.colors.white}
            contentStyle={styles.secretCard}
            style={styles.wordCard}
          >
            <Text style={styles.secretLabel}>GUESS THE WORD</Text>
            <Text
              style={styles.maskedWord}
              numberOfLines={1}
              adjustsFontSizeToFit
              testID="masked-word"
            >
              {maskedWord}
            </Text>
          </ComicSurface>
        ) : (
          <View style={styles.wordCard} />
        )}

        {isRoundActive ? (
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.sm}
            backgroundColor={tokens.colors.white}
            offset={2}
            contentStyle={styles.hintFace}
          >
            <Text style={styles.hintText} testID="hints-remaining">
              💡 {hintsRemaining}
            </Text>
          </ComicSurface>
        ) : null}
      </View>

      {/* Roster count - replaces the old inline score strip */}
      <Text style={styles.rosterText} testID="player-count">
        {playerCount} {playerCount === 1 ? 'PLAYER' : 'PLAYERS'} ·{' '}
        {Math.max(0, roundsPlanned - roundNumber)} ROUNDS TO GO
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.cream,
    borderBottomWidth: tokens.border.comic,
    borderBottomColor: tokens.colors.ink,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  roundText: {
    ...tokens.typography.label,
    color: tokens.colors.ink,
  },
  timerFace: {
    minWidth: 58,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  timerText: {
    ...tokens.typography.subheading,
    color: tokens.colors.ink,
  },
  timerTextCritical: {
    color: tokens.colors.cream,
  },
  scoreText: {
    ...tokens.typography.label,
    color: tokens.colors.purple,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  bannerLead: {
    ...tokens.typography.subheading,
    color: tokens.colors.ink,
  },
  bannerTagline: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
    flexShrink: 1,
    textAlign: 'right',
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  wordCard: {
    flex: 1,
  },
  secretCard: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: 2,
  },
  secretLabel: {
    ...tokens.typography.label,
    color: tokens.colors.ink,
    opacity: 0.7,
  },
  secretWord: {
    ...tokens.typography.heading,
    color: tokens.colors.ink,
  },
  maskedWord: {
    ...tokens.typography.heading,
    color: tokens.colors.ink,
    letterSpacing: 3,
  },
  hintFace: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    alignItems: 'center',
  },
  hintText: {
    ...tokens.typography.bodyBold,
    color: tokens.colors.ink,
  },
  rosterText: {
    ...tokens.typography.label,
    color: tokens.colors.muted,
  },
});
