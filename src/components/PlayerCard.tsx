/**
 * Player tile - lobby roster card (Figma Make "DoodleBee" lobby).
 *
 * Approved treatment: a solid ink tile with cream text and a purple avatar
 * badge carrying the player's initials. States: NORMAL, HOST, YOU,
 * DISCONNECTED.
 */
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { ComicSurface } from './ui/ComicSurface';
import { tokens } from '../theme/tokens';
import type { Player } from '../types';

export type PlayerCardState =
  'NORMAL' | 'HOST' | 'YOU' | 'WAITING' | 'DISCONNECTED';

export interface PlayerCardProps {
  player: Player;
  state: PlayerCardState;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const STATE_TAG: Record<PlayerCardState, string> = {
  NORMAL: '',
  HOST: 'HOST',
  YOU: 'YOU',
  WAITING: 'WAITING',
  DISCONNECTED: 'OFFLINE',
};

export function PlayerCard({ player, state, style, testID }: PlayerCardProps) {
  const initials = player.nickname.slice(0, 2).toUpperCase();
  const tag = STATE_TAG[state];

  return (
    <ComicSurface
      variant="sticker"
      radius={tokens.radius.md}
      backgroundColor={tokens.colors.ink}
      borderColor={tokens.colors.ink}
      style={style}
      contentStyle={styles.inner}
      testID={testID}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{initials}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.nickname} numberOfLines={1}>
          {player.nickname}
        </Text>
        {tag ? (
          <Text style={styles.tag} numberOfLines={1}>
            {player.isHost ? '👑 ' : ''}
            {tag}
          </Text>
        ) : null}
      </View>
    </ComicSurface>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
    letterSpacing: 0.6,
    color: tokens.colors.cream,
  },
  copy: {
    flex: 1,
  },
  nickname: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    lineHeight: tokens.typography.bodyBold.lineHeight,
    color: tokens.colors.cream,
  },
  tag: {
    marginTop: tokens.spacing.xxs,
    fontFamily: tokens.typography.label.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
    letterSpacing: 0.8,
    color: tokens.colors.beeYellow,
  },
});
