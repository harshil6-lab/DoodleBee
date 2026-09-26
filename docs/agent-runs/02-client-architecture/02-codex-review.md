# Final Stage 02 Architecture Review — Codex Independent Review

**Reviewer:** Codex (independent architecture reviewer)
**Date:** 2026-09-26
**Stage:** 02 — Client Architecture
**Context:** After Claude research, Nara tooling reconnaissance, and Architecture Decision Record (04-architecture-decision.md)

---

## 1. Environment Implications

The repository is an **EMPTY FOUNDATION** confirmed by NaraCLI reconnaissance:

| Factor | Status | Impact |
|--------|--------|--------|
| Git initialized | NO | CRITICAL prerequisite missing before any implementation |
| package.json | ABSENT | No dependencies locked; all choices still open |
| Expo project | NOT SCAFFOLDED | All architecture decisions are paper-only until scaffolded |
| Source code | ZERO files | No existing code conflicts with any proposal |
| Node 22.22.2 | ✅ | Compatible with Expo SDK 54+ |
| npm 10.9.8 | ✅ | Primary package manager; pnpm/yarn absent |
| EAS CLI 23.1.0 | ✅ | Cloud iOS builds viable; EAS Build profiles TBD |
| Android SDK | ✅ Full | Local Android builds fully supported |
| Xcode/iOS tooling | MISSING | iOS requires EAS cloud build only |
| Figma MCP | NOT CONFIGURED | Manual screenshot reference from ZIP required |

**Assessment:** The empty foundation is an advantage — no retrofitting required. However, it also means no empirical validation of any architecture choice has been performed. All recommendations below are theoretical until scaffold + prototype.

---

## 2. Claude Proposal Review

**Observation:** `01-claude-research.md` contains the **prompt/task description**, not Claude's actual research output. The file has no substantive research findings, folder proposals, or recommendations — it is purely the instruction given to Claude.

**Same applies to `02-codex-review.md`** — it contains the review prompt, not a completed review.

This means **no actual Claude research output or Codex review output exists** in the repository for this stage. The only substantive prior work is:

- `04-architecture-decision.md` (1298 lines) — the Architecture Decision Record
- `03-nara-tooling.md` — the environment report

**IMPACT ON THIS REVIEW:** I am reviewing the Architecture Decision Record (`04-architecture-decision.md`) as the primary proposed architecture artifact, supplemented by the PRD and approved documents. I cannot evaluate Claude's specific recommendations because they were not written to disk.

---

## 3. Nara Findings Impact

Nara's reconnaissance confirms several environmental facts that directly affect architecture decisions:

### Critical prerequisites before implementation:
1. **Git initialization is mandatory** — Agents.md §28 requires small focused commits. No `.git/` exists.
2. **No Expo project yet** — The folder structure proposals in the ADR are aspirational, not validated against a real project.

### Drawing library constraint:
Some drawing libraries require custom native modules that conflict with Expo Go. Since this project will use a development build (not Expo Go) for production, most React Native canvas libraries are viable. However, **the exact Expo SDK version is unknown** because no `app.json` exists yet. The drawing library choice should be made before or alongside scaffold to avoid SDK compatibility issues.

### EAS and iOS:
iOS is viable via EAS cloud builds. The architecture must not assume any iOS-specific native APIs that are unavailable through Expo managed workflow. Standard Expo-managed APIs are safe.

---

## 4. Navigation Architecture

**ADR Section 6 — Approved Routes:**

```
/
/nickname
/create-room
/join-room
/lobby/[roomId]
/game/[roomId]
/round-result/[roomId]
/final-result/[roomId]
/settings
```

### Review:

**APPROVED** — Matches the approved Information Architecture document exactly. 9 routes. Clean. Correctly excludes the Figma prototype bottom navigation.

### Finding — MEDIUM:

