/**
 * The room commit path (`server-state-writer-map.md` section 3).
 *
 * `withRoomLock` is the only serialization point for a room's mutations, and
 * therefore the only place a `version` is assigned. A mutation that bypasses it
 * does not get a version, which is what makes a bypass detectable.
 *
 * V1 is one service (D03-031), so the critical section is an in-process
 * per-room async chain. The `lock:room:{id}` key in `data-model.md` section 3
 * exists for the clustered case, which D03-031 explicitly defers with the
 * Socket.IO Redis adapter; it is unused here and recorded as such in `Build.md`.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

const chains = new Map<string, Promise<void>>();

export async function withRoomLock<T>(
  roomId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = chains.get(roomId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => gate);
  chains.set(roomId, chained);

  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    // Only the last waiter clears the entry, so the map cannot grow forever.
    if (chains.get(roomId) === chained) {
      chains.delete(roomId);
    }
  }
}

/**
 * The room commit path proper: one critical section, one `version`, and
 * reentrancy for nested commits within the same logical mutation.
 *
 * A handler that must both resync scores and end a round (for example a guess
 * that completes the round) calls `commit` twice. Reentrancy makes the second
 * call share the first call's `version` instead of deadlocking on the lock it
 * already holds, so exactly one version is assigned per client action
 * (`server-state-writer-map.md` section 3).
 */
const commitScope = new AsyncLocalStorage<Map<string, number>>();

export async function commitRoom<T>(
  roomId: string,
  bump: () => Promise<number>,
  fn: (version: number) => Promise<T>,
): Promise<{ version: number; result: T }> {
  const store = commitScope.getStore();
  if (store !== undefined) {
    const held = store.get(roomId);
    if (held !== undefined) {
      return { version: held, result: await fn(held) };
    }
  }
  return withRoomLock(roomId, async () => {
    const version = await bump();
    const next = new Map(store ?? []);
    next.set(roomId, version);
    return commitScope.run(next, async () => {
      const result = await fn(version);
      return { version, result };
    });
  });
}
