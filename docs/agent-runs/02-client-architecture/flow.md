# Stage 02 — Client Architecture: Workflow

**Stage:** 02 — Client Architecture
**Document:** Executed workflow record (how Stage 02 actually ran)
**Version:** 1.0
**Status:** CLOSED
**Project:** DoodleBee
**Date:** 2026-09-30
**Authority:** Subordinate to `04-architecture-decision.md` (ADR) and `decision.md`.
This file introduces no decisions and claims no work that was not performed.

---

## 1. Why this file exists

`flow.md` was named in BUILD-001's execution record (`Execution.md` → BUILD-001
→ *Files inspected*) and again in the ARCH-002 reconciliation request, but it had
never been authored: `git ls-files docs/agent-runs` shows it was never tracked and
no earlier revision exists.

This file closes that documentation gap. It is a **map of what was executed**, not a
new source of truth:

- Where this file and the ADR disagree, the **ADR** wins.
- Where this file and `Execution.md` disagree, **`Execution.md`** wins.

Only executed phases are listed. Anything attempted but not completed is marked as
such rather than smoothed over.

---

## 2. Two numbering systems (do not confuse them)

| System | What it is | Ordering |
|---|---|---|
| Artifact numbers `01-` ... `04-` | Output filename *slots* | **Not** chronological |
| `Execution.md` entry IDs (`NARA-001`, `ARCH-001`, `CODEX-001`, `BUILD-001`, `ARCH-002`, `DOCS-001`) | The record of who ran what | Chronological (append-only) |

The numeric prefixes are not a chronology. `03-nara-tooling.md` is the tooling
report dated 2026-09-26, and `02-codex-review.md` states in its own header that it
was written *after* "Claude research, Nara tooling reconnaissance, and Architecture
Decision Record" — so slot `02` was filled after slot `03`.

Artifact → producing entry:

| Artifact | Produced by | Current verified state |
|---|---|---|
| `01-claude-research.md` | (never produced) | **Prompt only** — no research output (1,994 bytes) |
| `02-codex-review.md` | `CODEX-001` | Full independent review (30,963 bytes, dated 2026-09-26) |
| `03-nara-tooling.md` | `NARA-001` | Full environment report (15,994 bytes, dated 2026-09-26) |
| `04-architecture-decision.md` | `ARCH-001` → v2.0; `ARCH-002` → v2.1 | ADR v2.1, LOCKED (AD-004 CONDITIONAL) |
| `decision.md` | `ARCH-001` → v2.0; `ARCH-002` → v2.1 | Ledger v2.1, 23 decisions (D02-001 ... D02-023) |
| `Build.md` | `BUILD-001` | Build record + ARCH-002 pointer section |
| `flow.md` | `DOCS-001` | This file |

---

## 3. Executed workflow — phase map

| # | Phase | Entry | Primary artifact(s) | Outcome |
|---|---|---|---|---|
| 1 | Reconnaissance / research | (none) | `01-claude-research.md` | **NOT COMPLETED** — prompt only, no output |
| 2 | Independent architecture review | `CODEX-001` | `02-codex-review.md` | DONE |
| 3 | Tooling reconnaissance | `NARA-001` | `03-nara-tooling.md` | DONE |
| 4 | Architecture Lead reconciliation | `ARCH-001` | ADR v2.0, `decision.md` v2.0 | DONE |
| 5 | Foundation build | `BUILD-001` | client foundation, `Build.md` | DONE |
| 6 | Validation | `BUILD-001` | `Build.md` §7 and §8 | PASS |
| 7 | Architecture Lead reconciliation v2.1 | `ARCH-002` | ADR v2.1, `decision.md` v2.1 | DONE |
| 8 | Stage 02 closure | `DOCS-001` | `flow.md`, `Execution.md` | DONE |

Phases 5 and 6 share one entry: validation was executed as part of BUILD-001 and
recorded in `Build.md`, not as a separate agent run.

---

## 4. Phase detail

### Phase 1 — Reconnaissance / research — NOT COMPLETED

