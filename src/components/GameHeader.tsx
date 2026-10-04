/**
 * GameHeader — round indicator, timer, score strip.
 *
 * Reads authoritative data from game store + room store.
 * Timer is rendered from server-provided `roundEndTime` — never a client
 * countdown (client computes remaining time from `serverNow` offset).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import { useDrawerGameStore } from '../stores/drawer.store';
import { useRoomStore } from '../stores/room.store';
import { useSessionStore } from '../stores/session.store';

// ---------------------------------------------------------------- Constants ---

const LOW_TIMER_THRESHOLD_MS = 10_000;
const FINAL_SECONDS_THRESHOLD_MS = 5_000;

// ---------------------------------------------------------------- Component --

export function GameHeader() {
  const playerId = useSessionStore((s) => s.playerId);
  const phase = useDrawerGameStore((s) => s.phase);
  const roundNumber = useDrawerGameStore((s) => s.roundNumber);
  const roundsPlanned = useDrawerGameStore((s) => s.roundsPlanned);
  const maskedWord = useDrawerGameStore((s) => s.maskedWord);
  const scores = useDrawerGameStore((s) => s.scores);
  const timer = useDrawerGameStore((s) => s.timer);
  const drawer = useDrawerGameStore((s) => s.drawer);

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

  const timerColor = useMemo(() => {
    if (remainingMs === null) return tokens.colors.timerNormal;
    if (remainingMs <= FINAL_SECONDS_THRESHOLD_MS)
      return tokens.colors.timerCritical;
    if (remainingMs <= LOW_TIMER_THRESHOLD_MS)
      return tokens.colors.timerWarning;
    return tokens.colors.timerNormal;
  }, [remainingMs]);

  const formatTime = (ms: number): string => {
    const secs = Math.ceil(ms / 1000);
    return `${secs}s`;
  };

  const isRoundActive = phase === 'ROUND_ACTIVE' || phase === 'STARTING';

  return (
    <View style={styles.container}>
      {/* Round indicator */}
      <View style={styles.row}>
        <Text style={styles.roundText}>
          Round {roundNumber} / {roundsPlanned}
        </Text>
        {isRoundActive && timer.roundEndTime ? (
          <Text
            style={[styles.timerText, { color: timerColor }]}
            testID="round-timer"
          >
            {formatTime(remainingMs ?? 0)}
          </Text>
        ) : null}
      </View>

      {/* Masked word — visible to all during ROUND_ACTIVE */}
      {isRoundActive && maskedWord ? (
        <Text style={styles.maskedWord} testID="masked-word">
          {maskedWord}
        </Text>
      ) : null}

      {/* Score strip */}
      <View style={styles.scoreRow}>
        {players.map((p) => {
          const isYou = p.playerId === playerId;
          const isDrawer = p.playerId === drawer;
          return (
            <View key={p.playerId} style={styles.scoreItem}>
              <Text
                style={[
                  styles.scoreNickname,
                  isYou && styles.scoreYou,
                  isDrawer && styles.scoreDrawer,
                ]}
                numberOfLines={1}
              >
                {p.nickname}
                {isDrawer ? ' 🎨' : isYou ? ' (you)' : ''}
              </Text>
              <Text style={styles.scoreValue}>{scores[p.playerId] ?? 0}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderLight,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundText: {
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600' as const,
    color: tokens.colors.textSecondary,
  },
  timerText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700' as const,
  },
  maskedWord: {
    fontSize: tokens.typography.heading.fontSize,
    fontWeight: '700' as const,
    color: tokens.colors.primary,
    textAlign: 'center',
    letterSpacing: 3,
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.radius.sm,
    paddingVertical: 4,
    paddingHorizontal: tokens.spacing.sm,
  },
  scoreNickname: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textPrimary,
  },
  scoreYou: {
    fontWeight: '700' as const,
    color: tokens.colors.primary,
  },
  scoreDrawer: {
    fontWeight: '600' as const,
    color: tokens.colors.secondary,
  },
  scoreValue: {
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700' as const,
    color: tokens.colors.textSecondary,
  },
});
