/**
 * Word database seed (`data-model.md` section 2.2).
 *
 * The twelve PRD categories. Seeding is a data step run explicitly, not part of
 * service startup. Re-running is safe: the `lower(text)` unique index plus
 * `onConflictDoNothing` makes the insert idempotent.
 */

import { fileURLToPath } from 'node:url';
import { createDatabase, type DatabaseHandle } from './client.js';
import { words } from './schema.js';
import { loadEnvFile, parseEnv } from '../config/env.js';

export const WORD_SEED: ReadonlyArray<{ category: string; entries: string[] }> = [
  { category: 'Animals', entries: ['Elephant', 'Penguin', 'Giraffe', 'Dolphin', 'Squirrel'] },
  { category: 'Food', entries: ['Pizza', 'Sushi', 'Pancake', 'Watermelon', 'Popcorn'] },
  { category: 'Objects', entries: ['Umbrella', 'Telescope', 'Ladder', 'Lantern', 'Compass'] },
  { category: 'Places', entries: ['Beach', 'Castle', 'Airport', 'Volcano', 'Library'] },
  { category: 'People', entries: ['Teacher', 'Chef', 'Astronaut', 'Detective', 'Farmer'] },
  { category: 'Jobs', entries: ['Firefighter', 'Pilot', 'Barber', 'Plumber', 'Photographer'] },
  { category: 'Sports', entries: ['Basketball', 'Surfing', 'Archery', 'Snowboarding', 'Cricket'] },
  { category: 'Technology', entries: ['Smartphone', 'Laptop', 'Satellite', 'Headphones', 'Robot'] },
  { category: 'Nature', entries: ['Rainbow', 'Waterfall', 'Thunderstorm', 'Cactus', 'Glacier'] },
  { category: 'Movies', entries: ['Titanic', 'Inception', 'Godzilla', 'Jaws', 'Rocky'] },
  { category: 'Vehicles', entries: ['Submarine', 'Tractor', 'Helicopter', 'Tram', 'Bulldozer'] },
  { category: 'Actions', entries: ['Juggling', 'Sneezing', 'Diving', 'Skateboarding', 'Yawning'] },
];

export async function seedWords(handle: DatabaseHandle): Promise<number> {
  const rows = WORD_SEED.flatMap((group) =>
    group.entries.map((text) => ({ text, category: group.category })),
  );
  const inserted = await handle.db
    .insert(words)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: words.id });
  return inserted.length;
}

async function main(): Promise<void> {
  loadEnvFile();
  const env = parseEnv();
  const handle = createDatabase(env.DATABASE_URL);
  try {
    const count = await seedWords(handle);
    process.stdout.write('words inserted: ' + count + '\n');
  } finally {
    await handle.close();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(
      'seed failed: ' +
        (error instanceof Error ? error.message : String(error)) +
        '\n',
    );
    process.exitCode = 1;
  });
}
