/**
 * A real `socket.io-client` wrapper (`testing-strategy.md` section 3: realtime
 * is exercised over a real socket, never a stub).
 */

import { io, type Socket } from 'socket.io-client';
import type { Ack } from '../../src/realtime/envelope.js';

export interface Received {
  event: string;
  payload: unknown;
}

export interface TestClient {
  readonly token: string;
  readonly socket: Socket;
  readonly received: Received[];
  /** Emit and await the ack, with a bounded wait so a missing ack fails fast. */
  emit(event: string, payload: Record<string, unknown>): Promise<Ack>;
  /** Resolve with the first payload of `event` received after this call. */
  waitFor(
    event: string,
    predicate?: (payload: unknown) => boolean,
    timeoutMs?: number,
  ): Promise<unknown>;
  all(event: string): unknown[];
  close(): void;
}

export interface ConnectOptions {
  reconnection?: boolean;
  timeoutMs?: number;
}

export async function connectClient(
  url: string,
  token: string,
  options: ConnectOptions = {},
): Promise<TestClient> {
  const socket = io(url, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: options.reconnection ?? false,
  });

  const received: Received[] = [];
  const waiters: {
    event: string;
    predicate: (payload: unknown) => boolean;
    resolve: (payload: unknown) => void;
  }[] = [];

  socket.onAny((event: string, payload: unknown) => {
    received.push({ event, payload });
    for (let i = waiters.length - 1; i >= 0; i -= 1) {
      const waiter = waiters[i];
      if (waiter === undefined) continue;
      if (waiter.event === event && waiter.predicate(payload)) {
        waiters.splice(i, 1);
        waiter.resolve(payload);
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('socket connect timed out')),
      options.timeoutMs ?? 5000,
    );
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  const client: TestClient = {
    token,
    socket,
    received,
    emit(event, payload) {
      return new Promise<Ack>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('ack timed out for ' + event)),
          options.timeoutMs ?? 5000,
        );
        socket.emit(event, payload, (ack: Ack) => {
          clearTimeout(timer);
          resolve(ack);
        });
      });
    },
    waitFor(event, predicate, timeoutMs = 5000) {
      const match = predicate ?? (() => true);
      const alreadyReceived = received.find(
        (entry) => entry.event === event && match(entry.payload),
      );
      if (alreadyReceived !== undefined) {
        return Promise.resolve(alreadyReceived.payload);
      }
      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('timed out waiting for ' + event));
        }, timeoutMs);
        waiters.push({
          event,
          predicate: match,
          resolve: (payload) => {
            clearTimeout(timer);
            resolve(payload);
          },
        });
      });
    },
    all(event) {
      return received
        .filter((entry) => entry.event === event)
        .map((entry) => entry.payload);
    },
    close() {
      socket.close();
    },
  };
  return client;
}

/** `eventId` values must be unique per attempt; this keeps them readable. */
export function eventIds(prefix: string): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return prefix + '-' + counter;
  };
}