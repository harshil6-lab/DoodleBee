/**
 * Migration runner (`data-model.md` section 6).
 *
 * Migrations are checked-in generated files applied by an explicit command,
 * never on service start ("No auto-migration on service start").
 */

import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './client.js';
import { loadEnvFile, parseEnv } from '../config/env.js';

export async function runMigrations(
  databaseUrl: string,
  migrationsFolder: string,
): Promise<void> {
  const handle = createDatabase(databaseUrl);
  try {
    await migrate(handle.db, { migrationsFolder });
  } finally {
    await handle.close();
  }
}

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

async function main(): Promise<void> {
  loadEnvFile();
  const env = parseEnv();
  await runMigrations(env.DATABASE_URL, migrationsFolder);
  process.stdout.write('migrations applied\n');
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(
      'migration failed: ' +
        (error instanceof Error ? error.message : String(error)) +
        '\n',
    );
    process.exitCode = 1;
  });
}
