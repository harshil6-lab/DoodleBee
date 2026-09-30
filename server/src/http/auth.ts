/**
 * Bearer authentication for REST (`api-contract.md` section 4, D03-019).
 *
 * The same opaque token the socket handshake carries. The token is never
 * logged or echoed; only the resolved session leaves this module.
 */

import { AppError } from '../errors.js';
import type { FastifyRequest } from 'fastify';
import type { Services } from '../game/services.js';
import type { SessionRecord } from '../game/types.js';

export interface AuthenticatedRequest {
  session: SessionRecord;
  token: string;
}

export async function authenticate(
  services: Services,
  request: FastifyRequest,
): Promise<AuthenticatedRequest> {
  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token.length === 0) throw new AppError('UNAUTHENTICATED');
  const session = await services.session.require(token);
  return { session, token };
}
