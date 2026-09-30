/**
 * Room validation (`testing-strategy.md` section 2, "Room validation").
 *
 * The bounds are shared constants; the schemas are the only place they are
 * enforced, so a drift between the REST form and the socket payload is caught
 * here.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_HINTS,
  MAX_PLAYERS,
  MAX_ROUND_DURATION_SECONDS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  MIN_ROUND_DURATION_SECONDS,
  MIN_ROUNDS,
  ROOM_NAME_MAX_LENGTH,
} from '../../../shared/contract/constants.js';
import {
  NicknameSchema,
  RoomCodeSchema,
  RoomConfigSchema,
} from '../../../shared/contract/schemas.js';

describe('RoomCodeSchema', () => {
  it('accepts 5 and 6 character codes and upper-cases them', () => {
    expect(RoomCodeSchema.parse('abcde')).toBe('ABCDE');
    // The alphabet excludes F as well as I/O/U and 0/1, so a valid 6-character
    // code is drawn from A B C D E G H J K L M N P Q R S T V W X Y Z 2-9.
    expect(RoomCodeSchema.parse('abcdeg')).toBe('ABCDEG');
    expect(RoomCodeSchema.parse(' abcde ')).toBe('ABCDE');
  });

  it('rejects codes outside the 5-6 character range', () => {
    expect(RoomCodeSchema.safeParse('ABCD').success).toBe(false);
    expect(RoomCodeSchema.safeParse('ABCDEFG').success).toBe(false);
  });

  it('rejects the ambiguous symbols O, 0, I and 1', () => {
    for (const code of ['ABCDO', 'ABCD0', 'ABCDI', 'ABCD1']) {
      expect(RoomCodeSchema.safeParse(code).success).toBe(false);
    }
  });
});

describe('NicknameSchema', () => {
  it('accepts letters, numbers and underscores', () => {
    expect(NicknameSchema.parse(' player_1 ')).toBe('player_1');
  });

  it('rejects spaces, punctuation and empty input', () => {
    for (const value of ['', '   ', 'a b', 'a-b', 'a.b']) {
      expect(NicknameSchema.safeParse(value).success).toBe(false);
    }
  });

  it('rejects input longer than the bound', () => {
    expect(NicknameSchema.safeParse('a'.repeat(21)).success).toBe(false);
  });
});

describe('RoomConfigSchema', () => {
  const valid = {
    roomName: 'Room',
    maxPlayers: 8,
    rounds: 3,
    roundDuration: 80,
    hints: 2,
  };

  it('accepts the documented defaults', () => {
    expect(RoomConfigSchema.safeParse(valid).success).toBe(true);
  });

  it('enforces the capacity bounds', () => {
    expect(
      RoomConfigSchema.safeParse({ ...valid, maxPlayers: MIN_PLAYERS }).success,
    ).toBe(true);
    expect(
      RoomConfigSchema.safeParse({ ...valid, maxPlayers: MAX_PLAYERS }).success,
    ).toBe(true);
    expect(
      RoomConfigSchema.safeParse({ ...valid, maxPlayers: MAX_PLAYERS + 1 })
        .success,
    ).toBe(false);
    expect(
      RoomConfigSchema.safeParse({ ...valid, maxPlayers: MIN_PLAYERS - 1 })
        .success,
    ).toBe(false);
  });

  it('enforces the round count bounds', () => {
    expect(
      RoomConfigSchema.safeParse({ ...valid, rounds: MIN_ROUNDS }).success,
    ).toBe(true);
    expect(
      RoomConfigSchema.safeParse({ ...valid, rounds: MAX_ROUNDS }).success,
    ).toBe(true);
    expect(
      RoomConfigSchema.safeParse({ ...valid, rounds: MAX_ROUNDS + 1 }).success,
    ).toBe(false);
  });

  it('enforces the round duration bounds', () => {
    expect(
      RoomConfigSchema.safeParse({
        ...valid,
        roundDuration: MIN_ROUND_DURATION_SECONDS,
      }).success,
    ).toBe(true);
    expect(
      RoomConfigSchema.safeParse({
        ...valid,
        roundDuration: MAX_ROUND_DURATION_SECONDS,
      }).success,
    ).toBe(true);
    expect(
      RoomConfigSchema.safeParse({
        ...valid,
        roundDuration: MAX_ROUND_DURATION_SECONDS + 1,
      }).success,
    ).toBe(false);
  });

  it('enforces the hint bounds', () => {
    expect(
      RoomConfigSchema.safeParse({ ...valid, hints: MAX_HINTS }).success,
    ).toBe(true);
    expect(
      RoomConfigSchema.safeParse({ ...valid, hints: MAX_HINTS + 1 }).success,
    ).toBe(false);
  });

  it('enforces the room-name length', () => {
    expect(
      RoomConfigSchema.safeParse({ ...valid, roomName: '' }).success,
    ).toBe(false);
    expect(
      RoomConfigSchema.safeParse({
        ...valid,
        roomName: 'a'.repeat(ROOM_NAME_MAX_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      RoomConfigSchema.safeParse({
        ...valid,
        roomName: 'a'.repeat(ROOM_NAME_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });
});