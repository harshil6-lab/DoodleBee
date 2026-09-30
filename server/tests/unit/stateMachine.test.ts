/**
 * State transitions (`testing-strategy.md` section 2, "State transitions").
 *
 * Every guard in `state-machine.md` section 4 is exercised in both directions:
 * the allowed transition fires, and the same transition from the wrong
 * predecessor does not.
 */

import { describe, expect, it } from 'vitest';
import {
  canEnterRoundActive,
  canLeaveRoundFinished,
  canStartGame,
  canStartRound,
  isRoundActive,
  isRoundTimerExpired,
  resultsDestination,
  shouldAbortStarting,
  type TransitionContext,
} from '../../src/game/stateMachine.js';
import { makeAggregate } from '../helpers/fixtures.js';

const NOW = 1_700_000_100_000;

function ctx(overrides: Partial<TransitionContext> = {}): TransitionContext {
  const aggregate = makeAggregate();
  return {
    phase: aggregate.phase,
    roomStatus: aggregate.status,
    connectedRosterSize: 2,
    now: NOW,
    startingDeadline: null,
    resultsDeadline: null,
    roundNumber: aggregate.roundNumber,
    roundsPlanned: aggregate.roundsPlanned,
    drawerPlayerId: aggregate.drawerPlayerId,
    wordId: aggregate.wordId,
    roundTimerPaused: aggregate.roundTimerPaused,
    roundEndTime: aggregate.roundEndTime,
    ...overrides,
  };
}

describe('WAITING -> STARTING (canStartGame)', () => {
  it('fires for the host when the connected roster reaches the minimum', () => {
    expect(canStartGame(ctx())).toBe(true);
  });

  it('requires the minimum roster', () => {
    expect(canStartGame(ctx({ connectedRosterSize: 1 }))).toBe(false);
  });

  it('does not fire from any other phase', () => {
    for (const phase of [
      'STARTING',
      'ROUND_ACTIVE',
      'ROUND_FINISHED',
      'NEXT_ROUND',
      'GAME_FINISHED',
    ] as const) {
      expect(canStartGame(ctx({ phase }))).toBe(false);
    }
  });
});

describe('STARTING -> ROUND_ACTIVE (canEnterRoundActive)', () => {
  it('fires once the countdown elapsed with a roster', () => {
    expect(
      canEnterRoundActive(
        ctx({ phase: 'STARTING', startingDeadline: NOW - 1 }),
      ),
    ).toBe(true);
  });

  it('waits while the countdown is still running', () => {
    expect(
      canEnterRoundActive(
        ctx({ phase: 'STARTING', startingDeadline: NOW + 1 }),
      ),
    ).toBe(false);
  });

  it('does not fire without a roster', () => {
    expect(
      canEnterRoundActive(
        ctx({
          phase: 'STARTING',
          startingDeadline: NOW - 1,
          connectedRosterSize: 1,
        }),
      ),
    ).toBe(false);
  });
});

describe('STARTING -> WAITING (shouldAbortStarting)', () => {
  it('aborts only when the roster collapsed during the countdown', () => {
    expect(
      shouldAbortStarting(ctx({ phase: 'STARTING', connectedRosterSize: 1 })),
    ).toBe(true);
    expect(shouldAbortStarting(ctx({ phase: 'STARTING' }))).toBe(false);
    expect(shouldAbortStarting(ctx({ connectedRosterSize: 0 }))).toBe(false);
  });
});

describe('ROUND_FINISHED -> NEXT_ROUND | GAME_FINISHED', () => {
  it('leaves only after the results window elapsed', () => {
    expect(
      canLeaveRoundFinished(
        ctx({ phase: 'ROUND_FINISHED', resultsDeadline: NOW - 1 }),
      ),
    ).toBe(true);
    expect(
      canLeaveRoundFinished(
        ctx({ phase: 'ROUND_FINISHED', resultsDeadline: NOW + 1 }),
      ),
    ).toBe(false);
    expect(canLeaveRoundFinished(ctx({ resultsDeadline: NOW - 1 }))).toBe(false);
  });

  it('finishes the game on the last planned round', () => {
    expect(
      resultsDestination(ctx({ roundNumber: 3, roundsPlanned: 3 })),
    ).toBe('GAME_FINISHED');
    expect(
      resultsDestination(ctx({ roundNumber: 1, roundsPlanned: 3 })),
    ).toBe('NEXT_ROUND');
  });
});

describe('NEXT_ROUND -> ROUND_ACTIVE (canStartRound)', () => {
  it('requires both a drawer and a word', () => {
    const base = { phase: 'NEXT_ROUND' as const };
    expect(
      canStartRound(ctx({ ...base, drawerPlayerId: 'p1', wordId: 'w1' })),
    ).toBe(true);
    expect(canStartRound(ctx({ ...base, drawerPlayerId: null, wordId: 'w1' }))).toBe(
      false,
    );
    expect(canStartRound(ctx({ ...base, drawerPlayerId: 'p1', wordId: null }))).toBe(
      false,
    );
  });
});

describe('round timer (isRoundTimerExpired)', () => {
  it('expires only while live and unpaused', () => {
    const live = {
      phase: 'ROUND_ACTIVE' as const,
      roundEndTime: NOW - 1,
    };
    expect(isRoundTimerExpired(ctx(live))).toBe(true);
    expect(isRoundTimerExpired(ctx({ ...live, roundTimerPaused: true }))).toBe(
      false,
    );
    expect(isRoundTimerExpired(ctx({ ...live, roundEndTime: NOW + 1 }))).toBe(
      false,
    );
    expect(isRoundTimerExpired(ctx({ ...live, phase: 'ROUND_FINISHED' }))).toBe(
      false,
    );
  });
});

describe('isRoundActive', () => {
  it('is true only while the round is live', () => {
    expect(isRoundActive(ctx({ phase: 'ROUND_ACTIVE' }))).toBe(true);
    expect(isRoundActive(ctx({ phase: 'ROUND_FINISHED' }))).toBe(false);
  });
});