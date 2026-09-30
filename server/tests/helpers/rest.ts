/**
 * REST helpers over Fastify's in-process injection
 * (`testing-strategy.md` section 3: "Fastify's in-process injection is used for
 * REST").
 */

import type { FastifyInstance } from 'fastify';

export interface Session {
  token: string;
  playerId: string;
}

export interface RoomConfigBody {
  roomName: string;
  maxPlayers: number;
  rounds: number;
  roundDuration: number;
  hints: number;
}

export function bearer(token: string): Record<string, string> {
  return { authorization: 'Bearer ' + token };
}

export const DEFAULT_CONFIG: RoomConfigBody = {
  roomName: 'Test Room',
  maxPlayers: 8,
  rounds: 3,
  roundDuration: 80,
  hints: 2,
};

export async function newSession(
  app: FastifyInstance,
  nickname: string,
): Promise<Session> {
  const created = await app.inject({ method: 'POST', url: '/session' });
  if (created.statusCode !== 201) {
    throw new Error('POST /session failed: ' + created.body);
  }
  const body = created.json() as { playerId: string; sessionToken: string };
  const named = await app.inject({
    method: 'PUT',
    url: '/session/nickname',
    headers: bearer(body.sessionToken),
    payload: { nickname },
  });
  if (named.statusCode !== 200) {
    throw new Error('PUT /session/nickname failed: ' + named.body);
  }
  return { token: body.sessionToken, playerId: body.playerId };
}

export async function createRoom(
  app: FastifyInstance,
  token: string,
  config: Partial<RoomConfigBody> = {},
): Promise<{ roomId: string; roomCode: string; config: RoomConfigBody }> {
  const response = await app.inject({
    method: 'POST',
    url: '/rooms',
    headers: bearer(token),
    payload: { ...DEFAULT_CONFIG, ...config },
  });
  if (response.statusCode !== 201) {
    throw new Error('POST /rooms failed: ' + response.body);
  }
  return response.json();
}

export async function joinRoom(
  app: FastifyInstance,
  token: string,
  roomCode: string,
): Promise<{ statusCode: number; body: unknown }> {
  const response = await app.inject({
    method: 'POST',
    url: '/rooms/join',
    headers: bearer(token),
    payload: { roomCode },
  });
  return { statusCode: response.statusCode, body: response.json() };
}