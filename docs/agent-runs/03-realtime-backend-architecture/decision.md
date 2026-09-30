# Stage 03 — Realtime + Backend Architecture: Decision Ledger

**Stage:** 03 — Realtime + Backend Architecture
**Document:** Decision ledger (the authority for Stage 03)
**Version:** 1.0
**Status:** LOCKED (architecture review pending — see §7)
**Project:** DoodleBee
**Date:** 2026-09-30
**Baseline:** Stage 02 ADR v2.1 (LOCKED). Stage 03 does not reopen Stage 02 decisions
unless a genuine contradiction is recorded in §5.

---

## 0. How to read this document

This is the Stage 03 decision ledger. It is the document that outranks the other
Stage 03 artifacts. Where `architecture-research.md`, `realtime-contract.md`,
`state-machine.md`, `server-state-writer-map.md`, `data-model.md`,
`api-contract.md`, `reconnect-protocol.md`, `security-model.md` or
`testing-strategy.md` describe a design, this ledger states the decision and why.

### 0.1 Status vocabulary

| Status | Meaning |
|---|---|
| **APPROVED** | Decided, with evidence sufficient to implement. |
| **APPROVED_WITH_CONDITIONS** | Decided, but an explicitly listed condition must be satisfied or re-checked before or during implementation. The condition is recorded in §6. |
| **PROPOSED** | A concrete value chosen to unblock design, but the *source of truth* (usually the PRD) does not fix it. Implementation may proceed on the proposal, but the proposal is a placeholder that must be confirmed or changed by the product owner. Never treated as PRD-mandated. |
| **DEFERRED** | Deliberately not decided in Stage 03. Listed in §4 with the reason and the stage that owns it. |
| **SUPERSEDES** | Explicitly replaces an earlier decision or an upstream deferral. Every supersession is argued in the decision record and listed in §3. |

**PROPOSED is not APPROVED.** A PROPOSED value is not evidence and must not be
presented to the user as a product requirement. It exists so implementation is not
blocked by an unstated value, and it is flagged wherever it is used.

### 0.2 Decision record shape

Every decision below carries the same six fields:

- **Decision** — the decision itself, in one sentence.
- **Evidence** — what was actually observed (file, upstream manifest, PRD line,
  client constant). Evidence is never a measurement unless a measurement was taken.
- **Alternatives considered** — what was rejected.
- **Reason** — why this option wins for DoodleBee V1 specifically.
- **Consequences** — what this decision forces, enables, or forecloses.
- **Implementation implications** — what the implementer must do differently
  because of it.

### 0.3 What this ledger does not contain

No implementation, no code, no migrations, no handler bodies. Stage 03 is design.
AD-004 is **not** marked met anywhere in this document (see D03-025 and §7).

---

## 1. Decision ledger

| ID | Decision | Status | Design detail |
|---|---|---|---|
| D03-001 | Backend framework: Fastify v5, not NestJS | APPROVED | `architecture-research.md` §6 |
| D03-002 | Realtime transport: Socket.IO 4.8.4, single default namespace | APPROVED | `realtime-contract.md` §1—§2 |
| D03-003 | Room topology: one public room per game; no secret-bearing room | APPROVED | `realtime-contract.md` §4; `security-model.md` §3 |
| D03-004 | Acknowledgement: typed ack on every gameplay event | APPROVED | `realtime-contract.md` §10 |
| D03-005 | Idempotency and ordering: `eventId`, server-receipt order, `version` | APPROVED | `realtime-contract.md` §11 |
| D03-006 | Storage split: Redis authoritative transient; PostgreSQL system of record | APPROVED | `data-model.md` §1 |
| D03-007 | Redis key model, TTLs, absolute-instant timers | APPROVED | `data-model.md` §3 |
| D03-008 | PostgreSQL schema (8 entities) | APPROVED | `data-model.md` §2 |
| D03-009 | Query layer: Drizzle ORM + drizzle-kit | APPROVED_WITH_CONDITIONS | `data-model.md` §5—§6 |
| D03-010 | Game lifecycle: 6 PRD phases; room status modelled separately | APPROVED | `state-machine.md` §1—§3 |
| D03-011 | Drawer selection: random, never the previous drawer | APPROVED | `state-machine.md` §6.1 |
| D03-012 | Round-end triggers: exactly three; no drawer bonus on `DRAWER_ABANDONED` | APPROVED | `state-machine.md` §5 |
| D03-013 | Scoring authority: server-only, PRD rank table | APPROVED | `data-model.md` §2.7 |
| D03-014 | Hint authority: drawer-triggered, server-computed derived mask | APPROVED | `security-model.md` §3.3 |
| D03-015 | Secret-word transport and projection | APPROVED | `security-model.md` §3; `realtime-contract.md` §9.1 |
| D03-016 | Drawing protocol: `strokeId`, `strokeSeq`, `pointIndex` | APPROVED | `realtime-contract.md` §9.8 |
| D03-017 | Guess handling: normalization + atomic rank assignment | APPROVED | `realtime-contract.md` §9.4 |
| D03-018 | Chat: one `chat:message` with a `type` discriminator | APPROVED | `realtime-contract.md` §9.3 |
| D03-019 | Session identity: opaque token; snapshot request/response pair | APPROVED | `reconnect-protocol.md` §1—§2 |
| D03-020 | Disconnect grace: guesser 30 s / drawer 15 s; host transfer immediate | APPROVED_WITH_CONDITIONS | `reconnect-protocol.md` §6 |
| D03-021 | REST surface: 6 endpoints + `GET /health` | APPROVED | `api-contract.md` §2 |
| D03-022 | Error taxonomy mapping to the client's 0/400/401/404/409/429/500 | APPROVED | `api-contract.md` §5 |
| D03-023 | Shared contract at `shared/contract/`, synced verbatim copies, `contract:sync`/`contract:check` | APPROVED | D03-023 below; `architecture-research.md` §10 (M) |
| D03-024 | Testing: vitest + Fastify inject server-side; Jest client-side; one contract suite | APPROVED | `testing-strategy.md` §1—§3 |
| D03-025 | AD-004 measurement protocol defined; AD-004 remains CONDITIONAL | APPROVED_WITH_CONDITIONS | `testing-strategy.md` §7 |
| D03-026 | `Room.status` — see D03-026 for the value set | PROPOSED | `state-machine.md` §1.1 |
| D03-027 | `MIN_PLAYERS` — see D03-027 for the value | PROPOSED | `state-machine.md` §2 |
| D03-028 | Default timings (countdown, results, graces, TTLs) | PROPOSED | `state-machine.md` §8 |
| D03-029 | Report action deferred from V1 (PRD beats IA) | APPROVED | `security-model.md` §5.1 |
| D03-030 | Six additive server→client events + one client→server event | APPROVED_WITH_CONDITIONS | `realtime-contract.md` §8 |
| D03-031 | V1 is a single backend service; no microservices, Kafka, K8s, service mesh, or second database | APPROVED | `architecture-research.md` §9 |

---

## 2. Decision records
### 2.1 D03-001 — Backend framework: Fastify v5

**Decision.** DoodleBee V1's backend is a single Fastify v5 application in TypeScript.

