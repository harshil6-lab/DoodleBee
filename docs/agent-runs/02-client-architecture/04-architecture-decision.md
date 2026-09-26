# DoodleBee Stage 02 Architecture Decision

**Stage:** 02 — Client Architecture
**Document:** Architecture Decision Record
**Version:** 2.0 (Final — Architecture Lead Reconciliation)
**Status:** LOCKED
**Project:** DoodleBee
**Date:** September 2026

---

## 1. Architecture Status

**LOCKED** — All implementable decisions resolved. Two items deferred to Stage 3 with explicit rationale.

---

## 2. Environment Constraints

| Constraint | Detail |
|---|---|
| Repository | Empty foundation — no git, no package.json, no source code |
| OS | Windows — iOS native builds impossible locally |
| Node | v22.23.2 / npm 10.9.8 |
| Android SDK | APIs 31–36, build-tools 36.x, adb 36.0.2, Java 24.0.1 |
| iOS tooling | None available — EAS cloud builds required |
| EAS CLI | 23.1.0 (cloud build capability confirmed) |
| Expo CLI | Not global — `npx expo` usable; will install after scaffold |
| Git | Not initialized — prerequisite before any implementation |
| Figma MCP | Not configured — local ZIP (~134 MB) is reference asset |
| Prior agent outputs | `01-claude-research.md` = prompt only (no research written); `02-codex-review.md` = prompt only (no review written) — this ADR supersedes all prior proposals |

---

## 3. Architecture Principles

### 3.1 Server Authority (Non-Negotiable)

The client MUST NOT become the authority for: secret word, drawer selection, round state, round completion, timer completion, guess correctness, guess ranking, score, game completion.

Client: requests, renders, interacts.
Server: decides, validates, calculates, broadcasts.

### 3.2 Single Source of Truth

Every state field has exactly one authoritative writer. No field may be written by both REST and WebSocket simultaneously.

### 3.3 No Silent Architecture Changes

Agents MUST NOT silently replace Zustand, Expo Router, or introduce alternative state managers, networking architectures, or microservices.

### 3.4 Figma Is Visual Source of Truth

Figma determines visual hierarchy, colors, typography, component appearance. Figma does NOT dictate backend behavior.

### 3.5 Server-Decides, Client-Renders

This principle governs every architectural choice below.

---

## 4. Client Stack

| Decision | Status | Rationale |
|---|---|---|
| React Native | **APPROVED** | PRD-mandated; Expo wraps it |
| Expo | **APPROVED** | Target SDK 54+ for Node 22 compatibility; managed workflow with dev client |
| TypeScript | **APPROVED** | Strict mode; `noImplicitAny: true`; domain types via discriminated unions |
| Expo Router | **APPROVED** | 9 production routes per approved IA document |
| Zustand | **APPROVED WITH CONDITIONS** | 5-domain store split (session, room, game, connection, ui); State Writer Map mandatory (Section 7) |
| Zod | **APPROVED** | All boundary validation — API input, WebSocket payloads, room codes, nicknames |
| React Hook Form | **APPROVED** | Complex forms only (nickname, create-room, join-room); simple controls use direct state |
| React Native Reanimated | **APPROVED WITH CONDITIONS** | UI animations only; must not interfere with drawing touch handler (use `runOnJS` appropriately) |
| socket.io-client | **APPROVED** | See Section 11 |
| @shopify/react-native-skia | **UNDER_REVIEW — SDK COMPATIBILITY CHECK REQUIRED** | See Section 14 |
| fetch (native) | **APPROVED** | Thin wrapper with base URL and error normalization; Axios rejected — unnecessary bundle cost for 4-5 endpoints |

---

## 5. Navigation

Production routes (from approved IA — NOT modified):

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

Expo Router file mapping:

```
app/
├── (index).tsx           → /
├── nickname.tsx          → /nickname
├── create-room.tsx       → /create-room
├── join-room.tsx         → /join-room
├── lobby/
│   └── [roomId].tsx      → /lobby/[roomId]
├── game/
│   └── [roomId].tsx      → /game/[roomId]
├── round-result/
│   └── [roomId].tsx      → /round-result/[roomId]
├── final-result/
│   └── [roomId].tsx      → /final-result/[roomId]
└── settings.tsx          → /settings
```

**FORBIDDEN:** No additional routes beyond these 9. No Figma prototype bottom navigation. No design-system reference screen as an app route.

---

## 6. State Architecture

Three categories, strictly separated:

### 6.1 Server/Game State (Zustand — WebSocket-authoritative)

`room`, `players`, `host`, `game`, `round`, `drawer`, `maskedWord`, `score`, `timer`, `connection`

Written exclusively by WebSocket events. Never by REST responses or local user interaction.

### 6.2 Local UI State (Zustand — component-local or store-scoped)

`chatExpanded`, `selectedColor`, `brushSize`, `modal`, `bottomSheet`, `toast`, `animationState`

Never persisted across navigations unless explicitly designed (e.g., `selectedColor` during a round).

### 6.3 Session State (Zustand + persist middleware → AsyncStorage)

`playerId`, `nickname`, `roomId`, `reconnectInfo`

Persisted for reconnection support. Cleared on app close or explicit logout.

---

## 7. STATE WRITER MAP

