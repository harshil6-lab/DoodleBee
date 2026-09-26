# Stage 02 — Decision Ledger

**Stage:** Client Architecture
**Version:** 2.0 (Architecture Lead Reconciliation)
**Date:** 2026-09-26
**Status:** LOCKED

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
| D02-008 | Drawing library | UNDER_REVIEW — SDK COMPATIBILITY | Codex review (4-library evaluation) | @shopify/react-native-skia recommended; verify with `npx expo install` post-scaffold |
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

---

## superseded Decisions

None. This is the first comprehensive reconciliation of all prior proposals.

---

## Blocked Decisions

None. All decisions are either APPROVED, APPROVED_WITH_CONDITIONS, UNDER_REVIEW (with explicit mitigation), or DEFERRED.