**Evidence.** `architecture-research.md` §6. Fastify 5.12.5 was observed on the npm
registry with no `engines` field, and the Fastify v5 migration guide states "Fastify v5
will only support Node.js v20+" — compatible with the observed Node v22.23.2.
`@nestjs/core` 12.1.1 declares `engines.node >= 20`. Both are Node 20+ viable, so
runtime support does not separate them.

**Alternatives considered.** (a) NestJS — decorators, DI container, opinionated module
system; (b) Fastify — plugin encapsulation, schema-first validation; (c) raw Node HTTP
— rejected as unnecessary construction work for V1.

**Reason.** The Stage 03 system is *small and single-service* (D03-031): one HTTP
surface with seven routes and one Socket.IO gateway. NestJS's DI and module system pay
off on large multi-module teams; here it adds indirection over the exact areas the
project golden rule asks us to keep explicit (server authority, writer map). Fastify's
plugin encapsulation gives per-plugin isolation and its validation is native, which
matches the D03-022 error taxonomy better than Nest's pipe/exception-filter stack. Fastify
is also the underlying HTTP layer of Nest's Fastify adapter, i.e. choosing Fastify is a
subset of Nest's dependency graph.

**Consequences.** We own our own wiring (no DI). Testability comes from Fastify
`inject()` (D03-024) rather than from a testing module abstraction. If the backend ever
grows into multiple independently deployed services, this decision should be revisited —
but D03-031 forbids that for V1.

**Implementation implications.** One `createApp()` factory returning a Fastify instance
with plugins registered in a fixed order; no decorators, no DI container, no module
metadata. Socket.IO attaches to the same Fastify HTTP server (single port) so the
realtime and REST lifecycles share one process and one shutdown path.

---

### 2.2 D03-002 — Socket.IO 4.8.4 on a single default namespace

**Decision.** Realtime uses Socket.IO 4.8.4 served by the Fastify process, over the
WebSocket transport, with **one** namespace (`/`). No second namespace in V1.

**Evidence.** `architecture-research.md` §4—§5; `realtime-contract.md` §1—§2.
`socket.io@4.8.4` and `socket.io-client@4.8.4` are the same version on the registry,
matching the PRD's Socket.IO requirement and the Stage 02 client dependency.

**Alternatives considered.** (a) raw `ws`; (b) Socket.IO with separate `/game` and
`/chat` namespaces; (c) Socket.IO with namespaces per room.

**Reason.** Socket.IO is named by the PRD, already a client dependency, and provides
reconnection, acknowledgements and room multiplexing out of the box — all of which
Stage 03 needs. Namespaces exist to separate *authorization domains*; DoodleBee has one
authorization model (a session token scoped to one room), so multiple namespaces would
duplicate the auth handshake and split the writer map for no gain. Namespaces-per-room
do not scale (a namespace is a server-level object with its own adapter state) and would
fragment the single Redis adapter.

**Consequences.** Rooms are Socket.IO *rooms* inside namespace `/`, not namespaces
(D03-003). All events share one auth boundary, so authorization must be enforced per
event rather than per-namespace.

**Implementation implications.** `io.of('/')` only. Room membership is
`socket.join(roomId)`. Never create a namespace at runtime.

---

### 2.3 D03-003 — One public room; the secret never gets its own room

**Decision.** Each game has exactly **one** Socket.IO room (`roomId`). There is no
"drawer-only" or "secret" room. The drawer-only projection of an event is delivered by
targeting the drawer's **socket ids** only.

**Evidence.** `realtime-contract.md` §4 and §9.1; `security-model.md` §3.2.
`socket.io@4.8.4` exposes `io.except(...)` (verified in `dist/index.d.ts`), so a single
room-wide broadcast can exclude the drawer without a second room.

**Alternatives considered.** (a) a second `roomId:drawer` room holding only the drawer;
(b) sending the secret to everyone and trusting clients; (c) per-socket emit loops only.

**Reason.** A secret-bearing room is a second membership list to keep consistent on
join, leave, reconnect, host transfer and drawer rotation — five failure points for one
benefit. Socket-id targeting is exact and is already required for reconnection
(drawer resumption) and host transfer. Excluding the wrong audience is a *visible*
bug (drawer sees no word), whereas a leaked secret room is an *invisible* one, and
DoodleBee's anti-cheat posture (PRD, `security-model.md`) prefers the failure that is
loud.

**Consequences.** Reconnect must re-resolve "which socket is the drawer" before the
next drawer-only emit. Socket-id targeting is only valid for currently-connected
sockets, so a drawer in its grace period receives the secret on rejoin, not before.

**Implementation implications.** A helper that resolves "drawer sockets for room R,
currently connected" is the single path for drawer-only emits. Never broadcast a
secret-bearing payload into the room and filter client-side.

---

### 2.4 D03-004 — Typed acknowledgement on every gameplay event

**Decision.** Every client→server gameplay event carries an acknowledgement
callback and the server replies with the typed envelope defined in
`realtime-contract.md` §10.1: `{ ok: true, data? }` or `{ ok: false, error: { code, message } }`.

**Evidence.** `realtime-contract.md` §10; `api-contract.md` §5.3. The Stage 02
client already switches on error codes 0/400/401/404/409/429/500
(`ApiError.userMessage()`), so the ack error vocabulary is constrained by an existing
client contract.

**Alternatives considered.** (a) fire-and-forget events with a separate `error` event;
(b) Socket.IO's built-in `timeout()` only; (c) both ack and a global error event.

**Reason.** Acknowledgements give the sender a *correlated* result — essential for
`draw:move` (D03-016) and `guess:submit` (D03-017), where the client needs to know
whether its input was accepted, rejected as duplicate, or rejected as already-solved. A
separate global `error` event has no correlation and cannot distinguish "your guess was
wrong" (a normal game outcome, not an error) from "your guess was malformed". Using ack
alone keeps one result channel.

**Consequences.** Every client→server handler must be `async` and must call the ack
exactly once on every path, including thrown exceptions. A dropped ack is a client-side
timeout (D03-004 consequence handled in `realtime-contract.md` §10.3).

**Implementation implications.** A single `withAck(schema, handler)` wrapper validates
the payload, enforces auth, runs the handler, and guarantees exactly-one ack with a
normalized error. Handlers cannot emit `error` events; they return or throw.

---

### 2.5 D03-005 — Idempotency (`eventId`), server-receipt ordering, and `version`

**Decision.** Client→server gameplay events carry a client-generated `eventId`.
The server deduplicates on it, and orders all concurrent events by **server receipt
time** (not by client timestamps or client sequence). Server→client state-bearing
payloads carry a monotonically increasing `version` scoped to the room.

**Evidence.** `realtime-contract.md` §11, §5.1; `server-state-writer-map.md` §3.
The Stage 02 client contract has no version counter, so `version` is an additive field
(D03-030).

**Alternatives considered.** (a) trust client timestamps for ordering; (b) Lamport/
vector clocks; (c) no dedupe, accept double-application.

**Reason.** Clients cannot be trusted for ordering (anti-cheat, PRD) and phone clocks
drift. Retried events after a reconnect are real (Socket.IO buffers), so dedupe is
required for correctness of scoring (D03-013) and drawing (D03-016). Server receipt
order is the only order all clients can be made to agree on, and `version` lets a
client detect that it is behind without re-deriving state.

