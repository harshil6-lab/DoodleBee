/**
 * Identity sources (`data-model.md` section 2.3 room codes, D03-019 tokens).
 *
 * All randomness is server-side. A seeded source exists so tests are
 * deterministic (`testing-strategy.md` section 6.2) without the game logic
 * knowing whether it is running under test.
 */

import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_MAX_LENGTH,
  ROOM_CODE_MIN_LENGTH,
} from '../../../shared/contract/constants.js';

export interface IdSource {
  uuid(): string;
  /** 5-6 characters, alphabet excludes O/0/I/1 (PRD "Room Code"). */
  roomCode(): string;
  /** An unpredictable opaque bearer token. */
  token(): string;
  /** Uniform integer in [0, maxExclusive). */
  randomInt(maxExclusive: number): number;
}

export const systemIds: IdSource = {
  uuid: () => randomUUID(),
  roomCode() {
    const length =
      ROOM_CODE_MIN_LENGTH +
      randomInt(ROOM_CODE_MAX_LENGTH - ROOM_CODE_MIN_LENGTH + 1);
    let code = '';
    for (let i = 0; i < length; i += 1) {
      code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    }
    return code;
  },
  token: () => randomBytes(32).toString('base64url'),
  randomInt: (maxExclusive) => randomInt(maxExclusive),
};

/** mulberry32: a small deterministic PRNG, for tests only. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededIdSource(seed: number): IdSource {
  const next = mulberry32(seed);
  let counter = 0;
  const pick = <T>(values: readonly T[]): T => {
    const index = Math.floor(next() * values.length);
    return values[Math.min(index, values.length - 1)] as T;
  };
  return {
    uuid: () => {
      counter += 1;
      const hex = counter.toString(16).padStart(12, '0');
      return `00000000-0000-4000-8000-${hex}`;
    },
    roomCode() {
      const length =
        ROOM_CODE_MIN_LENGTH +
        Math.floor(next() * (ROOM_CODE_MAX_LENGTH - ROOM_CODE_MIN_LENGTH + 1));
      let code = '';
      for (let i = 0; i < length; i += 1) {
        code += pick([...ROOM_CODE_ALPHABET]);
      }
      return code;
    },
    token: () => {
      counter += 1;
      return `token-${counter.toString(36).padStart(8, '0')}`;
    },
    randomInt: (maxExclusive) => Math.min(Math.floor(next() * maxExclusive), maxExclusive - 1),
  };
}
