# Stage 03 — Realtime + Backend Architecture: Flow

**Stage:** 03 — Realtime + Backend Architecture
**Document:** Workflow record (the ACTUAL sequence of Stage 03 work)
**Version:** 1.0
**Status:** COMPLETE with AD-004 CONDITIONAL
**Project:** DoodleBee
**Date:** 2026-09-30
**Authority:** Subordinate to `decision.md`. This file records what was *done* and in
what order; it does not decide anything.

---

## 1. Purpose

`flow.md` records the workflow Stage 03 actually followed — the phases, their inputs
and outputs, and the artifacts each produced. It is written after the work, from the
execution record, and describes reality rather than an intended ideal. Where the actual
order differs from the plan, the difference is stated (`§7`).

Companion documents:

| Document | Role |
|---|---|
| `decision.md` | What was decided, and why (the authority) |
| `flow.md` | This file — how the work proceeded |
| `Execution.md` | Chronological execution history, including blockers |
| `architecture-research.md` | Evidence gathered before decisions |
| remaining 8 artifacts | The design detail behind the ledger |

---

## 2. Constraints the flow had to respect

1. **Documentation only.** Stage 03 designs; it does not implement. No handler, route,
   migration or screen was written.
2. **Stage 02 is closed.** ADR v2.1 is the baseline. Stage 02 decisions are not reopened
   unless new evidence creates a recorded contradiction.
3. **Evidence before decision.** The project golden rule (`docs/projectInfo.md` §45,
   `docs/AGENTS.md` §31) forbids deciding by assertion. Research precedes the ledger.
4. **The PRD is the product source of truth.** `Draw_and_Guess_PRD.pdf` outranks generic
   architecture knowledge; where the PRD is silent, the silence is recorded as a gap
   rather than filled silently.
5. **The 12 required artifacts** and the **19 explicit decisions** were fixed by the
   Stage 03 brief.
6. **AD-004 must not be marked LOCKED** without real measurements, and no measurement was
   possible (no device attached, no server, no clients).

---

## 3. Phases

### P0 — Reconnaissance: read the approved sources

**Input:** the Stage 03 brief; the repository at `D:\doodlebee`.

**Work:** read, in the approved hierarchy, `docs/AGENTS.md`, `docs/Design.md`,
`docs/projectInfo.md`, `ProjectDocs/01-information-architecture.md`,
`ProjectDocs/01-screen-state-map.md`, `ProjectDocs/02-client-architecture.md`, and the
whole Stage 02 run directory (`04-architecture-decision.md` = ADR v2.1, `decision.md`,
`flow.md`, `Execution.md`, `Build.md`). Inspected the live `app/` and `src/` trees,
`package.json`, `app.json`, `tsconfig.json`, the lint/format configs, and the Stage 02
client constants (`src/drawing/config.ts`, `src/validation/schemas.ts`).

**Output:** the source table in `architecture-research.md` §2, and confirmation that
Stage 02 ended at `DOCS-001` with the next stage scoped as "Stage 03 (Game State
Machine)".

**Note:** the Stage 02 `flow.md` documents the Stage 02 workflow; Stage 03 does not edit
it. Stage 03's own `flow.md` is this file.

---

### P1 — PRD extraction and requirement location

**Input:** `Draw_and_Guess_PRD.pdf`.

**Work:** extracted the PDF to text with `pdftotext -layout -enc UTF-8`
(31,550 characters, 723 lines) and located each requirement area by line: Product
Overview 56, Core Game Flow 91, FRs 144, NFRs 350, Tech Stack 413, Real-Time 482, Word DB
501, Infra 508, DevOps 528, Testing 537, Analytics 562, V1 Scope 604, Final Stack 625,
Recommended Arch 677, Core Principle 704, Success Criteria 715.

**Output:** PRD citation anchors used throughout Stage 03. The success criterion
(8 players → start → draw → guesses → ranking → scores → drawer change →
disconnect → reconnect → restore → leaderboard) is the acceptance spine the
design is checked against.

**Limitation recorded:** text extraction can reorder table cells; every cited
requirement was cross-checked against duplicated text in `docs/projectInfo.md` where one
exists (`architecture-research.md` §12.5).

---

### P2 — Evidence gathering (upstream and local)

**Input:** the candidate technology list from the brief and the PRD stack section.

**Work:** gathered *current, verifiable* facts rather than relying on memory:

