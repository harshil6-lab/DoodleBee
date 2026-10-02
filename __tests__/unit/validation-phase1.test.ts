/**
 * Validation schema tests (Phase 1).
 *
 * Reuses the existing validation suite; adds Phase 1-specific cases.
 */
import {
  NicknameSchema,
  RoomCodeSchema,
  RoomConfigSchema,
} from '../../src/validation';

describe('Phase 1 validation — nicknames', () => {
  it('accepts valid nicknames', () => {
    expect(NicknameSchema.parse('bee_doodler_42')).toBe('bee_doodler_42');
    expect(NicknameSchema.parse('alice')).toBe('alice');
    expect(NicknameSchema.parse('A')).toBe('A');
  });

  it('rejects empty nickname', () => {
    expect(NicknameSchema.safeParse('').success).toBe(false);
  });

  it('rejects nicknames over 20 characters', () => {
    expect(NicknameSchema.safeParse('a'.repeat(21)).success).toBe(false);
  });

  it('rejects nicknames with invalid characters', () => {
    expect(NicknameSchema.safeParse('bad name!').success).toBe(false);
    expect(NicknameSchema.safeParse('bad@name').success).toBe(false);
  });

  it('trims whitespace', () => {
    expect(NicknameSchema.parse('  test  ')).toBe('test');
  });
});

describe('Phase 1 validation — room codes', () => {
  it('accepts valid 5-char room codes', () => {
    expect(RoomCodeSchema.parse('ABCDE')).toBe('ABCDE');
    expect(RoomCodeSchema.parse('abcde')).toBe('ABCDE');
  });

  it('accepts valid 6-char room codes', () => {
    expect(RoomCodeSchema.parse('ABCDEG')).toBe('ABCDEG');
  });

  it('rejects room codes with ambiguous characters', () => {
    expect(RoomCodeSchema.safeParse('ABCOEF').success).toBe(false);
    expect(RoomCodeSchema.safeParse('ABC0EF').success).toBe(false);
    expect(RoomCodeSchema.safeParse('ABCIEF').success).toBe(false);
    expect(RoomCodeSchema.safeParse('ABC1EF').success).toBe(false);
  });

  it('normalises to uppercase', () => {
    expect(RoomCodeSchema.parse('abcde')).toBe('ABCDE');
  });

  it('rejects codes outside 5–6 chars', () => {
    expect(RoomCodeSchema.safeParse('ABC').success).toBe(false);
    expect(RoomCodeSchema.safeParse('ABCDEFG').success).toBe(false);
  });
});

describe('Phase 1 validation — room config', () => {
  const validConfig = {
    roomName: 'Friday night',
    maxPlayers: 4,
    rounds: 3,
    roundDuration: 60,
    hints: 2,
  };

  it('accepts a valid room config', () => {
    const parsed = RoomConfigSchema.parse(validConfig);
    expect(parsed.roomName).toBe('Friday night');
    expect(parsed.maxPlayers).toBe(4);
  });

  it('rejects maxPlayers below minimum', () => {
    expect(
      RoomConfigSchema.safeParse({ ...validConfig, maxPlayers: 1 }).success,
    ).toBe(false);
  });

  it('rejects maxPlayers above maximum', () => {
    expect(
      RoomConfigSchema.safeParse({ ...validConfig, maxPlayers: 9 }).success,
    ).toBe(false);
  });

  it('rejects round duration outside bounds', () => {
    expect(
      RoomConfigSchema.safeParse({ ...validConfig, roundDuration: 10 }).success,
    ).toBe(false);
    expect(
      RoomConfigSchema.safeParse({ ...validConfig, roundDuration: 400 })
        .success,
    ).toBe(false);
  });

  it('rejects hints outside bounds', () => {
    expect(
      RoomConfigSchema.safeParse({ ...validConfig, hints: -1 }).success,
    ).toBe(false);
    expect(
      RoomConfigSchema.safeParse({ ...validConfig, hints: 6 }).success,
    ).toBe(false);
  });
});