**Consequences.** The server keeps a short-lived seen-`eventId` set per room (Redis,
D03-007). Ordering is therefore *arrival* ordering: a stroke sent 10 ms later but arriving
first is ordered first. This is acceptable and must be documented rather than hidden.

**Implementation implications.** Dedupe and ordering happen in one place per event type.
Two clients' events in the same millisecond are broken by arrival; the tie-break rule is
recorded in `server-state-writer-map.md` §4. `eventId` is opaque to the server.

---

### 2.6 D03-006 — Storage split: Redis is authoritative transient, PostgreSQL is the system of record

**Decision.** Live game state is authoritative in **Redis** for the duration of a
room's life. PostgreSQL is the permanent system of record and the source of the room's
persistent identity. Caches, rate-limit counters and dedupe sets are **derived** and
disposable.

**Evidence.** `data-model.md` §1. The PRD names both PostgreSQL and Redis. Stage 02
left the split undefined.

**Alternatives considered.** (a) PostgreSQL only, with in-memory state in the Node
process; (b) Redis only (Redis as the system of record); (c) both, with no stated
authority.

**Reason.** A single backend service can hold live state in process memory, but that
makes the process a single point of truth that cannot survive a restart and cannot be
observed by any future second process. Redis gives a shared, restart-survivable home for
transient state with TTLs that match the room lifecycle naturally. PostgreSQL is the
wrong home for 20 Hz stroke traffic but the right home for anything a user must be able
to see after the room is gone. Making the split explicit prevents the classic bug of
two writers to the same field.

**Consequences.** A room that outlives its Redis TTL loses live state; the durable
record survives. Redis is a *hard dependency* at runtime — no Redis, no live game.
This is acceptable for V1 and is stated as a deployment requirement.

**Implementation implications.** Every authoritative field has exactly one storage home
(`server-state-writer-map.md` §2). Reads that must not be lost read PostgreSQL; reads
on the hot path read Redis.

---

### 2.7 D03-007 — Redis key model, TTLs, and absolute-instant timers

**Decision.** Redis holds one hash per room aggregate, one hash per game/round, and
small derived keys for dedupe and rate limiting. **Timers are stored as absolute
instants** (`deadlineAt` epoch ms), never as "seconds remaining", and never as a
server-side `setTimeout` as the source of truth.

**Evidence.** `data-model.md` §3; `state-machine.md` §8. The PRD requires
multiple rounds, hints and a round timer; Stage 02's client shows a countdown.

**Alternatives considered.** (a) `setTimeout` as authority; (b) storing remaining
seconds; (c) a separate Redis key per timer.

**Reason.** `setTimeout` does not survive a process restart and drifts under load;
"seconds remaining" drifts with every read and makes reconnect (D03-019) compute a
different value than the original broadcast. A stored deadline makes the timer a pure
function of `now` and is identical for every observer, including a reconnecting one.
Client-side countdowns are then cosmetic.

**Consequences.** Round expiry is enforced by a sweep that compares `now` to
`deadlineAt` — the state machine's timer transition is idempotent and re-entrant.

**Implementation implications.** One `deadlineAt` per timed phase, written by the phase
transition. `setTimeout` may be used only as a *wake-up hint*; correctness must never
depend on it firing.

---

### 2.8 D03-008 — PostgreSQL schema: eight entities

**Decision.** Eight tables: `users`, `words`, `rooms`, `room_players`, `games`,
`rounds`, `scores`, `game_results`. Room codes are unique among **active** rooms via a
partial unique index, and score writes are idempotent.

**Evidence.** `data-model.md` §2. The PRD names these entities; `scores` and
`game_results` are separated because a per-round score and a final result have different
lifecycles.

**Alternatives considered.** (a) fewer tables with JSON blobs; (b) a `game_events`
append-only log as the primary record; (c) storing strokes permanently.

**Reason.** The entity list is the PRD's own. Keeping `scores` (per round, per player)
separate from `game_results` (per game, per player, final) means the leaderboard is a
read of `game_results` and the round breakdown is a read of `scores`, with no
recomputation. A JSON blob would make the leaderboard a parsing problem. An event log is
more infrastructure than V1 needs. Strokes are explicitly **not** persisted
(`data-model.md` §8) — no requirement needs them after the round.

**Consequences.** Schema changes are migrations (`data-model.md` §6). The partial
unique index means a room code may be reused after its room closes.

**Implementation implications.** Idempotent writes use the natural key (e.g.
`(room_id, round_number, player_id)` for `scores`) as the conflict target. No table
stores the secret word in plaintext where a guesser-adjacent read could reach it
(`security-model.md` §3).

---

### 2.9 D03-009 — Query layer: Drizzle ORM + drizzle-kit

**Decision.** PostgreSQL access uses Drizzle ORM (`drizzle-orm` 0.45.3) with
`drizzle-kit` 0.31.11 for migrations. **Status: APPROVED_WITH_CONDITIONS** — Drizzle
is pre-1.0; the version must be pinned and re-checked at implementation time.

**Evidence.** `architecture-research.md` §4, §9; `data-model.md` §5—§6.
Observed `latest`: drizzle-orm 0.45.3, drizzle-kit 0.31.11, pg 8.23.0, zod 4.6.5.
Notably `prisma` `latest` resolved to 8.0.0-rc.19 (a release candidate) while
`@prisma/client` `latest` resolved to 7.10.0 — a version skew that is itself evidence.

**Alternatives considered.** (a) Prisma; (b) Kysely; (c) `pg` with hand-written SQL.

**Reason.** Drizzle is a TypeScript-first query builder with no separate engine binary
and no code-generation step at runtime, which keeps the single-service deployment
(D03-031) simple. Prisma requires a generation step and, as observed, is currently
publishing an RC under its `latest` tag — an avoidable risk for a V1 that must be
reproducible. The shared-contract decision (D03-023) already uses Zod; Drizzle's
`drizzle-zod` path keeps one validation vocabulary rather than introducing a second.
Kysely would work but gains nothing over Drizzle here.

**Consequences (conditions).** Because Drizzle is pre-1.0: (1) exact versions must be
pinned; (2) the version pair must be re-verified at implementation start; (3) any
breaking change between now and implementation is expected and must not be treated as a
surprise. This is recorded in §6.

**Implementation implications.** Schema lives in TypeScript; migrations are generated
files committed to the repo. No `prisma generate` step, no separate migration engine
binary.

---

### 2.10 D03-010 — Game lifecycle: six PRD phases, with room status modelled separately

**Decision.** The game's authoritative lifecycle has exactly the **six PRD phases**:
`WAITING` → `STARTING` → `ROUND_ACTIVE` → `ROUND_FINISHED` → `NEXT_ROUND` →
(`ROUND_ACTIVE` ...) → `GAME_FINISHED`. Room *status* (whether the room itself is
open, in play, or closed) is a **separate** field, not a phase.

**Evidence.** `state-machine.md` §1—§3. The six-phase sequence is the PRD's own
(`Draw_and_Guess_PRD.pdf`, server-authoritative state machine). C-01 records that
`Room.status` was listed as a property with no defined values.

**Alternatives considered.** (a) flatten room status into the phase list; (b) add a
`LOBBY`/`PAUSED` phase; (c) model only the PRD phases and leave room status unmodelled.

