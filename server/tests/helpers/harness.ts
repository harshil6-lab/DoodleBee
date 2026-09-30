/**
 * The integration harness (`testing-strategy.md` sections 3 and 6.3).
 *
 * A real Fastify app, a real Socket.IO server on an ephemeral port, real
 * Redis and real PostgreSQL - because the properties under test (transactional
 * admission, the Redis commit, socket fan-out) do not exist in a fake.
 *
 * The test database and Redis keyspace are separate from development:
 * `doodlebee_test` and Redis db 15. Both are reset between suites.
 */

import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { createApp, registerApi } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { createDatabase, type DatabaseHandle } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';
import { seedWords } from '../../src/db/seedWords.js';
import { createTestClock, type TestClock } from '../../src/game/clock.js';
import { systemIds } from '../../src/game/ids.js';
import { createServices, type Services } from '../../src/game/services.js';
import { SocketIoBus } from '../../src/realtime/ioBus.js';
import { attachRealtime, createSocketIoServer } from '../../src/realtime/socket.js';
import { createRedis, type RedisHandle } from '../../src/redis/client.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://doodlebee:doodlebee@127.0.0.1:5433/doodlebee_test';

export const TEST_REDIS_URL =
  process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379/15';

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

const TABLES = [
  'scores',
  'game_results',
  'rounds',
  'games',
  'room_players',
  'rooms',
  'users',
];

export interface Harness {
  app: FastifyInstance;
  services: Services;
  db: DatabaseHandle;
  redis: RedisHandle;
  /**
   * The injectable clock (`testing-strategy.md` section 6.1). Advance it and
   * call `services.sweep()` to drive a countdown, a round deadline or a grace
   * period - no test sleeps on wall-clock time.
   */
  clock: TestClock;
  /** Base URL for `socket.io-client`. */
  url: string;
  /** Empty both stores. Called before each suite. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function startHarness(): Promise<Harness> {
  const clock = createTestClock();
  const db = createDatabase(TEST_DATABASE_URL);
  const redis = createRedis(TEST_REDIS_URL);
  await runMigrations(TEST_DATABASE_URL, MIGRATIONS_FOLDER);
  await seedWords(db);

  const env = parseEnv({
    NODE_ENV: 'test',
    PORT: '0',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: TEST_REDIS_URL,
  });

  const app = createApp(env);
  const io = createSocketIoServer(app.server);
  const bus = new SocketIoBus(io, redis.client);
  const services = createServices({
    redis: redis.client,
    db,
    clock,
    ids: systemIds,
    logger: app.log,
    bus,
  });
  registerApi(app, services);
  const realtime = attachRealtime(io, services);

  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address() as AddressInfo;
  const url = 'http://127.0.0.1:' + address.port;

  async function reset(): Promise<void> {
    await redis.client.flushdb();
    await db.pool.query(
      'TRUNCATE TABLE ' + TABLES.join(', ') + ' RESTART IDENTITY CASCADE',
    );
  }

  return {
    app,
    services,
    db,
    redis,
    clock,
    url,
    reset,
    async close() {
      await realtime.shutdown();
      await app.close();
      await redis.close();
      await db.close();
    },
  };
}