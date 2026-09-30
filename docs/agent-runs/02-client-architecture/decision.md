# Stage 02 — Decision Ledger

**Stage:** Client Architecture
**Version:** 2.1 (Architecture Lead Reconciliation - BUILD-001)
**Date:** 2026-09-30
**Status:** LOCKED — one decision (D02-008 / AD-004) CONDITIONAL; see Open Conditions

---

## Decision Status Legend

| Status | Meaning |
|---|---|
| APPROVED | Locked; no further debate required |
| APPROVED_WITH_CONDITIONS | Locked; conditional requirements must be met before implementation |
| UNDER_REVIEW | Actively being evaluated; cannot be used as implementation assumption |
| BLOCKED | Cannot proceed until external input is provided |
| REJECTED | Explicitly declined; rationale documented in ADR |
| SUPERSEDED | Replaced by a later decision |
| DEFERRED | Intentionally moved to a later stage |

---

## Decisions

| ID | Decision | Status | Evidence Source | Rationale |
|---|---|---|---|---|
| D02-001 | React Native | APPROVED | PRD §23 | Framework choice confirmed by project requirements |
| D02-002 | Expo (SDK 54+) | APPROVED | Nara recon + PRD | Node 22 compatible; EAS cloud builds cover iOS gap |
| D02-003 | TypeScript (strict) | APPROVED | PRD §11, Agents.md §11 | No `any` without documented reason |
| D02-004 | Expo Router | APPROVED | IA document + PRD | 9 production routes, Figma bottom nav excluded |
| D02-005 | Zustand | APPROVED_WITH_CONDITIONS | PRD §23 + Codex review | Domain-split stores (5); State Writer Map mandatory |
| D02-006 | REST (Fetch) | APPROVED | PRD §23 + Codex review | Thin wrapper; Axios rejected for unnecessary bundle cost |
| D02-007 | Socket.IO | APPROVED | Codex review (12-factor analysis) | Reconnection, rooms, ACKs, debugging justify +25KB bundle |
| D02-008 | Drawing library | APPROVED_WITH_CONDITIONS | Codex review + BUILD-001 SDK 57 verification | @shopify/react-native-skia 2.6.2 pinned and verified SDK 57 compatible; **on-device performance validation (60 fps / 8 viewers / <200 ms) outstanding** — AD-004 stays CONDITIONAL (ADR §14) |
| D02-009 | Fastify vs NestJS | DEFERRED | Backend not in Stage 02 scope | Server architecture deferred to Stage 3 |
| D02-010 | Reconnect strategy | APPROVED_WITH_CONDITIONS | Codex review + PRD FR-010 | Snapshot-based restoration; exact protocol in Stage 3 |
| D02-011 | Session persistence | APPROVED_WITH_CONDITIONS | Codex review | zustand/persist for nickname + reconnectInfo only |
| D02-012 | Shared type package | APPROVED_WITH_CONDITIONS | Codex review + pragmatism | Types in `src/types/`; monorepo deferred until server scaffolded |
| D02-013 | React Hook Form | APPROVED | PRD §23 | Forms with validation complexity; simple controls exempt |
| D02-014 | Zod | APPROVED | PRD §12, §23 | All boundary validation; non-negotiable |
| D02-015 | Reanimated | APPROVED_WITH_CONDITIONS | PRD §23 + Codex review | UI animations only; must not block drawing touch handler |
| D02-016 | Jest + RTL | APPROVED | Codex review | Expo default; mock server for multiplayer tests |
| D02-017 | Secret word store separation | APPROVED | Codex HIGH finding | Compartmentalized stores prevent accidental exposure |
| D02-018 | State Writer Map | APPROVED_WITH_CONDITIONS | Codex CRITICAL finding | Mandatory append to ADR; every state field has one writer |
| D02-019 | Design tokens | APPROVED | Design.md §8 | Centralized `tokens.ts`; components consume tokens only |
| D02-020 | V1 scope boundary | APPROVED | PRD §35, Agents.md §7 | Explicit exclusion list enforced |
| D02-021 | Route directory convention | APPROVED | ADR §5 + `ProjectDocs/02-client-architecture.md` §3 + verified implementation | Routes live in `app/` (sibling to `src/`). `AGENTS.md` said `src/app/` and was the outlier; `AGENTS.md` was corrected. No implementation was moved |
| D02-022 | Deep-link scheme `doodlebee` | APPROVED_WITH_CONDITIONS | BUILD-001 deviation + Expo SDK 57 linking docs | Scheme kept and recorded. Platform configuration only: creates no public deep-link contract and exposes no linkable route. Value derives from the approved `slug` (`doodlebee`). Any deep-link surface needs separate approval |
| D02-023 | npm audit advisories | ACCEPTED (non-blocking) | `npm audit`, 2026-09-30 | 14 moderate transitive build-toolchain advisories from 2 root advisories; 0 low/high/critical. Not remediated: npm's only fix is a semver-major SDK downgrade. Re-check each SDK upgrade |

