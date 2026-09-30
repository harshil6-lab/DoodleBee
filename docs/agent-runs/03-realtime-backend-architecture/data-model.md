# Stage 03 — Data Model

**Stage:** 03 — Realtime + Backend Architecture
**Document:** PostgreSQL schema and Redis key model
**Version:** 1.0
**Status:** DESIGNED — decisions recorded in `decision.md` (D03-006 … D03-009)
**Project:** DoodleBee
**Date:** 2026-09-30

Design only. No migration, DDL file or query code is created in this stage.

---

## 1. Storage split

The PRD lists Redis responsibilities that span three genuinely different kinds of
state. They are separated here, because losing Redis must not corrupt the permanent
record (`architecture-research.md` §8).

| Kind | Home | Loss consequence |
|---|---|---|
| Authoritative transient (live room aggregate, round, presence, timers, strokes, chat tail) | Redis, TTL-bounded | In-flight games are lost; completed games and results survive |
| Persistent record (`users`, `rooms`, `room_players`, `games`, `rounds`, `scores`, `words`, `game_results`) | PostgreSQL | Must not be lost; this is the system of record |
| Derived / ephemeral (rate limits, dedupe caches, word pool cache, adapter pub/sub) | Redis | Silently rebuilt; no user-visible effect |

**Redis is not the system of record.** This is stated explicitly so that no future
component treats a Redis flush as recoverable data loss with no bounds.

### 1.1 When PostgreSQL is written

| Moment | Tables written |
|---|---|
| `POST /session` | `users` (upsert guest) |
| `POST /rooms` | `rooms`, `room_players` (host) |
| `POST /rooms/join` | `room_players` |
| `PUT /rooms/:id/config` | `rooms` (config columns) |
| `game:start` accepted | `games` |
| Round starts | `rounds` (insert) |
| Round ends | `rounds` (update), `scores` (insert batch, one transaction) |
| Game ends | `games` (update), `game_results` (insert batch, one transaction) |
| Room closed / TTL expiry | `rooms.closed_at`, `room_players.left_at` |

Per-event writes (per stroke, per chat message, per guess) do **not** touch PostgreSQL.
That is what keeps 8 players at 60 drawing events/s off the database.

---

## 2. PostgreSQL schema

Conventions: `uuid` primary keys (`gen_random_uuid()`), `timestamptz` for all instants
(UTC, server clock), `text` for short strings, `smallint` for bounded counts, snake_case
identifiers. FKs are `ON DELETE RESTRICT` unless stated otherwise.

### 2.1 `users`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `nickname` | `text` | not null, length 1..20 (mirrors the client schema) |
| `is_guest` | `boolean` | not null, default `true` (guest-first V1) |
| `created_at` | `timestamptz` | not null, default `now()` |
| `last_seen_at` | `timestamptz` | not null, default `now()` |

No email, password, avatar or profile columns. The PRD does not require a social profile
system in V1 (`docs/projectInfo.md` §5).

### 2.2 `words`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `text` | `text` | not null, unique on `lower(text)` |
| `category` | `text` | not null; one of the PRD categories |
| `difficulty` | `text` | null; reserved for the PRD's future tiers |
| `aliases` | `text[]` | not null, default `'{}'` |
| `active` | `boolean` | not null, default `true` |
| `created_at` | `timestamptz` | not null, default `now()` |

`aliases` is **not required by the PRD**. It exists so that a curated list of accepted
variants (for example a plural form) does not require a migration later. V1 behaviour
does not depend on it being populated: the matcher accepts the normalized word plus any
normalized aliases (D03-017).

`category` is seeded with the PRD's initial list: Animals, Food, Objects, Places,
People, Jobs, Sports, Technology, Nature, Movies, Vehicles, Actions.

### 2.3 `rooms`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `code` | `text` | not null, length 5..6, uppercase |
| `name` | `text` | not null, length 1..30 |
| `host_user_id` | `uuid` | not null, FK `users(id)` |
| `max_players` | `smallint` | not null, check `between 2 and 8` |
| `rounds` | `smallint` | not null, check `>= 1` |
| `round_duration` | `smallint` | not null, seconds, check `>= 30` |
| `hints` | `smallint` | not null, check `>= 0` |
| `status` | `text` | not null, check in `('WAITING','IN_GAME','CLOSED')` |
| `created_at` | `timestamptz` | not null, default `now()` |
| `closed_at` | `timestamptz` | null |

Index that implements the PRD's actual rule ("**Active** room codes shall be unique"):

```
CREATE UNIQUE INDEX rooms_active_code_uniq
  ON rooms (code)
  WHERE status <> 'CLOSED';
```

