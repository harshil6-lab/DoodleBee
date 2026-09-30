/**
 * Chat (`realtime-contract.md` section 9.3, `security-model.md` section 5).
 *
 * The single writer of the chat ring buffer and of `chat:message` /
 * `guess:submitted`. The ring holds either shape (`ChatEntry`), because a
 * wrong guess is a chat entry too.
 *
 * Moderation: length is enforced by the shared Zod schema at the boundary;
 * here `ChatService` owns the rate limit, the identical-message collapse and
 * the mute check. The profanity filter is applied to the displayed text only -
 * never to the guess-matching path - so it cannot create a false negative.
 *
 * Spam-collapse thresholds and the profanity word list are PROPOSED.
 */

import { CHAT_RING_SIZE, RATE_LIMITS } from '../../../shared/contract/constants.js';
import { AppError } from '../errors.js';
import { appendChat, isMuted } from '../redis/roomState.js';
import { profanityMask } from './profanity.js';
import type {
  ChatMessagePayload,
  GuessSubmittedPayload,
} from '../../../shared/contract/server-payloads.js';
import type { Services } from './services.js';

/** Identical messages inside this window collapse after `SPAM_ALLOWED_COPIES`. */
const SPAM_WINDOW_MS = 10_000;
const SPAM_ALLOWED_COPIES = 2;

export class ChatService {
  private readonly recent = new Map<
    string,
    { text: string; copies: number; at: number }
  >();

  constructor(private readonly services: Services) {}

  private isSpam(roomId: string, playerId: string, text: string, now: number): boolean {
    const key = roomId + '|' + playerId;
    const previous = this.recent.get(key);
    if (
      previous !== undefined &&
      previous.text === text &&
      now - previous.at <= SPAM_WINDOW_MS
    ) {
      previous.copies += 1;
      previous.at = now;
      return previous.copies > SPAM_ALLOWED_COPIES;
    }
    this.recent.set(key, { text, copies: 1, at: now });
    return false;
  }

  /** A normal chat message. Throws `MUTED` / `RATE_LIMITED`. */
  async send(
    roomId: string,
    playerId: string,
    nickname: string,
    text: string,
    version: number,
  ): Promise<ChatMessagePayload> {
    const now = this.services.clock.now();
    if (await isMuted(this.services.redis, roomId, playerId)) {
      throw new AppError('MUTED');
    }
    const allowed = await this.services.limiter.consume(
      'chat',
      roomId + ':' + playerId,
      {
        capacity: RATE_LIMITS.chatBurst,
        refillPerSecond: RATE_LIMITS.chatPer5s / 5,
      },
      now,
    );
    if (!allowed) throw new AppError('RATE_LIMITED');
    if (this.isSpam(roomId, playerId, text, now)) {
      throw new AppError('RATE_LIMITED');
    }
    const payload: ChatMessagePayload = {
      type: 'chat:message',
      id: this.services.ids.uuid(),
      messageType: 'NORMAL',
      senderPlayerId: playerId,
      senderNickname: nickname,
      text: profanityMask(text),
      createdAt: now,
      version,
    };
    await appendChat(this.services.redis, roomId, payload);
    this.services.bus.toRoom(roomId, 'chat:message', payload);
    return payload;
  }

  /** A wrong or near-match guess, echoed to the room as chat. */
  async appendGuess(
    roomId: string,
    playerId: string,
    nickname: string,
    text: string,
    result: 'WRONG' | 'CLOSE',
    version: number,
  ): Promise<GuessSubmittedPayload> {
    const payload: GuessSubmittedPayload = {
      type: 'guess:submitted',
      playerId,
      nickname,
      text,
      result,
      version,
    };
    await appendChat(this.services.redis, roomId, payload);
    this.services.bus.toRoom(roomId, 'guess:submitted', payload);
    return payload;
  }

  /** A server-authored line (round start, winner, kick notices). */
  async appendSystem(
    roomId: string,
    text: string,
    version: number,
    messageType: 'SYSTEM' | 'CORRECT_GUESS' = 'SYSTEM',
  ): Promise<ChatMessagePayload> {
    const payload: ChatMessagePayload = {
      type: 'chat:message',
      id: this.services.ids.uuid(),
      messageType,
      senderPlayerId: null,
      senderNickname: null,
      text,
      createdAt: this.services.clock.now(),
      version,
    };
    await appendChat(this.services.redis, roomId, payload);
    this.services.bus.toRoom(roomId, 'chat:message', payload);
    return payload;
  }
}

export { CHAT_RING_SIZE };
