/**
 * Secret word isolation tests (ADR section 9.5).
 *
 * These cover the technical enforcement, not just documentation:
 * - compartmentalized stores (drawer vs guesser)
 * - TypeScript-level absence of a guesser `secretWord` accessor
 * - absence of the secret word from public payloads
 * - log redaction
 */
import { ServerToClientEvent } from '../../src/types';
import type { PublicDrawerSelectedPayload } from '../../src/types';
import type { DrawerSelectedPayload } from '../../src/types/drawer-private';
import {
  assertNoSecretWord,
  useGuesserGameStore,
} from '../../src/stores/guesser.store';
import { useDrawerGameStore } from '../../src/stores/drawer.store';
import { createLogger } from '../../src/utils/logger';

describe('secret word isolation (ADR section 9)', () => {
  afterEach(() => {
    useDrawerGameStore.getState().setSecretWord('');
    useGuesserGameStore.getState().setMaskedWord('');
  });

  it('guesser-facing state exposes no secretWord field', () => {
    const state = useGuesserGameStore.getState();
    expect('secretWord' in state).toBe(false);
    expect(() => assertNoSecretWord(state)).not.toThrow();
    expect(state.maskedWord).toBe('');
  });

  it('guesser store has no secretWord accessor at the type level', () => {
    // @ts-expect-error - secretWord must not exist on guesser state (ADR 9.2)
    expect(useGuesserGameStore.getState().secretWord).toBeUndefined();
  });

  it('drawer store receives the secret word (positive control)', () => {
    const payload: DrawerSelectedPayload = {
      type: ServerToClientEvent.DrawerSelected,
      playerId: 'player-1',
      secretWord: 'elephant',
      maskedWord: '_ _ _ _ _ _ _ _',
    };

    // The realtime layer splits `drawer:selected` into two payloads: the
    // drawer-private one above and `PublicDrawerSelectedPayload` for everyone
    // else. Each store only ever receives its own half.
    useDrawerGameStore.getState().setSecretWord(payload.secretWord);
    useGuesserGameStore.getState().setMaskedWord(payload.maskedWord);

    expect(useDrawerGameStore.getState().secretWord).toBe('elephant');
    expect(useGuesserGameStore.getState().maskedWord).toBe('_ _ _ _ _ _ _ _');
    expect('secretWord' in useGuesserGameStore.getState()).toBe(false);
  });

  it('drawer state never leaks into the guesser store', () => {
    useDrawerGameStore.getState().setSecretWord('cabinet');

    expect('secretWord' in useGuesserGameStore.getState()).toBe(false);
    expect(() =>
      assertNoSecretWord(useGuesserGameStore.getState()),
    ).not.toThrow();
  });

  it('public drawer:selected payload has no secretWord key', () => {
    const payload: PublicDrawerSelectedPayload = {
      type: ServerToClientEvent.DrawerSelected,
      playerId: 'player-2',
      maskedWord: '_ _ _ _ _ _ _ _',
    };

    expect(JSON.stringify(payload)).not.toContain('secretWord');

    type PublicPayloadKeys = keyof PublicDrawerSelectedPayload;
    // @ts-expect-error - secretWord is not part of the public payload (ADR 9.3)
    const forbiddenKey: PublicPayloadKeys = 'secretWord';
    expect(forbiddenKey).toBe('secretWord');
  });

  it('the logger redacts secretWord before output', () => {
    const log = createLogger();
    const output = JSON.stringify(
      log.sanitize({ phase: 'ROUND_ACTIVE', secretWord: 'elephant' }),
    );

    expect(output).not.toContain('elephant');
    expect(output).toContain('[redacted]');
  });

  it('the logger masks nicknames', () => {
    const log = createLogger();
    const output = log.sanitize({ nickname: 'doodler' }) as {
      nickname: string;
    };

    expect(output.nickname).toBe('do***');
  });
});
