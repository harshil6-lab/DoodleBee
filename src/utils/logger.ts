/**
 * Safe logging utility (ADR section 9.4).
 *
 * Every log payload is scrubbed before it reaches the console: sensitive
 * fields (secret word, credentials) are redacted and identity fields can be
 * masked. Application code should log through this module rather than
 * calling `console` directly.
 */
export const REDACTED = '[redacted]';
export const DEPTH_LIMIT = '[depth-limit]';

const DEFAULT_EXCLUDED_FIELDS = ['secretWord', 'password', 'token'];
const DEFAULT_MASKED_FIELDS = ['nickname'];
const MAX_DEPTH = 6;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  /** Field names replaced with `[redacted]` anywhere in the payload. */
  excludeFields?: string[];
  /** String field names reduced to their first two characters. */
  maskFields?: string[];
}

export interface Logger {
  /** Returns a scrubbed copy of the payload - performs no output. */
  sanitize: (payload: unknown) => unknown;
  debug: (payload: unknown) => void;
  info: (payload: unknown) => void;
  warn: (payload: unknown) => void;
  error: (payload: unknown) => void;
}

function maskString(value: string): string {
  return `${value.slice(0, 2)}***`;
}

function scrub(
  value: unknown,
  excluded: Set<string>,
  masked: Set<string>,
  depth: number,
): unknown {
  if (depth > MAX_DEPTH) {
    return DEPTH_LIMIT;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => scrub(entry, excluded, masked, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (excluded.has(key)) {
        result[key] = REDACTED;
      } else if (masked.has(key) && typeof entry === 'string') {
        result[key] = maskString(entry);
      } else {
        result[key] = scrub(entry, excluded, masked, depth + 1);
      }
    }
    return result;
  }
  return value;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const excluded = new Set([
    ...DEFAULT_EXCLUDED_FIELDS,
    ...(options.excludeFields ?? []),
  ]);
  const masked = new Set([
    ...DEFAULT_MASKED_FIELDS,
    ...(options.maskFields ?? []),
  ]);

  const sanitize = (payload: unknown): unknown =>
    scrub(payload, excluded, masked, 0);
  const emit = (level: LogLevel, payload: unknown): void => {
    const safe = sanitize(payload);
    if (level === 'error') {
      console.error(safe);
    } else if (level === 'warn' || __DEV__) {
      console.warn(safe);
    }
  };

  return {
    sanitize,
    debug: (payload) => emit('debug', payload),
    info: (payload) => emit('info', payload),
    warn: (payload) => emit('warn', payload),
    error: (payload) => emit('error', payload),
  };
}

export const logger = createLogger();
