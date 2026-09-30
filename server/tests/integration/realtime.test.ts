/**
 * Realtime integration (`testing-strategy.md` section 3 and 5).
 *
 * A real `socket.io-client` against a real Socket.IO server. Time is injected:
 * the STARTING countdown, the round deadline and the grace periods are crossed
 * by advancing the harness clock and calling `services.sweep()`, exactly as
 * section 6.1 requires.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DRAWER_GRACE_MS,
  RESULTS_WINDOW_MS,
  STARTING_WINDOW_MS,
} from '../../../shared/contract/constants.js';
import { readAggregate } from '../../src/redis/roomState.js';
import { connectClient, eventIds, type TestClient } from '../helpers/client.js';
import { beginRound, connectPlayer, emitFail, emitOk, type Player } from '../helpers/game.js';
import { startHarness, type Harness } from '../helpers/harness.js';
import { createRoom, joinRoom, newSession } from '../helpers/rest.js';

let harness: Harness;
const open: TestClient[] = [];

const ids = eventIds('rt');

beforeAll(async () => {
  harness = await startHarness();
});

beforeEach(async () => {
  await harness.reset();
});

afterEach(() => {
  for (const client of open) client.close();
  open.length = 0;
});

afterAll(async () => {
  await harness.close();
});

/** A REST session plus a connected socket, tracked for cleanup. */
async function player(nickname: string): Promise<Player> {
  const session = await newSession(harness.app, nickname);
  const connected = await connectPlayer(harness, session, nickname);
  open.push(connected.client);
  return connected;
}

/** A room where `host` created it and every guest was admitted over REST. */
async function roomWith(
  host: Player,
  guests: readonly Player[],
  config: Record<string, unknown> = {},
): Promise<{ roomId: string; roomCode: string }> {
  const room = await createRoom(harness.app, host.session.token, config);
  for (const guest of guests) {
    const joined = await joinRoom(harness.app, guest.session.token, room.roomCode);
    expect(joined.statusCode, guest.nickname).toBe(200);
  }
  return { roomId: room.roomId, roomCode: room.roomCode };
}

describe('connection lifecycle', () => {
  it('rejects a handshake with no token and closes the socket', async () => {
    const socket = await connectClient(harness.url, '');
    open.push(socket);
    const lost = (await socket.waitFor('connection:lost')) as { code: string };
    expect(lost.code).toBe('UNAUTHENTICATED');
    expect(socket.all('drawer:selected')).toEqual([]);
  });

  it('rejects an unknown token as SESSION_EXPIRED', async () => {
    const socket = await connectClient(harness.url, 'not-a-real-token');
    open.push(socket);
    const lost = (await socket.waitFor('connection:lost')) as { code: string };
    expect(lost.code).toBe('SESSION_EXPIRED');
  });
});

describe('join:room', () => {
  it('binds an admitted socket and announces it to the room', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    await host.client.emit('join:room', { eventId: ids(), roomCode: room.roomCode });

    const joinedNotice = host.client.waitFor('player:joined');
    const ack = await guest.client.emit('join:room', {
      eventId: ids(),
      roomCode: room.roomCode,
    });
    expect(ack.ok).toBe(true);
    const body = ack as unknown as Record<string, unknown>;
    expect(body.channel).toBe('room:' + room.roomId);
    expect((body.room as { roomId: string }).roomId).toBe(room.roomId);
    expect((body.you as { role: string }).role).toBe('GUESSER');

    const notice = (await joinedNotice) as { player: { playerId: string } };
    expect(notice.player.playerId).toBe(guest.session.playerId);
  });

  it('404s an unknown code', async () => {
    const host = await player('hosty');
    const ack = await host.client.emit('join:room', {
      eventId: ids(),
      roomCode: 'ABCDE',
    });
    expect(ack.ok).toBe(false);
    expect((ack as unknown as { code: string }).code).toBe('ROOM_NOT_FOUND');
  });

  it('refuses gameplay from a socket that never joined', async () => {
    const host = await player('hosty');
    await roomWith(host, []);
    const ack = await host.client.emit('game:start', { eventId: ids() });
    // The socket is authenticated but not bound to a room.
    expect(ack.ok).toBe(false);
    expect((ack as unknown as { code: string }).code).toBe('NOT_ADMITTED');
  });

  it('leaves the room and announces the departure', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    await host.client.emit('join:room', { eventId: ids(), roomCode: room.roomCode });
    await guest.client.emit('join:room', { eventId: ids(), roomCode: room.roomCode });

    const leftNotice = host.client.waitFor('player:left');
    const ack = await guest.client.emit('leave:room', { eventId: ids() });
    expect(ack.ok).toBe(true);
    expect((ack as unknown as { left: boolean }).left).toBe(true);

    const notice = (await leftNotice) as { playerId: string };
    expect(notice.playerId).toBe(guest.session.playerId);
  });
});