**This is the single most important addition to the architecture.** Every state field below has exactly ONE authoritative writer.

| State Field | Category | Authoritative Writer | Transport | Reader Scope | Persistence | Reconciliation Rule |
|---|---|---|---|---|---|---|
| `playerId` | Session | Server (on connect) | REST response `POST /session` | All stores | AsyncStorage (persist) | Last REST response wins |
| `nickname` | Session | Client (user input) | localStorage + REST `PUT /session/nickname` | All stores | AsyncStorage (persist) | Client owns; syncs to server on join |
| `roomId` | Session | Server (on create/join) | REST response `POST /rooms` or `POST /rooms/join` | All stores | AsyncStorage (persist) | Must match connected WebSocket room |
| `reconnectInfo` | Session | Client | — | Connection store | AsyncStorage (persist) | `{ playerId, roomId, lastHeartbeat }` |
| `connection.status` | Connection | WebSocket lifecycle | WS disconnect/connect events | All components | None | EXPIRED → DISCONNECTED → RECONNECTING → CONNECTED |
| `connection.lastError` | Connection | WebSocket error handler | WS error events | Connection banner | None | Clear on successful reconnect |
| `room.id` | Room | Server | WebSocket `ROOM_JOINED` | Room store, UI | None | Replaced atomically on join |
| `room.code` | Room | Server | WebSocket `ROOM_JOINED` | Room store | None | Read-only after join |
| `room.config` | Room | Server (initial) + Host (updates) | WebSocket `ROOM_CONFIG_UPDATED` | Room store | None | Host events take precedence |
| `room.players` | Room | Server | WebSocket `PLAYER_JOINED`, `PLAYER_LEFT` | Room store, PlayerCard | None | Array diff: add/remove by playerId |
| `room.host` | Room | Server | WebSocket `HOST_TRANSFERRED` | Room store | None | Atomic replace |
| `game.phase` | Game | Server | WebSocket `GAME_STARTED`, `ROUND_STARTED`, `ROUND_ENDED`, `GAME_FINISHED` | Game store | None | Server transition only; never client-invented |
| `game.drawer` | Game | Server | WebSocket `DRAWER_SELECTED` | Game store, SecretWordCard | None | Server transition only |
| `game.secretWord` | Game | Server | WebSocket `DRAWER_SELECTED` (drawer-only payload) | Drawer store ONLY | None | **Never enters public game state.** See Section 9. |
| `game.maskedWord` | Game | Server | WebSocket `DRAWER_SELECTED` (non-drawer payload) | Guesser store ONLY | None | Server-controlled hint reveals |
| `game.timer.roundEndTime` | Game | Server | WebSocket `ROUND_STARTED` | Timer component | None | Client derives `remaining = roundEndTime - now`; server owns completion |
| `game.scores` | Game | Server | WebSocket `SCORE_UPDATED` | ScoreBadge, Leaderboard | None | Atomic replace per player |
| `game.guessRanking` | Game | Server | WebSocket `GUESS_CORRECT` | RoundResult screen | None | Append-only; server assigns order |
| `game.hintsRemaining` | Game | Server | WebSocket `HINT_REVEALED` | HintButton | None | Decrement on each reveal |
| `game.chats` | Chat | Server | WebSocket `CHAT_MESSAGE`, `CORRECT_GUESS_MESSAGE`, `SYSTEM_MESSAGE` | ChatPanel | None | Append; truncate to last 100 messages locally |
| `ui.chatExpanded` | UI | Component | Local state | ChatPreview, ChatPanel | None | Toggle; resets on round end |
| `ui.selectedColor` | UI | Component | Local drawer state | DrawingToolbar | None | Preserved across round transitions within same game |
| `ui.brushSize` | UI | Component | Local drawer state | DrawingToolbar | None | Preserved across round transitions |
| `ui.modal` | UI | Component | Local state | Modal overlay | None | Stack-based; auto-close on round end |
| `ui.toast` | UI | Component | Local state | Toast container | None | Auto-dismiss after 3s |
| `ui.connectionBanner` | UI | Connection store | Derived from `connection.status` | App-level overlay | None | Reactive to connection store |
| `ui.drawings[strokeId]` | Game | Local (drawer) + Server (remote) | Drawer: local touch → WebSocket `DRAW_MOVE`; Others: WebSocket `DRAW_START`/`DRAW_MOVE`/`DRAW_END` | DrawingCanvas | None (V1) | Merge by strokeId; clear on round end |

**Rules:**
1. No field appears in two writer columns.
2. WebSocket events are the sole writer for all game-phase fields (`game.*`).
3. REST responses write only session and room-metadata fields.
4. Local component state writes only `ui.*` fields.
5. The `secretWord` field exists in the Zustand store but is accessible ONLY through a drawer-scoped hook (`useDrawerGameStore`). Guesser components import `useGuesserGameStore` which has no `secretWord` selector.

---

## 8. Server vs Client Authority

