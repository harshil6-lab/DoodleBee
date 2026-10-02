/**
 * Player card component for lobby and game header (Phase 1).
 * States: NORMAL, HOST, YOU, DISCONNECTED.
 */
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import type { Player } from '../types';

export type PlayerCardState = 'NORMAL' | 'HOST' | 'YOU' | 'DISCONNECTED';

export interface PlayerCardProps {
  player: Player;
  state: PlayerCardState;
  testID?: string;
}

const STATE_COLORS: Record<PlayerCardState, { bg: string; badge?: string }> = {
  NORMAL: { bg: tokens.colors.surface },
  HOST: {
    bg: tokens.colors.surface,
    badge: tokens.colors.accentYellow,
  },
  YOU: {
    bg: tokens.colors.backgroundAlt,
    badge: tokens.colors.primary,
  },
  DISCONNECTED: { bg: tokens.colors.surfaceElevated },
};

const STATE_LABELS: Record<PlayerCardState, string> = {
  NORMAL: '',
  HOST: 'HOST',
  YOU: 'YOU',
  DISCONNECTED: 'OFFLINE',
};

export function PlayerCard({ player, state, testID }: PlayerCardProps) {
  const colors = STATE_COLORS[state];

  return (
    <View style={[styles.card, { backgroundColor: colors.bg }]} testID={testID}>
      <View style={styles.row}>
        <Text style={styles.nickname} numberOfLines={1}>
          {player.nickname}
        </Text>
        {colors.badge ? (
          <View style={[styles.badge, { backgroundColor: colors.badge }]}>
            <Text style={styles.badgeText}>{STATE_LABELS[state]}</Text>
          </View>
        ) : null}
      </View>
      {state === 'DISCONNECTED' ? (
        <Text style={styles.statusDisconnected}>Disconnected</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: tokens.colors.borderLight,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  nickname: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textPrimary,
    flex: 1,
  },
  badge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    borderRadius: tokens.radius.sm,
  },
  badgeText: {
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700' as const,
    color: tokens.colors.textInverse,
  },
  statusDisconnected: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xs,
  },
});