describe('game start and drawer selection', () => {
  it('walks WAITING -> STARTING -> ROUND_ACTIVE and splits the drawer payload', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    // Both sockets must be bound: the roster that gates the start counts
    // connected sockets, not REST admissions.
    await host.client.emit('join:room', { eventId: ids(), roomCode: room.roomCode });
    await guest.client.emit('join:room', { eventId: ids(), roomCode: room.roomCode });

    const started = host.client.waitFor('game:started');
    const ack = await emitOk(host, 'game:start', {});
    expect(ack.version).toBeGreaterThan(0);
    await started;

    const aggregate = await readAggregate(harness.services.redis, room.roomId);
    expect(aggregate?.phase).toBe('STARTING');
    expect(aggregate?.status).toBe('IN_GAME');

    // Subscribe before the sweep so no emitted payload can be missed.
    const selections = [host, guest].map((member) =>
      member.client.waitFor('drawer:selected'),
    );
    harness.clock.advance(STARTING_WINDOW_MS + 1);
    await harness.services.sweep();
    await Promise.all(selections);

    const round = await readAggregate(harness.services.redis, room.roomId);
    expect(round?.phase).toBe('ROUND_ACTIVE');
    expect(round?.drawerPlayerId).not.toBeNull();

    const drawer = round?.drawerPlayerId === host.session.playerId ? host : guest;
    const guesser = drawer === host ? guest : host;

    const privateSelections = drawer.client.all('drawer:selected') as {
      secretWord?: string;
      playerId: string;
    }[];
    const publicSelections = guesser.client.all('drawer:selected') as {
      secretWord?: string;
      playerId: string;
    }[];

    expect(privateSelections).toHaveLength(1);
    expect(typeof privateSelections[0]?.secretWord).toBe('string');
    expect(publicSelections).toHaveLength(1);
    expect('secretWord' in (publicSelections[0] ?? {})).toBe(false);
  });

  it('409s a second game:start while the game is running', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    await beginRound(harness, [host, guest], room, host);

    const failure = await emitFail(host, 'game:start', {});
    expect(failure.code).toBe('BAD_STATE');
    expect(failure.retryable).toBe(true);
  });

  it('403s game:start from a non-host', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    await host.client.emit('join:room', { eventId: ids(), roomCode: room.roomCode });
    await guest.client.emit('join:room', { eventId: ids(), roomCode: room.roomCode });

    const failure = await emitFail(guest, 'game:start', {});
    expect(failure.code).toBe('FORBIDDEN');
  });
});