**Reason.** The PRD sequence is a *game* lifecycle. A room can exist before a game and
after one, so conflating the two produces states the PRD never named (a "waiting room"
that is also "game finished") and makes the leaderboard lifecycle unclear. Two
lifecycles with an explicit relationship is the smallest model that covers both without
inventing phases. Adding a `PAUSED` phase was rejected: the PRD's answer to a drawer
disconnect is a grace period inside `ROUND_ACTIVE` (D03-020), not a new phase.

**Consequences.** Every event and writer must say whether it is a room-status change or
a phase change. `NEXT_ROUND` is a real, observable phase with its own entry condition
and short duration, not an implementation detail.

**Implementation implications.** One phase enum (the six PRD values) and one room-status
enum (D03-026). The state machine's transition table (`state-machine.md` §4) is the
only place a transition is legal.

---

### 2.11 D03-011 — Drawer selection: random, never the same drawer twice in a row

**Decision.** The drawer for a round is chosen uniformly at random from eligible
players, **excluding the previous round's drawer** when more than one player is eligible.

**Evidence.** `state-machine.md` §6.1. The PRD requires the drawer to change across
rounds but does not specify the rule.

**Alternatives considered.** (a) strict rotation; (b) pure random with repetition
allowed; (c) host-chosen drawer.

**Reason.** The PRD success criterion explicitly requires "drawer changes" between
rounds, which pure random-with-repetition can violate. Strict rotation is predictable,
which is a mild anti-cheat and fairness concern (a player can count turns). Random-with-
no-immediate-repeat satisfies "drawer changes" while staying unpredictable. Host-chosen
would make the host a gameplay authority, contradicting the server-authoritative
principle.

**Consequences.** Selection is server-side and uses a server RNG. With exactly two
players, exclusion leaves exactly one candidate — the drawer strictly alternates, which
is correct behaviour.

**Implementation implications.** Selection runs at `ROUND_ACTIVE` entry, records the
result, and persists the previous drawer so the exclusion survives a restart. The RNG
must be server-side only; the client never proposes a drawer.

---

### 2.12 D03-012 — Exactly three round-end triggers

**Decision.** A round ends on exactly one of: (1) **all eligible guessers have guessed
correctly**, (2) **the round timer expires**, or (3) **the drawer abandoned the round**
(grace expiry, FR-026 path). If the round ends because the drawer abandoned it, the
drawer receives **no** round bonus.

**Evidence.** `state-machine.md` §5. The PRD requires round completion on timer
expiry and on all-correct; the abandonment path follows from the disconnect requirement.

**Alternatives considered.** (a) a fourth trigger on host action; (b) no abandonment
trigger (leave the round hanging); (c) award the drawer bonus on abandonment.

**Reason.** Three triggers cover every way the PRD's success criterion can progress
without deadlock. A host-triggered end would make the host able to end a round mid-
play — unnecessary authority. If the drawer leaves, the round cannot fairly continue
(the drawing stops), so the abandonment trigger is required. Withholding the bonus is
what makes abandonment *not* a winning strategy for the drawer.

**Consequences.** The round can end with zero correct guesses (timer expiry), which the
scoring table (D03-013) must handle. The exactly-three rule means a fourth condition is
a design bug, not a feature.

**Implementation implications.** Three named trigger reasons on the round-end path. The
scoring call receives the trigger reason so it can suppress the drawer bonus.

---

### 2.13 D03-013 — Scoring authority: server-only, PRD rank table

**Decision.** Only the server computes or writes scores. The scoring basis is the
PRD's rank-based table (earlier correct guess ranks higher), applied when a guess is
accepted as correct. **No** client-submitted score is ever trusted or accepted.

**Evidence.** `data-model.md` §2.7; `server-state-writer-map.md` §2.4; `security-model.md`
§2, §4. The PRD requires server-authoritative state and ranks guesses.

**Alternatives considered.** (a) client reports its own score; (b) host computes scores;
(c) continuous time-based scoring.

**Reason.** Score is the game's outcome; it is exactly the field an attacker would
tamper with. Any client- or host-computed score is unverifiable. Rank-based scoring
follows directly from the server being the only component that can order simultaneous
guesses (D03-017).

**Consequences.** The scoring function is pure and deterministic given
`(guessRank, guessCount, triggerReason)` and is unit-testable in isolation. The exact
point values beyond the PRD's ranking and the drawer-bonus magnitude are **PROPOSED**
(D03-013 record below and C-07).

**Implementation implications.** The scoring function takes no clock and no I/O. It is
the only writer of `scores` and `game_results`. Client score updates are render-only
consequences of server events.

---

### 2.14 D03-014 — Hint authority: drawer-triggered, server-computed derived mask

**Decision.** Hints are triggered by the **drawer** and computed by the server. A hint
reveals positions of the secret word via a server-derived mask; the mask is a pure
function of `(secretWord, hintIndex)`. The client never receives the word through a hint.

**Evidence.** `security-model.md` §3.3; `state-machine.md` §8. IA §7.1 attributes
the hint request to the drawer, which resolves C-04. The PRD gives one worked example
only, which is C-08.

**Alternatives considered.** (a) automatic hints on a timer; (b) guesser-triggered
hints; (c) send the masked word as a string of underscores computed on the client.

**Reason.** A drawer-triggered hint is the only reading consistent with the IA, and it
keeps hints a *drawer* resource (like the secret) rather than a shared one. Computing
the mask on the server is mandatory: sending anything from which a client could derive
unrevealed letters would defeat the secret-word protection (D03-015). Sending the
already-masked representation keeps the client's rendering job trivial and its
knowledge minimal.

**Consequences.** The number of hints is bounded by config (client allows 0–5). Hint
state is authoritative and must be in the reconnect snapshot (D03-019) so a reconnecting
guesser sees the same mask.

**Implementation implications.** One pure `maskWord(word, hintIndex)` function shared by
the live path and the snapshot path so they can never disagree. The algorithm is
**PROPOSED** (C-08) and must be confirmed.

---

### 2.15 D03-015 — Secret-word transport and projection

**Decision.** The secret word may appear in exactly four places, all server-controlled:
(1) the drawer's `drawer:selected` payload, (2) the drawer's reconnect snapshot, (3)
the drawer's hint response, and (4) server-side storage. **No public payload has a
property that contains the word.** Public projections carry only the masked
representation and the word's length.

**Evidence.** `security-model.md` §3; `realtime-contract.md` §9.1; `docs/AGENTS.md` §10
(secret information). C-09 records that a `CLOSE`/near-miss state is required by the IA
but not by the PRD.

**Alternatives considered.** (a) hash the word and compare hashes; (b) send the word to
all clients with a `hidden` flag; (c) a separate `secret:reveal` event per viewer.

**Reason.** "All clients are honest" is not a security model. A property that exists in
a public payload will be read — a `hidden: true` flag is not protection. Hash comparison
was rejected because the word list is small enough to brute-force a hash offline, and
because near-miss detection (C-09) needs distance, not equality. Role-split payloads
(D03-003) are the only projection that is enforced by *transport*, not by client
behaviour.

**Consequences.** Two payload shapes exist for `drawer:selected` — a drawer shape with
the word and a public shape without it. The public shape must not even have the property
(present-but-null is a leak waiting to happen).

