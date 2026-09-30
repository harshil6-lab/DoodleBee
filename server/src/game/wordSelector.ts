/**
 * Secret-word selection (D03-015, `server-state-writer-map.md` section 2.3).
 *
 * The single writer of `room:{id}:secret`. The literal word never leaves this
 * module except through the drawer-scoped projection
 * (`snapshotProjector.ts`) and the two allow-listed payloads
 * (`security-model.md` section 3).
 */

import { eq } from 'drizzle-orm';
import { words } from '../db/schema.js';
import { addUsedWord, writeSecret } from '../redis/roomState.js';
import { maskWord } from './hints.js';
import type { RoomSecret } from './types.js';
import type { Services } from './services.js';

export class WordSelector {
  constructor(private readonly services: Services) {}

  /** Active words, preferring ones this room has not used yet. */
  async candidatePool(
    usedWordIds: readonly string[],
  ): Promise<{ id: string; text: string }[]> {
    const rows = await this.services.db.db
      .select({ id: words.id, text: words.text })
      .from(words)
      .where(eq(words.active, true));
    const used = new Set(usedWordIds);
    const fresh = rows.filter((row) => !used.has(row.id));
    return fresh.length > 0 ? fresh : rows;
  }

  /**
   * Select a word and write `room:{id}:secret`. Returns `null` when the word
   * table is empty, which the callers treat as `BAD_STATE`.
   */
  async selectForRound(
    roomId: string,
    usedWordIds: readonly string[],
  ): Promise<RoomSecret | null> {
    const pool = await this.candidatePool(usedWordIds);
    if (pool.length === 0) return null;
    const index = this.services.ids.randomInt(pool.length);
    const chosen = pool[Math.min(index, pool.length - 1)];
    if (chosen === undefined) return null;
    const secret: RoomSecret = {
      wordId: chosen.id,
      secretWord: chosen.text,
      maskedWord: maskWord(chosen.text, 0).maskedWord,
    };
    await writeSecret(this.services.redis, roomId, secret);
    await addUsedWord(this.services.redis, roomId, chosen.id);
    return secret;
  }
}