| Concern | Owner | Reason |
|---|---|---|
| drawer selection | Server | Anti-cheat; player cannot self-select |
| secret word | Server | Anti-cheat; must never reach guessers |
| masked word | Server | Server generates partial reveal |
| round state transitions | Server | Must be deterministic and consistent across all clients |
| timer (roundEndTime) | Server | Client clock drift; server is authoritative |
| guess correctness | Server | Cannot trust client judgment |
| guess ranking | Server | Order matters for scoring |
| score calculation | Server | Math must be consistent |
| game completion | Server | Must coordinate all players |
| room capacity | Server | Prevents race-condition overfill |
| host transfer | Server | Must be fair and deterministic |
| hint reveals | Server | Controls pacing |
| chat messages | Server (moderation) | Profanity filter, rate limit, mute |
| drawing strokes | Server (distribution) | Relays to all peers; does not validate geometry |
| nickname | Client (input) + Server (registration) | Client edits; server persists to room |
| secret word display | Client (rendering) | Server sends, client shows |
| canvas rendering | Client (local) | Touch → Skia path; server only distributes operations |
| UI state (expanded/collapsed) | Client | Per-player choice, no server coordination needed |

---

## 9. Secret Word Security Model

**Problem:** A single Zustand store with a `secretWord` field allows any component to read it. Documentation alone is insufficient — TypeScript must enforce the boundary.

**Solution: Compartmentalized stores with role-gated accessors.**

### 9.1 Store Split

```typescript
// stores/session.store.ts — shared by all players
interface SessionState {
  playerId: string
  nickname: string
  roomId: string | null
  reconnectInfo: ReconnectInfo | null
}

// stores/connection.store.ts — shared by all players
interface ConnectionState {
  status: 'connected' | 'disconnected' | 'reconnecting' | 'reconnected'
  lastError: string | null
}

// stores/room.store.ts — shared by all players IN THE ROOM
interface RoomState {
  room: Room | null
  players: Player[]
  host: string // playerId
  config: RoomConfig
}

// stores/game.store.ts — SHARED BUT SECRET-WORD ACCESS IS ROLE-GATED
interface GameBaseState {
  phase: GamePhase
  drawer: string | null       // playerId
  maskedWord: string
  scores: Record<string, number>
  hintsRemaining: number
  timer: { roundEndTime: number | null }
  // secretWord is NEVER stored here — see drawer-specific store below
}

// stores/drawer.store.ts — ONLY imported by drawer-facing components
interface DrawerState extends GameBaseState {
  secretWord: string          // Drawer-only field
  strokes: Stroke[]
  selectedColor: Color
  brushSize: number
}

// stores/guesser.store.ts — ONLY imported by guesser-facing components
interface GuesserState extends GameBaseState {
  // NO secretWord field
  // Has maskedWord instead
  maskedWord: string
  hasGuessed: Set<string>     // Track who already guessed correctly
}
```

### 9.2 TypeScript Enforcement

```typescript
// This compiles — drawer hook has access to secretWord
const { secretWord } = useDrawerGameStore(state => state.secretWord)

// This does NOT compile — guesser store has no secretWord field
// const { secretWord } = useGuesserGameStore(state => state.secretWord)
// TS Error: Property 'secretWord' does not exist on type 'GuesserState'
```

### 9.3 Server-Side Payload Separation

```typescript
// Server sends DIFFERENT payloads based on player role
// DRAWER receives:
{ type: 'DRAWER_SELECTED', playerId: 'abc', secretWord: 'elephant', maskedWord: '_ _ _ _ _ _ _ _' }

// GUESSER receives:
{ type: 'DRAWER_SELECTED', playerId: 'xyz', maskedWord: '_ _ _ _ _ _ _ _' }
// Note: NO secretWord field in guesser payload

// PUBLIC room state (broadcast to ALL):
{ type: 'ROOM_STATE', room, players, host, gamePhase, scores, timer }
// Note: NO secretWord field
```

### 9.4 Logging and Analytics Restrictions

```typescript
// Logger utility — automatically strips sensitive fields
const safeLog = createLogger({
  excludeFields: ['secretWord', 'password', 'token'],
  maskFields: ['nickname']  // Only show first 2 chars
})

// Analytics events MUST NOT include secretWord
// Allowed: { event: 'ROUND_STARTED', phase, drawerPlayerId, maskedWord }
// Forbidden: { event: 'ROUND_STARTED', secretWord }
```

### 9.5 Test Cases (Required)

```typescript
test('secretWord not present in public room state', () => {
  const publicState = extractPublicRoomState(serverSnapshot)
  expect(publicState).not.toHaveProperty('secretWord')
})

test('guesser store has no secretWord accessor', () => {
  expect(typeof useGuesserGameStore.getState().secretWord).toBe('undefined')
})

test('drawer store receives secretWord on DRAWER_SELECTED', () => {
  const drawerState = processEvent(DRAWER_SELECTED, { playerId: 'me', secretWord: 'test' })
  expect(drawerState.secretWord).toBe('test')
})

test('logger excludes secretWord from output', () => {
  const output = safeLog({ phase: 'active', secretWord: 'elephant' })
  expect(output).not.toContain('elephant')
})
```

---

## 10. REST Boundary

REST handles request/response operations only. Surface area:

| Endpoint | Method | Purpose |
|---|---|---|
| `/session` | POST | Create guest session, return playerId |
| `/session/nickname` | PUT | Set nickname |
| `/rooms` | POST | Create room, return roomId + roomCode |
| `/rooms/join` | POST | Join room by code, return room state |
| `/rooms/:id/config` | PUT | Update room config (host only) |
| `/settings` | GET | Fetch client settings defaults |

