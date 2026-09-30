# Stage 03 — Build Record (backend / realtime foundation)

**Status:** backend scope DONE and verified locally; **one documented step remains** (the
additive client-contract entries E-01…E-05). AD-004 remains **CONDITIONAL**.
**Project:** DoodleBee — Stage 03 realtime backend.
**Date:** 2026-10-01.
**Related:** `decision.md`, `realtime-contract.md`, `state-machine.md`,
`server-state-writer-map.md`, `data-model.md`, `api-contract.md`, `reconnect-protocol.md`,
`security-model.md`, `testing-strategy.md`, `flow.md`, `Execution.md` (EXEC-009, EXEC-010).

---

## 1. Resume point (read this first)

The backend is complete and green. **Nothing is half-applied.** The only outstanding
implementation step is the additive client-contract work that `realtime-contract.md` §8
requires, which was deliberately **not started** so the repository is left at a clean boundary.

**Exact next action, in order:**

1. Apply **E-01…E-05** to `src/types/index.ts`:
   - `ServerToClientEvent.RoomConfigUpdated = 'room:config:updated'` (E-01)
   - `ServerToClientEvent.ChatMessage = 'chat:message'` (E-02, one event with a `messageType`
     discriminator: `'NORMAL' | 'GUESS' | 'SYSTEM' | 'CORRECT_GUESS'`)
   - `ServerToClientEvent.PlayerDisconnected = 'player:disconnected'` and
     `ServerToClientEvent.PlayerReconnected = 'player:reconnected'` (E-03, writers of
     `Player.isConnected`)
   - `ServerToClientEvent.CanvasCleared = 'canvas:cleared'` (E-04)
   - `ClientToServerEvent.RequestStateSnapshot = 'request:state:snapshot'` and
     `ServerToClientEvent.StateSnapshot = 'response:state:snapshot'` (E-05)
   - plus the matching **public** payload interfaces, mirroring `shared/contract/server-payloads.ts`
     and `reconnect-protocol.md` §3. The **public** `response:state:snapshot` shape must carry no
     `secretWord`.
2. Put the **drawer-only** snapshot variant in `src/types/drawer-private.ts` (it is the second
   and last payload allowed to carry the secret word; the first is `DrawerSelectedPayload`, which
   is already there). Never re-export it from `src/types/index.ts`.
3. Re-verify the client toolchain at the repository root: `npx tsc --noEmit` and `npx expo lint`.
4. Produce the Stage 03 implementation report. **Do not** start Stage 04 and **do not** claim
   AD-004.

**Caution:** `Room.status`'s value set (`WAITING`/`IN_GAME`/`CLOSED`) is **PROPOSED** (D03-026,
OC-4). If the snapshot type needs it, mark the union as provisional rather than presenting it as a
product decision.

---

## 2. Stack and pinned dependencies

Locked V1 architecture, as implemented (no substitutions, no additions):

| Dependency | Version | Role |
|---|---|---|
| Node.js | v22.23.2 (`engines: >=22.12.0`) | runtime |
| TypeScript | `~6.0.3` | language |
| Fastify | `5.12.5` | HTTP / REST |
| Socket.IO | `4.8.4` (+ `socket.io-client 4.8.4` in tests) | realtime transport |
| PostgreSQL | `postgres:16-alpine` (container) | durable store |
| Redis | `redis:7-alpine` (container) | live aggregate, locks, rate limits, presence |
| Drizzle ORM | `0.45.3` (+ `drizzle-kit 0.31.11`) | schema and migrations |
| Zod | `4.6.5` | shared contracts and validation |
| `pg` / `ioredis` | `8.23.1` / `6.0.0` | drivers |
| Vitest | `5.0.3` | tests |

Runtime topology: **one** backend service. The server is authoritative for drawer, secret word,
game state, timers, correctness, ranking, scoring, and game completion; the client is
authoritative for nothing.

---

## 3. Commands

All commands run from `server/` unless stated otherwise.

