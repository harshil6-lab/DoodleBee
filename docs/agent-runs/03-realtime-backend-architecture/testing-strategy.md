# Stage 03 — Testing Strategy

**Stage:** 03 — Realtime + Backend Architecture
**Document:** Test plan and the AD-004 measurement protocol
**Version:** 1.0
**Status:** DESIGNED — decisions recorded in `decision.md` (D03-024, D03-025). **No test in this document has been executed.**
**Project:** DoodleBee
**Date:** 2026-09-30

Test levels follow the PRD "Testing Requirements" and `docs/AGENTS.md` §21–§22.
Nothing here is a result; every item is a plan. Fabricating any result would violate
`docs/AGENTS.md` §25.

---

## 1. Level map

| PRD requirement | Level here | Section |
|---|---|---|
| Unit: score calculation, hint generation, word matching, room validation, state transitions | Unit | §2 |
| Integration: create room, join room, start game, submit guess, complete round, calculate score | Integration | §3 |
| Multiplayer: 2 / 4 / 8 players | Multiplayer | §4 |
| Failure: disconnects, internet loss/return, server restart, simultaneous guesses, room full, invalid code, duplicate guess, spam | Failure | §5 |
| Load, progressive | Load | §8 |

---

## 2. Unit tests

One module, no I/O, deterministic. Redis and PostgreSQL are stubbed at the boundary.

| Area | Cases |
|---|---|
| Scoring | rank table (1st 500, 2nd 350, 3rd 100, 4th 50, 5th 15, 6th 2, 7th/8th 0); rank > 8 maps to 0; configurable table override; drawer `correctCount x bonus`; `DRAWER_ABANDONED` gives 0 |
| Hint generation | number of reveals never exposes the whole word; the reveal set grows monotonically; positions are stable across reveals; `hintsRemaining` decrements exactly once per request; 0 hints means no reveal |
| Word matching | NFKC normalization; case folding; whitespace collapse; trailing punctuation; aliases accepted; a wrong word is rejected; a correct word with different case/spacing is accepted |
| Near-match (`CLOSE`) | threshold behaviour over word lengths; never returns the word; a correct guess is never classified as merely close |
| Room validation | code length 5–6; alphabet excludes O/0/I/1; case-insensitive; capacity 2..8; `rounds` 1..20; `roundDuration` 30..300; `hints` 0..5; room-name length |
| State transitions | every allowed transition in `state-machine.md` §4 fires; every disallowed transition is rejected; `WAITING -> STARTING` requires host + roster >= 2; `ROUND_ACTIVE` requires a selected drawer and word |
| Drawer selection | never selects the previous drawer while another eligible player exists; with one eligible player it still selects them; uniform distribution over the pool (statistical, with a fixed seed) |
| Round-end conditions | timer expiry; all-guessers-correct; drawer abandonment; each sets the correct `endReason` |
| Host transfer | earliest `joinedAt` wins; tie-break by `playerId`; no revert on the old host's return; no connected candidates leaves the role assigned |
| Version counter | strictly monotonic across a scripted mutation sequence; never decreases across a simulated restart |
| Snapshot projection | drawer gets `secretWord`; guesser does not; non-`ROUND_ACTIVE` phases do not; the projector mutates nothing |
| Error mapping | every `ErrorCode` maps to the HTTP status in `api-contract.md` §5.2 and to a user-safe message |

---

## 3. Integration tests

Run against a real Fastify instance with a Redis and a PostgreSQL container. Fastify's
in-process injection is used for REST; a real `socket.io-client` connects for realtime.

| Scenario | Assertions |
|---|---|
| Create room | room row + code uniqueness among active rooms; creator is host; response shape matches the contract |
| Join room | membership row created; `player:joined` reaches existing members; joining twice is idempotent via the partial unique index |
| Join a full room | `409 ROOM_FULL`; no membership row |
| Join with an invalid code | `404 ROOM_NOT_FOUND` |
| Join after start | `409 ROOM_ALREADY_STARTED` |
| Start game | phase `WAITING -> STARTING -> ROUND_ACTIVE`; `rounds` row created; `drawer:selected` delivered role-split |
| Submit a guess | correct guess ranks; wrong guess becomes a `GUESS` chat message; the drawer's guess is refused |
| Complete a round | all three end conditions produce `round:ended` with the right `endReason`; `scores` rows written once |
| Calculate score | the transaction is idempotent: re-running it inserts nothing new |
| Finish a game | `game_results` written; `game:finished` payload matches the persisted rows |
| Play again | a second `games` row; the first game's results are unchanged |
| Config update | host succeeds; non-host gets `403`; update after start gets `409 BAD_STATE` |
| Health | `200` when both dependencies are up; `503` when Redis is stopped |