**Implementation:** Native `fetch` with thin wrapper. Base URL from environment config. Error normalization returns user-friendly messages per Section 21.

**Excluded from REST:** All game-state synchronization, all realtime events, all drawing operations, all guessing.

---

## 11. Realtime Transport Decision

### Decision: **Socket.IO** (`socket.io-client`)

### Evidence:

| Factor | Socket.IO | Raw WebSocket | Winner |
|---|---|---|---|
| Expo compatibility | ✅ Well-supported in RN | ✅ Works but manual | Tie |
| Reconnection | ✅ Built-in exponential backoff, jitter, re-attempt limits | ❌ Must build manually: heartbeat, backoff, state recovery | **Socket.IO** |
| Rooms | ✅ Native `socket.join(roomId)` | ❌ Custom room management | **Socket.IO** |
| Acknowledgements | ✅ `emit(event, data, callback)` pattern | ❌ Manual correlation IDs | **Socket.IO** |
| Event semantics | ✅ Named events with typed payloads | ❌ Custom protocol | **Socket.IO** |
| Debugging | ✅ `DEBUG=socket.io*` namespace; Chrome DevTools Network tab | ❌ Raw binary frames | **Socket.IO** |
| Testing | ✅ Mock adapter available; debug logs | ❌ Custom fixture generation | **Socket.IO** |
| Background/reopen | ✅ Handles mobile network switches | ⚠️ Must handle manually | **Socket.IO** |
| Bundle cost | ~40KB gzipped | ~15KB gzipped | WebSocket (marginally) |
| Server complexity | Lower (built-in rooms, ACKs) | Higher (custom everything) | **Socket.IO** |
| 8-player performance | ✅ Proven at scale | ✅ Capable with good engineering | Tie |
| Future scaling | ✅ Namespace support | ⚠️ Manual sharding | **Socket.IO** |
| Redis pub/sub integration | ✅ `socket.io-redis` adapter exists | ❌ Manual bridge | **Socket.IO** |

### Tradeoffs Accepted:

- +25KB bundle size for Socket.IO vs raw WebSocket — negligible for a game app
- Slightly higher per-connection overhead (~1-2KB handshake) — acceptable at V1 scale (max 8 players/room)
- Learning curve for Socket.IO concepts (rooms, namespaces, ACKs) — documented in onboarding

### Events (Client-Side Contract):

```typescript
// Emitted BY client TO server
enum ClientToServerEvents {
  JOIN_ROOM = 'join:room',
  LEAVE_ROOM = 'leave:room',
  SUBMIT_GUESS = 'guess:submit',
  SEND_CHAT = 'chat:message',
  USE_HINT = 'hint:request',
  START_GAME = 'game:start',        // host only
  DRAW_START = 'draw:start',
  DRAW_MOVE = 'draw:move',
  DRAW_END = 'draw:end',
  CLEAR_CANVAS = 'canvas:clear',
}

// Emitted BY server TO client
enum ServerToClientEvents {
  ROOM_JOINED = 'room:joined',
  PLAYER_JOINED = 'player:joined',
  PLAYER_LEFT = 'player:left',
  HOST_TRANSFERRED = 'host:transferred',
  GAME_STARTED = 'game:started',
  ROUND_STARTED = 'round:started',
  DRAWER_SELECTED = 'drawer:selected',
  DRAW_START = 'draw:start',
  DRAW_MOVE = 'draw:move',
  DRAW_END = 'draw:end',
  GUESS_SUBMITTED = 'guess:submitted',
  GUESS_CORRECT = 'guess:correct',
  HINT_REVEALED = 'hint:revealed',
  ROUND_ENDED = 'round:ended',
  SCORE_UPDATED = 'score:updated',
  GAME_FINISHED = 'game:finished',
  CONNECTION_LOST = 'connection:lost',
}
```

---

## 12. Realtime Event Boundary

| Event | Direction | Payload Schema | Authorization | Idempotency |
|---|---|---|---|---|
| `join:room` | C→S | `{ roomCode: string, nickname: string }` | Guest session valid | Force new join (idempotent) |
| `leave:room` | C→S | `{}` | Any player | N/A |
| `guess:submit` | C→S | `{ guess: string }` | Must be guesser, word not yet guessed | Duplicate submission → ignore |
| `chat:message` | C→S | `{ text: string }` | Not muted, rate-limited | N/A |
| `hint:request` | C→S | `{}` | Must be drawer, hints remaining | Idempotent (duplicate = no-op) |
| `game:start` | C→S | `{}` | Must be host | Force start (idempotent) |
| `draw:start` | C→S | `{ strokeId: string, color: string, brushSize: number, startX, startY }` | Must be drawer | Ordered by strokeId |
| `draw:move` | C→S | `{ strokeId: string, x, y }` | Must be drawer | Drop stale strokes |
| `draw:end` | C→S | `{ strokeId: string }` | Must be drawer | Ordered |
| `canvas:clear` | C→S | `{}` | Must be drawer | Reset all strokes |

---

## 13. Drawing Architecture

### 13.1 Canvas Model

The DrawingCanvas component renders strokes from the `strokes` array in the Zustand drawer/guesser stores.

