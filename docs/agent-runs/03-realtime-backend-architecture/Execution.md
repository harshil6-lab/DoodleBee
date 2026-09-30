# Stage 03 — Execution Log

**Scope:** Realtime + Backend Architecture (design only — no implementation).
**Chronology:** append-only. Entries are recorded in the order they occurred. Prior
entries are never rewritten.
**Related documents:** `decision.md` (authority), `flow.md` (workflow), the nine research
and design artifacts in this directory.
**Predecessor:** `docs/agent-runs/02-client-architecture/Execution.md`, which ends at
`DOCS-001` and hands off with "Begin Stage 03 (Game State Machine)".

---

## EXEC-001 — Stage 03 worker kickoff, reconnaissance, and source read

- **Agent:** Stage 03 Architecture Research + Design Worker
- **Task:** Open Stage 03. Read the full approved source hierarchy and the repository,
  without modifying implementation.
- **Files inspected:**
  - `docs/AGENTS.md`, `docs/Design.md`, `docs/projectInfo.md`
  - `ProjectDocs/01-information-architecture.md`, `ProjectDocs/01-screen-state-map.md`,
    `ProjectDocs/02-client-architecture.md`
  - `docs/agent-runs/02-client-architecture/04-architecture-decision.md` (ADR v2.1),
    `decision.md`, `flow.md`, `Execution.md`, `Build.md`
  - Repository structure: `app/`, `src/` (full file tree), `package.json`, `app.json`,
    `tsconfig.json`, `.eslintrc.js`, `.prettierrc.js`, `index.ts`, `.gitignore`,
    `.refact/project_information.yaml`
  - Stage 02 client constants: `src/drawing/config.ts`, `src/validation/schemas.ts`,
    `src/api/*` (error handling), `src/stores/*`
- **Commands executed:**
  - `git status`, `git branch`, `git log --oneline -5`
  - `node --version`, `npm --version`
  - `adb devices`
  - recursive file listing of `app/` and `src/`
- **Findings:**
  - Stage 02 closed at `DOCS-001`; ADR v2.1 is LOCKED; `app/` is the authoritative route
    directory (D02-021); `scheme: "doodlebee"` was approved-with-conditions (D02-022);
    Jest (D02-016) and Zod (D02-014) are locked client choices; AD-008 (shared types) and
    AD-009 (reconnect event names) were explicitly deferred to Stage 3; the 14 moderate
    npm advisories were accepted (D02-023); AD-004 was left CONDITIONAL.
  - Package manager is npm (`package-lock.json`), not bun, so the AGENTS.md bun-path
    branch does not apply.
  - Node v22.23.2 / npm 10.9.8 observed.
  - `adb devices` returned an **empty list** — no device attached, so no on-device
    measurement was possible in this stage.
  - Client-locked constants observed: `DRAW_MOVE_BATCH_SIZE=10`, `MAX_POINTS_PER_STROKE=300`,
    `STROKE_HISTORY_MS=30_000`, brush 1–20; `MIN_PLAYERS=2`, `MAX_PLAYERS=8`, rounds 1–20,
    duration 30–300 s, hints 0–5, nickname 1–20, chat 200, guess 100, room-code alphabet
    excluding O/0/I/1; `ApiError.userMessage()` switching on 0/400/401/404/409/429/500.
- **Files created/modified:** None.
- **Tests/checks:** None (no code changed).
- **Blockers:** None.
- **Resolution:** N/A.
- **Status:** DONE.
- **Next action:** Extract the PRD and locate each requirement area.

---

## EXEC-002 — PRD extraction and requirement location

- **Agent:** Stage 03 Architecture Research + Design Worker
- **Task:** Extract the product source of truth and anchor requirements to readable
  locations; the PRD outranks generic architecture knowledge.