A plain `UNIQUE (code)` would forbid ever reusing a code; the partial index expresses
the requirement exactly and keeps code generation simple.

### 2.4 `room_players`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `room_id` | `uuid` | not null, FK `rooms(id)` |
| `user_id` | `uuid` | not null, FK `users(id)` |
| `seat_order` | `smallint` | not null (join order; drives the host-transfer tie-break) |
| `is_host_start` | `boolean` | not null, default `false` |
| `joined_at` | `timestamptz` | not null, default `now()` |
| `left_at` | `timestamptz` | null |

Constraints:

- `UNIQUE (room_id, user_id) WHERE left_at IS NULL` — one active membership per user per
  room; gives `POST /rooms/join` a database-level idempotency guarantee.
- `UNIQUE (room_id, seat_order)` — deterministic ordering.

### 2.5 `games`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `room_id` | `uuid` | not null, FK `rooms(id)` |
| `rounds_planned` | `smallint` | not null |
| `rounds_completed` | `smallint` | not null, default `0` |
| `status` | `text` | not null, check in `('STARTING','IN_PROGRESS','FINISHED','ABANDONED')` |
| `started_at` | `timestamptz` | not null, default `now()` |
| `ended_at` | `timestamptz` | null |

A room may have many `games` rows (the PRD's "play again"), which is why game history is
not collapsed into the room.

### 2.6 `rounds`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `game_id` | `uuid` | not null, FK `games(id)` |
| `round_number` | `smallint` | not null, 1-based |
| `drawer_user_id` | `uuid` | not null, FK `users(id)` |
| `word_id` | `uuid` | not null, FK `words(id)` |
| `masked_word_final` | `text` | null (written at round end) |
| `status` | `text` | not null, check in `('ACTIVE','FINISHED','ABANDONED')` |
| `end_reason` | `text` | null, check in `('TIMER_EXPIRED','ALL_GUESSERS_CORRECT','DRAWER_ABANDONED','SERVER_TERMINATED')` |
| `started_at` | `timestamptz` | not null, default `now()` |
| `ended_at` | `timestamptz` | null |

Constraints: `UNIQUE (game_id, round_number)`.

The drawer's *user id* is stored, not a session id, so the record survives reconnects.

### 2.7 `scores`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `game_id` | `uuid` | not null, FK `games(id)` |
| `round_id` | `uuid` | null, FK `rounds(id)` (null only for a game-level adjustment) |
| `user_id` | `uuid` | not null, FK `users(id)` |
| `kind` | `text` | not null, check in `('guess','drawer')` |
| `points` | `integer` | not null |
| `rank_in_round` | `smallint` | null (set for `kind = 'guess'`) |
| `created_at` | `timestamptz` | not null, default `now()` |

Constraints:

- `UNIQUE (round_id, user_id, kind) WHERE round_id IS NOT NULL` — makes the round-end
  score write **idempotent**. A retried round-end transaction inserts nothing new
  instead of double-scoring.

This table satisfies FR-029: "the order in which players correctly guess" is exactly
`rank_in_round` ordered ascending. No separate guess log is required by the PRD, and
none is added.

### 2.8 `game_results`

| Column | Type | Constraints |
|---|---|---|
| `game_id` | `uuid` | not null, FK `games(id)` |
| `user_id` | `uuid` | not null, FK `users(id)` |
| `final_score` | `integer` | not null |
| `final_rank` | `smallint` | not null |
| `is_winner` | `boolean` | not null, default `false` |
| `created_at` | `timestamptz` | not null, default `now()` |

Constraints: `PRIMARY KEY (game_id, user_id)`.

### 2.9 Entity relationship summary

```
users 1---* room_players *---1 rooms
users 1---* rooms            (host)
rooms 1---* games
games 1---* rounds
users 1---* rounds           (drawer)
words 1---* rounds
games 1---* scores *---1 users
rounds 1---* scores          (nullable for game-level rows)
games 1---* game_results *---1 users
```

---

## 3. Redis key model

All keys are namespaced by `room:{roomId}` unless they are global. Every room-scoped key
carries the room TTL so a crashed process does not leak rooms.

| Key | Type | Contents | TTL |
|---|---|---|---|
| `room:{id}:state` | hash | `roomId, code, status, hostPlayerId, config json, phase, gameId, roundNumber, roundsPlanned, drawerPlayerId, roundEndTime, roundTimerPaused, hintsRemaining, revealedPositions json, correctCount, wordId` | room TTL (30 min idle, **proposal**) |
| `room:{id}:secret` | hash | `secretWord`, `maskedWord` — the only key that may hold the literal | same as `state` |
| `room:{id}:version` | string (int) | monotonic `INCR` counter | room TTL |
| `room:{id}:members` | hash | `playerId -> { nickname, userId, seatOrder, isConnected, graceDeadline, isHost }` | room TTL |
| `room:{id}:sockets` | hash | `playerId -> socketIds[]` | room TTL |
| `room:{id}:strokes` | list | rolling window of stroke operations (JSON), trimmed to the last 30 s | 30 s per element |
| `room:{id}:chat` | list | last 50 chat entries | room TTL, trimmed to 50 |
| `room:{id}:correct` | list | correct guesser ids in rank order | room TTL |
| `room:{id}:usedwords` | set | `wordId`s already used in this room (avoids repeats across rounds) | room TTL |
| `room:{id}:scores` | hash | `playerId -> score` | room TTL |
| `room:{id}:blocked` | set | player ids kicked from this room | room TTL |
| `session:{token}` | hash | `playerId`, `roomId`, `createdAt` | 24 h (**proposal**) |
| `ratelimit:{scope}:{id}` | hash/string | token bucket state | short (seconds) |
| `wordpool:{category}` | list | cached word ids for selection | 10 min (**proposal**) |
| `lock:room:{id}` | string | the critical-section token (see `server-state-writer-map.md` §3) | milliseconds |

Deliberately absent: no key holds a *client-facing* aggregate. The live aggregate is
`room:{id}:state` and the projection to any client happens at send time, so the
drawer-only rule is applied per recipient rather than by maintaining two copies
(D03-015).

---

## 4. Consistency between Redis and PostgreSQL

Redis is write-through for the live aggregate; PostgreSQL is written at the lifecycle
boundaries listed in §1.1. The two are reconciled only in one direction:

- On round end, the transaction that writes `scores` also writes `rounds.ended_at` and
  `rounds.end_reason`. If that transaction fails, the round still ends in Redis (the
  game must not stall), and the write is retried from a durable outbox entry in Redis
  under `room:{id}:outbox`. This is a small, bounded mechanism, not a message broker.
- On game end, the same pattern applies to `games` + `game_results`.
- If the room TTL expires with an outbox entry still pending, the game is recorded as
  `ABANDONED` and the partial scores are written best-effort.

This is the only "eventual" behaviour in the design, and it is bounded to two write
points. Everything a player sees is decided in Redis synchronously.

---

## 5. Query layer

Decision D03-009 selects `drizzle-orm` with `drizzle-kit` for migrations. Full record
(decision/evidence/alternatives/reason/consequences/implications) is in `decision.md`.

Consequences that belong here:

- The schema in §2 is the single source of the generated migration.
- Typed row types are derived from the same definitions, so a column rename is a
  compile error rather than a runtime surprise.
- Raw SQL remains available for the two batch transactions (§4) without leaving the
  library, because Drizzle exposes its SQL builder.
- No repository abstraction layer is added on top. The PRD names no such requirement,
  and a second indirection over eight tables would be unrequested infrastructure.

---

## 6. Migration strategy

- Migrations are generated files checked into the repository and applied by a
  `migrate` command in the CI/CD pipeline before the service is released (PRD "DevOps":
  Test → Lint → Build → Deploy).
- No auto-migration on service start.
- The word database is seeded by a data migration (categories from §2.2), not by
  application startup code.

---

## 7. Data privacy (NFR-007)

The PRD requires collecting only what is needed, plus disclosure, consent and deletion
mechanisms. Consequences for this model:

- No email, phone, real name, contacts, location or advertising identifier is stored.
- `users.nickname` is user-supplied and is the only personal datum in the schema.
- Deletion: because `users` fans out into `room_players`, `rounds`, `scores` and
  `game_results`, deletion is a **pseudonymization** (nickname replaced with a
  tombstone and `is_guest` retained) rather than a row cascade, so historical results
  keep their shape. The exact policy is an implementation-stage task; the schema
  supports it without a migration because no other personal column exists.
- Analytics events listed in the PRD contain no personal data beyond a player id.

---

## 8. Deliberately not stored

| Not stored | Reason |
|---|---|
| Drawing strokes | PRD: "Drawing strokes need not be persisted permanently in V1" |
| Per-guess rows | Not required by the PRD; the ranking is persisted in `scores.rank_in_round` |
| Per-chat rows | Not required; chat is a live display concern |
| Chat/analytics with the secret word | `docs/AGENTS.md` §10 |
| Session tokens in PostgreSQL | Redis-only, with a TTL |
| A second database | PRD "Infrastructure": no multiple databases for V1 |