- **npm registry metadata (2026-09-30):** fastify 5.12.5 (no `engines`), @nestjs/core
  12.1.1 (`>=20`), socket.io 4.8.4, socket.io-client 4.8.4, @socket.io/redis-adapter
  8.3.0, ioredis 6.0.0, redis 6.2.1, drizzle-orm 0.45.3, drizzle-kit 0.31.11, pg 8.23.0,
  zod 4.6.5, vitest 5.0.2, pino 10.3.1. Noted that `prisma` `latest` resolved to
  8.0.0-rc.19 while `@prisma/client` `latest` resolved to 7.10.0.
- **Upstream documentation:** the Fastify v5 migration guide's Node 20+ statement.
- **Upstream typings:** `socket.io@4.8.4` `dist/index.d.ts` exposes
  `connectionStateRecovery` (default `maxDisconnectionDuration` 120000 ms) and
  `io.except(...)`.
- **Local environment:** Node v22.23.2, npm 10.9.8, npm (not bun) — `package-lock.json`
  present, `adb devices` empty, branch `main`.

**Output:** `architecture-research.md` §3—§5.

**Explicit non-output:** no benchmark, no FPS sample, no latency sample, no load test.

---

### P3 — Independent architecture review (areas A—M)

**Input:** the evidence from P2 plus the PRD and Stage 02 baseline.

**Work:** evaluated each brief area against DoodleBee's *actual* V1 requirements — not
against general reputation. Key judgements:

- **A. Fastify vs NestJS:** decided on the size of the system (one service, seven routes,
  one gateway), not popularity (`architecture-research.md` §6).
- **B. Socket.IO architecture:** connection lifecycle, identity boundary, rooms,
  namespaces, acks, ordering, duplicates, and the full disconnect taxonomy including
  host and drawer (§7).
- **C. Redis:** classified each candidate responsibility as authoritative-transient,
  persistent, or derived (§8).
- **D. PostgreSQL:** mapped the PRD's eight entities and decided strokes are not
  persisted (§9).
- **E—M:** contract observations for the state machine, secret-word security,
  drawing, guessing, chat, reconnection, REST, the error model, and shared types
  (§10).

**Output:** `architecture-research.md` §6—§10, and the contradiction list
C-01 — C-12 (`§11`).

**Behaviour note:** twelve contradictions were recorded rather than silently resolved.
Each receives a disposition in `decision.md` §5. No research gap was papered over.

---

### P4 — Design artifact creation

**Input:** P3's findings and the 19 explicit decision requirements.

**Work:** produced the eight design artifacts that carry the detail behind the ledger:

| Artifact | Content |
|---|---|
| `realtime-contract.md` | Transport, lifecycle, rooms, envelopes, every event, ack/error semantics, ordering, the server-side event→writer mapping |
| `state-machine.md` | The two lifecycles, transition graph, per-state definitions, guards, the three round-end triggers, selection rules, timers |
| `server-state-writer-map.md` | One writer per authoritative field, the `version` counter, tie-breaks, the reader-scope matrix |
| `data-model.md` | Storage split, the eight PostgreSQL tables, the Redis key model and TTLs, migrations, privacy |
| `api-contract.md` | The six REST endpoints plus health, auth, the error model, rate limits, CORS/transport |
| `reconnect-protocol.md` | Reconnect identity, sequence, snapshot schema, secret-word visibility, staleness, grace periods, disconnect matrix |
| `security-model.md` | Trust model, server authority, secret-word protection, anti-cheat, moderation, abuse prevention, residual risks |
| `testing-strategy.md` | Test levels, multiplayer and failure tests, determinism, the AD-004 measurement protocol, load tests, CI |

**Output:** the eight artifacts above, cross-referenced to each other and to the ledger.

---

### P5 — Decision locking

**Input:** P3's research and P4's design detail.

**Work:** consolidated the design into one ledger of **31 decisions** (D03-001 —
D03-031), each with the six required fields (decision, evidence, alternatives
considered, reason, consequences, implementation implications). Applied the status
vocabulary: APPROVED / APPROVED_WITH_CONDITIONS / PROPOSED / DEFERRED / SUPERSEDES. Where
the PRD does not fix a value, the decision is marked **PROPOSED** and flagged as needing
product confirmation rather than being presented as a requirement.

Recorded two supersessions of Stage 02 *deferrals* (AD-008 → D03-023, AD-009 →
D03-019/D03-030), both of which Stage 02 explicitly assigned to Stage 3, plus one
additive REST field (ADR §10 → D03-021). No locked Stage 02 decision was reopened.

**Output:** `decision.md` — the ledger, its supersession table, the deferred list, the
C-01 — C-12 dispositions, and six open conditions (OC-1 — OC-6).

---

### P6 — AD-004 measurement protocol (design only)

**Input:** Stage 02's CONDITIONAL AD-004 with three unmeasured clauses.