- **Files inspected:** `Draw_and_Guess_PRD.pdf` (10 pages).
- **Commands executed:**
  - `pdftotext.exe -layout -enc UTF-8 'Draw_and_Guess_PRD.pdf' $out`
    (poppler 25.11.0, already present on the machine)
  - line-count and section grep over the extracted text
- **Findings:**
  - Extraction produced 31,550 characters / 723 lines.
  - Requirement anchors located: Product Overview 56, Core Game Flow 91, FRs 144, NFRs 350,
    Tech Stack 413, Real-Time 482, Word DB 501, Infra 508, DevOps 528, Testing 537,
    Analytics 562, V1 Scope 604, Final Stack 625, Recommended Arch 677, Core Principle 704,
    Success Criteria 715.
  - The PRD's server-authoritative state machine is exactly
    `WAITING → STARTING → ROUND_ACTIVE → ROUND_FINISHED → NEXT_ROUND →
    (ROUND_ACTIVE ...) → GAME_FINISHED`.
  - The PRD's success criterion is the acceptance spine: 8 players join → host starts →
    drawer draws → 7 see the drawing → simultaneous guesses → server ranks → scores
    update → drawer changes → one disconnects → game continues → reconnects →
    authoritative state restores → all rounds complete → final leaderboard.
  - The PRD names Node.js + TypeScript, Fastify or NestJS, WebSocket/Socket.IO, PostgreSQL,
    Redis, server-authoritative state, 2–8 players, private room codes, drawing sync,
    realtime guesses/chat, scoring, hints, multiple rounds, reconnection, disconnect
    handling, basic anti-cheat and basic moderation.
- **Limitation recorded:** `pdftotext` layout extraction can reorder table cells; every
  cited requirement was cross-checked against the duplicated requirement text in
  `docs/projectInfo.md` where one exists (`architecture-research.md` §12.5).
- **Files created/modified:** None in the repository (the extracted text lives in a temp
  path, not in the repo).
- **Tests/checks:** N/A.
- **Blockers:** None.
- **Resolution:** N/A.
- **Status:** DONE.
- **Next action:** Gather current, verifiable technology evidence rather than relying on
  memory.

---

## EXEC-003 — Evidence gathering: registry, upstream, environment

- **Agent:** Stage 03 Architecture Research + Design Worker
- **Task:** Replace recollection with verifiable facts about each candidate technology,
  and record the local environment.
- **Files inspected:** `package.json`, `package-lock.json`; upstream package metadata and
  typings for the candidate dependencies.
- **Commands executed:**
  - `npm view <pkg> version` for fastify, @nestjs/core, socket.io, socket.io-client,
    @socket.io/redis-adapter, @socket.io/cluster-adapter, ioredis, redis, drizzle-orm,
    drizzle-kit, prisma, @prisma/client, pg, zod, vitest, pino
  - registry `engines` reads for fastify and @nestjs/core
  - local reads of `node_modules` typings where already installed (`socket.io`)
  - `node --version`, `npm --version`, `adb devices`, `git status`, `git branch`
