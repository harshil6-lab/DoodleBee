/**
 * The composition root (`server-state-writer-map.md` section 1 rule 5).
 *
 * Everything is constructed exactly once, here: the connection handles, the
 * Socket.IO server, the one `Bus`, the service container and the Fastify app.
 * Nothing else in the codebase constructs a service or opens a connection, so
 * "one authoritative writer per field" is enforced by construction rather than
 * by convention.
 *
 * Boot order matters and is fixed: the Socket.IO server needs the HTTP server,
 * the `Bus` needs the Socket.IO server, and the service container needs the
 * `Bus` - so Fastify is created first and its routes are registered last.
 */

import { SWEEPER_INTERVAL_MS } from '../../shared/contract/constants.js';
import { createApp, registerApi } from './app.js';
import { loadEnvFile, parseEnv } from './config/env.js';
import { createDatabase } from './db/client.js';
import { systemClock } from './game/clock.js';
import { systemIds } from './game/ids.js';
import { createServices } from './game/services.js';
import { SocketIoBus } from './realtime/ioBus.js';
import { attachRealtime, createSocketIoServer } from './realtime/socket.js';
import { createRedis } from './redis/client.js';

async function main(): Promise<void> {
  loadEnvFile();
  const env = parseEnv();

  const db = createDatabase(env.DATABASE_URL);
  const redis = createRedis(env.REDIS_URL);

  const app = createApp(env);
  const io = createSocketIoServer(app.server);
  const bus = new SocketIoBus(io, redis.client);
  const services = createServices({
    redis: redis.client,
    db,
    clock: systemClock,
    ids: systemIds,
    logger: app.log,
    bus,
  });
  registerApi(app, services);
  const realtime = attachRealtime(io, services);

  const [postgres, redisReady] = await Promise.all([db.ping(), redis.ping()]);
  if (!postgres) app.log.warn('postgres is not reachable yet');
  if (!redisReady) app.log.warn('redis is not reachable yet');

  // The sweeper is the only background loop: it expires grace periods, round
  // deadlines and STARTING/RESULTS windows (`state-machine.md` section 8).
  const sweeper = setInterval(() => {
    void services.sweep().catch((error: unknown) => {
      app.log.error({ err: error }, 'sweeper failed');
    });
  }, SWEEPER_INTERVAL_MS);
  sweeper.unref();

  let shuttingDown = false;
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'shutting down');
    clearInterval(sweeper);
    // Order is deliberate: stop the transport, then the HTTP surface, then the
    // dependencies the two of them were using.
    try {
      await realtime.shutdown();
    } catch (error) {
      app.log.error({ err: error }, 'socket shutdown failed');
    }
    try {
      await app.close();
    } catch (error) {
      app.log.error({ err: error }, 'http shutdown failed');
    }
    try {
      await redis.close();
    } catch (error) {
      app.log.error({ err: error }, 'redis close failed');
    }
    try {
      await db.close();
    } catch (error) {
      app.log.error({ err: error }, 'postgres close failed');
    }
    app.log.info('shutdown complete');
  }

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write('fatal: ' + message + '\n');
  process.exitCode = 1;
});