describe('guessing', () => {
  it('echoes a wrong guess as chat and never leaks the word', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    const round = await beginRound(harness, [host, guest], room, host);
    const guesser = round.guessers[0];
    if (guesser === undefined) throw new Error('no guesser');

    const echoed = round.drawer.client.waitFor('guess:submitted');
    const ack = await emitOk(guesser, 'guess:submit', { guess: 'definitely-wrong' });
    expect(ack.result).toBe('WRONG');
    expect(JSON.stringify(ack)).not.toContain(round.secretWord);

    const payload = (await echoed) as { result: string; text: string };
    expect(payload.result).toBe('WRONG');
    expect(payload.text).toBe('definitely-wrong');
  });

  it('ranks a correct guess, scores it, and refuses a second attempt', async () => {
    const host = await player('hosty');
    const second = await player('second');
    const third = await player('third');
    const room = await roomWith(host, [second, third]);
    // Two guessers, so the round survives the first correct answer and a repeat
    // attempt is still a duplicate rather than a closed round.
    const round = await beginRound(harness, [host, second, third], room, host);
    expect(round.guessers).toHaveLength(2);
    const guesser = round.guessers[0];
    if (guesser === undefined) throw new Error('no guesser');

    const correctNotice = round.drawer.client.waitFor('guess:correct');
    const ack = await emitOk(guesser, 'guess:submit', { guess: round.secretWord });
    expect(ack.result).toBe('CORRECT');
    expect(ack.rank).toBe(1);
    expect(ack.points).toBe(500);

    const notice = (await correctNotice) as { rank: number; points: number };
    expect(notice.rank).toBe(1);
    expect(notice.points).toBe(500);

    const again = await emitFail(guesser, 'guess:submit', { guess: round.secretWord });
    expect(again.code).toBe('ALREADY_GUESSED');
  });

  it('refuses a guess from the drawer', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    const round = await beginRound(harness, [host, guest], room, host);

    const failure = await emitFail(round.drawer, 'guess:submit', { guess: 'anything' });
    expect(failure.code).toBe('DRAWER_CANNOT_GUESS');
  });

  it('applies a duplicate eventId exactly once and replays the cached ack', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    const round = await beginRound(harness, [host, guest], room, host);
    const guesser = round.guessers[0];
    if (guesser === undefined) throw new Error('no guesser');

    const eventId = 'duplicate-1';
    const first = await guesser.client.emit('guess:submit', {
      eventId,
      guess: 'definitely-wrong',
    });
    const second = await guesser.client.emit('guess:submit', {
      eventId,
      guess: 'definitely-wrong',
    });
    expect(first).toEqual(second);
    // The echo happened once, not twice.
    expect(
      round.drawer.client.all('guess:submitted').length,
    ).toBe(1);
  });

  it('gives simultaneous correct guessers distinct ranks', async () => {
    const host = await player('hosty');
    const first = await player('first');
    const second = await player('second');
    const room = await roomWith(host, [first, second]);
    const round = await beginRound(harness, [host, first, second], room, host);
    expect(round.guessers).toHaveLength(2);

    const word = round.secretWord;
    const [firstGuesser, secondGuesser] = round.guessers;
    if (firstGuesser === undefined || secondGuesser === undefined) {
      throw new Error('expected two guessers');
    }
    const [ackA, ackB] = await Promise.all([
      firstGuesser.client.emit('guess:submit', {
        eventId: 'sim-a',
        guess: word,
      }),
      secondGuesser.client.emit('guess:submit', {
        eventId: 'sim-b',
        guess: word,
      }),
    ]);
    const ranks = [ackA, ackB].map((ack) => (ack as unknown as { rank: number }).rank);
    expect([...ranks].sort()).toEqual([1, 2]);
    const points = [ackA, ackB].map(
      (ack) => (ack as unknown as { points: number }).points,
    );
    expect([...points].sort((a, b) => b - a)).toEqual([500, 350]);
  });
});

