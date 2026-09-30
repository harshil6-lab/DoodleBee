/**
 * The REST error envelope (`api-contract.md` section 5, D03-022).
 *
 * One vocabulary serves both transports. Internal detail is logged with the
 * request but never returned; the correlation id is deliberately NOT exposed.
 */

import { ZodError } from 'zod';
import { ERROR_HTTP_STATUS } from '../../../shared/contract/errors.js';
import { AppError, isAppError } from '../errors.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Normalise any thrown value to the shared taxonomy. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof ZodError) return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL_ERROR');
}

export function sendError(reply: FastifyReply, error: unknown): FastifyReply {
  const appError = toAppError(error);
  return reply
    .code(ERROR_HTTP_STATUS[appError.code])
    .send({ error: { code: appError.code, message: appError.message } });
}

export function handleRequestError(
  this: void,
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const appError = toAppError(error);
  if (appError.code === 'INTERNAL_ERROR') {
    request.log.error({ err: error, url: request.url }, 'request failed');
  }
  void sendError(reply, appError);
}