---

## 4. Multiplayer tests

Deterministic rooms driven by a scripted harness; the assertions are about *server*
behaviour, not wall-clock timing.

| Room size | Cases |
|---|---|
| 2 players | drawer + 1 guesser; the round ends on the first correct guess (`ALL_GUESSERS_CORRECT`); drawer scoring is `1 x bonus` |
| 4 players | 3 guessers; rank order is stable; the leaderboard matches the accumulated scores |
| 8 players | 7 guessers; the full rank table is exercised including 7th place scoring 0; capacity is exactly 8 and the 9th join is refused |
| All sizes | every client's `leaderboard` and `scores` converge to the same values at round end |
| All sizes | a client that joins late (impossible after start) and a client that leaves mid-round are handled |

---

## 5. Failure tests

Each of these is required by PRD "Testing Requirements" and `docs/AGENTS.md` §22.

| # | Failure | Expected |
|---|---|---|
| F-01 | Guesser disconnects mid-round | Game continues; seat kept; `player:disconnected` emitted; guesser is removed from `eligibleGuessers` |
| F-02 | Guesser reconnects | Snapshot restores the round, drawing and scores; `player:reconnected` emitted |
| F-03 | Drawer disconnects mid-round | Timer pauses; `player:disconnected` + pause notice; round continues to `ROUND_FINISHED` only after grace expiry |
| F-04 | Drawer reconnects within grace | Timer extended by the pause duration; the round resumes; the drawer keeps the role |
| F-05 | Drawer grace expires | `round:ended` with `DRAWER_ABANDONED`; drawer points 0; the next round selects a different drawer |
| F-06 | Host disconnects | `host:transferred` to the earliest-joined connected player; the game is unaffected |
| F-07 | Host reconnects | No host revert; `player:reconnected` only |
| F-08 | Internet disappears, then returns | Socket.IO reconnects; snapshot restores; `version` is non-decreasing |
| F-09 | Server restart within room TTL | Clients reconnect, re-snapshot, and the game continues from the Redis aggregate |
| F-10 | Server restart beyond room TTL | `ROOM_CLOSED`; the game is recorded `ABANDONED` |
| F-11 | Simultaneous correct guesses | Exactly one rank 1; ranks are a permutation; two clients that guess in the same millisecond do not share a rank |
| F-12 | Duplicate guess event (same `eventId`) | Applied once; the second attempt replays the cached ack |
| F-13 | Duplicate drawing packet | Dropped by `pointIndex` monotonicity; peers see no duplicate segment |
| F-14 | Room becomes full | Additional joins refused; existing members unaffected |
| F-15 | Invalid room code | `404`; no membership created; the rate limiter counts the attempt |
| F-16 | Spam messages | Rate limited; repeated spam escalates to mute; the room is not flooded |
| F-17 | Client clock skew | A client whose clock is minutes off still renders the correct remaining time (server `roundEndTime` + `serverNow`) |
| F-18 | Non-drawer sends `draw:*` | `NOT_DRAWER`; nothing broadcast; the violation counter increments |
| F-19 | Malformed payload | `VALIDATION_ERROR`; no state change |
| F-20 | Socket disconnects mid-ack | The retry with the same `eventId` is idempotent |

---

## 6. Determinism requirements

The failure suite is only meaningful if the harness is deterministic. Rules:

1. Timer tests use an injectable clock, not `setTimeout` real time.
2. All randomness (drawer selection, room codes, word selection) uses a seeded source in
   tests.
3. Redis and PostgreSQL containers are per-suite, and the Redis keyspace is flushed
   between suites.
4. A test that needs two sockets to act "simultaneously" issues both emits and awaits
   both acks; it never relies on `Promise.all` scheduling order for correctness — the
   point is that the *server* produces a total order regardless of arrival order.

---

## 7. AD-004 instrumentation and measurement protocol

AD-004 requires three measured clauses. **This section is a protocol, not a result.**
AD-004 remains CONDITIONAL until all three clauses have been measured and recorded.

### 7.1 What must be measured