Slot `01-claude-research.md` contains the research **prompt** and nothing else: read
`docs/Agents.md`, `docs/Design.md`, `docs/projectInfo.md` and the three
`ProjectDocs/` documents, then propose the Stage 02 client architecture.

**No research output was ever written to this slot.** ADR §2 records the same
finding: "`01-claude-research.md` = prompt only (no research written)". Every
downstream phase proceeded without it.

### Phase 2 — Independent architecture review — DONE (`CODEX-001`)

`02-codex-review.md` is a full, dated independent review — "Final Stage 02
Architecture Review — Codex Independent Review", 2026-09-26 — of the
then-current **ADR v1.0**. It is the first substantive independent critique and it
produced the findings that shaped Phase 4:

- State Writer Map required to prevent duplicate sources of truth
- the secret-word rule was stated but not technically enforceable
- Socket.IO recommended over raw WebSocket (reconnection, rooms, ACKs, debugging)
- `@shopify/react-native-skia` recommended for the drawing canvas, pending an Expo
  SDK compatibility check
- the 9 production routes confirmed correct, with no scope creep

### Phase 3 — Tooling reconnaissance — DONE (`NARA-001`)

`03-nara-tooling.md` is the tooling/environment report dated 2026-09-26 14:30
UTC+7. It established the **empty-foundation baseline** (no git repository, no
`package.json`, no source, no CI, no `.gitignore`, no `.env`) and the capability
envelope for the stage:

| Capability | Finding |
|---|---|
| Node / npm | v22.23.2 / 10.9.8 |
| Java / Android SDK | 24.0.1 / APIs 31-36, build-tools 35-36, adb 36.0.2 |
| EAS CLI | 23.1.0 (cloud build capability confirmed) |
| Expo CLI | not installed globally; `npx expo` usable |
| iOS tooling | none (Windows host) → EAS cloud builds required |
| Figma MCP | not configured; local ZIP is the reference asset |
| Package managers | npm only; pnpm / yarn absent |

### Phase 4 — Architecture Lead reconciliation — DONE (`ARCH-001`)

Produced ADR **v2.0** and `decision.md` **v2.0** (20 decisions, D02-001 ... D02-020)
by resolving the four architecture gates opened in Phase 2:

| Gate | Resolution |
|---|---|
| State Writer Map | 26 fields, each with authoritative writer, transport, reader scope, persistence and reconciliation rule |
| Secret-word security | Compartmentalised drawer/guesser stores with TypeScript-enforced separation, role-gated payloads, logger redaction, required tests |
| Realtime transport | Socket.IO locked over raw WebSocket on a 12-factor comparison |
| Drawing library | `@shopify/react-native-skia` CONDITIONAL on an Expo SDK compatibility check; `react-native-svg` documented as the fallback |

### Phase 5 — Foundation build — DONE (`BUILD-001`)

Built the **client foundation only** against ADR v2.0: configuration, the 9-route
Expo Router tree, types, validation, the Zustand domain stores, the REST client
wrapper, drawing constants, theme tokens, logger and tests. Explicitly excluded:
game logic, rooms, multiplayer, scoring, chat, drawing sync, auth, backend,
realtime event contracts, API calls and production screens.

Full record: `Build.md`. An earlier agent had already written part of the
foundation; BUILD-001 inspected that state first and repaired it rather than
recreating the project (`Build.md` §5).

### Phase 6 — Validation — PASS (`BUILD-001`)