```bash
npm run db:migrate      # apply Drizzle migrations from server/drizzle
npm run db:seed         # idempotent word seed
npm run dev             # tsx watch; reads .env
npm run start           # compiled dist
npm run typecheck       # tsc --noEmit
npm run lint            # eslint .
npm test                # vitest run (unit + integration)
npm run build           # tsc -p tsconfig.json
```

Repository root (client): `npx tsc --noEmit`, `npx expo lint`.

Environment (`server/.env`, gitignored): `PORT=3000`, `HOST=127.0.0.1`,
`DATABASE_URL=postgres://doodlebee:doodlebee@127.0.0.1:5433/doodlebee`,
`REDIS_URL=redis://127.0.0.1:6379`. Integration tests override to `doodlebee_test` and Redis
logical db `15`.

---

## 4. Files

### Created — server runtime (`server/src`)

- App/composition: `index.ts`, `app.ts`, `logger.ts`, `errors.ts`
- Config: `config/env.ts`
- HTTP: `http/auth.ts`, `http/errors.ts`, `http/routes/{session,rooms,health,settings,index}.ts`
- Data: `db/{client,schema,migrate,seedWords}.ts`, `drizzle/0000_lumpy_zuras.sql` (+ `drizzle/meta`)
- Redis: `redis/{client,keys,roomState,scripts}.ts`
- Game engine: `game/{stateMachine,gameStateMachine,roomService,roundService,gameFinalizer,`
  `drawerSelector,wordSelector,wordMatch,guessService,hintService,hints,chatService,scoring,`
  `scoreService,hostTransferService,connectionRegistry,roundTimer,snapshotProjector,`
  `drawingGateway,sessionService,lock,clock,ids,profanity,types,bus,services}.ts`
- Realtime: `realtime/{socket,handlers,ioBus,envelope}.ts`
- Security: `security/{rateLimit,rules}.ts`

### Created — shared contracts (`shared/contract`)

`events.ts`, `schemas.ts`, `server-payloads.ts`, `snapshot.ts`, `errors.ts`, `constants.ts`,
`types.ts`, `index.ts`, `package.json`.

### Created — tests (`server/tests`)

- `unit/`: `stateMachine`, `scoring`, `hints`, `wordMatch`, `hostTransfer`, `drawerSelector`,
  `roomValidation`, `errorMapping`, `secretWordContract` (9 files, 69 tests)
- `integration/`: `rest.test.ts`, `realtime.test.ts` (2 files, 42 tests)
- `helpers/`: `harness.ts`, `client.ts`, `game.ts`, `rest.ts`, `fixtures.ts`, `memoryBus.ts`
- `server/vitest.config.ts`, `server/tsconfig.json`, `server/eslint.config.mjs`, `server/package.json`

### Modified this session (Stage-03-owned only)

| File | Change |
|---|---|
| `server/src/redis/roomState.ts` | `readAggregate` decodes `status`/`phase` as bare strings via a new `decStringUnion` helper (defect D-1). |
| `server/src/realtime/ioBus.ts` | `toRoomExceptPlayer` reassigns the operator returned by `except()` (defect D-2). |
| `server/src/game/roomService.ts` | `hasBound` set on bind; `wasReconnect` keyed off presence history (defect D-3). |
| `server/src/game/types.ts` | `RoomMember.hasBound` added (additive). |
| `server/src/config/env.ts` | `PORT` accepts `0` (ephemeral-port sentinel). |
| `server/src/realtime/handlers.ts` | Removed the unused `RATE_LIMITS` import. |
| `server/tests/**` | Harness/helper fixes, host binding in broadcast tests, two-guesser duplicate test, `PORT=0`, `waitFor` replay, REST admission test writes both stores. |
| `shared/contract/constants.ts` | `SWEEPER_INTERVAL_MS = 1_000` (PROPOSED). |

**Not modified:** Stage 02 architecture decisions, ADR v2.1, `app/` routes, or any client file.

---

## 5. Database

- One migration: `server/drizzle/0000_lumpy_zuras.sql`; applied via `npm run db:migrate`
  (dev db `doodlebee`), recorded in `drizzle.__drizzle_migrations` = 1.