- **Drawer:** Renders local strokes (touch input → immediate render) + remote strokes (WebSocket events)
- **Guesser:** Renders only remote strokes (WebSocket events only)

### 13.2 Stroke Representation

```typescript
interface Stroke {
  id: string                    // UUID generated client-side
  points: Point[]               // { x, y } sampled at ~60Hz
  color: string                 // Hex color
  brushSize: number             // 1-20px
  erased: boolean               // For eraser support
}

interface Point {
  x: number    // Normalized 0-1 relative to canvas bounds
  y: number    // Normalized 0-1 relative to canvas bounds
  pressure?: number  // Optional: touch pressure
}
```

### 13.3 DRAW_* Event Payloads

```typescript
// DRAW_START
{ strokeId, color, brushSize, points: [{ x, y }] }

// DRAW_MOVE (batched — up to 10 points per event to reduce traffic)
{ strokeId, points: [{ x, y }, ...] }

// DRAW_END
{ strokeId }  // Signals stroke completion; client renders final segment
```

### 13.4 Performance Boundaries

- Maximum points per stroke: ~300 (capped by server)
- Batched DRAW_MOVE events: ≤10 points per packet
- Stroke history buffer for reconnection: last 30 seconds of strokes
- Canvas clearance resets all strokes for current round; previous rounds discarded (V1)

---

## 14. Drawing Library Decision

### Evaluation Summary

Four candidates evaluated by Codex review: `@shopify/react-native-skia`, `react-native-svg`, `react-native-canvas`, `expo-gl`.

### Decision: **@shopify/react-native-skia** — CONDITIONAL

| Factor | Assessment |
|---|---|
| Expo compatibility | Requires development build (not Expo Go) — acceptable for production |
| Android | ✅ Full native support |
| iOS | ✅ Full native support (EAS cloud build) |
| Performance | ✅ GPU-accelerated; 60fps target achievable |
| Touch handling | ✅ Built-in gesture system; raw touch coordinates accessible |
| Path rendering | ✅ `Path` + `Paint` objects map 1:1 to DRAW_START/DRAW_MOVE/DRAW_END |
| Remote rendering | ✅ Same canvas instance renders both local and remote strokes |
| Memory | ✅ Path data is lightweight vs bitmap |
| TypeScript | ✅ First-class TS support |
| Maintenance | ✅ Actively maintained by Shopify |
| Bundle impact | ~150KB uncompressed — acceptable for game app |

### Condition:

**Before scaffold:** Verify `@shopify/react-native-skia` version compatibility with the target Expo SDK version (54+). Run `npx expo install @shopify/react-native-skia` after project creation to confirm. If incompatible, fall back to `react-native-svg` with performance degradation acknowledgment.

**If Skia is incompatible:** Use `react-native-svg` as fallback. Accept reduced smoothness at high touch frequency. Document tradeoff in ADR.

### Test Requirement:

Before marking this decision LOCKED: render a test stroke on device, measure frame rate at 8 simultaneous viewers, verify <200ms event propagation (NFR-001).

---

## 15. Reconnection Architecture

### Lifecycle

```
CONNECTED
    ↓ (network loss / socket disconnect)
DISCONNECTED
    ↓ (auto-reconnect attempt by Socket.IO)
RECONNECTING
    ↓ (connection restored)
RECONNECTED
    ↓ (client requests state snapshot)
STATE_SYNC_REQUEST  →  AUTHORITATIVE_STATE_SNAPSHOT
    ↓ (client reconciles stores atomically)
RECONCILED
    ↓
CONNECTED
```

### State Restoration Protocol

On `RECONNECTED`, client emits `request:state:snapshot` to server. Server responds with:

```json
{
  "room": { "id", "code", "config", "players" },
  "game": { "phase", "scores", "hintsRemaining" },
  "round": { "drawer": "playerId", "maskedWord", "timer": { "roundEndTime" } },
  "strokes": [ /* last 30s of strokes, if round was active */ ],
  "guesses": [ /* already-correct guesser playerIds */ ]
}
```

Client replaces store state atomically. No incremental reconciliation.

### Player Status After Reconnect

| Situation | Behavior |
|---|---|
| Guesser reconnects during active round | Restores full state; sees current drawing; can resume guessing |
| Drawer disconnects and reconnects within grace period | Restores drawer role; game continues |
| Drawer disconnects beyond grace period | New drawer assigned; reconnecting player becomes guesser with restored state |
| Player reconnects after round ended | Shows round result screen with updated leaderboard |
| Player reconnects after game ended | Shows final result screen |

### Persistence

- `reconnectInfo` (playerId + lastRoomId) persisted in AsyncStorage via Zustand `persist` middleware
- Only used if app is closed and reopened; in-app backgrounding handled by Socket.IO auto-reconnect

---

## 16. Session Architecture

### Session Lifecycle

1. App opens → check AsyncStorage for `reconnectInfo`
2. If found → attempt reconnection to last room via WebSocket
3. If reconnection fails or no saved info → navigate to `/nickname`
4. Nickname entered → `POST /session` → receive `playerId`
5. Create or join room → `POST /rooms` or `POST /rooms/join`
6. Join WebSocket room → `socket.join(roomId)`
7. On leave room → `socket.disconnect()` → clear `roomId` from session store

