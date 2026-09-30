# Stage 03 — Realtime + Backend Architecture: Research

**Stage:** 03 — Realtime + Backend Architecture
**Document:** Independent research record (evidence before decision)
**Version:** 1.0
**Status:** COMPLETE — research closed, decisions recorded in `decision.md`
**Project:** DoodleBee
**Date:** 2026-09-30
**Authority:** Subordinate to `decision.md` and the PRD. This file records what was
*observed*, not what was decided.

---

## 1. Purpose and method

Stage 03 designs the realtime + backend architecture for DoodleBee V1. Per the
project golden rule (`docs/projectInfo.md` §45, `docs/AGENTS.md` §31), nothing
is decided by assertion. This document records the evidence gathered *before* the
decisions in `decision.md`.

Method:

1. Read the requirements sources in the approved hierarchy (`docs/projectInfo.md` §44).
2. Re-read the locked Stage 02 baseline so Stage 03 does not reopen settled items.
3. Gather current, verifiable facts about each candidate technology from upstream
   sources (npm registry metadata, upstream repository files) rather than memory.
4. Record observations, contradictions and gaps. Decisions are made in `decision.md`.

**No measurement, benchmark, device test or load test was performed in this stage.**
Nothing in this file is a performance result. Where a number could not be measured,
it is recorded as unmeasured.

---

## 2. Sources read

| Source | Role |
|---|---|
| `Draw_and_Guess_PRD.pdf` | Requirements source of truth |
| `docs/projectInfo.md` | Project context, pending decisions (§43), hierarchy (§44), golden rule (§45) |
| `docs/AGENTS.md` | Agent behaviour, server authority (§9), secret information (§10), WebSocket rules (§15), drawing rules (§16), testing (§21–§22) |
| `docs/Design.md` | Design restrictions |
| `ProjectDocs/01-information-architecture.md` | Navigation; game state (§9), game start (§10), drawing (§11), guessing (§12), chat (§13), timer (§14), hints (§15), connection (§21), moderation (§23) |
| `ProjectDocs/01-screen-state-map.md` | Screen/state map; drawer (§8), guesser (§9), drawing (§10), chat (§11), guess feedback (§12), hints (§14), timer (§15), round result (§16), connection (§18), moderation (§19) |
| `ProjectDocs/02-client-architecture.md` | Stage 02 proposal; realtime (§7), drawing (§8), API (§9), next stage (§17) |
| `docs/agent-runs/02-client-architecture/04-architecture-decision.md` | Locked ADR v2.1 (Stage 02 baseline) |
| `docs/agent-runs/02-client-architecture/decision.md` | Locked ledger v2.1 (D02-001 … D02-023) |
| `docs/agent-runs/02-client-architecture/flow.md`, `Execution.md`, `Build.md` | Stage 02 executed record |
| `D:\doodlebee` implementation (`app/`, `src/`, `package.json`) | Verified client contract that the server must match |

The PRD was extracted to text with `pdftotext -layout -enc UTF-8` for line-accurate
reading. Extracted working copy: `%TEMP%\prd.txt` (31,550 characters, 723 lines).

---

## 3. Environment facts observed (this session)

| Fact | Value | How observed |
|---|---|---|
| Node.js | `v22.23.2` | `node --version` |
| npm | `10.9.8` | `npm --version` |
| Attached Android devices | none (empty `adb devices` list) | `adb devices` |
| Client package manager | npm (`package-lock.json`; no `bun.lock`) | repo inspection |
| Git branch | `main` | `git rev-parse --abbrev-ref HEAD` |

An empty `adb devices` list is load-bearing for AD-004: no on-device clause can be
satisfied in the current environment without attaching hardware.

---

## 4. Upstream dependency facts (verified 2026-09-30)

All versions were read from the npm registry (`registry.npmjs.org`), and behaviour
claims were read from upstream repository files. These are the facts the technology
decisions rest on.