**Work:** defined the measurement protocol without performing any measurement:
instrumentation points (`_probe.t0` at touch ingest, `t1`/`t2` at the server, `t3`/`t4` at
the receiving client), an NTP-style four-timestamp clock-offset method using a median
offset over >=20 samples, a 30 s scripted measurement window repeated three times,
acceptance criteria (p95 <=16.7 ms frame time for clause 1; 8 concurrent viewers for
clause 2; p50 <=95 ms and p95 <=200 ms for clause 3), the test topology and device
requirements, and the enumerated evidence to record.

**Output:** `testing-strategy.md` §7 and `decision.md` D03-025.

**Explicit outcome:** **AD-004 remains CONDITIONAL.** No clause is claimed as met. The
modality fact verified in Stage 02 (Skia 2.6.2 bundled in Expo Go SDK 57) is a
build-time fact and is explicitly *not* extended into a runtime performance claim.

---

### P7 — Closure

**Input:** the completed research, design and ledger.

**Work:** verified every artifact exists with correct UTF-8 (no BOM), LF-only line
endings, and no replacement characters; confirmed internal cross-references resolve to
real sections; confirmed the ledger's decision IDs match the IDs referenced by the design
artifacts; confirmed no implementation file was touched (`git status` shows documentation
only); wrote this `flow.md` and appended the execution history to `Execution.md`.

**Output:** a complete, internally consistent Stage 03 documentation set. Stage 03
implementation is not begun.

---

## 4. Artifact production order (actual)

1. `architecture-research.md`
2. `realtime-contract.md`
3. `state-machine.md`
4. `server-state-writer-map.md`
5. `data-model.md`
6. `api-contract.md`
7. `reconnect-protocol.md`
8. `security-model.md`
9. `testing-strategy.md`
10. `decision.md` (written in sequential chunks after one failed oversized write — see
    `Execution.md` EXEC-006)
11. `flow.md` (this file)
12. `Execution.md`

The ledger was written *after* the design artifacts because each design artifact is the
detail behind several ledger rows; writing the ledger last let every row cite a section
that already existed. This is the reverse of the document numbering, and is intentional.

---

## 5. What did not happen

Stated plainly so the record is not over-read:

- No implementation code, migration, handler, route, screen or gameplay logic was written.
- No backend was run; no Fastify or Socket.IO process was started.
- No benchmark, FPS sample, latency sample, load test or device test was performed.
- No Redis or PostgreSQL instance was provisioned or queried.
- No Stage 02 document was modified, and no locked Stage 02 decision was reopened.
- No Stage 03 decision was made on popularity, and no value was invented to fill a gap
  without being marked PROPOSED.

---

## 6. Blockers encountered during Stage 03

Stage 03 hit one tooling blocker. It is recorded here in summary and in full in
`Execution.md`.

| ID | Blocker | Class | Resolution |
|---|---|---|---|
| EXEC-006 | A single `powershell` invocation carrying the entire `decision.md` here-string exceeded the Windows command-length limit (`Failed to create unified exec process: The filename or extension is too long. (os error 206)`). The write did not occur; no partial file was left behind. | Tooling | Recovery attempt 1: split the write into sequential chunks (`WriteAllText` for the head, `AppendAllText` for the remainder), each well under the limit. The retry succeeded on the first attempt. |

No environment, research, architecture, dependency, product-ambiguity or tooling blocker
remained unresolved at closure. The product-ambiguity findings (C-01 — C-12) are
recorded as contradictions and dispositions, not as blockers — each has a stated
disposition and, where it needs a value, a PROPOSED value with a confirmation owner.

---

## 7. Deviations from the plan, and why

1. **Ledger written last, not first.** The brief lists `decision.md` first. It was
   produced after the design artifacts so that every ledger row could cite a section that
   already existed, rather than a section that was about to exist. The numbering of the
   artifacts does not imply production order.
2. **The ledger was written in chunks.** A single write was attempted and failed with the
   command-length error; the recovery is recorded above and in `Execution.md`.
3. **`flow.md` and `Execution.md` were written at closure.** They describe the work, so
   they can only be complete once the work is; writing them earlier would have produced a
   plan rather than a record.

---

## 8. Handoff

Stage 03 ends **here**. The next worker begins implementation only after the architecture
review is explicitly acknowledged as locked.

- **Read first:** `decision.md`, then `realtime-contract.md`.
- **Close first:** OC-1 and OC-2 (re-check pinned registry versions) before writing
  `package.json`; treat every PROPOSED value as provisional until OC-4 is answered.
- **Do not:** mark AD-004 met, reopen a Stage 02 decision, or begin Stage 04 before
  Stage 03 implementation is reviewed.
