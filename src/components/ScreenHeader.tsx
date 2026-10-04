/**
 * Screen header - the approved "★ Back" row used by the nickname, create-room
 * and join-room screens, with the decorative star that closes the row.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

export interface ScreenHeaderProps {
  onBack: () => void;
  backLabel?: string;
  /** Right-aligned decorative glyph (defaults to the approved star). */
  accent?: string;
  testID?: string;
}

export function ScreenHeader({
  onBack,
  backLabel = 'Back',
  accent = '★',
  testID,
}: ScreenHeaderProps) {
  return (
    <View style={styles.row} testID={testID}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={styles.back}
        accessibilityRole="button"
      >
        <Text style={styles.starSmall}>★</Text>
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      <Text style={styles.accent}>{accent}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.sm,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  starSmall: {
    fontSize: 18,
    color: tokens.colors.hotPink,
  },
  backText: {
    fontFamily: tokens.typography.subheading.fontFamily,
    fontSize: tokens.typography.subheading.fontSize,
    lineHeight: tokens.typography.subheading.lineHeight,
    color: tokens.colors.ink,
  },
  accent: {
    fontSize: 20,
    color: tokens.colors.purple,
  },
});
