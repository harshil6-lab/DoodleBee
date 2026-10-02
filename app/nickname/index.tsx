/**
 * Route: /nickname
 *
 * Entry: app launch with no session, or user chooses to change identity.
 * Exit: POST /session → store token/playerId → navigate to /
 *
 * Uses real REST endpoint (`createSession`). No fake data.
 * Errors are shown inline per D04-011.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSessionStore } from '@/stores/session.store';
import { createSession } from '@/api/endpoints';
import type { SessionResponse } from '@/api/endpoints';
import { NicknameSchema } from '@/validation/schemas';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { tokens } from '@/theme/tokens';

export default function NicknameScreen() {
  const router = useRouter();
  const setPlayerId = useSessionStore((s) => s.setPlayerId);
  const setSessionToken = useSessionStore((s) => s.setSessionToken);
  const setNickname = useSessionStore((s) => s.setNickname);

  // All React hooks must run before any early return.
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If session already exists, skip to home.
  const playerId = useSessionStore((s) => s.playerId);
  if (playerId) {
    return <Redirect href="/" />;
  }

  const validationError = (() => {
    const result = NicknameSchema.safeParse(input);
    if (!result.success) return result.error.issues[0]?.message ?? null;
    return null;
  })();

  async function handleSubmit() {
    if (validationError) return;
    setSubmitting(true);
    setError(null);
    try {
      const response: SessionResponse = await createSession();
      setPlayerId(response.playerId);
      setSessionToken(response.sessionToken);
      if (response.nickname) setNickname(response.nickname);
      router.replace('/');
    } catch (err) {
      if (err instanceof Error && 'status' in err) {
        const apiErr = err as unknown as {
          status: number;
          userMessage: () => string;
        };
        setError(apiErr.userMessage());
      } else {
        setError('Failed to create session. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.branding}>
        <Text style={styles.logo}>🐝 DoodleBee</Text>
        <Text style={styles.tagline}>Enter your nickname to play</Text>
      </View>

      <Input
        value={input}
        onChangeText={setInput}
        placeholder="e.g. bee_doodler_42"
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        autoFocus
        errorMessage={validationError ?? error}
        testID="nickname-input"
      />

      <Button
        label="Continue"
        onPress={handleSubmit}
        disabled={!!validationError || submitting}
        isLoading={submitting}
        testID="nickname-submit"
        style={styles.submitButton}
      />

      {error && !validationError ? null : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xxxl,
    paddingBottom: tokens.spacing.xxxl,
    alignItems: 'center',
    gap: tokens.spacing.lg,
  },
  branding: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xxl,
  },
  logo: {
    fontSize: tokens.typography.display.fontSize,
    fontWeight: tokens.typography.display.fontWeight,
    color: tokens.colors.textPrimary,
  },
  tagline: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
    marginTop: tokens.spacing.xs,
  },
  submitButton: {
    width: '100%',
    marginTop: tokens.spacing.md,
  },
});