- **Findings (2026-09-30):**
  - fastify 5.12.5 — **no `engines` field**; the Fastify v5 migration guide states
    "Fastify v5 will only support Node.js v20+".
  - @nestjs/core 12.1.1 — `engines.node >= 20`. Both frameworks are Node 20+ viable, so
    runtime support does not separate them.
  - socket.io 4.8.4 and socket.io-client 4.8.4 — client and server versions match the
    Stage 02 client's dependency.
  - `socket.io@4.8.4` `dist/index.d.ts` exposes `connectionStateRecovery`
    (default `maxDisconnectionDuration` 120000 ms) and `io.except(...)`.
  - @socket.io/redis-adapter 8.3.0, @socket.io/cluster-adapter 0.3.0, ioredis 6.0.0,
    redis 6.2.1.
  - drizzle-orm 0.45.3, drizzle-kit 0.31.11 (both pre-1.0).
  - **`prisma` `latest` = 8.0.0-rc.19 (a release candidate) while `@prisma/client`
    `latest` = 7.10.0** — a version skew on the primary tag.
  - pg 8.23.0, zod 4.6.5 (= the client's version), pino 10.3.1.
  - vitest 5.0.2 — `engines.node ^22.12.0 || ^24 || >=26`, satisfied by Node v22.23.2.
  - Environment: Node v22.23.2, npm 10.9.8, `adb devices` empty, branch `main`.
- **Files created/modified:** None.
- **Tests/checks:** No benchmark, no FPS sample, no latency sample, no load test.
- **Blockers:** None.
- **Resolution:** N/A.
- **Status:** DONE — all evidence recorded in `architecture-research.md` §3—§5.
- **Next action:** Evaluate the brief's areas A—M against these facts.

---

## EXEC-004 — Independent architecture review (areas A—M)

- **Agent:** Stage 03 Architecture Research + Design Worker
- **Task:** Work through every evaluation area in the brief against DoodleBee's actual V1
  requirements, not against general reputation.
- **Files inspected:** the PRD extraction; the Stage 02 ADR, decision ledger and build log;
  the Stage 02 client contract; the evidence gathered in EXEC-003.
- **Commands executed:** none beyond reads and targeted greps.
- **Findings / judgements recorded:**
  - **A — Fastify vs NestJS:** decided on the size of the system (one service, seven
    routes, one gateway), not on popularity. Both are Node 20+ viable; Nest's DI and module
    system add indirection that the writer map and server-authority rules argue against at
    this scale.
  - **B — Socket.IO architecture:** defined the connect/reconnect lifecycle, the identity
    boundary, rooms vs namespaces, acknowledgements, ordering, duplicates, and the full
    disconnect taxonomy (server, client, host, drawer).
  - **C — Redis:** classified each candidate responsibility explicitly as authoritative
    transient, persistent, or derived/cache, instead of moving everything into Redis.
  - **D — PostgreSQL:** mapped the PRD's eight entities and decided drawing strokes are
    not persisted in V1 (no requirement needs them after a round).
  - **E—M:** recorded contract observations for the state machine, secret-word security,
    the drawing protocol, guessing, chat, reconnection, REST, the error model, and shared
    types.
  - Twelve contradictions/gaps were discovered and recorded as **C-01 — C-12** rather than
    silently resolved, covering `Room.status` values, `MIN_PLAYERS`, the report feature,
    hint trigger authority, drawer grace duration, timer-pause-during-drawer-grace, drawer
    bonus magnitude, the hint algorithm, near-miss (`CLOSE`) handling, `Player.isConnected`
    having no writer, documentation path drift, and the undefined percentile behind
    "typical <200 ms".
- **Files created/modified:** `docs/agent-runs/03-realtime-backend-architecture/architecture-research.md`
  — **new** (evidence record, including the contradiction table).
- **Tests/checks:** None (documentation only).
- **Blockers:** None. The absence of hardware is a *limitation recorded in the research*,
  not a blocker for design work.
- **Resolution:** N/A.
- **Status:** DONE.
- **Next action:** Produce the design artifacts that carry the detail behind the ledger.
---

## EXEC-005 — Design artifact creation

- **Agent:** Stage 03 Architecture Research + Design Worker
- **Task:** Produce the design artifacts that carry the detail behind the ledger, per the
  Stage 03 required-artifact list.
- **Files inspected:** `architecture-research.md` (just written), the Stage 02 ADR and
  client contract, the PRD extraction.
- **Commands executed:** file writes; per-file byte/line/encoding verification after each
  write.
- **Findings:** The nine artifacts were produced with mutually resolving cross-references.
  Verified byte sizes and line counts at creation:
  - `architecture-research.md` — 24,909 bytes / 457 lines
  - `realtime-contract.md` — 19,873 bytes / 449 lines
  - `state-machine.md` — 17,441 bytes / 320 lines
  - `server-state-writer-map.md` — 13,470 bytes / 192 lines
  - `data-model.md` — 13,802 bytes / 319 lines
  - `api-contract.md` — 10,769 bytes / 272 lines
  - `reconnect-protocol.md` — 13,240 bytes / 290 lines
  - `security-model.md` — 12,924 bytes / 237 lines
  - `testing-strategy.md` — 17,735 bytes / 322 lines
- **Files created/modified:** the nine files above, all **new**. No implementation file was
  created or modified.
- **Tests/checks:** Each file verified as UTF-8 without BOM, LF-only line endings, zero
  U+FFFD replacement characters. No code changed, so no build/lint/test run was required.
- **Blockers:** None.
- **Resolution:** N/A.
- **Status:** DONE.
- **Next action:** Consolidate the design into the decision ledger.

---

## EXEC-006 — Decision ledger write — BLOCKED, then RECOVERED (tooling)

- **Agent:** Stage 03 Architecture Research + Design Worker
- **Task:** Write `decision.md` — the ledger of 31 decisions (D03-001 — D03-031), each
  with decision / evidence / alternatives considered / reason / consequences /
  implementation implications, plus the supersession, deferred, contradiction-disposition,
  open-condition and architecture-status sections.
- **Files inspected:** the nine artifacts from EXEC-005 (to cite accurate sections).
- **Commands executed:**
  - Attempt 1: a single shell invocation carrying the entire ledger as one here-string.
  - Attempt 2 (recovery): a sequence of chunked writes — one initial `[IO.File]::WriteAllText`
    for the head (header, status legend, ledger table, section-2 opening), then successive
    `[IO.File]::AppendAllText` calls for the decision records in order.
- **Findings:**
  - **Attempt 1 failed** before producing any output:
    `Failed to create unified exec process: The filename or extension is too long. (os error 206)`.
    This is the Windows command-line length limit, hit because the whole document was passed
    as one command argument. **No file was created and no partial content was left behind** —
    the failure occurred while constructing the process, before any write.
  - **Attempt 2 succeeded**, producing a complete ledger of 60,761 bytes / 1,092 lines.
- **Files created/modified:** `docs/agent-runs/03-realtime-backend-architecture/decision.md`
  — **new** (created by attempt 2).
- **Tests/checks:** After the successful write: bytes = 60,761; lines = 1,092; CRLF count =
  0; U+FFFD count = 0; heading enumeration confirmed all 31 decision records plus sections 0
  through 7 are present and in order.
- **Blockers:** **Tooling** — command-length limit on a single large write.
- **Resolution:** Recovery attempt 1 (chunked sequential append) resolved it on the first
  try. No further attempt was needed. The blocker did not affect document content or
  completeness.
- **Status:** DONE — ledger complete; blocker resolved.
- **Next action:** Design the AD-004 measurement protocol.

---

## EXEC-007 — AD-004 measurement protocol design (no measurement performed)

- **Agent:** Stage 03 Architecture Research + Design Worker
- **Task:** Design the exact measurement protocol for AD-004's three clauses, and decide
  AD-004's status on the basis of evidence that actually exists.
- **Files inspected:** the Stage 02 ADR §14 and its AD-004 statement; the Stage 02 build
  log (Skia/Expo Go verification); `architecture-research.md` §13.
- **Commands executed:** `adb devices` (re-confirmed empty).
- **Findings:**
  - Stage 02 verified that Skia 2.6.2 is bundled in Expo Go for SDK 57 — a build-time/APK
    -level fact. It says nothing about runtime frame timing. Extending it into a performance
    claim would be exactly the error Stage 02 warned against.
  - `adb devices` is empty, so even a manually driven on-device check was impossible in this
    stage.
  - No realtime server and no clients exist, so clauses 2 and 3 cannot be measured either.
  - The measurement protocol was designed in full: instrumentation points (`_probe.t0` at
    touch ingest, `t1`/`t2` at the server, `t3`/`t4` at the receiving client); an NTP-style
    four-timestamp clock-offset method using a median offset over >=20 samples; a 30 s
    scripted measurement window repeated three times; acceptance criteria of p95 <=16.7 ms
    frame time (clause 1), 8 concurrent viewers (clause 2), and p50 <=95 ms with p95 <=200 ms
    (clause 3); and the enumerated evidence to record (items 1–9 in `testing-strategy.md`
    §7.8).
  - `react-native-svg` is named as the fallback **only** if clause 1 fails.
- **Files created/modified:**
  - `docs/agent-runs/03-realtime-backend-architecture/testing-strategy.md` — its §7
    (created in EXEC-005).
  - `decision.md` — D03-025 (created in EXEC-006).
- **Tests/checks:** None possible — no device, no server, no clients. This is recorded, not
  worked around.
- **Blockers:** **Environment** — no device attached and no backend running, so AD-004's
  three clauses cannot be measured in Stage 03.
- **Resolution:** The blocker does not stop design work. The measurement protocol is
  complete and executable later; AD-004 is left **CONDITIONAL** with the exact missing
  evidence documented per clause (`architecture-research.md` §13, `decision.md` D03-025).
- **Status:** DONE — protocol designed; **AD-004 remains CONDITIONAL.**
- **Next action:** Close the Stage 03 documentation set.

---

## EXEC-008 — Stage 03 documentation closure and verification

- **Agent:** Stage 03 Architecture Research + Design Worker
- **Task:** Create the three lifecycle documents (`decision.md`, `flow.md`, `Execution.md`),
  verify the complete artifact set, and confirm no implementation was touched.
- **Files inspected:** all artifacts in this directory; the Stage 02 `Execution.md` (for the
  entry format and handoff).
- **Commands executed:**
  - directory listing of `docs/agent-runs/03-realtime-backend-architecture`
  - decision-ID reference scan across all artifacts
  - per-file byte/line/CRLF/BOM/U+FFFD verification
  - `git status`
- **Findings:**
  - `flow.md` documents the **actual** Stage 03 workflow in eight phases (P0 reconnaissance →
    P1 PRD extraction → P2 evidence gathering → P3 independent review → P4 design artifacts →
    P5 decision locking → P6 AD-004 protocol → P7 closure), and states plainly that no
    measurement was performed and no implementation was started.
  - The ledger was written *after* the design artifacts (reverse of the document numbering)
    so every ledger row cites a section that already exists; recorded as an intentional
    deviation in `flow.md` §7.
  - All twelve required artifacts are present. All decision IDs referenced by the design
    artifacts resolve to real ledger rows.
- **Files created/modified:**
  - `docs/agent-runs/03-realtime-backend-architecture/flow.md` — **new** (14,090 bytes /
    299 lines, verified).
  - `docs/agent-runs/03-realtime-backend-architecture/Execution.md` — this file, appended
    (prior entries preserved).
  - No implementation file created or modified. Stage 02 documents untouched.
- **Tests/checks:**
  - All 12 artifacts verified present; UTF-8 without BOM; LF-only line endings; zero U+FFFD.
  - The Stage 02 client was not re-validated because no code changed; `*.md` is excluded from
    `prettier --check` by `.prettierignore`, so `format:check` is unaffected.
- **Blockers:** None.
- **Resolution:** Stage 03 documentation set is complete and internally consistent.
- **Status:** DONE — Stage 03 design complete; architecture LOCKED at v1.0 subject to the
  six open conditions; **AD-004 remains CONDITIONAL**; no implementation started.
- **Next action:** The Stage 03 implementation worker begins only after the architecture
  review is explicitly acknowledged as locked. First actions: re-check pinned registry
  versions (OC-1, OC-2), then treat every PROPOSED value as provisional until OC-4 is
  answered.

---

## Stage 03 summary

| Field | Value |
|---|---|
| Entries recorded | EXEC-001 — EXEC-008 |
| Artifacts created | 12 of 12 required |
| Decisions recorded | 31 (D03-001 — D03-031) |
| Decisions APPROVED | 24 |
| Decisions APPROVED_WITH_CONDITIONS | 4 (D03-009, D03-020, D03-025, D03-030) |
| Decisions PROPOSED (need product confirmation) | 3 (D03-026, D03-027, D03-028) |
| Decisions DEFERRED | 6 (listed in `decision.md` §4) |
| Open conditions | 6 (OC-1 — OC-6) |
| Contradictions found | 12 (C-01 — C-12), all dispositioned |
| Blockers encountered | 2 (EXEC-006 tooling — resolved; EXEC-007 environment — documented, AD-004 left conditional) |
| Implementation changes | None |
| Stage 02 documents changed | None |
| AD-004 | **CONDITIONAL** — three clauses unmeasured |
| Stage 03 implementation | **Not started** |


---

## EXEC-009 — Stage 03 implementation worker: recon, baseline, and backend foundation

- **Agent:** Stage 03 Implementation Worker.
- **Task:** Implement the locked Stage 03 backend/realtime foundation and core engine from the
  authoritative design documents (`decision.md`, `realtime-contract.md`, `state-machine.md`,
  `server-state-writer-map.md`, `data-model.md`, `api-contract.md`, `reconnect-protocol.md`,
  `security-model.md`, `testing-strategy.md`, `flow.md`). No implementation from memory.
- **Baseline verified before any file was changed:**
  - `git status` — no Stage 03 implementation was tracked; `server/` and `shared/` appeared as
    untracked. Pre-existing unrelated working-tree changes (`.refact/**`, the `AGENTS.md` typo
    `2This is an Expo…`, Stage 02 documents, untracked Stage 02 `flow.md`) were recorded and left
    untouched.
  - `server/package.json` — pinned to the locked V1 stack: `fastify 5.12.5`, `socket.io 4.8.4`,
    `drizzle-orm 0.45.3`, `zod 4.6.5`, `pg 8.23.1`, `ioredis 6.0.0`, `typescript ~6.0.3`,
    `vitest 5.0.3`. Node **v22.23.2**; npm (no `bun.lock`).
  - Local infrastructure present and used: `doodlebee-postgres` (postgres:16-alpine, host port
    **5433**) and `doodlebee-redis` (redis:7-alpine, host port **6379**). The `doodlebee_test`
    database and Redis logical db **15** are reserved for integration tests. `employee-postgres`
    (host port 5432) belongs to another project and was not touched.
  - `server/.env` (gitignored) points at 5433/6379; `PORT=3000`, `HOST=127.0.0.1`.
- **Implemented (server, `server/src`):** Fastify app + route registration (`app.ts`, `index.ts`),
  environment validation (`config/env.ts`), structured logger (`logger.ts`), typed errors
  (`errors.ts`), REST surface (`http/`: `auth.ts`, `errors.ts`, `routes/{session,rooms,health,settings,index}.ts`),
  PostgreSQL client/migrations/Drizzle schema/word seed (`db/`), Redis client, key registry, room
  state accessors and Lua scripts (`redis/`), the game engine (`game/`: state machine guards +
  `gameStateMachine`, `roomService`, `roundService`, `gameFinalizer`, `drawerSelector`,
  `wordSelector`, `wordMatch`, `guessService`, `hintService`/`hints`, `chatService`, `scoring`,
  `scoreService`, `hostTransferService`, `connectionRegistry`, `roundTimer`, `snapshotProjector`,
  `drawingGateway`, `sessionService`, `lock`, `clock`, `ids`, `services`), and the realtime
  transport (`realtime/`: `socket.ts`, `handlers.ts`, `ioBus.ts`, `envelope.ts`).
- **Implemented (shared contracts, `shared/contract`):** `events.ts` (the exact locked event
  names), `schemas.ts`, `server-payloads.ts`, `snapshot.ts`, `errors.ts`, `constants.ts`,
  `types.ts`, `index.ts`.
- **Tests implemented (`server/tests`):** unit — `stateMachine`, `scoring`, `hints`, `wordMatch`,
  `hostTransfer`, `drawerSelector`, `roomValidation`, `errorMapping`, `secretWordContract`;
  integration — `rest.test.ts` and `realtime.test.ts` (real Fastify, real Socket.IO, real
  PostgreSQL, real Redis, injected clock, no wall-clock sleeps in the state machine paths).
  Helpers: `harness`, `client`, `game`, `rest`, `fixtures`, `memoryBus`.
- **Status:** implementation complete for the Stage 03 backend scope; verification recorded in
  EXEC-010.
---

## EXEC-010 — Verification pass: four defects found and fixed, validation results

Verification ran the real toolchain end to end. Four defects were found by executing the
integration suite against real PostgreSQL and Redis; none were found by typecheck alone.

### Defects found and fixed

| # | Defect | Impact | Fix |
|---|---|---|---|
| D-1 | `readAggregate` decoded `status` and `phase` with the JSON decoder while `writeAggregate` writes them as bare strings, so `JSON.parse('IN_GAME')` threw and fell back to `WAITING`. | The authoritative room never left `WAITING`: `game:start` failed, no round ever began, and the admission/config guards read stale state. | Read both as bare strings via a new `decStringUnion` helper (tolerant of a JSON-quoted value for safety). |
| D-2 | `SocketIoBus.toRoomExceptPlayer` called `target.except(excluded)` without assigning the result. Socket.IO's `BroadcastOperator.except()` returns a **new** operator; it does not mutate. | The exclusion was silently dropped, so the drawer received its own `draw:start` / `draw:move` / `draw:end` / `canvas:cleared` broadcasts — a direct breach of the "never back to the drawer" rule in `realtime-contract.md` §7. | Reassign the returned operator (`const target = excluded.length > 0 ? room.except(excluded) : room`). |
| D-3 | `RoomService.bindSocket` computed `wasReconnect = !member.isConnected`; members are created `isConnected: false` at admission, so a member's **first** bind was reported as a reconnect. | `player:joined` never fired for anyone; every presence was announced as `player:reconnected`. | Added the presence-history marker `RoomMember.hasBound`, set on bind, and keyed `wasReconnect` off it. This also covers the documented "reconnect **after** grace" row (`reconnect-protocol.md` §7), which `graceDeadline` alone cannot express because the sweeper clears it on expiry. |
| D-4 | Test-harness and test defects: placeholder helpers left in `realtime.test.ts`; broadcast tests that never bound the host socket; a duplicate-guess test with a single guesser (the round ends on the first correct answer, so the repeat is `BAD_STATE`, not `ALREADY_GUESSED`); a REST admission test that wrote only the Redis aggregate for a state `admit` reads from `rooms.status`; `waitFor` could miss an event that arrived before it subscribed. | Flaky or wrong tests; a `PORT=0` harness value rejected by env validation. | Removed the placeholders; bound both sockets where a room broadcast is asserted; gave the duplicate-guess test two guessers; wrote both stores in the REST test (matching the single writer that persists `room.status` to Redis **and** PostgreSQL); made `waitFor` check already-received events; relaxed `PORT` to `min(0)` as the documented ephemeral-port sentinel used only by the harness. |

### Validation results

| Check | Command | Result |
|---|---|---|
| TypeScript (server) | `npx tsc -p tsconfig.json --noEmit` | **PASS** (exit 0) |
| Lint (server) | `npm run lint` (`eslint .`) | **PASS** (exit 0) |
| Unit + integration tests | `npx vitest run` | **PASS** — 11 files, **111/111** tests |
| Migrations (dev db) | `npm run db:migrate` | **PASS** — `migrations applied`; `drizzle.__drizzle_migrations` = 1 |
| Seed (dev db) | `npm run db:seed` | **PASS** — idempotent; `words` = 60 |
| PostgreSQL schema | `psql` on `doodlebee` | **PASS** — 7 model tables + `words` |
| Server boot | `node --import tsx src/index.ts` | **PASS** — structured JSON log, listening on 127.0.0.1:3000 |
| `GET /health` | `Invoke-RestMethod http://127.0.0.1:3000/health` | **PASS** — `{status: ok, dependencies: {postgres: ok, redis: ok}}` |
| Secret-word isolation | `tests/unit/secretWordContract.test.ts` + realtime assertions | **PASS** — public `drawer:selected` has no `secretWord` property; guesser snapshot contains no secret |
| Client contract extensions E-01…E-05 | — | **NOT RUN** — see below |
| AD-004 performance measurement | — | **NOT RUN** — instrumentation hooks only |

### Deviations recorded

1. **`probe` ack echo (AD-004 instrumentation only).** When a client sends `_probe` on
   `draw:start` / `draw:move`, the ack echoes `probe: { t0, t1, t2 }`. `t2` is sampled after the
   owning service returns, i.e. after the broadcast was issued, because the emit is
   fire-and-forget and has no observable "before" instant. No production behavior depends on it.
2. **`RoomMember.hasBound` (additive, non-authoritative).** A presence-history boolean on the
   Redis member record, owned by the bind path, added solely to distinguish a first presence from
   a returning one (defect D-3). the `room:{id}:members` shape in `data-model.md` lists the member fields without it; it
   becomes no second source of truth for any documented field.
3. **`PORT` accepts `0`.** Treated as the "bind an ephemeral port" sentinel so the integration
   harness never fights over a fixed port. Unchanged for any real deployment value.
4. **`SWEEPER_INTERVAL_MS = 1_000`.** Added to `shared/contract/constants.ts` as **PROPOSED** —
   no approved product value exists for it.
5. **`join:room` resolves the room by code.** The realtime payload carries `roomCode`; the server
   resolves it to the room id. This is an implementation note, not a contract change.

### Provisional values left provisional (OC-4)

Not reinterpreted as product decisions: the `Room.status` value set (D03-026), `MIN_PLAYERS`
(D03-027), default timings (D03-028), grace durations (D03-020), the drawer-bonus magnitude
(D03-013), the hint algorithm (D03-014), and the scoring magnitudes. They are implemented with
their documented provisional defaults and remain flagged as PROPOSED in `constants.ts` /
`decision.md`.

### Unresolved conditions carried forward

1. **Client contract extensions E-01…E-05 are not applied yet** (`realtime-contract.md` §8).
2. **AD-004 remains CONDITIONAL** — no FPS, 8-viewer, or propagation-latency measurement has been
   performed; only the instrumentation hooks exist.
3. **Multi-socket presence announcement** is undefined by the documents: with `hasBound`, a second
   concurrent socket for an already-present player is announced as `player:reconnected`.
4. **Shutdown/TTL paths** (`SERVER_TERMINATED` round end, all-players-disconnected room TTL,
   `games.status = 'ABANDONED'`) are implemented but not covered by integration tests.
5. **Single-instance only** — the locked V1 is a single backend service; no Redis Socket.IO
   adapter or multi-instance fan-out was validated.

### Status

- **DONE (backend scope)** for the Stage 03 foundation and core realtime engine; verified to the
  extent the local infrastructure allows. Stage 04 **not** started; no mobile UI implemented;
  AD-004 **not** claimed.
- **Next action:** apply the E-01…E-05 additive client-contract entries to
  `src/types/index.ts` (and the drawer-private snapshot variant to `src/types/drawer-private.ts`),
  then re-run `npx tsc --noEmit` and `npx expo lint` at the repository root, and finally produce
  the Stage 03 implementation report (`Build.md`).