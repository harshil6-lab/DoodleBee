/**
 * PostgreSQL schema (`data-model.md` section 2, decision D03-008).
 *
 * Eight entities, no more. Conventions from the data model: `uuid` primary
 * keys defaulting to `gen_random_uuid()`, `timestamptz` for every instant,
 * `smallint` for bounded counts, snake_case identifiers, foreign keys
 * `ON DELETE RESTRICT`.
 *
 * This file is the single source of the generated migration
 * (`npm run db:generate`). It is not edited by hand after generation.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

// --------------------------------------------------------------- 2.1 users ---

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nickname: text('nickname').notNull(),
    isGuest: boolean('is_guest').notNull().default(true),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'users_nickname_len_check',
      sql`char_length(${table.nickname}) between 1 and 20`,
    ),
  ],
);

// --------------------------------------------------------------- 2.2 words ---

export const words = pgTable(
  'words',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    text: text('text').notNull(),
    category: text('category').notNull(),
    difficulty: text('difficulty'),
    aliases: text('aliases')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('words_text_lower_uniq').on(sql`lower(${table.text})`),
  ],
);

// --------------------------------------------------------------- 2.3 rooms ---

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    hostUserId: uuid('host_user_id')
      .notNull()
      .references(() => users.id),
    maxPlayers: smallint('max_players').notNull(),
    rounds: smallint('rounds').notNull(),
    roundDuration: smallint('round_duration').notNull(),
    hints: smallint('hints').notNull(),
    status: text('status').notNull(),
    createdAt: createdAt(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    // The PRD rule is "active room codes are unique", so the index is partial.
    uniqueIndex('rooms_active_code_uniq')
      .on(table.code)
      .where(sql`status <> 'CLOSED'`),
    check(
      'rooms_code_len_check',
      sql`char_length(${table.code}) between 5 and 6`,
    ),
    check(
      'rooms_name_len_check',
      sql`char_length(${table.name}) between 1 and 30`,
    ),
    check(
      'rooms_max_players_check',
      sql`${table.maxPlayers} between 2 and 8`,
    ),
    check('rooms_rounds_check', sql`${table.rounds} >= 1`),
    check('rooms_round_duration_check', sql`${table.roundDuration} >= 30`),
    check('rooms_hints_check', sql`${table.hints} >= 0`),
    check(
      'rooms_status_check',
      sql`${table.status} in ('WAITING','IN_GAME','CLOSED')`,
    ),
  ],
);

// -------------------------------------------------------- 2.4 room_players ---

export const roomPlayers = pgTable(
  'room_players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    seatOrder: smallint('seat_order').notNull(),
    isHostStart: boolean('is_host_start').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (table) => [
    // One active membership per user per room: the DB-level idempotency
    // guarantee for `POST /rooms/join`.
    uniqueIndex('room_players_active_uniq')
      .on(table.roomId, table.userId)
      .where(sql`left_at is null`),
    uniqueIndex('room_players_seat_uniq').on(table.roomId, table.seatOrder),
  ],
);

// --------------------------------------------------------------- 2.5 games ---

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    roundsPlanned: smallint('rounds_planned').notNull(),
    roundsCompleted: smallint('rounds_completed').notNull().default(0),
    status: text('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'games_status_check',
      sql`${table.status} in ('STARTING','IN_PROGRESS','FINISHED','ABANDONED')`,
    ),
  ],
);

// -------------------------------------------------------------- 2.6 rounds ---

export const rounds = pgTable(
  'rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id),
    roundNumber: smallint('round_number').notNull(),
    drawerUserId: uuid('drawer_user_id')
      .notNull()
      .references(() => users.id),
    wordId: uuid('word_id')
      .notNull()
      .references(() => words.id),
    maskedWordFinal: text('masked_word_final'),
    status: text('status').notNull(),
    endReason: text('end_reason'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('rounds_game_round_uniq').on(table.gameId, table.roundNumber),
    check(
      'rounds_status_check',
      sql`${table.status} in ('ACTIVE','FINISHED','ABANDONED')`,
    ),
    check(
      'rounds_end_reason_check',
      sql`${table.endReason} is null or ${table.endReason} in
        ('TIMER_EXPIRED','ALL_GUESSERS_CORRECT','DRAWER_ABANDONED','SERVER_TERMINATED')`,
    ),
  ],
);

// -------------------------------------------------------------- 2.7 scores ---

export const scores = pgTable(
  'scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id),
    roundId: uuid('round_id').references(() => rounds.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    points: integer('points').notNull(),
    rankInRound: smallint('rank_in_round'),
    createdAt: createdAt(),
  },
  (table) => [
    // Makes the round-end score write idempotent (a retried transaction
    // inserts nothing new instead of double-scoring).
    uniqueIndex('scores_round_user_kind_uniq')
      .on(table.roundId, table.userId, table.kind)
      .where(sql`round_id is not null`),
    check('scores_kind_check', sql`${table.kind} in ('guess','drawer')`),
  ],
);

// -------------------------------------------------------- 2.8 game_results ---

export const gameResults = pgTable(
  'game_results',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    finalScore: integer('final_score').notNull(),
    finalRank: smallint('final_rank').notNull(),
    isWinner: boolean('is_winner').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.userId] })],
);