- Tables: `users`, `rooms`, `room_players`, `games`, `rounds`, `scores`, `game_results`, plus
  `words`. No table beyond what `data-model.md` authorises.
- **Drawing strokes are not persisted in PostgreSQL** — `room:{id}:strokes` is a rolling Redis
  window (`STROKE_HISTORY_MS`) and nothing more, per the architecture.
- Word seed is idempotent (`words` = 60).

---

## 6. Tests

- Unit ×9 files / 69 tests: state transitions and guards, room validation, scoring (rank table
  `[500,350,100,50,15,2,0,0]`, drawer bonus), hint masking, word matching, host transfer, drawer
  selection (no immediate repeat), error-code mapping, and the secret-word contract (no public
  schema may carry `secretWord`).
- Integration ×2 files / 42 tests against **real** Fastify + Socket.IO + PostgreSQL + Redis, with
  an injected clock: room validation and admission, join/leave, host authorization, drawer
  selection and the role-split payload, correct/wrong/duplicate/simultaneous guesses, scoring and
  round end, drawer disconnect → pause → `DRAWER_ABANDONED`, disconnect/reconnect snapshot
  restoration, drawing relay and monotonicity, chat, hints, envelope validation, rate limiting,
  and handshake rejection.
- Total: **111/111 passing**. No test sleeps on wall-clock time to cross a countdown or grace
  window; the harness advances the clock and calls `services.sweep()`.
- Not yet covered: shutdown/TTL paths, multi-socket announcement, multi-instance fan-out.

---

## 7. Service startup

```bash
docker ps --format "{{.Names}}\t{{.Ports}}"   # doodlebee-postgres → 5433, doodlebee-redis → 6379
cd server && npm run db:migrate && npm run db:seed
npm run dev
curl http://127.0.0.1:3000/health
```

Observed: `{"status":"ok","uptimeSeconds":13,"dependencies":{"postgres":"ok","redis":"ok"}}` with
structured JSON request logs. `GET /settings` publishes the shared bounds and the PROPOSED
defaults.

---

## 8. Failures, recovery attempts, and defects

Every failure encountered, with the recovery attempt that resolved it. Full narrative in
`Execution.md` EXEC-010.

| # | Symptom | Diagnosis | Recovery | Outcome |
|---|---|---|---|---|
| 1 | Integration suites aborted in `beforeAll`: `Invalid server environment: PORT: Too small`. | The harness binds an ephemeral port via `PORT=0`; env validation required `min(1)`. | Relaxed `PORT` to `min(0)` with the sentinel documented. | Resolved. |
| 2 | 20 failures: `game:start` acks failed, `round:started`/`drawer:selected` never arrived, admission/config guards ignored state. | `readAggregate` JSON-decoded `status`/`phase` while `writeAggregate` writes bare strings → `JSON.parse('IN_GAME')` threw and fell back to `WAITING`. | Added `decStringUnion` and read both fields as bare strings. | Resolved; the authoritative room now leaves `WAITING`. |
| 3 | `player:joined` timed out on every first join. | `wasReconnect = !member.isConnected` is `true` for a member's first bind. | Added `RoomMember.hasBound`, set on bind; keyed `wasReconnect` off it. | Resolved; first bind announces `player:joined`, returns announce `player:reconnected`. |
| 4 | Drawer received its own `draw:start`. | `except()` returns a new operator; the result was discarded. | Reassigned the returned operator. | Resolved. |
| 5 | `BAD_STATE` where `ALREADY_GUESSED` was expected. | With a single guesser the round ends on the first correct answer. | Gave that test two guessers. | Resolved. |
| 6 | REST admission test expected `409 ROOM_ALREADY_STARTED`, got `200`. | `admit` reads `rooms.status` (PostgreSQL); the test wrote only the Redis aggregate. | The test now writes both stores, matching the single writer that persists `room.status` to Redis **and** PostgreSQL. | Resolved. |
| 7 | 3 lint errors (unused import, two non-null assertions). | — | Removed the import; replaced the assertions with an explicit guard. | Resolved. |
| 8 | Placeholder helpers (`guestOr`, `readRoomCode`, `lastRoomCode`) left in `realtime.test.ts`. | Incomplete test scaffolding from an earlier pass. | Removed; the rate-limit test carries its own room code. | Resolved. |