**Implementation implications.** A projection function is the only way to serialize the
word-bearing state. Logging, error messages, analytics and crash reports must go through
a redacting serializer (`security-model.md` §3.5).

---

### 2.16 D03-016 — Drawing protocol: `strokeId`, `strokeSeq`, `pointIndex`

**Decision.** Drawing uses `DRAW_START`, `DRAW_MOVE`, `DRAW_END` with three identity
levels: `strokeId` (per stroke), `strokeSeq` (monotonic per drawer per round), and
`pointIndex` (monotonic within a stroke). Payloads carry points only — no server-side
geometry validation. Limits: `DRAW_MOVE_BATCH_SIZE` 10 points per message,
`MAX_POINTS_PER_STROKE` 300, brush size 1–20.

**Evidence.** `realtime-contract.md` §9.8; client locked constants in
`src/drawing/config.ts` (`DRAW_MOVE_BATCH_SIZE=10`, `MAX_POINTS_PER_STROKE=300`,
`STROKE_HISTORY_MS=30_000`, brush 1–20). `docs/AGENTS.md` §16 governs drawing.

**Alternatives considered.** (a) one event per point; (b) server-side path simplification
or geometry validation; (c) a binary/compact encoding.

**Reason.** Batching 10 points per message is already the client's locked behaviour, so
the server contract must match it. `strokeSeq` is what makes late and duplicate packets
(D03-005) recoverable *and* ordered across messages: a `DRAW_MOVE` that arrives after a
later one can be discarded by sequence, whereas point-level reordering alone cannot be
detected. Server-side geometry validation was rejected as a CPU cost on the hot path
with no security value — the server is not rendering the drawing; it is relaying it. A
binary encoding would break the "inspectable JSON contract" property for no measured
need.

**Consequences.** Illegal drawing operations are caught by *authorization and sequence*,
not by geometry: only the drawer may draw, only during `ROUND_ACTIVE`, and only with a
non-decreasing `strokeSeq`/`pointIndex`. Drawing is not persisted (D03-008).

**Implementation implications.** The drawing path is a fan-out with sequence filtering
and no state beyond the last accepted sequence per drawer. Late packets are dropped, not
buffered. A 30 s `STROKE_HISTORY_MS` window bounds any buffer used for reconnect
catch-up.
### 2.17 D03-017 — Guess handling: normalization, dedupe, and atomic rank assignment

**Decision.** `GUESS_SUBMITTED` is normalized (trim, case-fold, strip repeated
whitespace/punctuation per `realtime-contract.md` §9.4) and compared to the secret
word on the server. The **rank** of a correct guess is assigned by a single atomic Redis
operation so that simultaneous guesses get a total, deterministic order. The drawer may
not submit guesses. A `CLOSE` (near-miss) signal is computed server-side.

**Evidence.** `realtime-contract.md` §9.4; `security-model.md` §3.4; client
`src/validation/schemas.ts` (guess max length 100). C-09: the IA requires a `CLOSE`
state that the PRD never mentions.

**Alternatives considered.** (a) compare on the client and report the outcome; (b)
assign rank by arrival at the application layer with a read-then-write; (c) no near-miss
signal.

**Reason.** Client-side comparison is unverifiable (D03-013). A read-then-write rank
assignment has a race: two correct guesses arriving in the same tick could both read
rank 1. A single atomic Redis increment is the smallest construct that makes "first
correct" unambiguous without introducing locks. The near-miss signal is required by the
IA (C-09) and, computed server-side from the word, leaks only a distance, not the word.

**Consequences.** Guesses are never stored in their raw form beyond the round
(`security-model.md` §3.5): the log records the outcome, not the attempt. Watching a
guess stream cannot reveal the word because only *correctness* is public.

**Implementation implications.** One atomic rank counter per round. The guess handler
is the only writer of "correct guess order". Normalization must be identical for the
live comparison and for any offline verification, so it lives in one shared pure
function.

---

### 2.18 D03-018 — Chat: one `chat:message` event with a `type` discriminator

**Decision.** All room text uses one event, `chat:message`, with `type` in
`{PLAYER, SYSTEM, CORRECT}`. Chat is capped at 200 characters (client contract),
rate-limited per player, and the drawer may chat but may not submit guesses.

**Evidence.** `realtime-contract.md` §9.3; `security-model.md` §5, §6. Client
`src/validation/schemas.ts` fixes chat max length 200. `docs/AGENTS.md` §15 governs
WebSocket chat; the PRD requires basic moderation.

**Alternatives considered.** (a) separate `chat` and `system` events; (b) client-side
rate limiting; (c) no `CORRECT` type, relying on `guess:correct` alone.

**Reason.** One event with a discriminator keeps the client's render path single and
the writer map single — one writer for "room transcript". A separate system event
duplicates authorization and ordering logic for identical data. Client-side rate
limiting is not moderation (unverifiable). The `CORRECT` type is required because the
correct-answer notification must be *visible* in the transcript while the *word* must
remain masked for guessers (D03-015).

**Consequences.** The transcript is a single ordered stream mixing system and player
messages, which is what the IA's chat screen shows. The `CORRECT` message content is a
server-formatted string that never contains the secret word for a public audience.

**Implementation implications.** Rate limiting is server-side and per-player
(`security-model.md` §6). Message length is validated at the boundary; over-length is
a validation error (D03-022), not silent truncation.

---

### 2.19 D03-019 — Session identity: opaque token, and a snapshot request/response pair

**Decision.** Identity is an **opaque session token** issued by `POST /session`,
presented on connect and on reconnect. Reconnection uses
`request:state:snapshot` → `response:state:snapshot`, with the payload defined in
`reconnect-protocol.md` §3. The token is the only reconnect identity; the socket id
is not.

**Evidence.** `reconnect-protocol.md` §1—§3; `api-contract.md` §3.1. AD-009
(Stage 02) deferred reconnection's event names to Stage 3, which is the authority for
this decision.

**Alternatives considered.** (a) socket id as identity; (b) a JWT with embedded room
claims; (c) re-joining by room code + nickname.

**Reason.** A socket id changes on every reconnect — it cannot be an identity. A JWT
is attractive but its claims would have to be revocable (a kicked player must not be able
to reconnect with an old token), which means a server-side check anyway; an opaque token
with server-side lookup is simpler and revocable. Room code + nickname is trivially
spoofable and cannot distinguish two players who chose the same nickname.

**Consequences.** The token is a bearer credential and must never be logged
(`security-model.md` §3.5). Session TTL is 24 h (PROPOSED, D03-028); a room's
association with a session is what makes rejoin possible.

**Implementation implications.** Token generation is server-side and unpredictable.
Connect-time auth resolves token → (playerId, roomId) before any event is accepted.
The snapshot response is the *only* way a reconnecting client rebuilds state; it is
never a partial patch.

---

### 2.20 D03-020 — Disconnect grace: guesser 30 s, drawer 15 s; host transfer is immediate

**Decision.** A disconnected **guesser** has a 30 s grace period; a disconnected
**drawer** has a 15 s grace period. **The round timer is paused while the drawer is in
its grace period.** Host transfer on host disconnect is **immediate** and does **not**
revert on reconnect. Grace values and the pause rule are **PROPOSED** (C-05, C-06, D03-028).