### Persisted Fields (AsyncStorage)

| Field | Lifetime | Purpose |
|---|---|---|
| `nickname` | Until cleared by user | Remember player identity |
| `reconnectInfo.playerId` | Until cleared by user | Identify returning player |
| `reconnectInfo.lastRoomId` | Until cleared by user | Return to last room |
| `reconnectInfo.lastRoomCode` | Until cleared by user | Display for easy rejoin |

### Non-Persisted Fields

- `roomId` — set per-session; cleared on leave room
- `playerId` — set per-server-session; may change on new session creation
- All game state — server-authoritative; restored via snapshot on reconnect

---

## 17. API / Data Contract Strategy

### Data Exposure Levels

| Level | Contents | Audience |
|---|---|---|
| `PUBLIC_ROOM_STATE` | room id, code, config, players (nicknames, scores), host, game phase | All room members |
| `DRAWER_PRIVATE_STATE` | secretWord, currentStroke (local), tool state | Drawer only |
| `PLAYER_PRIVATE_STATE` | playerId, nickname, individual scores | Self only |
| `GAME_PUBLIC_STATE` | phase, drawer (playerId), maskedWord, scores, timer, hintsRemaining, guesses | All room members |

### Shared Type Strategy

**Decision:** Client-side shared types in `src/types/` directory. Server-side types in a separate package (Stage 3).

Rationale: Creating a monorepo with `packages/shared-types/` adds complexity (workspace config, build pipeline, publish workflow) that provides no benefit until the server repository is scaffolded. When Stage 3 creates the backend, shared types can be extracted into a workspace package. For V1, the client defines its own types and the server implements to match.

**Type contract example:**

```typescript
// src/types/events.ts
export type ServerEvent =
  | { type: 'room:joined'; payload: RoomJoinedPayload }
  | { type: 'player:joined'; payload: PlayerJoinedPayload }
  | { type: 'drawer:selected'; payload: DrawerSelectedPayload }
  | { type: 'round:started'; payload: RoundStartedPayload }
  | { type: 'draw:start'; payload: DrawStartPayload }
  | { type: 'draw:move'; payload: DrawMovePayload }
  | { type: 'draw:end'; payload: DrawEndPayload }
  | { type: 'guess:correct'; payload: GuessCorrectPayload }
  | { type: 'round:ended'; payload: RoundEndedPayload }
  | { type: 'score:updated'; payload: ScoreUpdatedPayload }
  | { type: 'game:finished'; payload: GameFinishedPayload }

// Drawer-only payload — NOT part of public event union
export interface DrawerSelectedPayload {
  type: 'drawer:selected'
  playerId: string
  secretWord: string    // Only delivered to drawer
  maskedWord: string
}

// Public payload — secretWord absent
export interface RoundStartedPayload {
  type: 'round:started'
  phase: 'ROUND_ACTIVE'
  timer: { roundEndTime: number }
  maskedWord: string
  hintsRemaining: number
}
```

---

## 18. Design System Integration

### Token Architecture

Centralized token file: `src/theme/tokens.ts`

```typescript
export const tokens = {
  colors: {
    background: '#FAF7F0',      // Warm cream/off-white
    surface: '#FFFFFF',
    textPrimary: '#1A1A2E',     // Dark ink
    textSecondary: '#4A4A6A',
    border: '#2D2D44',
    primary: '#7B2CBF',         // Purple accent
    secondary: '#FF6B9D',       // Pink accent
    success: '#06D6A0',         // Mint/green
    warning: '#FFD166',         // Yellow
    danger: '#EF476F',
    disabled: '#C4C4C4',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 8, md: 16, lg: 24, full: 9999 },
  typography: { /* per Figma */ },
  animation: { /* per Figma timings */ },
}
```

All components consume `tokens.*` — no hardcoded values in component files.

### Figma Reference Workflow

1. Extract screenshots from `DoodleBee_FIgma_screens.zip`
2. Place in `assets/figma-reference/`
3. Each screen gets a reference image used during implementation
4. Design conflicts documented per Design.md §26

---

## 19. Testing Architecture

### Framework: Jest (Expo default) + React Native Testing Library

### Structure

```
__tests__/
├── unit/
│   ├── scoring.test.ts          // Point calculation, drawer scoring
│   ├── hints.test.ts            // Masked word generation
│   ├── wordMatching.test.ts     // Case-insensitive, whitespace-normalized
│   └── roomValidation.test.ts   // Code format, capacity rules
├── integration/
│   └── roomFlow.test.ts         // Create → Join → Start sequence
├── multiplayer/
│   ├── twoPlayerRoom.test.ts
│   ├── fourPlayerRoom.test.ts
│   └── eightPlayerRoom.test.ts
├── failure/
│   ├── drawerDisconnect.test.ts
│   ├── guesserDisconnect.test.ts
│   ├── hostDisconnect.test.ts
│   ├── simultaneousGuesses.test.ts
│   └── invalidRoomCode.test.ts
└── mocks/
    ├── serverMock.ts            // Mock Socket.IO server
    └── stateFactory.ts          // Test state factories
```

### Multiplayer Testing Strategy

Use a mock Socket.IO server that simulates:
- N players joining a room
- Simultaneous guess submission
- Random disconnect/reconnect
- Rate-limited chat spam

