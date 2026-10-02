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

// ------------------------------------------------------------ Phase 1 endpoints --

/**
 * Fetch client settings defaults and bounds.
 * Used by create-room form to validate against server-authoritative bounds.
 */
export async function getSettings(): Promise<SettingsResponse> {
  return api.get<SettingsResponse>('/settings');
}

/**
 * Create a new room. Returns roomId, roomCode, and config.
 * POST /rooms (`api-contract.md` §3.3).
 */
export interface RoomCreateRequest {
  roomName: string;
  maxPlayers: number;
  rounds: number;
  roundDuration: number;
  hints: number;
}

export async function createRoom(
  body: RoomCreateRequest,
): Promise<import('../types').RoomCreateResponse> {
  return api.post<import('../types').RoomCreateResponse>('/rooms', body);
}

/**
 * Join an existing room by room code.
 * POST /rooms/join (`api-contract.md` §3.4).
 */
export interface RoomJoinRequest {
  roomCode: string;
}

export async function joinRoomByCode(
  body: RoomJoinRequest,
): Promise<import('../types').RoomJoinResponse> {
  return api.post<import('../types').RoomJoinResponse>('/rooms/join', body);
}

/**
 * Update room config (host only, while WAITING).
 * PUT /rooms/:id/config (`api-contract.md` §3.5).
 */
export interface RoomConfigPatch {
  roomName?: string;
  maxPlayers?: number;
  rounds?: number;
  roundDuration?: number;
  hints?: number;
}

export async function updateRoomConfig(
  roomId: string,
  patch: RoomConfigPatch,
): Promise<{ config: import('../types').RoomConfig }> {
  return api.put<{ config: import('../types').RoomConfig }>(
    `/rooms/${encodeURIComponent(roomId)}/config`,
    patch,
  );
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
