/**
 * Deterministic fixtures for the pure suites
 * (`testing-strategy.md` section 6: seeded ids, injectable clock).
 */

import type { RoomAggregate, RoomMember } from '../../src/game/types.js';

export function makeMember(overrides: Partial<RoomMember> = {}): RoomMember {
  return {
    playerId: 'p1',
    userId: 'u1',
    nickname: 'one',
    seatOrder: 0,
    isConnected: true,
    graceDeadline: null,
    hasBound: true,
    joinedAt: 1_700_000_000_000,
    ...overrides,
  };
}

export function makeAggregate(
  overrides: Partial<RoomAggregate> = {},
): RoomAggregate {
  return {
    roomId: 'room-1',
    code: 'ABCDE',
    status: 'WAITING',
    hostPlayerId: 'p1',
    config: {
      roomName: 'Room',
      maxPlayers: 8,
      rounds: 3,
      roundDuration: 80,
      hints: 2,
    },
    phase: 'WAITING',
    gameId: null,
    gameStatus: null,
    roundId: null,
    roundNumber: 0,
    roundsPlanned: 3,
    drawerPlayerId: null,
    previousDrawerPlayerId: null,
    nextDrawerPlayerId: null,
    wordId: null,
    roundEndTime: null,
    roundTimerPaused: false,
    roundStartedAt: null,
    pausedAt: null,
    startingDeadline: null,
    resultsDeadline: null,
    hintsRemaining: 2,
    revealedPositions: [],
    endReason: null,
    ...overrides,
  };
}