/**
 * PostgreSQL connection (`data-model.md` section 1: system of record).
 *
 * A single pool per process (D03-031: one service, one database). The pool is
 * created once at boot and closed on shutdown; nothing in the game path opens
 * a connection of its own.
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseHandle {
  readonly pool: pg.Pool;
  readonly db: Database;
  close(): Promise<void>;
  ping(): Promise<boolean>;
}

export function createDatabase(connectionString: string): DatabaseHandle {
  const pool = new pg.Pool({ connectionString, max: 10 });
  // An idle-client error must not crash the process; it is logged by the
  // caller's pino instance through the pool's own error surface.
  pool.on('error', () => {
    /* handled by health checks; a background client died */
  });
  const db = drizzle(pool, { schema });
  return {
    pool,
    db,
    async close() {
      await pool.end();
    },
    async ping() {
      try {
        await pool.query('select 1');
        return true;
      } catch {
        return false;
      }
    },
  };
}

export { schema };