| Clause | Requirement | Instrument |
|---|---|---|
| 1 | >= 60 FPS sustained local stroke rendering on a mid-tier physical device | drawer-side frame timing |
| 2 | 8 clients render the same live stroke stream with no dropped frames / visual divergence | 8 client-side renderers |
| 3 | Typical event propagation < 200 ms | end-to-end timestamps per stroke batch |

### 7.2 Instrumentation points

| Point | Where | Value |
|---|---|---|
| `t0` | Drawer client, at touch-sample ingest, **before** batching | `performance.now()`, ms |
| `t1` | Server, on `draw:move` receipt | `process.hrtime.bigint()`, ms (monotonic) |
| `t2` | Server, immediately before broadcast | monotonic ms |
| `t3` | Guesser client, when the batch is applied to the drawing store | `performance.now()`, ms, offset-corrected |
| `t4` | Guesser client, the first rendered frame after the apply | `performance.now()` |
| `f` | Both clients, per-frame | `requestAnimationFrame` delta, or a Skia draw timestamp |

`t0` and the optional `_probe: { t0 }` envelope field already exist in
`realtime-contract.md` §5.1. The server echoes `_probe` in the ack together with `t1`
and `t2`. **None of these values is read by game logic**, and `_probe` is optional so
production traffic can omit it.

### 7.3 Clocks

Two devices have unrelated clock origins. `performance.now()` is monotonic per device
with an arbitrary origin, so a raw subtraction between two devices is meaningless.

Method: an NTP-style four-timestamp exchange over the same socket.

```
client sends: { seq, c0 = performance.now() }
server replies: { seq, s1, s2 }              // receive, send (monotonic ms)
client records: c3 = performance.now()

rtt    = (c3 - c0) - (s2 - s1)
offset = ((s1 - c0) + (s2 - c3)) / 2         // client clock -> server clock
```

- Run >= 20 samples in a 5 s calibration phase before measurement.
- Use the **median** offset (robust to a single delayed packet) and record the observed
  RTT spread as the measurement's noise floor.
- Convert client timestamps with `serverTime ~= clientTime + offset` before subtracting.

Cross-check (not the primary metric): a dedicated echo probe measures round-trip and
reports `rtt / 2`. It is reported alongside, never instead of, the offset-corrected
one-way value, because `rtt / 2` conflates the two directions.

### 7.4 Metrics and formulas

Per stroke batch, per guesser:

```
serverHoldMs  = t2 - t1
oneWayMs      = (t3 + offset) - (t0 + offset) - serverHoldMs
              = t3 - t0 - serverHoldMs          // offset cancels; see the protocol below
renderLagMs   = t4 - t3
frameMs       = f(n+1) - f(n)
```

Because `t0` and `t3` come from different devices, the offset must be applied **once**
before the subtraction; the simplified form is only valid when `offset` has already been
applied to `t3`. The implementation must therefore store the corrected value and record
the offset used.

Aggregates reported: `p50`, `p95`, `p99`, `max`, and the sample count, for each of
`oneWayMs`, `renderLagMs` and `frameMs`, per device and per clause.

### 7.5 Measurement scenario

1. Calibrate clocks on every client (§7.3).
2. Drawer draws a scripted stroke pattern (continuous arcs, ~60 samples/s) for 30 s.
   Synthetic input is acceptable **for clause 1 and clause 3** because it drives the
   same renderer and the same transport path.
3. Clause 1 is measured on the drawer device only, over the full 30 s window.
4. Clause 2 is measured on all 8 clients over the same window. A stroke-set checksum is
   computed at the end of the window: every client must have applied the same set of
   `(strokeId, pointIndex)` tuples.
5. Clause 3 is measured from the drawer to each guesser over the same window.
6. The window is repeated 3 times; all three runs are recorded, not just the best.

### 7.6 Test topology and device requirements

| Element | Requirement |
|---|---|
| Drawer device | **A mid-tier physical Android device.** This is the clause-1 target; it may not be an emulator |
| Guesser devices | 7 clients. Physical devices preferred. A mix with emulators is permitted **for clause 2 exploration only** and must be recorded; an emulator-only run does **not** satisfy clause 2 |
| Network | A normal mobile network or Wi-Fi (not a loopback). Record the link type and, if available, measured throughput/latency |
| Server | The real backend on a host reachable from all devices; record whether it is local or remote |
| Build profile | Record Expo Go vs a development build, and the Skia version |

