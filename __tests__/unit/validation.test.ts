/**
 * Boundary validation tests (ADR section 20.2) plus a compile-time contract
 * check that the Zod output matches the domain type.
 */
import {
  ChatMessageSchema,
  GuessSchema,
  NicknameSchema,
  RoomCodeSchema,
  RoomConfigSchema,
} from '../../src/validation';
import type { RoomConfig } from '../../src/types';

describe('validation schemas', () => {
  it('room config output matches the domain RoomConfig type', () => {
    const parsed: RoomConfig = RoomConfigSchema.parse({
      roomName: 'Friday night',
      maxPlayers: 8,
      rounds: 3,
      roundDuration: 90,
      hints: 2,
    });

    expect(parsed.roomName).toBe('Friday night');
    expect(parsed.maxPlayers).toBe(8);
  });

  it('rejects room config outside the approved bounds', () => {
    const base = {
      roomName: 'Room',
      maxPlayers: 8,
      rounds: 3,
      roundDuration: 90,
      hints: 2,
    };

    expect(RoomConfigSchema.safeParse({ ...base, maxPlayers: 1 }).success).toBe(
      false,
    );
    expect(RoomConfigSchema.safeParse({ ...base, maxPlayers: 9 }).success).toBe(
      false,
    );
    expect(
      RoomConfigSchema.safeParse({ ...base, roundDuration: 10 }).success,
    ).toBe(false);
    expect(RoomConfigSchema.safeParse({ ...base, roomName: '' }).success).toBe(
      false,
    );
  });

  it('normalizes room codes and rejects ambiguous characters', () => {
    expect(RoomCodeSchema.parse('abcde')).toBe('ABCDE');
    expect(RoomCodeSchema.parse(' abc234 ')).toBe('ABC234');

    // O/0 and I/1 are excluded by the room code rules (projectInfo section 4)
    expect(RoomCodeSchema.safeParse('ABC0EF').success).toBe(false);
    expect(RoomCodeSchema.safeParse('ABC1EF').success).toBe(false);
    expect(RoomCodeSchema.safeParse('ABCOEF').success).toBe(false);
    expect(RoomCodeSchema.safeParse('ABCIEF').success).toBe(false);

    expect(RoomCodeSchema.safeParse('abc').success).toBe(false);
    expect(RoomCodeSchema.safeParse('abcdefg').success).toBe(false);
  });

  it('validates nicknames', () => {
    expect(NicknameSchema.parse('  bee_keeper  ')).toBe('bee_keeper');
    expect(NicknameSchema.safeParse('').success).toBe(false);
    expect(NicknameSchema.safeParse('a'.repeat(21)).success).toBe(false);
    expect(NicknameSchema.safeParse('bad name').success).toBe(false);
  });

  it('validates guesses and chat messages', () => {
    expect(GuessSchema.parse('  elephant ')).toBe('elephant');
    expect(GuessSchema.safeParse('   ').success).toBe(false);
    expect(ChatMessageSchema.safeParse('a'.repeat(201)).success).toBe(false);
  });
});