| Package | Latest stable observed | Notes |
|---|---|---|
| `fastify` | `5.12.5` | No `engines` field in the published manifest; upstream migration guide states Node.js v20+ for Fastify v5 |
| `@nestjs/core` | `12.1.1` | `engines.node = ">= 20"` |
| `@nestjs/common` | `12.1.1` | peers include `class-validator >=0.13.2`, `class-transformer >=0.4.1`, `reflect-metadata`, `rxjs ^7.1.0` |
| `@nestjs/websockets` | `12.1.1` | peers include `reflect-metadata ^0.1.12 \|\| ^0.2.0`, `@nestjs/platform-socket.io` |
| `@nestjs/platform-socket.io` | `12.1.1` | peers `@nestjs/common`, `@nestjs/websockets`, `rxjs` |
| `@nestjs/platform-fastify` | `12.1.1` | peers add `@fastify/view`, `@fastify/static`, `@fastify/multipart` |
| `socket.io` | `4.8.4` | Matches the client's installed `socket.io-client@4.8.4` exactly |
| `socket.io-client` | `4.8.4` | Already a client dependency (`^4.8.4`) |
| `@socket.io/redis-adapter` | `8.3.0` | Peer-free; depends on `notepack.io` |
| `@socket.io/cluster-adapter` | `0.3.0` | Peer `socket.io-adapter ~2.5.5`; not needed for V1 |
| `ioredis` | `6.0.0` | `engines.node = ">=20.0.0"` |
| `redis` (node-redis) | `6.2.1` | `engines.node = ">= 20.0.0"` |
| `drizzle-orm` | `0.45.3` | Peer set includes `pg >=8`; pre-1.0 |
| `drizzle-kit` | `0.31.11` | `latest` dist-tag |
| `prisma` (CLI) | `8.0.0-rc.19` | **`latest` dist-tag resolves to a release candidate** |
| `@prisma/client` | `7.10.0` | Client `latest` is a stable 7.x while the CLI `latest` is an 8.x RC |
| `pg` | `8.23.0` | Wire driver |
| `zod` | `4.6.5` | Matches the client's installed `zod@^4.6.5` exactly |
| `vitest` | `5.0.2` | `engines.node = "^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0"` |
| `pino` | `10.3.1` | Fastify's built-in logger |

Two of these observations are decision-relevant and were not assumed:

1. **`prisma`'s `latest` dist-tag is a release candidate** while `@prisma/client`'s is
   a stable 7.x. Installing "prisma" today would either pin an RC or require manual
   alignment between CLI and client.
2. **`socket.io@4.8.4` is the same version as the client's `socket.io-client`.** The
   wire protocol is versioned by protocol revision, and client/server 4.x compatibility
   is documented by the Socket.IO project; matching minor versions is the lowest-risk
   configuration and requires no client change.

---

## 5. Upstream capability evidence

### 5.1 Fastify v5 Node support

From `fastify/fastify` `docs/Guides/Migration-Guide-V5.md` (upstream, main branch):

> Fastify v5 will only support Node.js v20+. If you are using an older version of
> Node.js, you will need to upgrade to a newer version to use Fastify v5.

Observed environment Node is `v22.23.2`, which satisfies this.

### 5.2 Socket.IO connection state recovery

From the published type definitions of `socket.io@4.8.4` (`dist/index.d.ts`):

```
connectionStateRecovery: {
    /**
     * The backup duration of the sessions and the packets.
     *
     * @default 120000 (2 minutes)
     */
    maxDisconnectionDuration?: number;
```

So Socket.IO 4.8.4 has a built-in, opt-in recovery mechanism that replays *missed
packets* for a bounded disconnection window (default 2 minutes). Its documented scope
is "the missed packets, the rooms the socket was in and the `data` attribute" — it is
a transport convenience, not a role-aware game snapshot.

### 5.3 Socket.IO broadcast exclusion

From the same type definitions, `io.except(...)` and chained
`io.except("room-101").except("room-102")` broadcast operators exist in 4.8.4. This
makes a *role-filtered broadcast* (everyone in the room except the drawer socket)
expressible without a dedicated secret-bearing room.

### 5.4 NestJS validation idiom

`@nestjs/common@12.1.1` declares `class-validator` and `class-transformer` as peer
dependencies. The framework's first-class `ValidationPipe` path is DTO classes +
class-validator. This matters because Stage 02 locked **Zod** as the non-negotiable
boundary validation library (D02-014).

