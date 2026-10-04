/**
 * GuesserPanel - masked word display, guess input, feedback overlay.
 *
 * Guesser-only component. Drawer must NOT render this panel.
 * Server is authoritative for guess correctness - client only submits
 * and displays outcomes from server events.
 *
 * SECRET-WORD BOUNDARY: this panel reads `maskedWord` only. It never reads
 * or receives `secretWord` (the guesser store has no such field).
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ComicSurface } from './ui/ComicSurface';
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
        <ComicSurface
          variant="sticker"
          radius={tokens.radius.md}
          backgroundColor={
            feedback === 'CORRECT'
              ? tokens.colors.mint
              : feedback === 'CLOSE'
                ? tokens.colors.beeYellow
                : tokens.colors.hotPink
          }
          contentStyle={styles.feedbackFace}
        >
          <Text
            style={[
              styles.feedbackText,
              feedback === 'WRONG' && styles.feedbackTextInverse,
            ]}
          >
            {feedback === 'CORRECT'
              ? 'Correct!'
              : feedback === 'CLOSE'
                ? 'Close!'
                : 'Not quite...'}
          </Text>
        </ComicSurface>
      ) : null}

      {/* Masked word hint area */}
      <View style={styles.hintArea}>
        <Text style={styles.hintLabel}>Guess the word</Text>
        {maskedWord ? (
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.md}
            backgroundColor={tokens.colors.white}
            contentStyle={styles.maskedCard}
            style={styles.maskedCardWrap}
          >
            <Text
              style={styles.maskedWordText}
              numberOfLines={1}
              adjustsFontSizeToFit
              testID="masked-word-guesser"
            >
              {maskedWord}
            </Text>
          </ComicSurface>
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
          You are the drawer - draw, don&apos;t guess!
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.cream,
    borderTopWidth: tokens.border.comic,
    borderTopColor: tokens.colors.ink,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  feedbackFace: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    alignItems: 'center',
  },
  feedbackText: {
    ...tokens.typography.bodyBold,
    color: tokens.colors.ink,
  },
  feedbackTextInverse: {
    color: tokens.colors.cream,
  },
  hintArea: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  hintLabel: {
    ...tokens.typography.label,
    color: tokens.colors.muted,
    textTransform: 'uppercase',
  },
  maskedCardWrap: {
    alignSelf: 'stretch',
  },
  maskedCard: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    alignItems: 'center',
  },
  maskedWordText: {
    ...tokens.typography.heading,
    color: tokens.colors.ink,
    letterSpacing: 6,
  },
  hintPlaceholder: {
    ...tokens.typography.caption,
    color: tokens.colors.textMuted,
    fontStyle: 'italic',
  },
  disabledHint: {
    ...tokens.typography.caption,
    color: tokens.colors.textMuted,
    textAlign: 'center',
  },
  drawerNotice: {
    ...tokens.typography.bodyBold,
    color: tokens.colors.secondary,
    textAlign: 'center',
  },
});