**Evidence.** `reconnect-protocol.md` §6; `state-machine.md` §6.3, §8. The PRD
requires configurable grace periods and reconnection; it states no values and does not
address the drawer-grace timer question (C-06). FR-026 requires host transfer.

**Alternatives considered.** (a) equal grace for all roles; (b) no pause during drawer
grace; (c) reverting the host on reconnect.

**Reason.** The drawer's disconnect blocks all progress (no one can draw), so the
drawer's grace should be *shorter* than a guesser's — the round should not be held
hostage, but a brief pause is fairer than a round instantly ending because a player's
tunnel dropped. Pausing the timer during drawer grace is required for fairness: without
it, a 15 s drawer outage would consume 15 s of the round's clock while nobody could draw.
Host transfer must not revert, because two players both believing they are host is a
worse failure than one player losing the role.

**Consequences.** Disconnect handling is role-dependent, so the disconnect path must
resolve the disconnecting player's role before choosing a grace. The paused timer
introduces a second writer to `deadlineAt` — recorded in the writer map.

**Implementation implications.** Grace is enforced by absolute deadlines (D03-007), not
`setTimeout`. A reconnect inside grace restores the player without a rejoin broadcast to
others beyond `player:reconnected`. Expiry of the drawer grace is the `DRAWER_ABANDONED`
round-end trigger (D03-012).

---

### 2.21 D03-021 — REST surface: six endpoints plus `GET /health`

**Decision.** REST is exactly: `POST /session`, `PUT /session/nickname`, `POST /rooms`,
`POST /rooms/join`, `PUT /rooms/:id/config`, `GET /settings`, plus `GET /health`. One
change to the Stage 02 proposal: `POST /session` also returns a `sessionToken`
(D03-019).

**Evidence.** `api-contract.md` §2—§3; ADR §10 (excluded-from-REST list).

**Alternatives considered.** (a) adding REST endpoints for in-game actions; (b) no
`GET /health`; (c) separate auth service.

**Reason.** The in-game actions (draw, guess, chat, hint) are inherently realtime and
already covered by the Socket.IO contract; exposing them over REST would create a second
path to the same writer, which the writer map forbids. `GET /health` is required by any
deployment (readiness/liveness) and is the cheapest possible endpoint. Nickname change
is REST because it happens before a room exists; room join is REST because it is the
transition that *creates* the realtime membership.

**Consequences.** Every gameplay mutation has exactly one transport. A REST-only client
cannot play; that is intended.

**Implementation implications.** Six routes and one health route in the Fastify app.
`POST /rooms/join` is the only route that both writes PostgreSQL and materializes Redis
room state.

---

### 2.22 D03-022 — Error taxonomy mapping to the client's existing codes

**Decision.** The server's error vocabulary maps onto the codes the Stage 02 client
already understands: `0` (network/unknown), `400` (validation), `401` (authorization),
`404` (room/player not found), `409` (conflict / illegal state transition),
`429` (rate limit), `500` (server). Realtime acks reuse the same codes in the ack
envelope.

**Evidence.** `api-contract.md` §5; `realtime-contract.md` §10.2. The client's
`ApiError.userMessage()` already switches on exactly these values, so the server does
not get to invent a new vocabulary without a client change.

**Alternatives considered.** (a) a new server-specific error code list; (b) HTTP status
only, no codes in acks; (c) generic `{ ok: false }` with no code.

**Reason.** Reusing the client's existing codes is the difference between a working
client and a client that shows "Unknown error" for every failure. Because both HTTP and
realtime errors flow through one vocabulary, the client needs one error-rendering path.

**Consequences.** Adding a new error category requires a client contract change —
which is exactly the friction we want, because it prevents the error surface from
drifting.

**Implementation implications.** One error-code enum in the shared contract (D03-023).
Internal exception types are mapped to codes at the boundary, never leaked.

---

### 2.23 D03-023 — Shared contract at `shared/contract/`, with synced verbatim copies

**Decision.** Client and server share one contract under `shared/contract/`. It is
consumed by the server directly and by the client as **verbatim synced copies** into the
client's own paths, kept in sync by `contract:sync` and verified in CI by
`contract:check`. This **supersedes** AD-008's outcome, which AD-008 itself deferred to
Stage 3.

**Evidence.** `architecture-research.md` §10 (M); Stage 02 AD-008 (no monorepo;
shared-types placement deferred to Stage 3). The Stage 02 client already validates with
Zod (`src/validation/schemas.ts`) and the PRD stack names TypeScript on both sides.

**Alternatives considered.** (a) a monorepo workspace with a shared package; (b)
duplicated types maintained by hand; (c) generating client types from server code.

**Reason.** The client is an Expo/React Native app (Metro bundler) and the server is a
Node service; a workspace package would require Metro/watch resolution changes that
Stage 02 deliberately avoided (AD-008). Verbatim copies plus a CI check give the same
guarantee — one source of truth, divergence detected — without restructuring the
client's build. Hand-duplication has no enforcement. Code generation adds a build step
for a contract that is already plain TypeScript + Zod.

**Consequences.** `contract:check` is a required CI job; a drift between copies fails
the build. The copies are generated, so they must not be hand-edited (a header comment
says so).

**Implementation implications.** Zod schemas are the single definition; TypeScript types
are inferred from them. The contract directory contains only types, schemas and
constants — no server imports, so it can be copied into the client safely.

---

### 2.24 D03-024 — Testing: vitest + Fastify `inject` server-side; Jest stays client-side; one contract-conformance suite

**Decision.** The server is tested with **vitest** and Fastify's `inject()`. The Stage 02
client keeps **Jest** (D02-016). A single **contract-conformance** suite runs against the
shared contract and is the guard against drift.

**Evidence.** `testing-strategy.md` §1—§3, §9. Observed vitest 5.0.2 with
`engines.node ^22.12.0 || ^24 || >=26`, compatible with the observed Node v22.23.2.
Stage 02 locked Jest for the client (D02-016).

**Alternatives considered.** (a) Jest on the server too; (b) a single test runner across
both; (c) no contract-conformance suite.

**Reason.** `inject()` makes HTTP and Socket.IO-handler testing fast and in-process —
no port binding, no flakiness from port reuse — and vitest's ESM-native execution fits
a TypeScript Node 22 service better than Jest's transform chain. Using one runner across
both would mean changing the client's locked Stage 02 test setup (D02-016), which would
reopen a closed decision for no server-side benefit. The conformance suite is what makes
D03-023's copies safe.

**Consequences.** Two runners in the repo, scoped by directory. CI runs both plus
`contract:check`.

**Implementation implications.** Server tests import `createApp()` and call
`app.inject()`; multiplayer tests drive real Socket.IO clients against a test server
(`testing-strategy.md` §4).
### 2.25 D03-025 — AD-004 measurement protocol defined; AD-004 remains CONDITIONAL

**Decision.** The exact measurement protocol for AD-004's three clauses is defined in
`testing-strategy.md` §7. **AD-004 is NOT marked met.** No measurement, benchmark,
device test or load test was performed in Stage 03.