---

## 6. Area A — Fastify vs NestJS

Requirements the framework must serve, taken from the PRD and the locked Stage 02
baseline:

| Requirement | Source |
|---|---|
| Node.js + TypeScript HTTP server | PRD "Recommended Tech Stack" / "Backend" |
| Socket.IO realtime alongside HTTP | PRD "Real-Time Architecture"; D02-007 (Socket.IO locked) |
| A server-authoritative game state machine | PRD "Game State"; NFR-005 |
| Zod at every boundary | PRD "Validation"; D02-014 (non-negotiable) |
| Modular structure a small team can maintain | NFR-010; `docs/AGENTS.md` §7 |
| Testability incl. 2/4/8-player multiplayer and failure tests | PRD "Testing Requirements"; `docs/AGENTS.md` §21–§22 |
| Single service, simple deployment | PRD "Infrastructure" (V1 single backend service); `docs/AGENTS.md` §8 |
| 8 players/room, many concurrent rooms | PRD NFR-003 |

Observations:

- **Neither framework implements the state machine.** The PRD's
  `WAITING -> STARTING -> ROUND_ACTIVE -> ROUND_FINISHED -> NEXT_ROUND ->
  ROUND_ACTIVE -> ... -> GAME_FINISHED` machine is hand-written in both cases.
  NestJS contributes dependency injection, modules and decorators — useful for large
  teams, neutral for a single-service game loop.
- **NestJS's opinionated validation path conflicts with a locked decision.** Its
  canonical DTO/`ValidationPipe` idiom is class-validator-based; D02-014 locks Zod.
  Using Zod inside NestJS is possible through a custom pipe but leaves the framework's
  golden path, so a stated benefit of the framework is not collected.
- **Fastify's Socket.IO story is a well-trodden integration, not a first-class
  feature.** Socket.IO attaches to the Node HTTP server (`fastify.server`). NestJS has
  a first-class Socket.IO gateway (`@nestjs/websockets` +
  `@nestjs/platform-socket.io`), at the cost of `reflect-metadata` and `rxjs` peers.
- **Performance is not a differentiator at this scale.** Both are Node HTTP servers;
  the PRD's V1 ceiling is 8 players per room. No benchmark was run, and none is
  claimed.
- **Dependency surface.** Fastify's runtime dependency set is `pino`, `avvio`,
  `find-my-way`, `@fastify/ajv-compiler`, `light-my-request` and similar; NestJS adds
  `reflect-metadata` and `rxjs` on top of whichever underlay is chosen. `light-my-request`
  also gives Fastify in-process HTTP injection for integration tests without binding
  a port.
- **Deployment.** Both are a single long-lived Node process. NestJS conventionally adds
  a compilation step (`nest build`) and decorator metadata settings in `tsconfig.json`.

**Not selected on popularity.** The PRD names both; the choice is made on the locked
Zod decision, on the fact that the framework does not supply the state machine, and on
dependency/deployment surface.

Alternatives enumerated for the decision record: NestJS on the default Express
platform; NestJS on the Fastify platform (`@nestjs/platform-fastify`); Fastify v5 with
a hand-composed module graph; Express (never a PRD candidate; excluded).

---

## 7. Area B — Socket.IO architecture

Observations relevant to the contract:

1. **Ordering.** Socket.IO rides on Engine.IO, which on WebSocket transport delivers
   frames over a single ordered TCP connection. Events from one socket arrive in send
   order. There is no ordering guarantee *between* different sockets, so any decision
   that depends on order must be made server-side at receipt.
2. **Rooms.** `socket.join(room)` / `io.to(room).emit(...)` are native. A Socket.IO
   room is convenient but is not private: anything emitted to a room reaches every
   member, so **no secret-bearing payload may ever be emitted to a room** (see Area F).
3. **Exclusion.** `io.to(room).except(socketId)` is available (Section 5.3), so a
   public variant can be broadcast to a room minus the drawer without a special room.
4. **Acknowledgements.** Socket.IO supports per-emit acknowledgement callbacks and a
   declarative ack timeout (`.timeout(ms).emit(...)`), which gives every client action
   a typed, correlated result without inventing a correlation protocol.
