/**
 * Reusable button component (Phase 1).
 * Primary / secondary / ghost variants per design tokens.
 */
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  isLoading?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const VARIANT_STYLES: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: tokens.colors.primary },
  secondary: { backgroundColor: tokens.colors.secondary },
  ghost: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  danger: { backgroundColor: tokens.colors.danger },
};

const VARIANT_TEXT_COLORS: Record<ButtonVariant, string> = {
  primary: tokens.colors.textInverse,
  secondary: tokens.colors.textInverse,
  ghost: tokens.colors.textPrimary,
  danger: tokens.colors.textInverse,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  isLoading = false,
  style,
  testID,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isLoading}
      style={[
        styles.button,
        VARIANT_STYLES[variant],
        style,
        disabled && styles.disabled,
      ]}
      testID={testID}
    >
      {isLoading ? (
        <Text style={[styles.label, { color: VARIANT_TEXT_COLORS[variant] }]}>
          Loading...
        </Text>
      ) : (
        <Text style={[styles.label, { color: VARIANT_TEXT_COLORS[variant] }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: tokens.typography.button.fontSize,
    fontWeight: tokens.typography.button.fontWeight,
    letterSpacing: tokens.typography.button.letterSpacing,
  },
});
