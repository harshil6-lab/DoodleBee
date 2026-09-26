/**
 * REST client - thin `fetch` wrapper (ADR AD-006, section 10).
 *
 * Responsibilities:
 * - resolve the base URL from environment config (never hardcoded)
 * - normalize failures into user-safe errors (ADR section 20.3)
 * - optionally validate responses with a Zod schema before state merge
 *   (ADR section 20.2)
 *
 * No endpoints are implemented in Stage 02 - the REST surface is locked in
 * the ADR but its concrete contract belongs to Stage 3.
 */
import type { ZodType } from 'zod';
import { env } from '../config/env';

export const DEFAULT_TIMEOUT_MS = 15_000;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  /** JSON-serialized automatically. */
  body?: unknown;
  headers?: Record<string, string>;
  /** Caller-supplied abort signal (combined with the internal timeout). */
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`API ${status}: ${detail}`);
    this.name = 'ApiError';
  }

  /** User-facing message - never exposes infrastructure details. */
  userMessage(): string {
    switch (this.status) {
      case 0:
        return 'Your connection disappeared. Please try again.';
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Session expired. Please re-enter your nickname.';
      case 404:
        return 'Room not found. Check the room code and try again.';
      case 409:
        return 'Room is full or the game has already started.';
      case 429:
        return 'Too many attempts. Please wait a moment.';
      case 500:
        return 'Server error. Please try again.';
      default:
        return `Something went wrong (${this.status}). Please try again.`;
    }
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  schema?: ZodType<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${env.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal ?? controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ApiError(response.status, detail || response.statusText);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const payload: unknown = await response.json();
    if (schema) {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        throw new ApiError(response.status, 'Unexpected response shape');
      }
      return parsed.data;
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out');
    }
    throw new ApiError(
      0,
      error instanceof Error ? error.message : 'Network request failed',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string, schema?: ZodType<T>) =>
    request<T>(path, { method: 'GET' }, schema),
  post: <T>(path: string, body?: unknown, schema?: ZodType<T>) =>
    request<T>(path, { method: 'POST', body }, schema),
  put: <T>(path: string, body?: unknown, schema?: ZodType<T>) =>
    request<T>(path, { method: 'PUT', body }, schema),
};