---

## Accepted BUILD-001 Deviations

Dispositions recorded at ARCH-002 (see `Execution.md`). None of these changes an
architecture decision; each is a platform/toolchain requirement that BUILD-001
verified with a green toolchain (typecheck, lint, format, 12/12 tests,
`expo install --check`, `expo-doctor` 21/21, Android device smoke test).

| # | Deviation | Disposition |
|---|---|---|
| 1 | Package name `doodlebee-temp` → `doodlebee` | ACCEPTED — scaffold placeholder; matches `slug` |
| 2 | Route files use the directory form (`app/(index)/index.tsx`) where ADR §5 showed the flat form | ACCEPTED — URLs are identical; route **names** differ. ADR §5 mapping corrected (v2.1) so `_layout.tsx` names match |
| 3 | `.eslintrc.js` replaced by `eslint.config.js` (flat config) | ACCEPTED — required by Expo SDK 53+ |
| 4 | `jest` / `jest-expo` / `@types/jest` moved from `dependencies` to `devDependencies` | ACCEPTED — correct classification; Expo CLI mis-filed them on Windows |
| 5 | `app.json`: removed schema-invalid `newArchEnabled` and legacy top-level `splash` | ACCEPTED — both invalid in the SDK 57 schema |
| 6 | `app.json`: `scheme: "doodlebee"` added | APPROVED_WITH_CONDITIONS — D02-022 |
| 7 | Expo CLI rewrote `tsconfig.json` `include`, dropping `.expo/types/**/*.ts` and `expo-env.d.ts` | ACCEPTED — Expo-managed; this closes off typed routes unless re-added (deferred to the UI stage) |
| 8 | Added `.prettierignore` (excludes `*.md` and `.refact/`) | ACCEPTED — keeps `format:check` meaningful for code without reflowing the locked ADR and agent-run logs |

---

## superseded Decisions

None. This is the first comprehensive reconciliation of all prior proposals.

---

## Blocked Decisions

None. All decisions are either APPROVED, APPROVED_WITH_CONDITIONS, or DEFERRED.
D02-008 is APPROVED_WITH_CONDITIONS: its remaining condition is documented, not blocking.

---

## Open Conditions (not blockers)

| Decision | Condition | Closes when |
|---|---|---|
| D02-008 / AD-004 | 60 fps, 8 simultaneous viewers, <200 ms propagation measured on device | Stage 3 — protocol in ADR §14 |
| D02-022 | No public deep-link surface until separately approved | Any later stage that adds links |
| — | Typed routes (`experiments.typedRoutes`) deferred (beta; needs generated `.expo/types` before CI typecheck) | UI stage |
| — | `react-native-gesture-handler@3.3.0` installed transitively while SDK 57 pins `~2.32.0` | Before using gesture-handler directly |
