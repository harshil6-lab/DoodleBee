/**
 * FeedbackCard - inline banner for join/lobby errors.
 *
 * Visual reference: Figma Make "DoodleBee" error banners (`join-invalid`,
 * `join-full`): a sticker with a warm wash fill, a leading emoji, an optional
 * tangerine title and a body line.
 */
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { ComicSurface } from './ui/ComicSurface';
import { tokens } from '../theme/tokens';

export interface FeedbackCardProps {
  icon: string;
  title?: string;
  message?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function FeedbackCard({
  icon,
  title,
  message,
  style,
  testID,
}: FeedbackCardProps) {
  if (!title && !message) return null;

  return (
    <ComicSurface
      variant="sticker"
      radius={tokens.radius.md}
      backgroundColor={tokens.colors.tangerineWash}
      style={style}
      contentStyle={styles.content}
      testID={testID}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.copy}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </ComicSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
  },
  icon: {
    fontSize: 26,
    lineHeight: 32,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontFamily: tokens.typography.subheading.fontFamily,
    fontSize: tokens.typography.subheading.fontSize,
    lineHeight: tokens.typography.subheading.lineHeight,
    color: tokens.colors.tangerine,
  },
  message: {
    marginTop: tokens.spacing.xxs,
    fontFamily: tokens.typography.caption.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    lineHeight: tokens.typography.caption.lineHeight,
    color: tokens.colors.ink,
  },
});
