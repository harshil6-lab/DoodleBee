/**
 * Injectable clock (`testing-strategy.md` section 6.1: "Timer tests use an
 * injectable clock, not `setTimeout` real time").
 *
 * Every timer in the aggregate is an absolute server-clock instant, so a test
 * clock is all a test needs to drive a round from start to expiry.
 */

export interface Clock {
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

export interface TestClock extends Clock {
  set(at: number): void;
  advance(ms: number): void;
}

export function createTestClock(start = 1_700_000_000_000): TestClock {
  let current = start;
  return {
    now: () => current,
    set(at) {
      current = at;
    },
    advance(ms) {
      current += ms;
    },
  };
}
