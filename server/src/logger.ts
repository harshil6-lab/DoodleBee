/**
 * Logging foundation (`docs/AGENTS.md` sections 13 and 10).
 *
 * Fastify ships pino, so no extra dependency is added. The redaction list is
 * the mechanical half of the secret-word protection
 * (`security-model.md` section 3.5): even if a handler accidentally logs an
 * object that carries the word or a session token, it is censored.
 */

import type { FastifyServerOptions } from 'fastify';

/** Paths censored in every log line. */
export const REDACT_PATHS = [
  'secretWord',
  '*.secretWord',
  'round.secretWord',
  'secret',
  '*.secret',
  'token',
  '*.token',
  'sessionToken',
  '*.sessionToken',
  'req.headers.authorization',
  'headers.authorization',
];

export const LOG_CENSOR = '[redacted]';

export interface LoggerConfig {
  level: string;
}

export function loggerOptions(config: LoggerConfig): FastifyServerOptions['logger'] {
  return {
    level: config.level,
    redact: { paths: REDACT_PATHS, censor: LOG_CENSOR },
  };
}
