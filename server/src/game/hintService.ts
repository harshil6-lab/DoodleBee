/**
 * Hint reveals (D03-014, `server-state-writer-map.md` section 2.3).
 *
 * The single writer of `round.hintsRemaining`, `round.revealedPositions` and
 * the masked word inside `room:{id}:secret`. The mask algorithm is PROPOSED
 * (C-08) and lives in `hints.ts` so the live path and the snapshot path can
 * never disagree.
 */

import { AppError } from '../errors.js';
import {
  readAggregate,
  readSecret,
  writeAggregate,
  writeSecret,
} from '../redis/roomState.js';
import { maskWord } from './hints.js';
import type { RoomAggregate, RoomSecret } from './types.js';
import type { Services } from './services.js';

export interface HintResult {
  maskedWord: string;
  revealedPositions: number[];
  hintsRemaining: number;
}

export class HintService {
  constructor(private readonly services: Services) {}

  /**
   * Apply one hint inside the caller's commit. Returns `null` when no hint is
   * left, which the callers treat as `BAD_STATE`.
   */
  applyHint(
    aggregate: RoomAggregate,
    secret: RoomSecret,
  ): HintResult | null {
    if (aggregate.hintsRemaining <= 0) return null;
    const hintsUsed = aggregate.config.hints - aggregate.hintsRemaining + 1;
    const { maskedWord, revealedPositions } = maskWord(
      secret.secretWord,
      hintsUsed,
    );
    aggregate.hintsRemaining -= 1;
    aggregate.revealedPositions = revealedPositions;
    secret.maskedWord = maskedWord;
    return {
      maskedWord,
      revealedPositions,
      hintsRemaining: aggregate.hintsRemaining,
    };
  }

  /**
   * Authorize, apply, persist and broadcast one hint - the orchestration the
   * `realtime-contract.md` section 6 row for `hint:request` describes
   * (drawer-only, `ROUND_ACTIVE`, `hintsRemaining > 0`).
   *
   * Runs inside the caller's commit, so the new mask, the decremented counter
   * and the emitted payload all carry one `version`.
   */
  async request(
    roomId: string,
    requesterPlayerId: string,
    version: number,
  ): Promise<HintResult> {
    const aggregate = await readAggregate(this.services.redis, roomId);
    if (aggregate === null) throw new AppError('ROOM_NOT_FOUND');
    if (aggregate.phase !== 'ROUND_ACTIVE') throw new AppError('BAD_STATE');
    if (aggregate.drawerPlayerId !== requesterPlayerId) {
      throw new AppError('NOT_DRAWER');
    }
    const secret = await readSecret(this.services.redis, roomId);
    if (secret === null) throw new AppError('BAD_STATE');
    const result = this.applyHint(aggregate, secret);
    if (result === null) throw new AppError('BAD_STATE');
    await writeSecret(this.services.redis, roomId, secret);
    await writeAggregate(this.services.redis, aggregate);
    this.services.bus.toRoom(roomId, 'hint:revealed', {
      type: 'hint:revealed',
      maskedWord: result.maskedWord,
      revealedPositions: result.revealedPositions,
      hintsRemaining: result.hintsRemaining,
      version,
    });
    return result;
  }
}