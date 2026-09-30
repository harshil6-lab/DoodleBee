/**
 * Guest session identity (D03-019, `reconnect-protocol.md` section 1).
 *
 * `POST /session` issues an opaque bearer token stored in Redis with its own
 * TTL. The token is the only credential; `playerId` is never accepted from a
 * client payload and always equals the owning `users.id` so the PostgreSQL
 * foreign keys on `rooms`, `rounds` and `scores` stay satisfied.
 */

import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { SESSION_TTL_SECONDS } from '../../../shared/contract/constants.js';
import { AppError } from '../errors.js';
import { readSession, writeSession } from '../redis/roomState.js';
import type { SessionRecord } from './types.js';
import type { Services } from './services.js';

export interface CreatedSession {
  playerId: string;
  userId: string;
  nickname: string;
  sessionToken: string;
}

export class SessionService {
  constructor(private readonly services: Services) {}

  /** A generated, schema-valid guest nickname (`users.nickname` is NOT NULL). */
  private guestNickname(): string {
    const suffix = String(this.services.ids.randomInt(1_000_000)).padStart(
      6,
      '0',
    );
    return 'Guest' + suffix;
  }

  async create(): Promise<CreatedSession> {
    const nickname = this.guestNickname();
    const inserted = await this.services.db.db
      .insert(users)
      .values({ nickname, isGuest: true })
      .returning({ id: users.id, nickname: users.nickname });
    const row = inserted[0];
    if (row === undefined) throw new AppError('INTERNAL_ERROR');
    return this.issue(row.id, row.nickname);
  }

  private async issue(playerId: string, nickname: string): Promise<CreatedSession> {
    const token = this.services.ids.token();
    const session: SessionRecord = {
      playerId,
      userId: playerId,
      roomId: null,
      createdAt: this.services.clock.now(),
    };
    await writeSession(
      this.services.redis,
      token,
      session,
      SESSION_TTL_SECONDS,
    );
    return { playerId, userId: playerId, nickname, sessionToken: token };
  }

  /** Resolve a token to its session, or `null` when unknown/expired. */
  async resolve(token: string): Promise<SessionRecord | null> {
    if (token.length === 0) return null;
    return readSession(this.services.redis, token);
  }

  /** As `resolve`, but throws the shared `UNAUTHENTICATED` code. */
  async require(token: string): Promise<SessionRecord> {
    const session = await this.resolve(token);
    if (session === null) throw new AppError('UNAUTHENTICATED');
    return session;
  }

  async setNickname(playerId: string, nickname: string): Promise<string> {
    const updated = await this.services.db.db
      .update(users)
      .set({ nickname, lastSeenAt: new Date(this.services.clock.now()) })
      .where(eq(users.id, playerId))
      .returning({ nickname: users.nickname });
    const row = updated[0];
    if (row === undefined) throw new AppError('UNAUTHENTICATED');
    return row.nickname;
  }

  /** The display nickname for a user id (the roster attribute). */
  async nicknameOf(userId: string): Promise<string> {
    const rows = await this.services.db.db
      .select({ nickname: users.nickname })
      .from(users)
      .where(eq(users.id, userId));
    return rows[0]?.nickname ?? 'Player';
  }
}