The ADR shows a broken/malformed code fence in Section 6. The closing ``` is missing and the route tree is cut off mid-block. This is a documentation formatting issue, not an architectural problem, but it should be corrected before the ADR is finalized.

### Finding — INFO:

Expo Router file structure maps directly:

```
app/
├── (index).tsx          → /
├── nickname.tsx         → /nickname
├── create-room.tsx      → /create-room
├── join-room.tsx        → /join-room
├── lobby/
│   └── [roomId].tsx     → /lobby/[roomId]
├── game/
│   └── [roomId].tsx     → /game/[roomId]
├── round-result/
│   └── [roomId].tsx     → /round-result/[roomId]
├── final-result/
│   └── [roomId].tsx     → /final-result/[roomId]
└── settings.tsx         → /settings
```

This is the standard Expo Router convention. No issues.

---

## 5. State Architecture

**ADR Section 7-9 — Three categories: Server/Game State, Local UI State, Session State.**

### Review:

**APPROVED WITH CONDITIONS**

The three-category separation is correct and aligns with Agents.md §17. However:

### Finding — HIGH:

**"One authoritative synchronization path" (Section 8) is stated but not specified.** The ADR says:

> "REST state + WebSocket state + independent local state must not become three competing sources of truth."

This is a correct principle but lacks implementation guidance. Without explicit rules like:
- "WebSocket events are the sole writer for game state"
- "REST responses update only session/room metadata, never game round state"
- "Local UI state never persists across screen transitions unless explicitly designed"

...implementers will naturally drift toward duplicating state.

**Recommendation:** Add an explicit "State Writer Map" to the ADR that lists each state field and its single authoritative source:

| State Field | Authoritative Source |
|---|---|
| room.players | WebSocket (PLAYER_JOINED/PLAYER_LEFT) |
| room.host | WebSocket (HOST_TRANSFERRED) |
| game.roundState | WebSocket (ROUND_STARTED/ROUND_ENDED) |
| game.drawer | WebSocket (DRAWER_SELECTED) |
| game.secretWord | WebSocket (only to drawer client) |
| game.maskedWord | WebSocket (to all non-drawers) |
| game.timer | WebSocket (ROUND_STARTED with roundEndTime) |
| game.scores | WebSocket (SCORE_UPDATED) |
| game.guessRanking | WebSocket (GUESS_CORRECT) |
| connection.status | WebSocket disconnect/connect events + reconnect logic |
| ui.chatExpanded | Local component state |
| ui.selectedColor | Local drawer component state |
| session.nickname | Local storage + WebSocket identity |
| session.reconnectInfo | Local storage |

Without this map, Zustand store design will produce inconsistent implementations across agents.

### Finding — MEDIUM:

**Zustand middleware for persistence** — The ADR mentions "session persistence" as UNDER_REVIEW. For guest-first V1, the only state that needs persistence is `nickname` and `reconnectInfo`. Using `zustand/middleware` with `persist` for these two fields is appropriate. No need for full AsyncStorage persistence of game state (that belongs on the server via WebSocket reconnection).

### Finding — LOW:

**Secret word in Zustand store** — Section 19 correctly states the secret word must only go to the drawer. The ADR should explicitly state: "The `game` Zustand store MUST include a `secretWord` field, but the `useGameStore` hook used by guesser components MUST NOT read it. Access is enforced through store compartmentalization, not runtime checking."

This is a security-through-architecture decision, not just a policy statement.

---

## 6. REST Architecture

**ADR Section 13 — REST for request/response.**

### Review:

**APPROVED**

REST surface area is small and well-defined:
- Room creation
- Room lookup/join
- Room configuration
- Settings

No REST needed for game state. This is correct.

### Finding — INFO:

**Fetch vs Axios** — The PRD lists both as options. For this project:
- Fetch is built into JavaScript, zero bundle impact, sufficient for the small REST surface
- Axios adds ~10KB bundle, provides interceptors and auto-transform
- Given the simple REST surface (4-5 endpoints), Fetch is adequate and avoids an unnecessary dependency

**Recommendation:** Use `fetch` with a thin wrapper for base URL and error normalization. Do not add Axios.

---

## 7. Realtime Architecture — WebSocket vs Socket.IO

This is the most consequential undecided choice in the ADR.

### Raw WebSocket Analysis:

| Factor | Assessment |
|--------|-----------|
| Expo compatibility | ✅ Works in development builds and production |
| Reconnection | ❌ Must implement manually (exponential backoff, heartbeat, state recovery) |
| Rooms | ❌ Must implement manually (server-side room management, client-side subscribe/unsubscribe) |
| Event semantics | ❌ Custom protocol required (event name, payload, correlation ID) |
| Acknowledgements | ❌ Not built in; must implement request-response layer manually |
| Transport | WSS only (no fallback to HTTP polling) |
| Server complexity | Higher — all room/state/reconnect logic custom-built |
| Scaling | Potentially better (lighter protocol, no Socket.IO overhead) |
| Testing | Harder — no built-in debug tools, custom fixture generation needed |
| Debugging | Poor — raw frames, no event timeline, no room inspection |
| 8-player rooms | ✅ Capable, but reliability depends entirely on custom reconnection logic |

### Socket.IO Analysis:

| Factor | Assessment |
|--------|-----------|
| Expo compatibility | ✅ Well-supported; `socket.io-client` works in React Native |
| Reconnection | ✅ Built-in with exponential backoff, jitter, attempt limits |
| Rooms | ✅ Built-in (`socket.join(roomId)`, `io.to(roomId).emit(...)`) |
| Event semantics | ✅ Named events with typed payloads |
| Acknowledgements | ✅ `socket.emit('event', data, callback)` pattern |
| Transport | ✅ WSS primary, HTTP polling fallback for restrictive networks |
| Server complexity | Lower — rooms, namespaces, reconnection state all managed |
| Scaling | Acceptable — slightly higher per-connection overhead (~1-2KB extra handshake) |
| Testing | ✅ `socket.io-client` has debug mode (`DEBUG=socket.io*`); mock adapters available |
| Debugging | ✅ Chrome DevTools Network tab shows frames; debug namespace emits visible logs |
| 8-player rooms | ✅ Proven at scale; socket.io handles 500+ concurrent connections per namespace |

### Recommendation: **SOCKET.IO**

Evidence:
1. **Reconnection is a hard requirement** (FR-010, NFR-004). Socket.IO's built-in reconnection is battle-tested. Rolling a reliable custom reconnection with state recovery for an 8-player game is a significant engineering risk.
2. **Rooms are central to the product** — every game is a private room. Socket.IO rooms are a natural fit.
3. **Guess acknowledgements** — the server needs to acknowledge correct guesses to prevent duplicate submissions. Socket.IO ACKs handle this elegantly.
4. **Debugging** — multiplayer games are extremely difficult to debug without event visibility. Socket.IO's debug mode is valuable.
5. **Bundle cost is negligible** — `socket.io-client` is ~40KB minified/gzipped vs ~20KB for raw WebSocket. For a game app, this is irrelevant.

**Rejected alternatives:**
- Raw WebSocket: Only justified if extreme scaling (10K+ concurrent per server) or minimal bundle is required. Neither applies to V1.
- Server-Sent Events (SSE): One-way only; cannot send guesses. Inappropriate.
- GraphQL subscriptions: Overkill for this event volume; adds unnecessary complexity.

**Condition:** The ADR should lock Socket.IO as the realtime choice, not leave it as UNDER_REVIEW. The evidence strongly favors it.

---

## 8. Drawing Architecture — LIBRARY EVALUATION

This is the highest-priority unresolved decision. Per PRD: "The drawing library must be evaluated before locking."

### Candidates Evaluated:

#### Option 1: @shopify/react-native-skia

| Factor | Assessment |
|--------|-----------|
| Expo compatibility | ✅ Development build; not Expo Go. Requires `expo prebuild` or custom config. |
| Android | ✅ Full support |
| iOS | ✅ Full support (cloud build viable) |
| Expo Go | ❌ Requires custom dev client (acceptable for production) |
| Performance | ✅ GPU-accelerated; handles 60fps canvas comfortably |
| Touch handling | ✅ Built-in gesture system; can capture raw touch coordinates |
| Stroke rendering | ✅ Path-based; `Path` + `Paint` objects map directly to DRAW_START/DRAW_MOVE/DRAW_END |
| Remote rendering | ✅ Remote strokes rendered as Skia paths on the same canvas |
| Memory | ✅ Efficient; path data is lightweight vs bitmap |
| Maintenance | ✅ Actively maintained by Shopify; large user base |
| TypeScript | ✅ First-class TS support |
| Implementation complexity | MEDIUM — Steeper learning curve than SVG, but well-documented |
| DRAW_* event suitability | ✅ Excellent — Path commands (moveTo, lineTo, bezierCurveTo) map 1:1 to drawing operations |

**Verdict:** STRONG CANDIDATE

#### Option 2: react-native-svg

| Factor | Assessment |
|--------|-----------|
| Expo compatibility | ✅ Managed workflow compatible |
| Android | ✅ Full support |
| iOS | ✅ Full support |
| Expo Go | ✅ Works in Expo Go |
| Performance | ⚠️ Moderate — SVG path reconstruction on every frame is CPU-bound |
| Touch handling | ⚠️ Indirect — requires pan responder + path building |
| Stroke rendering | ⚠️ Possible but jerky at high touch frequency |
| Remote rendering | ⚠️ Works but DOM-like updates are slower than Skia |
| Memory | ⚠️ SVG string/path reconstruction on each move event |
| Maintenance | ✅ Actively maintained |
| TypeScript | ✅ Good |
| Implementation complexity | LOW — Simpler API, but performance limits |
| DRAW_* event suitability | ⚠️ Functional but not smooth for fast drawing |

**Verdict:** WORKABLE but performance risk for smooth freehand drawing with 8 players rendering simultaneously

#### Option 3: react-native-canvas (HTML5-style canvas)

| Factor | Assessment |
|--------|-----------|
| Expo compatibility | ⚠️ Limited; requires WebView or native bridge |
| Android | ✅ Works |
| iOS | ⚠️ WebKit limitations |
| Expo Go | ❌ Usually requires custom build |
| Performance | ⚠️ WebView-based; context switching overhead |
| Touch handling | ✅ Good via postMessage |
| Stroke rendering | ✅ Canvas API familiar |
| Remote rendering | ⚠️ Cross-platform inconsistency risk |
| Memory | ⚠️ WebView memory footprint |
| Maintenance | ⚠️ Slower release cadence |
| TypeScript | ⚠️ Weaker typing |
| Implementation complexity | MEDIUM |
| DRAW_* event suitability | ✅ 2D canvas context maps naturally |

**Verdict:** VIABLE but WebView overhead is unnecessary when native canvas options exist

#### Option 4: expo-gl + Canvas (GL-based)

| Factor | Assessment |
|--------|-----------|
| Expo compatibility | ⚠️ Requires GL setup; more complex |
| Android | ✅ Works |
| iOS | ✅ Works |
| Expo Go | ⚠️ Limited GL support in some versions |
| Performance | ✅ Excellent (GPU) |
| Touch handling | ⚠️ More complex setup |
| Stroke rendering | ⚠️ Shader-based; steeper learning curve |
| Remote rendering | ✅ Good |
| Memory | ✅ Efficient |
| Maintenance | ⚠️ Smaller community than Skia |
| TypeScript | ⚠️ Weaker typing |
| Implementation complexity | HIGH |
| DRAW_* event suitability | ⚠️ Over-engineered for this use case |

**Verdict:** OVERKILL — same GPU performance as Skia with more complexity

### RECOMMENDATION: **@shopify/react-native-skia**

Rationale:
1. Best performance for smooth 60fps drawing with 8 simultaneous viewers
2. Path-based architecture maps cleanly to DRAW_START/DRAW_MOVE/DRAW_END
3. Active maintenance, strong TypeScript support
4. Bundle cost is acceptable for a game app
5. Works with Expo development builds

**Required condition before selection:**
- Confirm target Expo SDK version compatibility with `@shopify/react-native-skia`
- Test touch coordinate mapping accuracy on target devices
- Verify remote stroke rendering latency is acceptable (<200ms per NFR-001)

**Decision status:** UNDER_REVIEW — needs SDK compatibility confirmation before locking.

---

## 9. Reconnection Architecture

**ADR Section 20 — Lifecycle defined but protocol not finalized.**

### Review:

**APPROVE WITH CONDITIONS**

The lifecycle (CONNECTED → DISCONNECTED → RECONNECTING → RECONNECTED → STATE RESTORATION → CONNECTED) is correct.

### Finding — HIGH:

**State restoration after reconnection is underspecified.** When a player reconnects:
1. What state does the client need to reconstruct?
2. Does the server maintain a snapshot of the current round?
3. Can a reconnecting player see the current drawing?
4. What happens if the round ends during reconnection?

**Recommendation:** The client should:
- On reconnect, request full current room state from server (not incremental diffs)
- Server responds with `{ room, game, round, players, scores }` snapshot
- Client replaces store state atomically
- If round was active, resume with current drawing strokes (server maintains stroke history buffer for grace period)
- If round ended during disconnect, show round result screen

This must be specified in Stage 3 (Game State Machine), not deferred indefinitely.

### Finding — MEDIUM:

**Drawer disconnection grace period** — The PRD specifies a configurable grace period. The client must display a clear "Drawer disconnected. Waiting..." state. This is a UI state, not a navigation change. Correctly modeled in the screen-state map.

---

## 10. Session Architecture

**ADR Section 7.3 — Session state category defined.**

### Review:

**APPROVED**

Session state fields are minimal and correct:
- `playerId` — assigned by server on first connection
- `nickname` — local input, persisted for session
- `roomId` — current room context
- `session identity` — token or guest identifier
- `reconnect information` — last known roomId + playerId for reconnection

### Finding — LOW:

Guest-first authentication means no password/token management. The "session identity" is likely a server-assigned UUID. This should be stored in Zustand `persist` middleware with AsyncStorage for reconnection support.

---

## 11. Testing Architecture

**ADR Section 22 — Test requirements listed.**

### Review:

**APPROVE WITH CONDITIONS**

Required test coverage is correct and comprehensive. However:

### Finding — MEDIUM:

**Testing framework is undecided.** Jest is Expo's default. Vitest is faster but requires configuration. For Stage 2, the recommendation is:

- **Use Jest** (Expo default) to minimize configuration overhead
- **Add React Native Testing Library** for component tests
- **Add mock-server for multiplayer tests** — critical for testing 2/4/8 player scenarios
- **Unit tests** for: score calculation, hint generation, word matching, room validation, game-state transitions

### Finding — INFO:

**No testing infrastructure exists yet.** This is expected. The ADR should include a `testing/` directory structure in the project layout:

```
__tests__/
├── unit/
│   ├── scoring.test.ts
│   ├── hints.test.ts
│   ├── wordMatching.test.ts
│   └── roomValidation.test.ts
├── integration/
│   └── roomFlow.test.ts
├── multiplayer/
│   └── eightPlayerRoom.test.ts
└── mocks/
    └── serverMock.ts
