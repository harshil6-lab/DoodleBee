/**
 * Reusable text input component (Phase 1).
 * Conforms to D04-011 — error state is component-level, not route-level.
 */
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { tokens } from '../theme/tokens';

export interface InputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  errorMessage?: string | null;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  secureTextEntry?: boolean;
  maxLength?: number;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  errorMessage,
  autoCapitalize = 'none',
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength,
  returnKeyType = 'done',
  onSubmitEditing,
  autoFocus = false,
  disabled = false,
  testID,
}: InputProps) {
  const hasError = !!errorMessage;

  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.textMuted}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        editable={!disabled}
        style={[
          styles.input,
          hasError && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
        testID={testID}
      />
      {errorMessage ? (
        <Text style={styles.errorText} testID={`${testID}-error`}>
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
  input: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.borderLight,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textPrimary,
    minHeight: 48,
  },
  inputError: {
    borderColor: tokens.colors.danger,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.danger,
    marginTop: tokens.spacing.xs,
    paddingLeft: tokens.spacing.sm,
  },
});