describe('round end and scoring', () => {
  it('ends the round when every guesser is correct and then finishes the game', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest], { rounds: 1 });
    const round = await beginRound(harness, [host, guest], room, host);
    const guesser = round.guessers[0];
    if (guesser === undefined) throw new Error('no guesser');

    const ended = host.client.waitFor('round:ended');
    await emitOk(guesser, 'guess:submit', { guess: round.secretWord });

    const roundEnded = (await ended) as {
      endReason: string;
      word: string;
      rankings: { playerId: string; points: number }[];
      drawerPoints: number;
    };
    expect(roundEnded.endReason).toBe('ALL_GUESSERS_CORRECT');
    expect(roundEnded.word).toBe(round.secretWord);
    expect(roundEnded.rankings).toHaveLength(1);
    expect(roundEnded.rankings[0]?.points).toBe(500);
    expect(roundEnded.drawerPoints).toBe(50);

    const finished = host.client.waitFor('game:finished');
    harness.clock.advance(RESULTS_WINDOW_MS + 1);
    await harness.services.sweep();

    const gameFinished = (await finished) as {
      finalScores: Record<string, number>;
    };
    expect(gameFinished.finalScores[guesser.session.playerId]).toBe(500);
    expect(gameFinished.finalScores[round.drawerPlayerId]).toBe(50);
  });

  it('ends the round by DRAWER_ABANDONED when the drawer never returns', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    const round = await beginRound(harness, [host, guest], room, host);
    const guesser = round.guessers[0];
    if (guesser === undefined) throw new Error('no guesser');

    const disconnected = guesser.client.waitFor('player:disconnected');
    round.drawer.client.socket.close();
    await disconnected;

    const paused = await readAggregate(harness.services.redis, room.roomId);
    expect(paused?.roundTimerPaused).toBe(true);

    const ended = guesser.client.waitFor('round:ended');
    harness.clock.advance(DRAWER_GRACE_MS + 1);
    await harness.services.sweep();

    const roundEnded = (await ended) as {
      endReason: string;
      drawerPoints: number;
    };
    expect(roundEnded.endReason).toBe('DRAWER_ABANDONED');
    expect(roundEnded.drawerPoints).toBe(0);
  });
});

describe('drawing', () => {
  it('relays strokes to the room but never back to the drawer', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    const round = await beginRound(harness, [host, guest], room, host);
    const guesser = round.guessers[0];
    if (guesser === undefined) throw new Error('no guesser');

    const received = guesser.client.waitFor('draw:start');
    await emitOk(round.drawer, 'draw:start', {
      strokeId: 'stroke-1',
      strokeSeq: 0,
      color: '#ff0000',
      brushSize: 4,
      points: [{ x: 1, y: 2 }],
    });
    const payload = (await received) as { strokeId: string };
    expect(payload.strokeId).toBe('stroke-1');
    expect(round.drawer.client.all('draw:start')).toEqual([]);
  });

  it('rejects drawing from a non-drawer and broadcasts nothing', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    const round = await beginRound(harness, [host, guest], room, host);
    const guesser = round.guessers[0];
    if (guesser === undefined) throw new Error('no guesser');

    const failure = await emitFail(guesser, 'draw:start', {
      strokeId: 'stroke-x',
      strokeSeq: 0,
      color: '#ff0000',
      brushSize: 4,
      points: [{ x: 1, y: 2 }],
    });
    expect(failure.code).toBe('NOT_DRAWER');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(round.drawer.client.all('draw:start')).toEqual([]);
  });

  it('drops a non-monotonic drawing batch', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    const round = await beginRound(harness, [host, guest], room, host);
    const guesser = round.guessers[0];
    if (guesser === undefined) throw new Error('no guesser');

    await emitOk(round.drawer, 'draw:start', {
      strokeId: 'stroke-2',
      strokeSeq: 0,
      color: '#ff0000',
      brushSize: 4,
      points: [{ x: 1, y: 2 }],
    });
    const moved = await emitOk(round.drawer, 'draw:move', {
      strokeId: 'stroke-2',
      pointIndex: 5,
      points: [{ x: 3, y: 4 }],
    });
    expect(moved.applied).toBe(true);

    const dropped = await emitOk(round.drawer, 'draw:move', {
      strokeId: 'stroke-2',
      pointIndex: 2,
      points: [{ x: 9, y: 9 }],
    });
    expect(dropped.applied).toBe(false);
  });
});

describe('chat and hints', () => {
  it('broadcasts chat to the room', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    await beginRound(harness, [host, guest], room, host);

    const received = guest.client.waitFor('chat:message');
    const ack = await emitOk(host, 'chat:message', { text: 'hello there' });
    expect(typeof ack.messageId).toBe('string');
    const payload = (await received) as { text: string };
    expect(payload.text).toBe('hello there');
  });

  it('reveals a hint to the drawer and refuses everyone else', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    const round = await beginRound(harness, [host, guest], room, host);
    const guesser = round.guessers[0];
    if (guesser === undefined) throw new Error('no guesser');

    const revealed = guesser.client.waitFor('hint:revealed');
    const ack = await emitOk(round.drawer, 'hint:request', {});
    expect(ack.hintsRemaining).toBe(1);
    expect(Array.isArray(ack.revealedPositions)).toBe(true);
    expect(String(ack.maskedWord)).toContain('_');

    const payload = (await revealed) as { hintsRemaining: number };
    expect(payload.hintsRemaining).toBe(1);

    const failure = await emitFail(guesser, 'hint:request', {});
    expect(failure.code).toBe('NOT_DRAWER');
  });
});

