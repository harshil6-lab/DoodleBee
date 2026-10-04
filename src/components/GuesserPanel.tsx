/**
 * GuesserPanel — masked word display, guess input, feedback overlay.
 *
 * Guesser-only component. Drawer must NOT render this panel.
 * Server is authoritative for guess correctness — client only submits
 * and displays outcomes from server events.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import { Button } from './Button';
import { Input } from './Input';
import { GuessSchema } from '../validation/schemas';
import { useGuesserGameStore } from '../stores/guesser.store';
import { useDrawerGameStore } from '../stores/drawer.store';
import { useSessionStore } from '../stores/session.store';
import { emitWithoutAck } from '../realtime/socket';
import { ClientToServerEvent } from '../types';

// ---------------------------------------------------------------- Component --

export function GuesserPanel() {
  const playerId = useSessionStore((s) => s.playerId);
  const phase = useDrawerGameStore((s) => s.phase);
  const drawer = useDrawerGameStore((s) => s.drawer);
  const hasGuessed = useGuesserGameStore((s) => s.hasGuessed);
  const maskedWord = useDrawerGameStore((s) => s.maskedWord);
  const [guess, setGuess] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    'WRONG' | 'CLOSE' | 'CORRECT' | null
  >(null);

  const isGuesser = playerId !== null && drawer !== null && playerId !== drawer;
  const canGuess =
    isGuesser && phase === 'ROUND_ACTIVE' && !hasGuessed.has(playerId ?? '');

  const handleSubmit = useCallback(() => {
    const result = GuessSchema.safeParse(guess);
    if (!result.success) {
      setInputError(result.error.issues[0]?.message ?? 'Invalid guess');
      return;
    }
    setInputError(null);
    setFeedback(null);

    const normalized = result.data.trim();
    emitWithoutAck(ClientToServerEvent.SubmitGuess, { guess: normalized });
    // Feedback comes from server events (guess:correct / guess:submitted).
    // Optimistically disable input while waiting.
  }, [guess]);

  // Clean up feedback after delay.
  React.useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 2000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  // Derive disabled state.
  const isDisabled = !canGuess || phase !== 'ROUND_ACTIVE';

  return (
    <View style={styles.container} testID="guesser-panel">
      {/* Feedback overlay */}
      {feedback ? (
        <View
          style={[
            styles.feedback,
            feedback === 'CORRECT'
              ? styles.feedbackCorrect
              : feedback === 'CLOSE'
                ? styles.feedbackClose
                : styles.feedbackWrong,
          ]}
        >
          <Text style={styles.feedbackText}>
            {feedback === 'CORRECT'
              ? 'Correct!'
              : feedback === 'CLOSE'
                ? 'Close!'
                : 'Not quite...'}
          </Text>
        </View>
      ) : null}

      {/* Masked word hint area */}
      <View style={styles.hintArea}>
        <Text style={styles.hintLabel}>Guess the word</Text>
        {maskedWord ? (
          <Text style={styles.maskedWordText} testID="masked-word-guesser">
            {maskedWord}
          </Text>
        ) : (
          <Text style={styles.hintPlaceholder}>Waiting for drawer...</Text>
        )}
      </View>

      {/* Guess input */}
      <Input
        value={guess}
        onChangeText={(v) => {
          setGuess(v);
          setInputError(null);
        }}
        placeholder="Type your guess..."
        errorMessage={inputError}
        maxLength={100}
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        disabled={isDisabled}
        testID="guess-input"
      />

      <Button
        label="Submit Guess"
        onPress={handleSubmit}
        disabled={isDisabled || guess.trim().length === 0}
        variant={canGuess ? 'primary' : 'ghost'}
        testID="submit-guess-button"
      />

      {isDisabled && phase !== 'ROUND_ACTIVE' ? (
        <Text style={styles.disabledHint}>
          {phase === 'WAITING' || phase === 'STARTING'
            ? 'Waiting for the round to start...'
            : 'Round has ended.'}
        </Text>
      ) : null}

      {!isGuesser ? (
        <Text style={styles.drawerNotice}>
          You are the drawer — draw, don&apos;t guess!
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderLight,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  feedback: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
  },
  feedbackCorrect: {
    backgroundColor: `${tokens.colors.accentMint}22`,
    borderWidth: 1,
    borderColor: tokens.colors.accentMint,
  },
  feedbackClose: {
    backgroundColor: `${tokens.colors.accentYellow}22`,
    borderWidth: 1,
    borderColor: tokens.colors.accentYellow,
  },
  feedbackWrong: {
    backgroundColor: `${tokens.colors.danger}11`,
  },
  feedbackText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700' as const,
    color: tokens.colors.textPrimary,
  },
  hintArea: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  hintLabel: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  maskedWordText: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: tokens.colors.primary,
    letterSpacing: 6,
  },
  hintPlaceholder: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    fontStyle: 'italic',
  },
  disabledHint: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    textAlign: 'center',
  },
  drawerNotice: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.secondary,
    textAlign: 'center',
    fontWeight: '600' as const,
  },
});
