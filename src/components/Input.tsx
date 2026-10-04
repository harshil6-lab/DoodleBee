/**
 * Sticker text input - ink border, hard offset shadow, cream fill, and the
 * approved focus treatment (purple border). Error state is component-level
 * per D04-011.
 */
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { ComicSurface } from './ui/ComicSurface';
import { tokens } from '../theme/tokens';

export interface InputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  label?: string;
  errorMessage?: string | null;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: TextInputProps['autoComplete'];
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  secureTextEntry?: boolean;
  maxLength?: number;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  label,
  errorMessage,
  autoCapitalize = 'none',
  autoComplete,
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength,
  returnKeyType = 'done',
  onSubmitEditing,
  autoFocus = false,
  disabled = false,
  style,
  testID,
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const hasError = !!errorMessage;

  const borderColor = hasError
    ? tokens.colors.hotPink
    : focused
      ? tokens.colors.purple
      : tokens.colors.ink;

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ComicSurface
        variant="sticker"
        radius={tokens.radius.md}
        backgroundColor={tokens.colors.white}
        borderColor={borderColor}
        contentStyle={styles.surface}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.muted}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          editable={!disabled}
          style={styles.input}
          testID={testID}
        />
      </ComicSurface>
      {errorMessage ? (
        <Text
          style={styles.errorText}
          testID={testID ? `${testID}-error` : undefined}
        >
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: tokens.spacing.md,
  },
  label: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    lineHeight: tokens.typography.bodyBold.lineHeight,
    color: tokens.colors.ink,
    marginBottom: tokens.spacing.sm,
  },
  surface: {
    paddingHorizontal: tokens.spacing.md,
  },
  input: {
    minHeight: 50,
    fontFamily: tokens.typography.body.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.ink,
    paddingVertical: tokens.spacing.sm,
  },
  errorText: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.hotPink,
    marginTop: tokens.spacing.xs,
    paddingLeft: tokens.spacing.xs,
  },
});