Current environment blocker (must be stated plainly): `adb devices` returns an **empty**
list. No physical device is attached, and the only previously observed emulator was
x86_64 on shared host GPU — not a valid clause-1 target. Clause 1 therefore cannot be
attempted at all today, and clauses 2–3 additionally need the backend, which does not
exist yet.

### 7.7 Acceptance criteria

| Clause | Metric | Pass |
|---|---|---|
| 1 | `frameMs` p95 on the drawer device | <= 16.7 ms, with no sustained jank (> 5 consecutive frames above 33 ms) over the 30 s window |
| 2 | `frameMs` p95 on each of the 8 clients, and the end-of-window stroke checksum | <= 16.7 ms on every device capable of it, and identical checksums on all 8 |
| 3 | `oneWayMs` from drawer to each guesser | p50 <= 95 ms **and** p95 <= 200 ms |

Interpretation recorded explicitly: NFR-001 says "Typical event propagation under
200ms" and does not define "typical" (C-12). This protocol interprets "typical" as the
**p50** and additionally requires the **p95** to stay under 200 ms, which is strictly
stronger than a p50-only reading.

If clause 1 fails, the documented fallback is `react-native-svg` (ADR §14). The
fallback is not triggered by a clause-2 or clause-3 failure.

### 7.8 Evidence to record

A measurement run is not evidence unless all of the following are recorded:

| # | Evidence |
|---|---|
| 1 | Device models, OS versions, and which device was the drawer |
| 2 | Build profile (Expo Go vs development build) and the Skia version |
| 3 | Network topology and link type |
| 4 | Server location and the commit SHA of both client and server |
| 5 | Calibration output: per-device offset estimate, sample count, RTT spread |
| 6 | Raw per-batch samples (CSV or JSON), not just summaries |
| 7 | `p50/p95/p99/max` for each metric, per device |
| 8 | The clause-2 stroke-set checksums |
| 9 | Any failed or discarded run, with the reason |

The numbers are recorded in a Stage 03 build/measurement record. **AD-004 moves to
LOCKED only after items 1–9 exist for all three clauses.** Until then it stays
CONDITIONAL and must not be cited as validated.

---

## 8. Load tests (progressive)

PRD: 100 rooms → 500 players → 1,000 players → 5,000+ players, "depending on launch
scale".

| Stage | Shape | What it answers |
|---|---|---|
| L1 | 100 rooms x 2 players | Does room creation/lookup hold up? |
| L2 | 125 rooms x 4 players | Does per-room overhead scale linearly? |
| L3 | 125 rooms x 8 players (1,000 players) | The PRD's real V1 shape; the first meaningful ceiling test |
| L4 | 625 rooms x 8 players (5,000 players) | Cost of the Redis adapter and per-room timers at scale |

Load tests are explicitly **out of V1 implementation scope** (ADR §22.3 lists load
testing infrastructure as not in V1); this section defines the target shape so the
architecture does not foreclose it, and so nothing in the design assumes a single
active room (NFR-003).

---

## 9. Tooling

| Concern | Choice | Evidence |
|---|---|---|
| Test runner | `vitest` (server) | Node-first ESM/TS ergonomics; `engines.node = ^22.12.0 || ^24 || >=26`, satisfied by the observed Node 22.23.2 |
| HTTP tests | Fastify `app.inject()` | In-process, no port binding; provided by `light-my-request`, a Fastify dependency |
| Realtime tests | real `socket.io-client` against a bound server | The contract is the wire format; mocking it would not test the thing that breaks |
| Client tests | `jest` + `jest-expo` + React Native Testing Library | Already locked by D02-016; unchanged |
| Contract conformance | one suite that loads the shared contract and asserts both sides validate against it | `decision.md` → D03-023 |
| Coverage | not a gate in V1 | The PRD does not require a threshold, and a threshold with no approved number is invented policy |

Note: the client and the server deliberately use different runners. The client's runner
is locked by Stage 02 (D02-016) and the client must not be destabilised; the server has
no tests yet, so it can use the runner that fits a Node service.

---

## 10. CI

```
GitHub Actions
  -> install (server + client)
  -> lint (server + client)
  -> typecheck (server + client)
  -> unit + integration + multiplayer + failure (server containers: postgres, redis)
  -> client jest
  -> contract conformance check
  -> build
  -> deploy (staging, then production, separate environments)
```

Matches PRD "DevOps". Load tests (L1–L4) run outside the per-commit pipeline.