**Evidence.** `architecture-research.md` §12—§13; `testing-strategy.md` §7.
`adb devices` returned an empty list in this session, so not even a manually driven
on-device check was possible. The three clauses are: (1) local drawing >=60 FPS, (2) 8
clients/viewers rendering live strokes, (3) typical event propagation <200 ms.

**Alternatives considered.** (a) marking AD-004 LOCKED on the strength of the Skia-in-
Expo-Go modality fact; (b) running a desktop-only FPS micro-benchmark and generalizing;
(c) leaving AD-004 undefined until implementation.

**Reason.** (a) is the exact error Stage 02 warned against: Skia being bundled in Expo Go
is a build-time/APK-level fact and says nothing about runtime frame timing. (b) would
produce a number that does not answer the question asked (a mid-tier phone). (c) would
leave the implementer without instrumentation points, which is the deliverable Stage 03
can actually produce without hardware.

**Consequences (conditions).** AD-004 stays CONDITIONAL with three unmeasured clauses.
The protocol is documented: instrumentation points (`_probe.t0` at touch ingest, `t1`
and `t2` at the server, `t3` and `t4` at the receiving client), an NTP-style four-
timestamp clock-offset method with a median offset over >=20 samples, a 30 s scripted
measurement window repeated 3 times, and acceptance criteria of p95 <=16.7 ms frame time
for clause 1, 8 concurrent viewers for clause 2, and p50 <=95 ms with p95 <=200 ms for
clause 3. Required evidence is enumerated as items 1–9 in `testing-strategy.md` §7.8.

**Implementation implications.** Instrumentation hooks must be built into the drawing
path and the realtime transport from the start; they are not an afterthought. A
`react-native-svg` fallback is considered **only** if clause 1 fails. No FPS or latency
number may be reported anywhere until it is measured on the specified topology.

---

### 2.26 D03-026 — `Room.status` value set

**Decision.** `Room.status` is `WAITING` | `IN_GAME` | `CLOSED`. **Status: PROPOSED.**

**Evidence.** `state-machine.md` §1.1. C-01: `Room.status` is listed as a room
property in `docs/projectInfo.md` §6, but no approved document defines its values, and
Stage 02 deliberately left it unmodelled.

**Alternatives considered.** (a) `OPEN`/`PLAYING`/`ENDED`; (b) reusing the game phase
enum; (c) only `OPEN`/`CLOSED`.

**Reason.** Three values are the minimum that distinguishes "accepting players" from
"a game is running" from "terminal". Reusing the phase enum is the conflation D03-010
rejects. Two values lose the difference between a room that finished a game and one that
is still open.

**Consequences.** A room may return from `IN_GAME` to `WAITING` if a rematch flow is
added later; V1 closes instead (PRD does not require rematch).

**Implementation implications.** Written only by the room-status writer
(`server-state-writer-map.md` §2.1). **Requires product confirmation** — this is a
proposed value, not a PRD requirement.

---

### 2.27 D03-027 — `MIN_PLAYERS` value

**Decision.** `MIN_PLAYERS = 2`. **Status: PROPOSED.**

**Evidence.** `state-machine.md` §2. C-02: the PRD says "2–8 players" and FR-019
mentions a "minimum player requirement" without fixing it. The Stage 02 client's
`src/validation/schemas.ts` already uses `MIN_PLAYERS=2`, `MAX_PLAYERS=8`.

**Alternatives considered.** (a) 3; (b) configurable per room; (c) 1 (solo practice).

**Reason.** 2 is consistent with the PRD's stated range floor and with the already-locked
client constant, so choosing anything else would require a client change. A configurable
minimum adds a room-config surface for no V1 requirement.

**Consequences.** A 2-player game is valid, and D03-011's "never the same drawer twice"
degenerates to strict alternation.

**Implementation implications.** The start guard reads the server-side constant, not a
client value. **Requires product confirmation.**

---

### 2.28 D03-028 — Default timings

**Decision.** Default timings: countdown 3 s, results 8 s, drawer grace 15 s, guesser
grace 30 s, room TTL 30 min, session TTL 24 h, round duration from the client's already-
locked 30–300 s range. **Status: PROPOSED** (C-05, C-06).

**Evidence.** `state-machine.md` §8; client `src/validation/schemas.ts` (round duration
30–300, hints 0–5). The PRD requires configurable timings and states no defaults.

**Alternatives considered.** (a) no defaults, require configuration; (b) longer/shorter
graces; (c) no room TTL.

**Reason.** Defaults are needed so a host who changes nothing still gets a playable game.
The grace values are chosen so a drawer outage is short relative to a typical round while
a guesser outage is not punishing. A room TTL is what makes Redis state self-cleaning
(D03-006) without a reaper.

**Consequences.** Every timing is a server-owned constant that a room may override where
the PRD allows configuration. Timers remain absolute instants (D03-007).

**Implementation implications.** One constants module in the shared contract for values
the client also displays; server-side enforcement reads the server copy. **Requires
product confirmation** for the specific values.

---

### 2.29 D03-029 — Report action deferred from V1

**Decision.** The `REPORT_PLAYER` action is **not** implemented in V1. The transcript
rate limit and the server-side message validation are V1's moderation surface.

**Evidence.** `security-model.md` §5.1. C-03: the IA §23 and screen-state map §19
list `REPORT_PLAYER`, while the PRD explicitly defers "report functionality (later
versions)".

**Alternatives considered.** (a) implement report per the IA; (b) implement a stub that
records nothing; (c) remove the IA entry.

**Reason.** The PRD outranks the IA (project hierarchy), and the PRD defers report. A
stub that records nothing is worse than absence because it implies a capability the
product does not have. The IA entry is left intact (Stage 03 does not edit Stage 01/02
documents) and the contradiction is recorded here.

**Consequences.** Moderation in V1 is limited to rate limiting and validation, which is
what the PRD's "basic moderation" requires. The IA's `REPORT_PLAYER` remains an
unimplemented design element, flagged.

**Implementation implications.** No report route, no report event, no report table. The
discrepancy is carried forward to whoever owns the IA.

---

### 2.30 D03-030 — Additive events required beyond the Stage 02 client contract

**Decision.** Six additive server→client events (`room:config:updated`, `chat:message`,
`canvas:cleared`, `player:disconnected`, `player:reconnected`,
`response:state:snapshot`) and one client→server event (`request:state:snapshot`).
**Status: APPROVED_WITH_CONDITIONS** — each must be added to the client contract, and
`Player.isConnected` (C-10) gets its writing events from `player:disconnected` /
`player:reconnected`.

**Evidence.** `realtime-contract.md` §8; C-10 (the client has `Player.isConnected`
with no client event writing it), C-11 (documentation path drift).

**Alternatives considered.** (a) overload existing events (e.g. `room:updated`); (b)
handle disconnects only via the snapshot; (c) no `canvas:cleared` (leave stale strokes).

**Reason.** C-10 is a real defect: a field that exists and is never written. Explicit
`player:disconnected` / `player:reconnected` events are the minimal fix and they also
drive the client's presence UI (IA §21). `canvas:cleared` is required so a client that
joined late or reconnected can discard strokes from a previous round — without it, a
reconnecting client can render a previous round's drawing over the current one. The
snapshot pair is required by D03-019.

