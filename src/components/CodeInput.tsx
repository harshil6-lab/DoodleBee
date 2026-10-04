/**
 * CodeInput - the approved multi-slot room-code field.
 *
 * Visual reference: Figma Make "DoodleBee" `join-empty` / `join-invalid`
 * (a row of sticker slots). Behaviour is unchanged from a plain text field:
 * one real TextInput owns the value, maxLength and submit handling, so
 * validation and the REST + socket join flow are unaffected.
 */
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ComicSurface } from './ui/ComicSurface';
import { tokens } from '../theme/tokens';

export interface CodeInputProps {
  value: string;
  onChangeText: (value: string) => void;
  /** Rendered slot count; the approved design uses six. */
  length?: number;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  hasError?: boolean;
  editable?: boolean;
  testID?: string;
}

export function CodeInput({
  value,
  onChangeText,
  length = 6,
  autoFocus = false,
  onSubmitEditing,
  hasError = false,
  editable = true,
  testID,
}: CodeInputProps) {
  const [focused, setFocused] = useState(false);
  const chars = value.split('');
  const activeIndex = Math.min(chars.length, length - 1);

  return (
    <View style={styles.root}>
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length }, (_, index) => {
          const char = chars[index] ?? '';
          const isActive =
            focused && index === activeIndex && chars.length < length;
          const borderColor = hasError
            ? tokens.colors.tangerine
            : isActive
              ? tokens.colors.purple
              : tokens.colors.ink;
          return (
            <ComicSurface
              key={index}
              variant="sticker"
              radius={tokens.radius.sm}
              backgroundColor={tokens.colors.white}
              borderColor={borderColor}
              style={styles.slot}
              contentStyle={styles.slotContent}
            >
              <Text style={styles.slotText}>{char}</Text>
            </ComicSurface>
          );
        })}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        maxLength={length}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        caretHidden
        style={styles.input}
        testID={testID}
        accessibilityLabel="Room code"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  slot: {
    flex: 1,
  },
  slotContent: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: {
    fontFamily: tokens.typography.heading.fontFamily,
    fontSize: tokens.typography.heading.fontSize,
    lineHeight: tokens.typography.heading.lineHeight,
    color: tokens.colors.ink,
    textAlign: 'center',
  },
  input: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});