No real backend required for unit/integration tests. Mock server provides deterministic outcomes.

---

## 20. Security

### 20.1 Secret Word (See Section 9)

Technical enforcement via store compartmentalization + TypeScript type separation.

### 20.2 Input Validation

All external input validated with Zod schemas at boundaries:
- WebSocket event payloads → `zod` schema validation before store update
- REST API responses → `zod` schema validation before state merge
- User input → `zod` schema in form handlers

### 20.3 Error Exposure

User-facing errors are friendly messages. Internal errors logged server-side only:

```typescript
// User sees:
"Your connection disappeared."
// Developer logs:
"WebSocket ECONNRESET: 10.0.1.7:6379 — Redis connection lost"
```

### 20.4 No Hardcoded Secrets

Zero secrets in client code. All endpoint URLs from environment config (`app.json` or `.env`).

---

## 21. Performance

### 21.1 Drawing Performance Targets

- 60fps local stroke rendering
- <200ms event propagation (NFR-001)
- 8 simultaneous viewers rendering same stroke stream without frame drops

### 21.2 Optimization Strategies

- Batched DRAW_MOVE events (≤10 points/packet)
- Path simplification on high-frequency touch points
- Skia GPU acceleration for all canvas rendering
- Reanimated animations on worker thread (New Architecture)
- WebSocket compression enabled

### 21.3 Memory Management

- Stroke history buffer: 30 seconds (configurable)
- Clear canvas on round end (V1: no stroke persistence)
- Chat message limit: 100 messages per session
- No memoization of full game state snapshots

---

## 22. Scalability

### 22.1 V1 Scale

- Max 8 players per room
- Unlimited concurrent rooms
- Single backend service (per PRD §28)

### 22.2 Architecture Supports Future Scaling

- Socket.IO namespaces enable horizontal scaling
- Redis pub/sub adapter supports multi-instance backend
- Stateless REST endpoints scale independently
- Room isolation ensures one room failure doesn't affect others (NFR-002)

### 22.3 Not in V1 Scope

- Load testing infrastructure
- Auto-scaling configuration
- CDN for assets
- Multi-region deployment

---

## 23. Dependency Rules

All dependencies must satisfy:
1. Necessary purpose identified
2. Expo SDK compatibility verified
3. Bundle/runtime impact assessed
4. Maintenance status reviewed
5. Documented in this ADR

### Approved Dependencies (Stage 2)

| Package | Purpose | Risk |
|---|---|---|
| expo | Core framework | None (baked in) |
| react-native | UI primitives | None (baked in) |
| expo-router | File-based routing | None (baked in) |
| zustand | Client state | Low |
| socket.io-client | Realtime transport | Low |
| react-hook-form | Form management | Low |
| zod | Runtime validation | Low |
| react-native-reanimated | Animations | Low (Expo official) |
| @shopify/react-native-skia | Drawing canvas | MEDIUM (needs SDK check) |

---

## 24. V1 Scope Protection

### Explicitly In Scope

Android, iOS, guest nickname, create room, join room, room code, lobby, 2-8 players, host, random drawer, word selection, drawing canvas, real-time drawing, real-time chat, guess processing, hint system, timer, scoring, multiple rounds, final scoreboard, reconnection, basic anti-cheat, basic moderation.

### Explicitly Out of Scope

Voice chat, video chat, global matchmaking, friends system, complex profiles, avatar/cosmetics marketplace, clans, tournaments, AI-generated drawings, AI-generated words, microservices.

---

## 25. Architecture Decisions Ledger

### AD-001 — Expo as Mobile Framework
**Status:** APPROVED
**Evidence:** PRD §23 recommends Expo; Nara confirms EAS CLI 23.1.0 available; Node 22 compatible with SDK 54+
**Reason:** Managed workflow reduces native build complexity; EAS enables iOS cloud builds from Windows dev machine
**Tradeoffs:** Requires dev client build for some native features (Skia); less direct native control than bare workflow
**Impact:** Scaffold with `npx create-expo-app --template blank-typescript`

### AD-002 — Socket.IO Over Raw WebSocket
**Status:** APPROVED
**Evidence:** Codex review analyzed 12 comparison factors; Socket.IO wins on reconnection, rooms, ACKs, debugging, server complexity
**Reason:** Reconnection is hard requirement (FR-010, NFR-004); building reliable custom reconnection is high-risk
**Tradeoffs:** +25KB bundle; slightly higher per-connection overhead
**Impact:** Add `socket.io-client` dependency; implement event contracts per Section 11

### AD-003 — Zustand with Domain-Split Stores
**Status:** APPROVED WITH CONDITIONS
**Evidence:** PRD §23 recommends Zustand; Codex confirms 5-domain split is correct
**Reason:** Domain splitting prevents uncontrolled global store growth; enforces state ownership (Section 7)
**Tradeoffs:** Slightly more files than single store; marginal complexity for simple projects
**Impact:** Create 5 store files; add State Writer Map (Section 7) as non-negotiable implementation requirement