5. **Recovery.** `connectionStateRecovery` (Section 5.2) replays missed packets for a
   bounded window. It is opaque to game roles and cannot express "the drawer gets the
   secret word, the guesser does not", so it cannot be the authoritative restore path.
6. **Scale-out.** `@socket.io/redis-adapter` exists for multi-instance broadcast. V1 is
   a single service, so the adapter is inert at one instance; it exists to avoid a
   rewrite later.

---

## 8. Area C — Redis

The PRD states: "Redis — fast/transient state: active rooms, connected players, game
state, timers, session state, rate limiting, pub/sub."

Observation: that list mixes three genuinely different kinds of state, and the
distinction matters because losing Redis must not corrupt the permanent record:

| Kind | Examples from the PRD list | Correct treatment |
|---|---|---|
| Authoritative transient | active rooms, room state, game state, timers, connected players | Redis is the write-through home for the live aggregate, TTL-bounded |
| Persistent | (not in the Redis list) `users`, `rooms`, `games`, `rounds`, `scores`, `words`, `game_results` | PostgreSQL only |
| Derived / ephemeral | rate-limiting counters, spammed-message detection, leaderboard *ordering* derivable from scores, socket.io adapter pub/sub channels | Redis, freely discardable; recomputed or reset on loss |

Also observed: the PRD's "timers" is a *transition deadline*, not a countdown. Storing
`roundEndTime` (an absolute server-clock instant) and comparing to now is exactly what
`ProjectDocs/01-information-architecture.md` §14 requires ("The server owns:
`roundEndTime`"), and a stored countdown would drift.

---

## 9. Area D — PostgreSQL and the query layer

The PRD fixes the entity list: `users, rooms, room_players, games, rounds, scores,
words, game_results`, and states that drawing strokes need not be permanently
persisted in V1.

Observations that shape the schema:

1. `Room != Game != Round` (`docs/projectInfo.md` §7) — three tables, three lifetimes.
2. "Active room codes shall be unique" (PRD "Room Code") — uniqueness is scoped to
   *active* rooms, not to all time. A plain `UNIQUE` on the code column would forbid
   ever reusing a code; a partial unique index expresses the actual rule.
3. FR-029 ("record the order in which players correctly guess") is satisfied by the
   `scores` rows carrying `rank_in_round` — no separate guess-log table is required by
   the PRD, and adding one would be unrequested infrastructure.
4. `game_results` is a distinct terminal artifact from `scores`, because the final
   leaderboard is a summary the PRD names explicitly ("Final Scoreboard") and it must
   survive even if the round-level rows are later pruned.

Query-layer research: see the version table (Section 4). The material observation is
that `prisma`'s `latest` dist-tag currently resolves to a release candidate while
`@prisma/client`'s resolves to a stable 7.x, so "npm install prisma" today does not
give a matched stable CLI/client pair. No stability problem of that kind was observed
on the Drizzle pair (`drizzle-orm@0.45.3` / `drizzle-kit@0.31.11`), though both are
pre-1.0.

---

## 10. Areas E–M — contract observations

### E. State machine

The PRD names six states and the transitions between them. The PRD does **not**
define, for any state: entry condition, owner, timer, permitted player actions,
emitted events, persistence obligation, or reconnect representation. Those are Stage
03's job and are defined in `state-machine.md`.

Two PRD statements constrain the machine:

- "The client is never responsible for authoritative game-state transitions."
- Round completion has three triggers: timer zero, all eligible guessers correct, or
  server-terminated exceptional condition.

### F. Secret-word security

`docs/AGENTS.md` §10 forbids placing the secret word in public game state, in a room
broadcast, in unnecessary logs, or in client debugging output. `ProjectDocs/01-information-architecture.md`
§10 requires that guessers receive only the masked word. Stage 02 already enforces the
*client* half (D02-017 compartmentalized stores; `src/types/drawer-private.ts` is
deliberately outside the public barrel). Stage 03 must enforce the *server* half.

Observed gap: `socket.join(room)` broadcasts reach every member. Therefore any design
that emits a role-split payload by "sending the drawer payload to the room" is
structurally unsafe regardless of what the client does with it.

### G. Drawing

`docs/AGENTS.md` §16 and the PRD require discrete `DRAW_START` / `DRAW_MOVE` /
`DRAW_END` operations and explicitly forbid per-update screenshots. The locked client
constants are: `DRAW_MOVE_BATCH_SIZE = 10`, `MAX_POINTS_PER_STROKE = 300`,
`STROKE_HISTORY_MS = 30_000`, brush `1..20`. The client's `Point` is normalized
`0..1` with optional `pressure`, and its `Stroke` carries a client-generated `id` and
an `erased` flag. The server contract must be compatible with these values rather
than invent parallel ones.

The PRD does not define: stroke identity semantics, sequence numbers, ACK
requirements, validation bounds, or late/duplicate handling.

### H. Guessing

PRD FR-027..FR-031 fix: server processes guesses; server normalizes (case,
whitespace); server records correct-guess order; no second ranking for an
already-correct player; server determines the final ranking. The PRD does not define
the ordering *mechanism* for simultaneous guesses, nor a near-miss ("close") concept.

Observed: `ProjectDocs/01-screen-state-map.md` §12 and IA §8 define a `CLOSE` /
`CLOSE_GUESS` guesser state with the message "OOOH... CLOSE". This is a **design-document
requirement that the PRD does not state.** It is a real requirement (the approved UI
shows it) but it is not PRD-derived, and it implies server-side near-match computation
without ever sending the word.

### I. Chat

PRD "Chat": guess messages, normal discussion, system messages, correct-answer
notifications; max length, rate limiting, spam protection, profanity filtering, player
mute, host kick, and report functionality **in later versions**. Message types are
fixed by the IA as `NORMAL`, `GUESS`, `SYSTEM`, `CORRECT_GUESS`.

Observed contradiction: `ProjectDocs/01-information-architecture.md` §23 and
`01-screen-state-map.md` §19 list `REPORT_PLAYER` as a context-menu action, while the
PRD explicitly defers report to a later version. Recorded, not silently resolved.
Resolution recorded in `decision.md`.

Security observation: broadcasting a *correct* guess verbatim would leak the answer.
The PRD requires a correct-answer notification, so the notification must be designed
to carry identity and rank without the word.

### J. Reconnection

PRD FR-010 requires reconnection "where technically possible"; NFR-004 lists
WebSocket disconnection and app backgrounding/reopening. Stage 02 locked
snapshot-based restoration (D02-010 / AD-009) and explicitly deferred the event names
to Stage 3: "Define `request:state:snapshot` / `response:state:snapshot` event pair in
Stage 3". The client's `ServerToClientEvent` enum does **not** yet contain those names,
nor per-player connection events.

Observed gap: the client's `Player` type already has `isConnected: boolean`, but the
locked client event enum has no `player:disconnected` / `player:reconnected`. The
field exists without an event to write it.

### K. REST

Stage 02 fixed the REST boundary as request/response only, with a specific endpoint
skeleton (`POST /session`, `PUT /session/nickname`, `POST /rooms`, `POST /rooms/join`,
`PUT /rooms/:id/config`, `GET /settings`) and explicitly excluded game state,
realtime events, drawing and guessing. Stage 03 must decide whether that skeleton is
sufficient and what it returns.

### L. Error model

The client already ships an `ApiError` class with a user-facing message switch keyed
on HTTP `0/400/401/404/409/429/500` (`src/api/client.ts`). A Stage 03 error model that
does not map onto those statuses would force client rework. `docs/AGENTS.md` §13
requires that internal detail never reaches the user.

### M. Shared types

`docs/projectInfo.md` §43 lists "shared type package structure" as pending. Stage 02
AD-008 locked "no monorepo for V1" with the explicit reasoning that the server did not
exist and that "when Stage 3 creates the backend, shared types can be extracted into a
workspace package". Stage 03 therefore owns the decision, and it must be made without
destabilising the verified Expo client's module resolution.

---

## 11. Contradictions and gaps discovered

Recorded here rather than resolved silently. Dispositions are in `decision.md`.

| # | Item | Source A | Source B | Class |
|---|---|---|---|---|
| C-01 | `Room.status` is listed as a room property | `docs/projectInfo.md` §6 | No approved document defines its values; Stage 02 deliberately left it unmodelled | Product ambiguity |
| C-02 | Minimum players | PRD "2–8 players", FR-019 "minimum player requirement" | No approved value for the minimum | Product ambiguity |
| C-03 | Report feature | IA §23 / screen-state map §19 list `REPORT_PLAYER` | PRD defers "report functionality (later versions)" | Product ambiguity |
| C-04 | Hint trigger authority | ADR §12: `hint:request` "Must be drawer" | PRD does not state who triggers a hint | Product ambiguity |
| C-05 | Drawer grace-period duration | PRD: "shall be configurable" | No approved value | Product ambiguity |
| C-06 | Whether the round timer pauses while the drawer is in its grace period | PRD silent | Stage 03 must choose | Architecture |
| C-07 | Drawer bonus value | PRD: "shall be configurable" | No approved value | Product ambiguity |
| C-08 | Hint reveal algorithm | PRD gives one worked example only | No defined algorithm | Product ambiguity |
| C-09 | Near-miss ("CLOSE") guesses | IA §8 / screen-state map §12 require a `CLOSE` state | PRD never mentions near-miss detection | Product ambiguity |
| C-10 | Per-player connection events | `Player.isConnected` exists in the client contract | No client event writes it | Architecture |
| C-11 | Documentation path drift | `docs/projectInfo.md` §44 and `docs/AGENTS.md` §18 cite `docs/01-information-architecture.md` | Actual file is `ProjectDocs/01-information-architecture.md` (already recorded in Stage 02 `flow.md` §5) | Documentation |
| C-12 | "Typical event propagation under 200ms" | PRD NFR-001 | "Typical" is not defined as a percentile | Product ambiguity |

---

## 12. Research limitations (stated, not hidden)

1. **No performance measurement was performed.** No benchmark, no FPS sample, no
   latency sample, no load test. AD-004's three clauses remain unmeasured.
2. **No device is attached.** `adb devices` returned an empty list in this session, so
   even a manually driven on-device check was impossible.
3. **No backend exists**, so no framework claim could be validated against a running
   server. Framework observations are drawn from upstream manifests and upstream
   documentation, and are attributed as such.
4. **Version facts are point-in-time** (2026-09-30) and must be re-checked at
   implementation time. In particular, the `prisma` `latest` tag resolving to a
   release candidate is a snapshot observation, not a permanent property.
5. The PRD PDF was read via `pdftotext` layout extraction. Text extraction can reorder
   table cells; every requirement cited in these artifacts was read from the extracted
   text and cross-checked against the duplicated requirement text in
   `docs/projectInfo.md` where one exists.

---

## 13. AD-004 evidence state (as required by Stage 02)

Stage 02 left AD-004 CONDITIONAL with three unmeasured clauses. Current evidence state:

| Clause | Required | Evidence present | Evidence missing |
|---|---|---|---|
| 1 | >=60 FPS sustained local stroke rendering on a mid-tier physical device | None | Instrumentation, a physical device, and measured frame timings |
| 2 | 8 clients render the same live stroke stream without frame drops | None | The realtime server, 8 attached clients, and measured frame timings |
| 3 | Typical event propagation <200 ms | None | The realtime transport, a clock-offset method, and measured propagation samples |

Modality availability verified in Stage 02 and unchanged: Skia 2.6.2 is bundled in
Expo Go for SDK 57. That is a *build-time/APK-level* fact and says nothing about
runtime rendering behaviour.

**AD-004 remains CONDITIONAL.** The measurement protocol is designed in
`testing-strategy.md` §7 and `decision.md` → D03-025. No clause is claimed as met.

---

## 14. What this research did not do

- Did not write any implementation code, migrations, handlers, or routes.
- Did not modify the verified Stage 02 client, its configuration, or its ADR.
- Did not reopen any locked Stage 02 decision. Where Stage 03 supersedes a Stage 02
  deferral (shared types), it does so because Stage 02 explicitly assigned that
  decision to Stage 3, and the supersession is recorded in `decision.md`.
- Did not select any technology on popularity, and did not fabricate a measurement.