describe('snapshot and reconnect', () => {
  it('restores a guesser without the secret and a drawer with it', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    const round = await beginRound(harness, [host, guest], room, host);
    const guesser = round.guessers[0];
    if (guesser === undefined) throw new Error('no guesser');

    const guesserSnapshot = guesser.client.waitFor('response:state:snapshot');
    await emitOk(guesser, 'request:state:snapshot', {});
    const fromGuesser = (await guesserSnapshot) as {
      round: { maskedWord: string; secretWord?: string };
    };
    expect(fromGuesser.round.maskedWord).toBe(round.maskedWord);
    expect('secretWord' in fromGuesser.round).toBe(false);
    expect(JSON.stringify(fromGuesser)).not.toContain(round.secretWord);

    const drawerSnapshot = round.drawer.client.waitFor('response:state:snapshot');
    await emitOk(round.drawer, 'request:state:snapshot', {});
    const fromDrawer = (await drawerSnapshot) as {
      round: { secretWord?: string };
    };
    expect(fromDrawer.round.secretWord).toBe(round.secretWord);
  });

  it('restores a reconnecting member and announces the reconnect', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    const round = await beginRound(harness, [host, guest], room, host);
    const guesser = round.guessers[0];
    if (guesser === undefined) throw new Error('no guesser');

    const gone = round.drawer.client.waitFor('player:disconnected');
    guesser.client.socket.close();
    await gone;

    const back = await connectClient(harness.url, guesser.session.token);
    open.push(back);
    const reconnected = round.drawer.client.waitFor('player:reconnected');
    const ack = await back.emit('join:room', {
      eventId: ids(),
      roomCode: room.roomCode,
    });
    expect(ack.ok).toBe(true);
    expect((ack as unknown as { reconnected: boolean }).reconnected).toBe(true);
    const notice = (await reconnected) as { playerId: string };
    expect(notice.playerId).toBe(guesser.session.playerId);

    const snapshot = back.waitFor('response:state:snapshot');
    await back.emit('request:state:snapshot', { eventId: ids() });
    const restored = (await snapshot) as {
      version: number;
      round: { drawerPlayerId: string };
    };
    expect(restored.round.drawerPlayerId).toBe(round.drawerPlayerId);
    expect(restored.version).toBeGreaterThan(0);
  });
});

describe('envelope and validation', () => {
  it('answers a malformed payload with VALIDATION_ERROR and changes nothing', async () => {
    const host = await player('hosty');
    const guest = await player('guest');
    const room = await roomWith(host, [guest]);
    await host.client.emit('join:room', { eventId: ids(), roomCode: room.roomCode });
    await guest.client.emit('join:room', { eventId: ids(), roomCode: room.roomCode });

    const ack = await guest.client.emit('chat:message', {
      eventId: ids(),
      text: '',
    });
    expect(ack.ok).toBe(false);
    expect((ack as unknown as { code: string }).code).toBe('VALIDATION_ERROR');
    expect((ack as unknown as { retryable: boolean }).retryable).toBe(false);
  });

  it('rate limits snapshot requests per socket', async () => {
    const host = await player('hosty');
    const room = await roomWith(host, []);
    await host.client.emit('join:room', {
      eventId: ids(),
      roomCode: room.roomCode,
    });

    let limited = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const ack = await host.client.emit('request:state:snapshot', {
        eventId: ids(),
      });
      if (ack.ok === false && (ack as unknown as { code: string }).code === 'RATE_LIMITED') {
        limited += 1;
      }
    }
    expect(limited).toBeGreaterThanOrEqual(1);
  });
});

