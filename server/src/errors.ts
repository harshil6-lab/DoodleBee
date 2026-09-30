/**
 * Internal error type and its mapping to the shared taxonomy (D03-022).
 *
 * Handlers throw `AppError`; the boundary (REST error handler, socket ack
 * wrapper) converts it to `{ code, message, retryable }`. Internal exception
 * detail is logged, never returned (`api-contract.md` section 5.1).
 */

import {
  ERROR_RETRYABLE,
  ERROR_USER_MESSAGE,
  type ErrorCode,
} from '../../shared/contract/errors.js';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? ERROR_USER_MESSAGE[code]);
    this.name = 'AppError';
    this.code = code;
    this.retryable = ERROR_RETRYABLE[code];
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** A user-safe message for a code: never infrastructure detail. */
export function userMessageFor(code: ErrorCode): string {
  return ERROR_USER_MESSAGE[code];
}