### AD-004 — @shopify/react-native-skia as Drawing Library
**Status:** UNDER_REVIEW — SDK COMPATIBILITY CHECK REQUIRED
**Evidence:** Codex evaluation: best performance (GPU-accelerated), best DRAW_* event mapping, strong TS support
**Reason:** 8-player simultaneous rendering requires GPU acceleration; SVG approaches risk jank at 60fps
**Tradeoffs:** Requires development build (not Expo Go); ~150KB uncompressed bundle; steeper learning curve than SVG
**Impact:** Verify `npx expo install @shopify/react-native-skia` compatibility after scaffold; fallback to react-native-svg if incompatible

### AD-005 — Compartmentalized Secret Word Stores
**Status:** APPROVED
**Evidence:** PRD §10 mandates drawer-only secret word; Codex identifies store exposure risk as HIGH
**Reason:** Single-store pattern makes accidental exposure trivially possible; TypeScript type separation prevents it at compile time
**Tradeoffs:** More store files; drawer/guesser hooks must be imported from correct store
**Impact:** Implement two game state slices (drawer/guesser) with no shared secretWord accessor

### AD-006 — Fetch Over Axios
**Status:** APPROVED
**Evidence:** REST surface is 4-5 endpoints; Fetch is zero-dependency built-in
**Reason:** Axios adds ~10KB for features (interceptors, auto-transform) not needed at this scale
**Tradeoffs:** Manual JSON parsing; manual error handling (wrap in thin utility)
**Impact:** Create `src/api/client.ts` wrapper around native fetch

### AD-007 — Jest + RTL for Testing
**Status:** APPROVED
**Evidence:** Jest is Expo default; RTL is the React Native testing standard
**Reason:** Zero configuration overhead; large community; mock server strategy feasible
**Tradeoffs:** Slower than Vitest for large suites (irrelevant for V1 test count)
**Impact:** Add `@testing-library/react-native` devDependency; create mock Socket.IO server

### AD-008 — No Monorepo for Shared Types (V1)
**Status:** APPROVED
**Evidence:** Server repository does not yet exist; monorepo adds workspace config, build pipeline, and publish workflow overhead
**Reason:** Client defines types independently; server implements to match when scaffolded in Stage 3
**Tradeoffs:** Potential type drift between client and server; resolved when monorepo is created in later stage
**Impact:** Types live in `src/types/`; documented contract in Section 17

### AD-009 — Snapshot-Based Reconnection
**Status:** APPROVED WITH CONDITIONS
**Evidence:** PRD FR-010 requires reconnection; Codex identifies underspecification as HIGH finding
**Reason:** Incremental diff reconciliation is fragile; full snapshot is simpler and more reliable
**Tradeoffs:** Slightly more data transferred on reconnect (~2-5KB); simpler client code
**Impact:** Define `request:state:snapshot` / `response:state:snapshot` event pair in Stage 3

### AD-010 — Design Tokens Centralized
**Status:** APPROVED
**Evidence:** Design.md §8 requires token categories; component variants require consistent values
**Reason:** Centralized tokens prevent arbitrary value drift across components
**Tradeoffs:** Initial setup cost; token file must be maintained
**Impact:** Create `src/theme/tokens.ts`; all components consume tokens via theme context or direct import

---

## 26. Deferred Decisions

These items are intentionally deferred to Stage 3 (Game State Machine) or later:

| ID | Decision | Reason for Deferral | Target Stage |
|---|---|---|---|
| D-DEF-001 | Fastify vs NestJS | Backend not scaffolded; choice doesn't affect client contracts | Stage 3 |
| D-DEF-002 | PostgreSQL ORM/query layer | No database layer in client | N/A |
| D-DEF-003 | Redis client/library | Transient state management is server concern | Stage 3 |
| D-DEF-004 | Deployment topology | Infrastructure decision, not client architecture | Post-Stage 2 |
| D-DEF-005 | Observability provider | Client-side logging strategy sufficient for V1; server observability is backend concern | Stage 3 |
| D-DEF-006 | Exact Zustand store implementation details | Store interfaces defined in Section 7; implementation in Stage 3 | Stage 3 |
| D-DEF-007 | Reconnect grace period duration | Configurable server parameter; client just displays appropriate UI | Stage 3 |
| D-DEF-008 | Specific Figma font names and weights | Need to extract from Figma export; implementation detail | Stage 3 UI |
| D-DEF-009 | Exact scoring multiplier (drawer bonus) | Configurable per room; server-side math | Stage 3 |
| D-DEF-010 | `@shopify/react-native-skia` SDK compatibility verification | Cannot verify until Expo project is scaffolded | Pre-scaffold check |

---

## 27. Scaffolding Prerequisites

**Before `npx create-expo-app` may execute, ALL of the following must be true:**

- [ ] This ADR (version 2.0) is the current authoritative document
- [ ] `decision.md` ledger reflects all locked decisions (Section 25)
- [ ] Git repository initialized at `D:/doodlebee`
- [ ] `.gitignore` for Expo/React Native project present
- [ ] Architecture Lead has reviewed and approved this ADR
- [ ] All `APPROVED` and `APPROVED WITH CONDITIONS` decisions are understood by implementation agent
- [ ] `UNDER_REVIEW` items (AD-004, D-DEF-010) have explicit mitigation plan documented
- [ ] `Deferred` items are understood as out-of-scope for Stage 2 implementation

**DO NOT scaffold until all checkboxes above are satisfied.**
