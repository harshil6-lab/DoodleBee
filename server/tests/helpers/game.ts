/**
 * Game-flow helpers built on the real harness and real sockets.
 */

import { expect } from 'vitest';
import { STARTING_WINDOW_MS } from '../../../shared/contract/constants.js';
import { eventIds } from './client.js';
import { connectClient, type TestClient } from './client.js';
import type { Harness } from './harness.js';
import type { Session } from './rest.js';

export interface Player {
  session: Session;
  client: TestClient;
  nickname: string;
}

export async function connectPlayer(
  harness: Harness,
  session: Session,
  nickname: string,
): Promise<Player> {
  const client = await connectClient(harness.url, session.token);
  return { session, client, nickname };
}

export interface RoundInfo {
  roomId: string;
  roomCode: string;
  drawerPlayerId: string;
  drawer: Player;
  guessers: Player[];
  secretWord: string;
  maskedWord: string;
  roundNumber: number;
}

const ids = eventIds('game');

/** Bind every player's socket to the room. */
export async function joinAll(
  players: readonly Player[],
  roomCode: string,
): Promise<void> {
  for (const player of players) {
    const ack = await player.client.emit('join:room', {
      eventId: ids(),
      roomCode,
    });
    expect(ack.ok, 'join:room for ' + player.nickname).toBe(true);
  }
}

/**
 * Host starts the game and the clock is advanced past the STARTING countdown,
 * so the round becomes live without any test sleeping on wall-clock time.
 */
export async function beginRound(
  harness: Harness,
  players: readonly Player[],
  room: { roomId: string; roomCode: string },
  host: Player,
): Promise<RoundInfo> {
  await joinAll(players, room.roomCode);

  const drawerSelections = players.map((player) =>
    player.client.waitFor('drawer:selected'),
  );
  const roundStarted = host.client.waitFor('round:started');

  const ack = await host.client.emit('game:start', { eventId: ids() });
  expect(ack.ok, 'game:start').toBe(true);

  harness.clock.advance(STARTING_WINDOW_MS + 1);
  await harness.services.sweep();

  const started = (await roundStarted) as {
    drawerPlayerId: string;
    maskedWord: string;
    roundNumber: number;
  };
  await Promise.all(drawerSelections);

  const drawerPlayerId = started.drawerPlayerId;
  const drawer = players.find(
    (player) => player.session.playerId === drawerPlayerId,
  );
  if (drawer === undefined) throw new Error('drawer is not one of the players');

  const privateSelection = drawer.client
    .all('drawer:selected')
    .find(
      (payload): payload is { secretWord?: string } =>
        typeof payload === 'object' &&
        payload !== null &&
        'secretWord' in payload,
    );
  if (privateSelection?.secretWord === undefined) {
    throw new Error('the drawer never received the private drawer:selected');
  }

  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    drawerPlayerId,
    drawer,
    guessers: players.filter(
      (player) => player.session.playerId !== drawerPlayerId,
    ),
    secretWord: privateSelection.secretWord,
    maskedWord: started.maskedWord,
    roundNumber: started.roundNumber,
  };
}

/** Emit one event and assert the ack succeeded. */
export async function emitOk(
  player: Player,
  event: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const ack = await player.client.emit(event, { eventId: ids(), ...payload });
  expect(ack.ok, event + ' by ' + player.nickname).toBe(true);
  return ack as unknown as Record<string, unknown>;
}

/** Emit one event and return its failure ack. */
export async function emitFail(
  player: Player,
  event: string,
  payload: Record<string, unknown>,
): Promise<{ code: string; retryable: boolean }> {
  const ack = await player.client.emit(event, { eventId: ids(), ...payload });
  expect(ack.ok, event + ' should fail').toBe(false);
  return ack as unknown as { code: string; retryable: boolean };
}