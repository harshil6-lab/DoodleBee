import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration (`testing-strategy.md` section 9).
 *
 * `fileParallelism` is off because the integration suites share one PostgreSQL
 * database and one Redis keyspace; they truncate/flush between suites rather
 * than each owning an instance (section 6.3).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Booting a real Fastify + Socket.IO server and applying migrations is
    // slower than a pure unit test.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});