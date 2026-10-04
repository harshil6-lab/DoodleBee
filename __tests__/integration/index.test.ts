/**
 * Integration test entry point — DoodleBee client.
 *
 * These tests require a LIVE server instance to execute meaningfully.
 * They are SKIPPED by default in CI and local runs where
 * `INTEGRATION_TESTS=true` is not set in the environment.
 *
 * Infrastructure requirements:
 * - Running Node.js server (default port 3000)
 * - Postgres database with migration applied
 * - Redis (for room state pub/sub)
 * - Seeded word list (same as shared/word-lists/)
 *
 * To run locally against a live server:
 *   INTEGRATION_TESTS=true npx jest --ci __tests__/integration/
 *
 * Current status: SCAFFOLD ONLY — no live-server tests implemented yet.
 */

const ENABLED = process.env.INTEGRATION_TESTS === 'true';

// ---------------------------------------------------------------- Fixtures ----

/**
 * Integration-test connection fixture.
 * Creates two players in the same room and returns their socket handles.
 * Requires a live server.
 */
async function createRoomFixture(nickname: string): Promise<{
  playerId: string;
  roomCode: string;
  cleanup: () => Promise<void>;
}> {
  throw new Error(
    'Integration fixtures require INTEGRATION_TESTS=true and a live server',
  );
}

async function cleanupFixture() {
  // No-op placeholder.
}

// ---------------------------------------------------------------- Tests ----
// All tests are skipped when INTEGRATION_TESTS is not set.

describe('integration — connection lifecycle', () => {
  beforeAll(() => {
    if (!ENABLED) return;
  });
  afterAll(() => {
    if (!ENABLED) return;
  });

  it('player can join a room and receive room:joined', async () => {
    if (!ENABLED) return;
    // Planned: verify room:joined event payload matches snapshot contract.
    throw new Error('Not implemented — requires live server');
  });

  it('disconnecting player triggers player:disconnected on others', async () => {
    if (!ENABLED) return;
    // Planned: verify player:disconnected event broadcast.
    throw new Error('Not implemented — requires live server');
  });

  it('reconnect restores game state from snapshot', async () => {
    if (!ENABLED) return;
    // Planned: verify snapshot contains correct phase, strokes, scores.
    throw new Error('Not implemented — requires live server');
  });
});

describe('integration — game flow', () => {
  it('host can start a game and all players receive game:started', async () => {
    if (!ENABLED) return;
    // Planned: verify game:started payload roundsPlanned, phase=STARTING.
    throw new Error('Not implemented — requires live server');
  });

  it('drawer receives drawer:selected with secretWord, guesser does not', async () => {
    if (!ENABLED) return;
    // Planned: verify secret-word isolation across roles during live game.
    throw new Error('Not implemented — requires live server');
  });

  it('correct guess triggers guess:correct for all players', async () => {
    if (!ENABLED) return;
    // Planned: verify guess:correct event and score update.
    throw new Error('Not implemented — requires live server');
  });

  it('round:ended transitions to NEXT_ROUND with correct rankings', async () => {
    if (!ENABLED) return;
    // Planned: verify round ended state consistency.
    throw new Error('Not implemented — requires live server');
  });
});

describe('integration — session expiration', () => {
  it('expired session clears navigation and shows home screen', async () => {
    if (!ENABLED) return;
    // Planned: simulate SESSION_EXPIRED, verify redirect to /nickname.
    throw new Error('Not implemented — requires live server');
  });
});
