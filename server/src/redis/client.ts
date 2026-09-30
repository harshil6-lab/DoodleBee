/**
 * Redis connection (`data-model.md` section 1: authoritative transient).
 *
 * One client per process. V1 is a single service (D03-031), so no adapter or
 * subscriber connection is created: the Socket.IO default in-memory adapter is
 * the transport, exactly as D03-031 scopes it.
 */

import { Redis } from 'ioredis';

export interface RedisHandle {
  readonly client: Redis;
  close(): Promise<void>;
  ping(): Promise<boolean>;
}

export function createRedis(url: string): RedisHandle {
  const client = new Redis(url, {
    // Fail fast at boot rather than queueing indefinitely behind a dead Redis.
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    lazyConnect: false,
  });
  client.on('error', () => {
    /* surfaced through health checks and the caller's logger */
  });
  return {
    client,
    async close() {
      await client.quit();
    },
    async ping() {
      try {
        return (await client.ping()) === 'PONG';
      } catch {
        return false;
      }
    },
  };
}