```

---

## 12. Dependency Risks

### Drawing library risk:

**CRITICAL RISK** — The drawing library choice affects:
- Expo SDK compatibility (some libraries pin specific RN versions)
- Bundle size
- Performance characteristics
- Android/iOS parity
- Development build requirements

**Mitigation:** Evaluate `@shopify/react-native-skia` against the target Expo SDK version BEFORE committing. Run `npx expo install` to check compatibility.

### Socket.IO risk:

**LOW RISK** — `socket.io-client` is well-established in React Native. Minimal compatibility concerns.

### Zustand risk:

**LOW RISK** — Mature, lightweight, Expo-compatible. No concerns.

### Reanimated risk:

**LOW RISK** — Officially supported by Expo. `npx expo install react-native-reanimated` handles native config automatically.

### React Hook Form risk:

**LOW RISK** — Pure JS, no native dependencies. Safe.

### Zod risk:

**LOW RISK** — Pure JS, no native dependencies. Safe.

### Total dependency count estimate:

| Dependency | Category | Risk |
|---|---|---|
| expo | Framework | None (baked in) |
| react-native | Framework | None (baked in) |
| expo-router | Navigation | None (baked in) |
| zustand | State | Low |
| socket.io-client | Realtime | Low |
| react-hook-form | Forms | Low |
| zod | Validation | Low |
| react-native-reanimated | Animation | Low |
| @shopify/react-native-skia | Drawing | MEDIUM (needs SDK check) |
| @react-navigation/native | (via Expo Router) | None (baked in) |

**Total new dependencies:** ~6-9 (excluding Expo baked-in packages)
**Risk assessment:** Low overall, one medium-risk item (drawing library)

---

## 13. Security Risks

### Finding — HIGH:

**Secret word exposure path via Zustand store.** If the `game` store is a single global store, any component with access to `useGameStore()` can read `secretWord`. Even if the drawer-only rule is documented, there is no technical enforcement.

**Mitigation:** Split the game store into compartmentalized slices or use a getter pattern:

```typescript
// WRONG — anyone can read secretWord
const secretWord = useGameStore(state => state.secretWord)