**Consequences (conditions).** The Stage 02 client contract must gain these event names
before implementation; this is a client-contract change, so it is recorded as a condition
(§6). All six events are additive — no Stage 02 event is renamed or removed.

**Implementation implications.** Event names are added to the shared contract (D03-023)
and emitted only by their single writer (`server-state-writer-map.md`).

---

### 2.31 D03-031 — V1 is a single backend service

**Decision.** DoodleBee V1's backend is one deployable Node service containing the HTTP
API and the realtime gateway, backed by one PostgreSQL database and one Redis instance.
No microservices, no Kafka, no Kubernetes, no service mesh, no second database.

**Evidence.** The Stage 03 non-goals; `architecture-research.md` §9. The PRD's scale
target is 8 players per room.

**Alternatives considered.** (a) separate realtime and REST services; (b) an event bus;
(c) a separate service for scoring.

**Reason.** At 8 players per room, the realtime and REST workloads are the same process's
work. Splitting them multiplies deployment, auth and observability surface while
introducing a network hop on the hot path (which would make AD-004's clause 3 harder, not
easier). Every listed technology is infrastructure for a scale the PRD does not ask for.

**Consequences.** Horizontal scaling of the realtime tier would require the Socket.IO
Redis adapter (AD-004-adjacent, deferred) — not needed for V1 and explicitly not
included.

**Implementation implications.** One process, one port, one shutdown path, one config
module. Redis is used for state, not for messaging between services.

---

## 3. Supersessions and amendments

| Supersedes | Superseded by | Basis |
|---|---|---|
| AD-008 (Stage 02) — shared-types placement deferred to Stage 3 | **D03-023** | AD-008 explicitly assigned this decision to Stage 3. Stage 3 executes it: no monorepo, but a single contract with synced copies and a CI check. |
| AD-009 (Stage 02) — reconnection event names deferred to Stage 3 | **D03-019** and **D03-030** | AD-009 explicitly deferred the event names. Stage 3 names them: `request:state:snapshot`, `response:state:snapshot`. |
| ADR §10 REST list | **D03-021** | One amendment: `POST /session` now returns `sessionToken` (D03-019). No endpoint removed. |
| ADR §14 Skia/Expo Go note | **unchanged in Stage 03** | Stage 02's correction (Skia 2.6.2 bundled in Expo Go SDK 57, BUILD-001 verified) stands. D03-025 explicitly does not extend it into a runtime performance claim. |

No Stage 02 decision is reopened. The two supersessions above are deferrals Stage 02
itself assigned to Stage 3, plus one additive field.

---

## 4. Deferred decisions

| Item | Reason | Owner |
|---|---|---|
| Socket.IO Redis adapter / horizontal scaling | Not required at 8 players/room; D03-031 forbids extra infrastructure | Post-V1 |
| Stroke persistence | No requirement needs strokes after a round (`data-model.md` §8) | Post-V1, if a "replay" requirement appears |
| Rematch flow (`IN_GAME` → `WAITING`) | Not a PRD requirement; D03-026 leaves the possibility open | Post-V1 |
| Report/moderation workflow | PRD defers it (D03-029) | Post-V1 |
| Observability stack (metrics/tracing backend) | Not a V1 requirement; AD-004 specifies what must be *recorded*, not a platform | Post-V1 |
| OAuth / account persistence beyond `users` | PRD's V1 auth scope is not specified beyond a nickname | Product |

---

## 5. Contradiction dispositions

| # | Contradiction | Disposition |
|---|---|---|
| C-01 | `Room.status` values undefined | **Resolved as PROPOSED** by D03-026 (`WAITING`/`IN_GAME`/`CLOSED`); needs product confirmation. |
| C-02 | Minimum players undefined | **Resolved as PROPOSED** by D03-027 (`MIN_PLAYERS = 2`), consistent with the locked client constant. |
| C-03 | Report deferred by PRD, listed in IA | **Resolved** by D03-029: V1 defers report; IA entry left intact and flagged. |
| C-04 | Hint trigger authority | **Resolved** by D03-014: drawer-triggered, per IA §7.1. |
| C-05 | Drawer grace duration unspecified | **Resolved as PROPOSED** by D03-020/D03-028 (15 s). |
| C-06 | Timer pause during drawer grace | **Resolved** by D03-020: the round timer pauses (PROPOSED value behaviour). |
| C-07 | Drawer bonus value unspecified | **Resolved as PROPOSED** in D03-013/D03-012; the *rule* (0 on `DRAWER_ABANDONED`) is decided, the *magnitude* is proposed. |
| C-08 | Hint reveal algorithm unspecified | **Resolved as PROPOSED** by D03-014: a pure `maskWord(word, hintIndex)`; the algorithm is a proposal requiring confirmation. |
| C-09 | Near-miss (`CLOSE`) required by IA, absent from PRD | **Resolved** by D03-017: server-computed distance signal; not a PRD requirement, recorded as IA-driven. |
| C-10 | `Player.isConnected` has no writer | **Resolved** by D03-030: `player:disconnected` / `player:reconnected` are its writers. |
| C-11 | Documentation path drift | **Recorded, not fixed** — Stage 03 does not edit Stage 01/02 documents. Carried forward. |
| C-12 | "Typical <200 ms" not defined as a percentile | **Resolved** by D03-025: the protocol declares p50 <=95 ms and p95 <=200 ms as the acceptance reading. |

---

## 6. Open conditions

Conditions attached to APPROVED_WITH_CONDITIONS decisions. Each must be closed before
or at implementation time; none of them blocks Stage 03 closure.

| # | Condition | Decision | How it closes |
|---|---|---|---|
| OC-1 | Pin `drizzle-orm`/`drizzle-kit` exact versions and re-verify the pair at implementation start (pre-1.0) | D03-009 | Version check at implementation start |
| OC-2 | Re-check all registry version facts (point-in-time 2026-09-30) before writing `package.json` | D03-009, D03-002, D03-001 | Registry re-check at implementation start |
| OC-3 | Add the six additive server→client events and one client→server event to the Stage 02 client contract | D03-030 | Client contract edit, reviewed as an additive change |
| OC-4 | Confirm or replace the PROPOSED values: `Room.status` set, `MIN_PLAYERS`, default timings, grace durations, drawer bonus magnitude, hint algorithm | D03-026, D03-027, D03-028, D03-020, D03-013, D03-014 | Product-owner confirmation |
| OC-5 | Perform AD-004 measurement on the specified topology and record evidence items 1–9 | D03-025 | On-device + 8-client measurement |
| OC-6 | Resolve C-11 documentation path drift | (documentation) | Whoever owns the Stage 01/02 docs |

---

## 7. Architecture status

**Stage 03 architecture is LOCKED at v1.0, with six open conditions (OC-1 – OC-6) and
AD-004 still CONDITIONAL.**

- The 31 decisions above are the authoritative Stage 03 design.
- No implementation code, migration, handler or route was written in Stage 03.
- AD-004 remains CONDITIONAL — no clause is claimed as met (`testing-strategy.md` §7).
- Stage 03 implementation begins only after the architecture review is explicitly
  acknowledged as locked.

**Next action:** the Stage 03 implementation worker reads this ledger and
`realtime-contract.md` first, closes OC-1/OC-2 with a registry re-check, and treats every
PROPOSED value as provisional until OC-4 is answered.
