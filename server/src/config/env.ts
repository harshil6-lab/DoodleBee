/**
 * Environment configuration (`docs/AGENTS.md` section 27).
 *
 * No credential is ever hardcoded; every value comes from the environment and
 * is validated once at startup so a misconfiguration fails fast and loudly.
 */

import { z } from 'zod';

const LogLevelSchema = z.enum([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
]);

export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  // 0 is the "bind an ephemeral port" sentinel: Fastify maps it to an
  // OS-assigned port. It is used by the integration harness
  // (`tests/helpers/harness.ts`) so suites never fight over a fixed port.
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: LogLevelSchema.default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnvFile(path = '.env'): void {
  try {
    process.loadEnvFile(path);
  } catch {
    // Absent .env is normal in CI; the ambient environment is used instead.
  }
}

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => issue.path.join('.') + ': ' + issue.message)
      .join('; ');
    throw new Error('Invalid server environment: ' + detail);
  }
  return parsed.data;
}
