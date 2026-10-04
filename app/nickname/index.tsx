/**
 * Route: /nickname
 *
 * Entry: app launch with no session, or user chooses to change identity.
 * Exit: POST /session -> store token/playerId -> navigate to /
 *
 * Visual reference: Figma Make "DoodleBee" screen `nickname`. Behaviour is
 * unchanged: real REST endpoint (`createSession`), inline errors per D04-011.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionStore } from '@/stores/session.store';
import { createSession } from '@/api/endpoints';
import type { SessionResponse } from '@/api/endpoints';
import { NicknameSchema } from '@/validation/schemas';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PaperBackground } from '@/components/ui/PaperBackground';
import { ComicSurface } from '@/components/ui/ComicSurface';
import { tokens } from '@/theme';

const MAX_NICK = 20;
const SUGGESTIONS = [
  'SketchLord',
  'DoodleGod',
  'PicassoBro',
  'ScribblePro',
  'MasterBrush',
];

export default function NicknameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const goBack = () => router.replace('/');

  return (
    <View style={styles.root}>
      <PaperBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + tokens.spacing.sm },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader onBack={goBack} testID="nickname-back" />

        <Text style={styles.headline}>What should{'\n'}we call you?</Text>
        <Text style={styles.subtitle}>Make it weird. Make it iconic.</Text>

        <View style={styles.inputWrap}>
          <Input
            value={input}
            onChangeText={setInput}
            placeholder="E.g. SketchLord..."
            autoCapitalize="none"
            maxLength={MAX_NICK}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            autoFocus
            errorMessage={null}
            testID="nickname-input"
          />
          <Text style={styles.counter}>
            {input.length}/{MAX_NICK}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Quick suggestions</Text>
        <View style={styles.chips}>
          {SUGGESTIONS.map((suggestion) => (
            <Pressable key={suggestion} onPress={() => setInput(suggestion)}>
              <ComicSurface
                variant="sticker"
                radius={tokens.radius.full}
                backgroundColor={
                  input === suggestion
                    ? tokens.colors.beeYellow
                    : tokens.colors.white
                }
                contentStyle={styles.chipInner}
              >
                <Text style={styles.chipText}>{suggestion}</Text>
              </ComicSurface>
            </Pressable>
          ))}
        </View>

        {validationError || error ? (
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.sm}
            backgroundColor={tokens.colors.cheek}
            style={styles.hint}
            contentStyle={styles.hintInner}
          >
            <Text style={styles.hintText}>★ {validationError ?? error}</Text>
          </ComicSurface>
        ) : null}

        <Button
          label="LET'S GO →"
          variant="primary"
          fullWidth
          onPress={handleSubmit}
          disabled={!!validationError || submitting}
          isLoading={submitting}
          testID="nickname-submit"
          style={styles.submitButton}
        />

        <Text style={styles.footer}>Talent optional. Confidence required.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.cream,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xxl,
  },
  headline: {
    marginTop: tokens.spacing.md,
    fontFamily: tokens.typography.display.fontFamily,
    fontSize: tokens.typography.display.fontSize,
    lineHeight: tokens.typography.display.lineHeight,
    letterSpacing: tokens.typography.display.letterSpacing,
    color: tokens.colors.ink,
  },
  subtitle: {
    marginTop: tokens.spacing.sm,
    fontFamily: tokens.typography.body.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textSecondary,
  },
  inputWrap: {
    marginTop: tokens.spacing.lg,
  },
  counter: {
    position: 'absolute',
    right: tokens.spacing.md,
    top: 46,
    fontFamily: tokens.typography.caption.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
  },
  sectionLabel: {
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.bodyBold.fontSize,
    color: tokens.colors.ink,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
  },
  chipInner: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  chipText: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.ink,
  },
  hint: {
    marginTop: tokens.spacing.lg,
  },
  hintInner: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  hintText: {
    fontFamily: tokens.typography.bodyBold.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.ink,
  },
  submitButton: {
    marginTop: tokens.spacing.lg,
  },
  footer: {
    marginTop: tokens.spacing.lg,
    fontFamily: tokens.typography.caption.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
});
