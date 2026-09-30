import { defineConfig } from 'drizzle-kit';

// drizzle-kit does not read `.env` itself; load it when present (Node >= 22).
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: fall back to the ambient environment.
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
