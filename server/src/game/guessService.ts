/**
 * Guess handling (D03-017, `server-state-writer-map.md` section 2.3).
 *
 * The single writer of `round.correctGuessers[]` rank assignment (through the
 * atomic Redis script). Correctness is computed against the server-held secret;
 * the client sends only text.
 */

import { eq } from 'drizzle-orm';
import { words } from '../db/schema.js';
import { RATE_LIMITS } from '../../../shared/contract/constants.js';
import { AppError } from '../errors.js';
import {
  assignGuessRank,
  readAggregate,
  readCorrect,
  readScores,
  readSecret,
} from '../redis/roomState.js';
import { eligibleGuessers } from './drawerSelector.js';
import { isCloseGuess, isCorrectGuess } from './wordMatch.js';
import type { Services } from './services.js';

export interface GuessOutcome {
  result: 'CORRECT' | 'WRONG' | 'CLOSE';
  rank: number;
  points: number;
  correctCount: number;
}

export class GuessService {
  private readonly aliasCache = new Map<string, string[]>();

  constructor(private readonly services: Services) {}

  private async aliasesFor(wordId: string): Promise<string[]> {
    const cached = this.aliasCache.get(wordId);
    if (cached !== undefined) return cached;
    const rows = await this.services.db.db
      .select({ aliases: words.aliases })
      .from(words)
      .where(eq(words.id, wordId));
    const aliases = rows[0]?.aliases ?? [];
    this.aliasCache.set(wordId, aliases);
    return aliases;
  }

  /**
   * Runs inside the caller's commit. Returns the outcome so the ack and the
   * chat echo can be built from one decision.
   */
  async evaluate(
    roomId: string,
    playerId: string,
    nickname: string,
    guess: string,
    version: number,
  ): Promise<GuessOutcome> {
    const allowed = await this.services.limiter.consume(
      'guess',
      roomId + ':' + playerId,
      { capacity: RATE_LIMITS.guessPer10s, refillPerSecond: RATE_LIMITS.guessPer10s / 10 },
      this.services.clock.now(),
    );
    if (!allowed) throw new AppError('RATE_LIMITED');

    const aggregate = await readAggregate(this.services.redis, roomId);
    if (aggregate === null) throw new AppError('ROOM_NOT_FOUND');
    if (aggregate.phase !== 'ROUND_ACTIVE') throw new AppError('BAD_STATE');
    if (aggregate.drawerPlayerId === playerId) {
      throw new AppError('DRAWER_CANNOT_GUESS');
    }
    const correct = await readCorrect(this.services.redis, roomId);
    if (correct.some((entry) => entry.playerId === playerId)) {
      throw new AppError('ALREADY_GUESSED');
    }
    const secret = await readSecret(this.services.redis, roomId);
    if (secret === null) throw new AppError('BAD_STATE');
    const aliases = await this.aliasesFor(secret.wordId);

    if (isCorrectGuess(guess, secret.secretWord, aliases)) {
      const rank = await assignGuessRank(this.services.redis, roomId, playerId);
      if (rank === 0) throw new AppError('ALREADY_GUESSED');
      const points = await this.services.scores.awardGuess(roomId, playerId, rank);
      const correctAfter = await readCorrect(this.services.redis, roomId);
      const scores = await readScores(this.services.redis, roomId);
      this.services.bus.toRoom(roomId, 'guess:correct', {
        type: 'guess:correct',
        playerId,
        nickname,
        rank,
        points,
        correctCount: correctAfter.length,
        version,
      });
      await this.services.chat.appendSystem(
        roomId,
        nickname + ' guessed correctly (+' + points + ')',
        version,
        'CORRECT_GUESS',
      );
      this.services.bus.toRoom(roomId, 'score:updated', {
        type: 'score:updated',
        scores,
        version,
      });

      const members = await this.services.rooms.readMembers(roomId);
      const eligible = eligibleGuessers(members, aggregate.drawerPlayerId);
      if (eligible.length > 0 && correctAfter.length >= eligible.length) {
        await this.services.rounds.endRound(roomId, 'ALL_GUESSERS_CORRECT');
      }
      return { result: 'CORRECT', rank, points, correctCount: correctAfter.length };
    }

    const close = isCloseGuess(guess, secret.secretWord, aliases);
    await this.services.chat.appendGuess(
      roomId,
      playerId,
      nickname,
      guess,
      close ? 'CLOSE' : 'WRONG',
      version,
    );
    return {
      result: close ? 'CLOSE' : 'WRONG',
      rank: 0,
      points: 0,
      correctCount: correct.length,
    };
  }
}