Executed within BUILD-001 and recorded in `Build.md` §7 (results table) and
§8 (Android). As recorded by that entry:

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`, strict) | 0 errors |
| ESLint (`expo lint`, flat config) | 0 errors, 0 warnings |
| Prettier (`--check .`) | all files formatted |
| Jest | 2 suites / 12 tests passed |
| `expo install --check` | dependencies up to date |
| `expo-doctor` | 21/21 checks passed |
| `expo config` (prebuild schema) | valid, `sdkVersion: "57.0.0"` |
| Metro bundle (Android export) | 1,245 modules → 2.7 MB Hermes bytecode |
| Android device run (Expo Go 57.0.9) | loaded, no JS exceptions, no redbox, zero Metro warnings after fixes |

`tsc`, `expo lint`, `prettier --check .` and Jest were re-run at `ARCH-002` and
were green again. The AD-004 drawing-performance test was **not** part of
validation — it cannot run until the Stage 3 realtime layer exists (ADR §14).

### Phase 7 — Architecture Lead reconciliation v2.1 — DONE (`ARCH-002`)

Resolved the four items BUILD-001 flagged for review, as **documentation only**.
ADR → v2.1; ledger → v2.1 (23 decisions).

| Item | Resolution |
|---|---|
| Route directory (`src/app/` vs `app/`) | `app/` at the repo root is authoritative (D02-021); `AGENTS.md` corrected; **no implementation moved** |
| Skia / Expo Go (ADR §14) | Corrected: Skia is bundled in Expo Go for SDK 57 (`inExpoGo: true`; `librnskia.so` present) |
| Deep-link `scheme: "doodlebee"` | Approved with conditions and formally recorded (D02-022); platform config only, no public link contract |
| AD-004 validation | Remains **CONDITIONAL**; the closing protocol and the exact missing evidence are in ADR §14 |
| npm audit advisories | Recorded, not "fixed" — 14 moderate, 0 high/critical, no SDK downgrade (D02-023) |

Also: `D-DEF-010` closed as RESOLVED, and the eight BUILD-001 deviations accepted
(`decision.md` → Accepted BUILD-001 Deviations).

### Phase 8 — Stage 02 closure — DONE (`DOCS-001`)

This phase. Created `flow.md` and appended the closure entry to `Execution.md`.
Documentation only: no implementation change, no ADR decision change, and Stage 03
was not started.

---

## 5. Known documentation discrepancies (recorded, not silently resolved)

1. **Phase 1 produced nothing.** Slot `01-claude-research.md` still contains only
   its prompt; ADR §2 records this.
2. **`02-codex-review.md` carries conflicting descriptions.** ADR §2 and the
   `CODEX-001` entry describe it as "prompt only, no review written", while
   `ARCH-001` describes it as a "full independent review, 681 lines". The file's
   **current, verified** content is a full review dated 2026-09-26. The shorter
   descriptions appear to record the state of the slot *before* the review was
   written into it; this file records the discrepancy rather than rewriting the ADR.
3. **`flow.md` did not exist until Phase 8**, although `Execution.md` →
   `BUILD-001` lists it among files inspected. Raised as a reporting gap at
   `ARCH-002` and closed here.
4. **`docs/01-information-architecture.md`** is referenced by `docs/AGENTS.md`
   §18 but the approved IA document in this repository is
   `ProjectDocs/01-information-architecture.md`. Not resolved here.

---

## 6. What this workflow deliberately did NOT do

- No backend, server, database or deployment work (deferred to Stage 3 / post-Stage-2).
- No game logic, rooms, multiplayer, scoring, chat, drawing sync, auth or production screens.
- No Stage 03 work of any kind.
- No implementation change during either reconciliation phase (`ARCH-002`, `DOCS-001`) — both were documentation only.
- No ADR decision reversed at closure: v2.1 corrected a factual error (Skia in Expo Go) and recorded a previously undocumented value (`scheme`).
- No technology selected by assertion: Socket.IO, Skia and Jest each carry an evidence section in the ADR §25 ledger.

---

## 7. State at closure

| Item | State |
|---|---|
| Stage 02 | COMPLETE — client foundation built and verified |
| ADR | v2.1, LOCKED, with **AD-004 CONDITIONAL** |
| Ledger | v2.1 — 23 decisions (D02-001 ... D02-023) |
| Open conditions | D02-008 / AD-004 performance validation; D02-022 deep-link surface; typed routes (UI stage); `react-native-gesture-handler` pin |
| Blockers | None |
| Stage 03 | **NOT STARTED** |