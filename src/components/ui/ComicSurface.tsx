/**
 * ComicSurface - the core DoodleBee "sticker" container.
 *
 * Recreates the approved `.btn-comic` / `.sticker` primitives from the Figma
 * Make design system: a solid ink border with a hard, un-blurred offset
 * shadow. React Native has no hard-shadow style, so the shadow is a second
 * view rendered behind the content at the same offset.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { tokens } from '../../theme/tokens';

export type ComicSurfaceVariant = 'comic' | 'sticker';

export interface ComicSurfaceProps {
  children?: ReactNode;
  /** `comic` = 3px border / 5px shadow, `sticker` = 2.5px border / 3px shadow. */
  variant?: ComicSurfaceVariant;
  radius?: number;
  backgroundColor?: string;
  borderColor?: string;
  /** Overrides the shadow offset (used for press feedback). */
  offset?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ComicSurface({
  children,
  variant = 'sticker',
  radius = tokens.radius.card,
  backgroundColor = tokens.colors.white,
  borderColor = tokens.colors.ink,
  offset,
  style,
  contentStyle,
  testID,
}: ComicSurfaceProps) {
  const borderWidth =
    variant === 'comic' ? tokens.border.comic : tokens.border.sticker;
  const shadowOffset =
    offset ??
    (variant === 'comic' ? tokens.hardShadow.comic : tokens.hardShadow.sticker);

  return (
    <View style={[styles.root, style]} testID={testID}>
      <View
        pointerEvents="none"
        style={[
          styles.shadow,
          {
            borderRadius: radius,
            backgroundColor: borderColor,
            top: shadowOffset,
            left: shadowOffset,
          },
        ]}
      />
      <View
        style={[
          styles.content,
          {
            borderRadius: radius,
            borderWidth,
            borderColor,
            backgroundColor,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  shadow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  content: {
    overflow: 'hidden',
  },
});
