/**
 * Error mapping (`testing-strategy.md` section 2, "Error mapping").
 *
 * One vocabulary serves both transports (`api-contract.md` section 5,
 * D03-022), so every code must have a status, a retryability flag and a
 * user-safe message.
 */

import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  ERROR_RETRYABLE,
  ERROR_USER_MESSAGE,
} from '../../../shared/contract/errors.js';

const ALLOWED_STATUSES = new Set([400, 401, 403, 404, 409, 429, 500]);

describe('error taxonomy', () => {
  it('defines a status, retryability and message for every code', () => {
    for (const code of ERROR_CODES) {
      expect(ALLOWED_STATUSES.has(ERROR_HTTP_STATUS[code]), code).toBe(true);
      expect(typeof ERROR_RETRYABLE[code], code).toBe('boolean');
      expect(ERROR_USER_MESSAGE[code].length, code).toBeGreaterThan(0);
    }
  });

  it('marks exactly the documented codes retryable', () => {
    const retryable = ERROR_CODES.filter((code) => ERROR_RETRYABLE[code]);
    expect([...retryable].sort()).toEqual(
      ['BAD_STATE', 'INTERNAL_ERROR', 'RATE_LIMITED'].sort(),
    );
  });

  it('never leaks internals in a user-safe message', () => {
    for (const code of ERROR_CODES) {
      const message = ERROR_USER_MESSAGE[code];
      expect(message, code).not.toContain('stack');
      expect(message, code).not.toContain('Error:');
      expect(message, code).not.toContain(code);
      expect(message, code).not.toContain('secret');
    }
  });
});