All eight were resolved. Two recovery attempts (defects 2 and 3) required reading the design
documents before changing behaviour; no attempt guessed at a product value.

---

## 9. Deviations and provisional values

Deviations (all recorded, none silent):

1. **`probe` ack echo** — AD-004 instrumentation only; `t2` is sampled **after** the broadcast is
   issued because the emit is fire-and-forget and has no observable "before" instant. Absent
   unless the client sends `_probe`. Nothing reads it.
2. **`RoomMember.hasBound`** — additive, non-authoritative presence-history boolean on the Redis
   member record; exists only to satisfy defect D-3. It is not a second source of truth for any
   documented field.
3. **`PORT` accepts `0`** — ephemeral-port sentinel used only by the integration harness.
4. **`SWEEPER_INTERVAL_MS = 1_000`** — added to `shared/contract/constants.ts`, flagged PROPOSED.
5. **`join:room` resolves the room by code** — implementation note; the payload carries
   `roomCode`, as already locked; no contract change.

Left **PROVISIONAL**, not reinterpreted as product decisions (OC-4): the `Room.status` value set
(D03-026), `MIN_PLAYERS` (D03-027), default timings (D03-028), grace durations (D03-020), the
drawer-bonus magnitude (D03-013), the hint algorithm (D03-014), and the scoring magnitudes.
`STARTING_WINDOW_MS = 3000`, `RESULTS_WINDOW_MS = 8000`, `DRAWER_GRACE_MS = 15000`,
`GUESSER_GRACE_MS = 30000`, `ROOM_TTL_SECONDS = 1800`, `SESSION_TTL_SECONDS = 86400`.

---

## 10. Validation

| Check | Result |
|---|---|
| TypeScript (`npx tsc -p tsconfig.json --noEmit`) | **PASS** |
| Lint (`npm run lint`) | **PASS** |
| Unit tests (9 files / 69 tests) | **PASS** |
| Integration tests (2 files / 42 tests) | **PASS** |
| Full suite | **PASS — 111/111** |
| Migrations applied (`npm run db:migrate`) | **PASS** |
| Seed (`npm run db:seed`) | **PASS** (idempotent, 60 words) |
| PostgreSQL connection + schema | **PASS** |
| Redis connection | **PASS** |
| Server boots, `GET /health` = postgres ok + redis ok | **PASS** |
| Secret-word security tests | **PASS** |
| Client contract extensions E-01…E-05 | **NOT RUN** — see §1 |
| Client toolchain re-verification (`npx tsc --noEmit`, `npx expo lint`) | **NOT RUN** — follows E-01…E-05 |
| AD-004 performance measurement | **NOT RUN** — hooks only |

**BLOCKED: none.** Nothing is blocked on infrastructure; PostgreSQL and Redis are running locally
and were exercised by the integration suite.

---

## 11. AD-004 status

**CONDITIONAL — not validated.** Only the instrumentation hooks exist (`_probe` on
`draw:start` / `draw:move`, echoed as `probe: {t0,t1,t2}` in the ack). No measurement of 60 FPS,
8-viewer performance, or `<200ms` propagation has been performed on the required topology, and
none is claimed. Completing AD-004 requires the measurement topology in `testing-strategy.md` §7
and a separate, explicit measurement pass.

---

## 12. Unresolved conditions

1. Client contract extensions **E-01…E-05** not yet applied (§1).
2. **AD-004** unmeasured (§11).
3. **Multi-socket announcement** semantics are undefined by the documents: a second concurrent
   socket for an already-present player is announced as `player:reconnected`.
4. **Shutdown / TTL paths** (`SERVER_TERMINATED`, all-players-disconnected room TTL,
   `games.status = 'ABANDONED'`) are implemented but untested.
5. **Single instance only** — no Redis Socket.IO adapter or multi-instance fan-out was validated.
6. **OC-4** product confirmation still outstanding for all PROPOSED values (§9).