// CORRECT — only drawer store exposes secretWord
const drawerWord = useDrawerStore(state => state.secretWord)
const maskedWord = useGuesserStore(state => state.maskedWord)
```

Or enforce at the hook level:

```typescript
const useGameStore = create<GameState>((set, get) => ({
  // ...
  getSecretWord: () => {
    if (get().playerRole !== 'drawer') throw new Error('Unauthorized access to secret word')
    return get().secretWord
  }
}))
```

### Finding — MEDIUM:

**Client-side guess validation.** The ADR correctly states the server validates guesses. But the client must also validate locally to provide immediate feedback (e.g., length check, profanity filter preview). These local validations must NOT override server decisions.

### Finding — LOW:

**No authentication tokens to protect.** Guest-first V1 means no JWT, no API keys in the client. The only sensitive data is the secret word (see HIGH finding above).

---

## 14. Performance Risks

### Finding — MEDIUM:

**8-player simultaneous drawing rendering.** When 8 players are in a room and the drawer is drawing, all 7 guessers must render the same stroke stream. Each guesser's device processes DRAW_MOVE events and renders paths. With Skia, this is GPU-accelerated and should be fine. With SVG-based approaches, this becomes a rendering bottleneck.

**Mitigation:** The drawing library choice (Skia recommended) directly addresses this. SVG-based approaches should be rejected for this reason.

### Finding — INFO:

**Animation interference with drawing.** Reanimated runs on the UI thread by default in older RN versions, but with the New Architecture (Fabric) it can run on the worker thread. Expo SDK 54+ with the New Architecture enabled should handle this. The ADR should note: "Ensure Reanimated animations do not block the drawing touch handler by using `runOnJS` appropriately."

---

## 15. Scope Risks

### Finding — INFO:

**V1 scope is well-contained.** The ADR Section 25 correctly lists explicitly out-of-scope items. No scope creep detected in any prior agent output.

### Finding — LOW:

**"Play Again" flow** — The IA document describes Play Again as returning to "another playable session using the existing room context." This implies the server maintains game history across rounds within a room. The client architecture must support transitioning between `/round-result` and `/game` without leaving the room. This is correctly modeled as a state transition, not a navigation change.

---

## 16. Required Changes

### CRITICAL — Must fix before lock:

| # | Issue | Required Action |
|---|-------|-----------------|
| C1 | State Writer Map missing | Add explicit table mapping each state field to its authoritative source (WebSocket/REST/Local) |
| C2 | Secret word store exposure | Specify store compartmentalization strategy (split stores or guarded getters) |
| C3 | Git not initialized | Must be done before ANY implementation — prerequisite, not architectural |

### HIGH — Should fix before lock:

| # | Issue | Required Action |
|---|-------|-----------------|
| H1 | WebSocket vs Socket.IO undecided | Lock Socket.IO based on reconnection, rooms, ACK, and debugging requirements |
| H2 | Drawing library undecided | Lock @shopify/react-native-skia pending Expo SDK compatibility verification |
| H3 | Reconnection state restoration underspecified | Define client snapshot request protocol in Stage 3 scope |
| H4 | ADR Section 6 formatting broken | Fix truncated code fence in navigation section |

### MEDIUM — Recommended:

| # | Issue | Required Action |
|---|-------|-----------------|
| M1 | Testing framework undecided | Recommend Jest + RTL; document in ADR |
| M2 | React Query not discussed | Document why it's NOT needed (small REST surface, WebSocket for game state) |
| M3 | Shared type package not discussed | Recommend `packages/shared-types/` for client-server type sharing |

### LOW — Nice to have:

| # | Issue | Required Action |
|---|-------|-----------------|
| L1 | Fetch vs Axios | Recommend Fetch; document reasoning |
| L2 | Session persistence strategy | Recommend zustand/persist with AsyncStorage for nickname + reconnectInfo only |
| L3 | Project folder structure | Add concrete `src/` or `app/` layout to ADR |

---

## 17. Architecture Recommendation Summary

| Decision Area | Status | Recommendation |
|---|---|---|
| React Native | APPROVED | Use Expo managed workflow |
| Expo | APPROVED | Target SDK 54+ for Node 22 compatibility |
| TypeScript | APPROVED | Strict mode; no `any` except documented exceptions |
| Expo Router | APPROVED | 9 routes per IA document |
| Zustand | APPROVED WITH CONDITIONS | 5-domain store split; add State Writer Map |
| REST | APPROVED | Use Fetch; minimal endpoint surface |
| WebSocket vs Socket.IO | UNDER_REVIEW → **RECOMMEND SOCKET.IO** | Reconnection, rooms, ACKs justify the bundle cost |
| React Hook Form | APPROVED | For nickname, create-room, join-room forms |
| Zod | APPROVED | All boundary validation |
| Reanimated | APPROVED | UI animations only; isolate from drawing thread |
| Drawing library | UNDER_REVIEW → **RECOMMEND SKIA** | @shopify/react-native-skia pending SDK check |
| Reconnect strategy | APPROVE WITH CONDITIONS | Snapshot-based restoration; specify in Stage 3 |
| Session persistence | APPROVE WITH CONDITIONS | zustand/persist for nickname + reconnectInfo only |
| Shared types | UNDER_REVIEW → **RECOMMEND SHARED PACKAGE** | `packages/shared-types/` for WebSocket event contracts |
| API client | APPROVED | Thin Fetch wrapper with error normalization |
| Testing | APPROVE WITH CONDITIONS | Jest + RTL; mock server for multiplayer tests |
| Project structure | APPROVED WITH CONDITIONS | Add concrete layout to ADR |
| Design tokens | APPROVED | Centralized token file; component consumption |

---

## 18. Final Verdict

**NEEDS_MORE_RESEARCH**

Reasoning:

1. **Two critical technical decisions remain unresolved** — Socket.IO vs raw WebSocket, and drawing library selection. Both have strong evidence pointing to specific choices, but the drawing library requires Expo SDK compatibility verification that cannot be done without scaffolding the project.

2. **State architecture needs the State Writer Map** — Without it, implementers will create competing sources of truth, violating the core architecture principle.

3. **No empirical validation exists** — The empty foundation means zero testing of any proposal. The architecture is theoretically sound but unproven.

4. **Prior agent outputs are prompts, not results** — The Claude research and Codex review files contain task descriptions, not completed work. This review stands as the first substantive independent critique of the architecture.

**The architecture is directionally correct and internally consistent with the PRD.** The main gaps are specificity (State Writer Map) and two unresolved technical evaluations (realtime transport, drawing library). These are fixable before implementation begins.

**Recommended path forward:**
1. Update ADR with State Writer Map and Socket.IO decision
2. Scaffold Expo project (`npx create-expo-app`)
3. Verify `@shopify/react-native-skia` compatibility with chosen Expo SDK
4. Lock remaining decisions
5. Proceed to Stage 3 (Game State Machine)

---

## Appendix: ADR Section-by-Section Audit

| ADR Section | Verdict | Notes |
|---|---|---|
| §1 Purpose | ✅ | Clear |
| §2 Source Hierarchy | ✅ | Correct priority order |
| §3 Stage Objective | ✅ | Appropriate scope |
| §4 Non-Negotiable Principles | ✅ | Server authority correctly emphasized |
| §5 Confirmed Technology Baseline | ✅ | Matches PRD recommendations |
| §6 Navigation Decision | ⚠️ | Formatting broken; routes correct |
| §7 State Architecture | ✅ | Three categories correct |
| §8 State Ownership Rule | ⚠️ | Principle correct, missing State Writer Map |
| §9 Zustand Decision | ⚠️ | Domain-based split correct; needs specific boundaries |
| §10 Realtime Decision | ⚠️ | Should lock Socket.IO based on evidence |
| §11 Drawing Decision | ⚠️ | Should recommend Skia pending SDK check |
| §12 Drawing Event Model | ✅ | DRAW_START/DRAW_MOVE/DRAW_END correct |
| §13 REST Decision | ✅ | Adequate |
| §14 Validation Decision | ✅ | Zod at boundaries correct |
| §15 Forms Decision | ✅ | RHF + Zod correct |
| §16 Animation Decision | ✅ | Reanimated correct; isolation from drawing noted |
| §17 Design Token Decision | ✅ | Centralized tokens correct |
| §18 Component Architecture | ✅ | Reusable components with variants correct |
| §19 Security Boundary | ⚠️ | Secret word rule stated but no technical enforcement mechanism |
| §20 Reconnection Architecture | ⚠️ | Lifecycle correct; state restoration underspecified |
| §21 Error Architecture | ✅ | Five error categories appropriate |
| §22 Testing Architecture | ✅ | Coverage targets correct |
| §23 Dependency Decision | ✅ | Justification requirement is good practice |
| §24 Decision Status | ⚠️ | Some items should be moved from UNDER_REVIEW to APPROVED based on this review |
| §25 V1 Scope Boundary | ✅ | Comprehensive exclusion list |
| §26 Architecture Change Protocol | ✅ | Well-defined |
| §27 Broken Prompt Protocol | ✅ | Mandatory protocol documented |
