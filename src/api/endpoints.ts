/**
 * REST endpoint layer (D04-016).
 *
 * Typed wrappers around `src/api/client.ts` for every endpoint in
 * `api-contract.md` §3. Phase 0 implements only what is needed by the
 * home screen and session flow.
 *
 * All endpoints use the existing `ApiError` error taxonomy — no new codes.
 */
import { api, ApiError } from './client';

// ------------------------------------------------------------------ Types -----

/** `POST /session` response (`api-contract.md` §3.1). */
export interface SessionResponse {
  playerId: string;
  sessionToken: string;
  nickname: string | null;
}

/** `GET /settings` response (`api-contract.md` §3.6). */
export interface SettingsResponse {
  defaults: {
    maxPlayers: number;
    rounds: number;
    roundDuration: number;
    hints: number;
  };
  limits: {
    minPlayers: number;
    maxPlayers: number;
    minRounds: number;
    maxRounds: number;
    minRoundDuration: number;
    maxRoundDuration: number;
    minHints: number;
    maxHints: number;
  };
}

// ---------------------------------------------------------- Phase 0 endpoints --

/**
 * Create a guest session. Returns playerId + sessionToken.
 * Used by the nickname screen to establish identity.
 */
export async function createSession(): Promise<SessionResponse> {
  return api.post<SessionResponse>('/session');
}

/**
 * Fetch client settings defaults and bounds.
 * Used by create-room form to validate against server-authoritative bounds.
 */
export async function getSettings(): Promise<SettingsResponse> {
  return api.get<SettingsResponse>('/settings');
}

// ------------------------------------------------------------ Type guards -----

/** Narrow an ApiError to a specific HTTP status code. */
export function isErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

/** Check if the error indicates a network/timeout failure (status 0). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}
