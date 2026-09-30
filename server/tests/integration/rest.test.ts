/**
 * REST integration (`testing-strategy.md` section 3).
 *
 * Real Fastify, real PostgreSQL, real Redis. The Redis keyspace and the tables
 * are emptied before each test, so the rate limiters and the room registry
 * start from a known state.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readAggregate, writeAggregate } from '../../src/redis/roomState.js';
import { startHarness, type Harness } from '../helpers/harness.js';
import {
  bearer,
  createRoom,
  DEFAULT_CONFIG,
  joinRoom,
  newSession,
} from '../helpers/rest.js';

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

beforeEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('POST /session', () => {
  it('issues a player id and an opaque token', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/session',
    });
    expect(response.statusCode).toBe(201);
    const body = response.json() as Record<string, unknown>;
    expect(typeof body.playerId).toBe('string');
    expect(typeof body.sessionToken).toBe('string');
    expect(String(body.sessionToken).length).toBeGreaterThan(20);
  });
});

describe('PUT /session/nickname', () => {
  it('stores a valid nickname', async () => {
    const session = await newSession(harness.app, 'hosty');
    const response = await harness.app.inject({
      method: 'PUT',
      url: '/session/nickname',
      headers: bearer(session.token),
      payload: { nickname: 'renamed_1' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ nickname: 'renamed_1' });
  });

  it('rejects an invalid nickname with VALIDATION_ERROR', async () => {
    const session = await newSession(harness.app, 'hosty');
    const response = await harness.app.inject({
      method: 'PUT',
      url: '/session/nickname',
      headers: bearer(session.token),
      payload: { nickname: 'not allowed' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('401s without a bearer token', async () => {
    const response = await harness.app.inject({
      method: 'PUT',
      url: '/session/nickname',
      payload: { nickname: 'x' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });
});

describe('POST /rooms', () => {
  it('creates a room whose creator is the host', async () => {
    const host = await newSession(harness.app, 'hosty');
    const created = await createRoom(harness.app, host.token);
    expect(created.roomCode).toMatch(/^[A-Z2-9]{5,6}$/);
    expect(created.roomCode).not.toMatch(/[OI01FU]/);

    const aggregate = await readAggregate(
      harness.services.redis,
      created.roomId,
    );
    expect(aggregate).not.toBeNull();
    expect(aggregate?.hostPlayerId).toBe(host.playerId);
    expect(aggregate?.status).toBe('WAITING');
    expect(aggregate?.phase).toBe('WAITING');
  });

  it('rejects an out-of-range config with VALIDATION_ERROR', async () => {
    const host = await newSession(harness.app, 'hosty');
    const response = await harness.app.inject({
      method: 'POST',
      url: '/rooms',
      headers: bearer(host.token),
      payload: { ...DEFAULT_CONFIG, maxPlayers: 9 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('401s without a bearer token', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/rooms',
      payload: DEFAULT_CONFIG,
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /rooms/join', () => {
  it('admits a member and reports the room', async () => {
    const host = await newSession(harness.app, 'hosty');
    const guest = await newSession(harness.app, 'guest');
    const room = await createRoom(harness.app, host.token);

    const joined = await joinRoom(harness.app, guest.token, room.roomCode);
    expect(joined.statusCode).toBe(200);
    const body = joined.body as {
      room: { roomId: string; roomCode: string };
      isHost: boolean;
    };
    expect(body.room.roomId).toBe(room.roomId);
    expect(body.room.roomCode).toBe(room.roomCode);
    expect(body.isHost).toBe(false);
  });

  it('normalises a lower-case code', async () => {
    const host = await newSession(harness.app, 'hosty');
    const guest = await newSession(harness.app, 'guest');
    const room = await createRoom(harness.app, host.token);

    const joined = await joinRoom(
      harness.app,
      guest.token,
      room.roomCode.toLowerCase(),
    );
    expect(joined.statusCode).toBe(200);
  });

  it('404s for an unknown code and creates no membership', async () => {
    const guest = await newSession(harness.app, 'guest');
    const joined = await joinRoom(harness.app, guest.token, 'ABCDE');
    expect(joined.statusCode).toBe(404);
    expect(joined.body).toMatchObject({ error: { code: 'ROOM_NOT_FOUND' } });
  });

  it('409s ROOM_FULL when the capacity is reached', async () => {
    const host = await newSession(harness.app, 'hosty');
    const second = await newSession(harness.app, 'second');
    const third = await newSession(harness.app, 'third');
    const room = await createRoom(harness.app, host.token, { maxPlayers: 2 });

    const admitted = await joinRoom(harness.app, second.token, room.roomCode);
    expect(admitted.statusCode).toBe(200);

    const refused = await joinRoom(harness.app, third.token, room.roomCode);
    expect(refused.statusCode).toBe(409);
    expect(refused.body).toMatchObject({ error: { code: 'ROOM_FULL' } });
  });

  it('409s ROOM_ALREADY_STARTED once the room is in game', async () => {
    const host = await newSession(harness.app, 'hosty');
    const guest = await newSession(harness.app, 'guest');
    const room = await createRoom(harness.app, host.token);

    // `room.status` has one writer that persists to both stores
    // (`server-state-writer-map.md`): Redis holds the live aggregate while
    // `rooms.status` is the durable mirror that admission reads. Set both so the
    // test reproduces a real post-`game:start` state, not a half-written one.
    const aggregate = await readAggregate(harness.services.redis, room.roomId);
    if (aggregate === null) throw new Error('room missing');
    aggregate.status = 'IN_GAME';
    await writeAggregate(harness.services.redis, aggregate);
    await harness.db.pool.query('UPDATE rooms SET status = $1 WHERE id = $2', [
      'IN_GAME',
      room.roomId,
    ]);

    const refused = await joinRoom(harness.app, guest.token, room.roomCode);
    expect(refused.statusCode).toBe(409);
    expect(refused.body).toMatchObject({
      error: { code: 'ROOM_ALREADY_STARTED' },
    });
  });
});

describe('PUT /rooms/:id/config', () => {
  it('lets the host update the config and broadcasts the change', async () => {
    const host = await newSession(harness.app, 'hosty');
    const room = await createRoom(harness.app, host.token);
    const response = await harness.app.inject({
      method: 'PUT',
      url: '/rooms/' + room.roomId + '/config',
      headers: bearer(host.token),
      payload: { rounds: 5 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ config: { rounds: 5 } });
  });

  it('403s for a non-host member', async () => {
    const host = await newSession(harness.app, 'hosty');
    const guest = await newSession(harness.app, 'guest');
    const room = await createRoom(harness.app, host.token);
    await joinRoom(harness.app, guest.token, room.roomCode);

    const response = await harness.app.inject({
      method: 'PUT',
      url: '/rooms/' + room.roomId + '/config',
      headers: bearer(guest.token),
      payload: { rounds: 5 },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('409s BAD_STATE once the game has left WAITING', async () => {
    const host = await newSession(harness.app, 'hosty');
    const room = await createRoom(harness.app, host.token);

    const aggregate = await readAggregate(harness.services.redis, room.roomId);
    if (aggregate === null) throw new Error('room missing');
    aggregate.phase = 'ROUND_ACTIVE';
    await writeAggregate(harness.services.redis, aggregate);

    const response = await harness.app.inject({
      method: 'PUT',
      url: '/rooms/' + room.roomId + '/config',
      headers: bearer(host.token),
      payload: { rounds: 5 },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'BAD_STATE' } });
  });
});

describe('GET /health', () => {
  it('reports both dependencies as ok', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      dependencies: { postgres: 'ok', redis: 'ok' },
    });
  });
});

describe('GET /settings', () => {
  it('exposes the shared bounds and the proposed defaults', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/settings',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      limits: { minPlayers: number; maxPlayers: number };
      defaults: Record<string, unknown>;
    };
    expect(body.limits).toMatchObject({ minPlayers: 2, maxPlayers: 8 });
    expect(body.defaults).toHaveProperty('roundDuration');
  });
});