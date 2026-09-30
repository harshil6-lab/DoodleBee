# Stage 03 — Server State Writer Map

**Stage:** 03 — Realtime + Backend Architecture
**Document:** Server-side authoritative state ownership (mirror of ADR v2.1 §7)
**Version:** 1.0
**Status:** DESIGNED — decisions recorded in `decision.md` (D03-003, D03-006, D03-011 … D03-017, D03-020)
**Project:** DoodleBee
**Date:** 2026-09-30

Stage 02 created the **client** State Writer Map (ADR §7), which assigns exactly one
writer to every client state field. This document is its **server-side equivalent**: for
every authoritative server field there is exactly one writer. The two maps are
complementary — the client map says who may write a client store field; this map says
who may write the authoritative value that the client store ultimately reflects.

---

## 1. Rules

1. Every authoritative field has **exactly one** writer component.
2. A reader is never a writer. The snapshot projector reads everything and writes
   nothing.
3. Redis holds the live aggregate; PostgreSQL holds the permanent record. No field is
   authoritative in both.
4. Every mutation that changes an authoritative field bumps `room.version` as its final
   step, inside the same critical section.
5. No handler, route, adapter or utility may write an authoritative field outside its
   owning component. Ownership is enforced by module boundaries (the owning component
   is the only module that exports the field's mutator).
6. A field that cannot be named with a single writer is a design defect, not an
   exception to be tolerated.

---

## 2. The map

`Writer` names the single component allowed to mutate the field. `Store` is where the
authoritative value lives. `Out` lists the server → client events that carry the value
to clients. `Persist` is the PostgreSQL obligation.

### 2.1 Room aggregate

| Field | Category | Writer (single) | Store | Out | Reader scope | Persist | Reconciliation |
|---|---|---|---|---|---|---|---|
| `room.roomId` | identity | `RoomService` (on create) | Redis + PG | `room:joined`, `response:state:snapshot` | all members | `rooms.id` | immutable |
| `room.code` | identity | `RoomCodeGenerator` (on create only) | Redis + PG | `room:joined` | all members | `rooms.code` | immutable; active codes unique |
| `room.status` | lifecycle | `GameStateMachine` (`WAITING`/`IN_GAME`) and `RoomService` (`CLOSED`) | Redis + PG | `room:joined`, `response:state:snapshot` | all members | `rooms.status` | last transition wins |
| `room.hostPlayerId` | authority | `HostTransferService` | Redis + PG | `host:transferred`, `room:joined`, `response:state:snapshot` | all members | `room_players.is_host_start` (initial) | atomic replace |
| `room.config` | configuration | `RoomService` (host-only, `WAITING` only) | Redis + PG | `room:config:updated`, `room:joined` | all members | `rooms.*` config columns | host events win |
| `room.members[]` | roster | `RoomService` (admission/removal only) | Redis + PG | `player:joined`, `player:left`, `room:joined` | all members | `room_players` | add/remove by `playerId` |
| `room.version` | sequencing | `VersionCounter` (only, inside the commit path) | Redis | every payload | all members | not persisted | monotonic, never decreases |
| `room.idleTtl` | lifecycle | `RoomService` | Redis key TTL | not broadcast | internal | `rooms.closed_at` on close | set on create, refreshed on activity |

### 2.2 Presence

| Field | Category | Writer (single) | Store | Out | Reader scope | Persist | Reconciliation |
|---|---|---|---|---|---|---|---|
| `player.isConnected` | presence | `ConnectionRegistry` (socket lifecycle only) | Redis | `player:disconnected`, `player:reconnected`, `response:state:snapshot` | all members | not persisted | socket truth wins |
| `player.graceDeadline` | presence | `ConnectionRegistry` | Redis | `player:disconnected` | all members | none | recomputed on each transition |
| `player.socketIds[]` | presence | `ConnectionRegistry` | Redis | not broadcast | internal | none | add on connect, remove on disconnect |

### 2.3 Game / round aggregate

| Field | Category | Writer (single) | Store | Out | Reader scope | Persist | Reconciliation |
|---|---|---|---|---|---|---|---|
| `game.gameId` | identity | `GameStateMachine` (on `~AR` STARTING) | Redis + PG | `game:started` | all members | `games.id` | immutable |
| `game.phase` | lifecycle | `GameStateMachine` (and `RoundService` for `ROUND_FINISHED`, `GameFinalizer` for `GAME_FINISHED`) | Redis | `game:started`, `round:started`, `round:ended`, `game:finished`, `response:state:snapshot` | all members | `games.status` | server transition only |
| `game.roundNumber` | progress | `RoundService` (only in `NEXT_ROUND` / `STARTING`) | Redis + PG | `round:started`, `response:state:snapshot` | all members | `rounds.round_number` | monotonic within a game |
| `game.roundsPlanned` | configuration | `RoomService` | Redis + PG | `game:started` | all members | `games.rounds_planned` | frozen at `STARTING` |
| `game.drawerPlayerId` | authority | `DrawerSelector` (only in `STARTING` / `NEXT_ROUND`) | Redis | `drawer:selected`, `round:started`, `round:ended`, `response:state:snapshot` | all members | `rounds.drawer_user_id` | atomic replace |
| `round.roundId` | identity | `RoundService` | Redis + PG | `round:started` | all members | `rounds.id` | immutable |
| `round.secretWord` | secret | `WordSelector` (only at round start) | Redis (TTL-scoped) | `drawer:selected` (private variant), `response:state:snapshot` (drawer only), `round:ended` (after the round ends) | drawer only, until the round ends | `rounds.word_id` (FK; the literal lives in `words`) | written once per round; never re-broadcast to a room while the round is active |
| `round.wordId` | secret-adjacent | `WordSelector` | Redis + PG | never (not broadcast while active) | drawer only | `rounds.word_id` | written once per round |
| `round.maskedWord` | derived state | `HintService` | Redis | `drawer:selected`, `round:started`, `hint:revealed`, `response:state:snapshot` | all members | `rounds.masked_word_final` (at round end only) | recomputed from `round.secretWord` + reveal set; never hand-edited |
| `round.revealedPositions[]` | derived state | `HintService` | Redis | `hint:revealed`, `response:state:snapshot` | all members | not persisted | append-only within a round |
| `round.hintsRemaining` | derived state | `HintService` | Redis | `round:started`, `hint:revealed`, `response:state:snapshot` | all members | not persisted (the configured count is `rooms.hints`) | decremented only by `HintService` |
| `round.roundEndTime` | timer | `RoundTimer` (start, pause-extend, resume) | Redis | `round:started`, `response:state:snapshot`, `player:disconnected` (pause notice) | all members | `rounds.ended_at` on end | single writer; extended never shortened |
| `round.roundTimerPaused` | timer | `RoundTimer` | Redis | `player:disconnected`, `player:reconnected`, `response:state:snapshot` | all members | not persisted | follows the drawer grace window exactly |
| `round.strokes[]` | media | `DrawingGateway` (append-only, drawer-authorized) | Redis (rolling 30 s) | `draw:start`, `draw:move`, `draw:end`, `canvas:cleared`, `response:state:snapshot` | all members | **never** (PRD: strokes need not be persisted) | append by `strokeId`; cleared on round start and on `canvas:clear` |
| `round.correctGuessers[]` | scoring input | `GuessService` (atomic rank assignment) | Redis | `guess:correct`, `round:ended`, `response:state:snapshot` | all members | `scores` rows at round end | append-only with a server-assigned rank |
| `round.endReason` | lifecycle | `RoundService` | Redis + PG | `round:ended` | all members | `rounds.end_reason` | written once at round end |

### 2.4 Scores and results

| Field | Category | Writer (single) | Store | Out | Reader scope | Persist | Reconciliation |
|---|---|---|---|---|---|---|---|
| `player.score` | scoring | `ScoreService` | Redis | `score:updated`, `guess:correct`, `round:ended`, `game:finished`, `response:state:snapshot` | all members | `scores`, `game_results` | additive by point delta; the delta is computed by `ScoreService` only |
| `round.drawerPoints` | scoring | `ScoreService` (at round end) | Redis | `round:ended`, `score:updated` | all members | `scores` (`kind = 'drawer'`) | computed once per round |
| `game.finalRankings[]` | results | `GameFinalizer` | PG | `game:finished`, `response:state:snapshot` | all members | `game_results` | computed once at game end |
| `game.winnerId` | results | `GameFinalizer` | PG | `game:finished` | all members | `game_results.is_winner` | deterministic tie-break (§4) |

### 2.5 Non-authoritative server state (explicitly not in the map)

| State | Where | Why it is not authoritative game state |
|---|---|---|
| Chat ring buffer (last 50) | Redis | A display convenience; a lost message does not change the game |
| Rate-limit token buckets | Redis | Derived; recomputed from scratch if Redis flushes |
| `eventId` dedupe LRU | Process memory | Transport-level idempotency, not game state |
| Socket.IO adapter channels | Redis pub/sub | Transport plumbing only |
| Word pool cache | Redis | A read cache over the `words` table |
| Session tokens | Redis | Auth plumbing with its own TTL |

---

## 3. The `version` counter (the one cross-cutting writer)

`room.version` is the only field written on behalf of every mutation, so its ownership
needs an explicit rule rather than an exception.

- **Writer:** `VersionCounter`, called **only** from the room commit path.
- **Rule:** the commit path is `withRoomLock(roomId, fn)`; `fn` performs the mutation,
  and the commit path then performs `INCR room:{id}:version` and attaches the result to
  the outgoing payloads. A mutation that bypasses `withRoomLock` does not get a version
  and is therefore detectable in tests.
- **Monotonic:** `INCR` never decreases, including across reconnects and across an
  application restart (the key's TTL is the room's TTL).
- **Use:** the client applies a payload only when `version >= lastAppliedVersion`; the
  snapshot carries the version at projection time (`reconnect-protocol.md` §3.4).

`withRoomLock` is also the serialization point for atomic operations (guess ranking,
capacity admission, drawer selection), so ordering decisions are made in exactly one
place.

---

## 4. Tie-breaks and determinism

Where two players can be equal, the server applies an explicit deterministic rule
rather than depending on map iteration order.

| Situation | Rule |
|---|---|
| Final score tie | Higher number of 1st-place round finishes; then higher total guess points; then lowest `playerId` |
| Host transfer tie | Earliest `joinedAt`; then lowest `playerId` |
| Simultaneous correct guesses | Assigned ranks by the atomic `INCR` order inside the Redis script (D03-017) — arrival order at the server, which is a total order |
| Drawer selection | Uniform random over the eligible pool; the pool is ordered before selection so the same inputs produce the same pool |

---

## 5. Reader-scope matrix (what each audience may see)

| Data | Drawer | Guesser | Disconnected member | Never sent |
|---|---|---|---|---|
| `room.*` (non-secret) | yes | yes | on reconnect | — |
| `game.*` non-secret | yes | yes | on reconnect | — |
| `round.secretWord` | **yes** | **no** | **no** | never in a room broadcast |
| `round.maskedWord` | yes | yes | on reconnect | — |
| `round.strokes[]` | yes | yes | last 30 s on reconnect | — |
| `round.correctGuessers[]` | yes | yes | on reconnect | — |
| `player.score` (others) | yes | yes | on reconnect | — |
| `session` token | own only | own only | own only | never in a payload |
| `secretWord` in logs/analytics | **never** | **never** | **never** | `docs/AGENTS.md` §10 |

---

## 6. Enforcement

Ownership is only real if it is violated loudly.

| Mechanism | What it catches |
|---|---|
| Module boundary: each owning component is the sole exporter of its field's mutator | Accidental cross-writes |
| `withRoomLock` as the only commit path | Mutations without a version bump |
| A test that asserts every mutation helper is exported by exactly one module | Wiring drift |
| A test that asserts no broadcast payload type contains `secretWord` | The highest-severity regression (`security-model.md` §7) |
| A runtime assertion in the projector that the drawer-only field is absent for a non-drawer request | Projection bugs |
| A pino `redact` configuration covering `secretWord` and the word table | Log leakage |

---

## 7. Relationship to the client map (ADR §7)

| ADR §7 client field | Server writer (this map) |
|---|---|
| `room.id`, `room.code` | `RoomService`, `RoomCodeGenerator` |
| `room.config` | `RoomService` |
| `room.players` | `RoomService` (+ `ConnectionRegistry` for `isConnected`) |
| `room.host` | `HostTransferService` |
| `game.phase` | `GameStateMachine` / `RoundService` / `GameFinalizer` |
| `game.drawer` | `DrawerSelector` |
| `game.secretWord` | `WordSelector` |
| `game.maskedWord` | `HintService` |
| `game.timer.roundEndTime` | `RoundTimer` |
| `game.scores` | `ScoreService` |
| `game.guessRanking` | `GuessService` |
| `game.hintsRemaining` | `HintService` |
| `game.chats` | `ChatService` |
| per-player connection | `ConnectionRegistry` |
| `ui.*` (all) | **no server writer** — pure client state (ADR §7 rule 4) |

Every ADR §7 server-owned field resolves to exactly one component here. The `ui.*`
fields correctly have no server writer at all.