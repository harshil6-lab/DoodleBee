/**
 * The Fastify application (`api-contract.md` sections 2, 5 and 7).
 *
 * The app owns three things only: the pino logger the whole process shares,
 * the REST error envelope, and route registration. Its HTTP server
 * (`app.server`) is also what Socket.IO attaches to, so one port serves both
 * transports - V1 is a single backend service (D03-031).
 *
 * CORS is deliberately absent: the mobile client is not a browser, so
 * `@fastify/cors` is not installed (`api-contract.md` section 7).
 */

import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from './config/env.js';
import type { Services } from './game/services.js';
import { handleRequestError } from './http/errors.js';
import { registerRoutes } from './http/routes/index.js';
import { loggerOptions } from './logger.js';

/** A Fastify instance with the logger and the shared error envelope installed. */
export function createApp(env: Env): FastifyInstance {
  const app = Fastify({ logger: loggerOptions({ level: env.LOG_LEVEL }) });
  app.setErrorHandler(handleRequestError);
  return app;
}

/**
 * Register the REST surface. Called after the service container exists, because
 * every route resolves identity and state through it
 * (`server-state-writer-map.md` section 1 rule 5).
 */
export function registerApi(app: FastifyInstance, services: Services): void {
  registerRoutes(app, services);
}