/**
 * Comic button - the approved `.btn-comic` treatment from the Figma Make
 * design system: 3px ink border, hard 5px offset shadow, press feedback that
 * shifts the face into the shadow. Variants map to the approved palette.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ComicSurface } from './ui/ComicSurface';
import { tokens } from '../theme/tokens';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'danger' | 'yellow' | 'mint' | 'ink';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const VARIANT_FILL: Record<ButtonVariant, string> = {
  primary: tokens.colors.purple,
  secondary: tokens.colors.hotPink,
  ghost: tokens.colors.white,
  danger: tokens.colors.hotPink,
  yellow: tokens.colors.beeYellow,
  mint: tokens.colors.mint,
  ink: tokens.colors.ink,
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: tokens.colors.cream,
  secondary: tokens.colors.cream,
  ghost: tokens.colors.ink,
  danger: tokens.colors.cream,
  yellow: tokens.colors.ink,
  mint: tokens.colors.cream,
  ink: tokens.colors.cream,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  isLoading = false,
  fullWidth = false,
  style,
  testID,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || isLoading;
  const shift = pressed && !inactive ? 4 : 0;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={inactive}
      style={[fullWidth && styles.fullWidth, style]}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: isLoading }}
    >
      <ComicSurface
        variant="comic"
        radius={tokens.radius.md}
        backgroundColor={VARIANT_FILL[variant]}
        offset={shift > 0 ? tokens.hardShadow.comicActive : undefined}
        contentStyle={[
          styles.face,
          { transform: [{ translateX: shift }, { translateY: shift }] },
          inactive && styles.disabled,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator color={VARIANT_TEXT[variant]} />
        ) : (
          <Text style={[styles.label, { color: VARIANT_TEXT[variant] }]}>
            {label}
          </Text>
        )}
      </ComicSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  face: {
    minHeight: 52,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: tokens.typography.button.fontFamily,
    fontSize: tokens.typography.button.fontSize,
    lineHeight: tokens.typography.button.lineHeight,
    letterSpacing: tokens.typography.button.letterSpacing,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
});
