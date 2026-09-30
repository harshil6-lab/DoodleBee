# Stage 03 — Realtime Contract

**Stage:** 03 — Realtime + Backend Architecture
**Document:** Socket.IO event contract (client and server)
**Version:** 1.0
**Status:** DESIGNED — decisions recorded in `decision.md` (D03-002 … D03-005, D03-013, D03-014, D03-016, D03-018, D03-030)
**Project:** DoodleBee
**Date:** 2026-09-30
**Authority:** Implements `decision.md`. Subordinate to the PRD.

This document defines the realtime surface. It does not implement it.

---

## 1. Transport

| Item | Decision |
|---|---|
| Protocol | Socket.IO over WebSocket (locked by D02-007 / AD-002) |
| Server library | `socket.io` → `4.8.4` |
| Client library | `socket.io-client` → `4.8.4` (already installed) |
| Namespace | **one**: the default `/` |
| Auth token carrier | `handshake.auth.token` |
| Byte budget | Engine.IO per-message framing only; no second envelope layer |

**One namespace.** The PRD describes a single gameplay surface. Namespaces exist to
multiplex *different authentication or authorization domains* on one server; DoodleBee
V1 has one domain (a room member). Adding namespaces now would duplicate the auth
middleware and the room registry with no benefit. ADR §22 lists namespaces as a future
scaling lever — that is where they belong.

**Why 4.8.4 server-side is not arbitrary.** The client already ships
`socket.io-client@4.8.4`. Matching the server minor version is the lowest-risk
configuration and requires no change to the frozen client.

---

## 2. Connection lifecycle

```
  (HTTP)  POST /session            -> playerId + sessionToken
  (HTTP)  POST /rooms | /rooms/join -> admission + room snapshot
  (WS)    connect(auth.token)      -> server resolves playerId
          io.use(middleware)       -> verify token; attach socket.data
  (WS)    join:room                -> bind socket to room; presence begins
  (WS)    join:room ack            -> { ok, room, you, version }
  ...     gameplay events          -> ack per action
  (WS)    disconnect               -> presence lost; grace timer per role
  (WS)    reconnect + join:room    -> request:state:snapshot
```

### 2.1 Connect

1. Client opens the socket with `auth: { token }`.
2. Server middleware (`io.use`) validates the token against
   `session:{token}` and, on success, sets `socket.data.playerId`,
   `socket.data.roomId` (if the token is bound to a room) and `socket.data.role`.
3. On failure the server emits `connection:lost` with
   `{ code: 'UNAUTHENTICATED' }` and disconnects the socket. **A failed handshake
   never reaches a room or a game handler.**
4. On success the socket is *connected but not yet in a room*. Presence begins only
   at `join:room`.

### 2.2 Reconnect

Socket.IO performs transport reconnection automatically. On a successful transport
reconnect the server treats the socket as a **new connection with the same identity**
and requires `join:room` again; the client then issues `request:state:snapshot`.

`connectionStateRecovery` (available in 4.8.4, default `maxDisconnectionDuration`
120000 ms) may be enabled as an *optimisation*, but it is never the authoritative
restore path: it replays opaque packets and cannot express the role-scoped secret-word
rule. `request:state:snapshot` is the contract.

### 2.3 Disconnect taxonomy

| Cause | Server action | Room continues? |
|---|---|---|
| Guesser disconnects | Mark `isConnected = false`; start guesser grace timer; emit `player:disconnected` | Yes, immediately |
| Drawer disconnects | Mark `isConnected = false`; start drawer grace timer; **pause the round timer** (D03-020) | Yes, round pauses |
| Host disconnects | Drawer/guesser handling as above **plus** immediate host transfer to the earliest-joined connected player (FR-026); emit `host:transferred` | Yes, immediately |
| Client loses the room (room closed / not admitted) | Emit `connection:lost` with a code; disconnect | N/A |
| Server shutting down | Emit `connection:lost` with `{ code: 'SERVER_SHUTDOWN', retryable: true }` to every room, then close | Client reconnects and re-snapshots |
| Session token expired | Emit `connection:lost` with `{ code: 'SESSION_EXPIRED' }`; disconnect | Client returns to `/nickname` |

---

## 3. Identity and authorization boundary

| Value | Source | Trust |
|---|---|---|
| `playerId` | Server, from `session:{token}` | Never read from a payload |
| `nickname` | Server, from the persisted player record at join time | Client may *request* a change via REST; it does not set it inline in an event |
| `roomId` | Server, from the admission record | Never read from a payload |
| `role` (`DRAWER` / `GUESSER`) | Server, from the live round aggregate | Never read from a payload |

**Rule.** No client-to-server event payload contains an identity field that the server
already knows. A payload that carries `playerId` or `roomId` is a contract violation.
This removes an entire class of spoofing for free.

`Player` identity in the roster is `playerId`; `nickname` is a display attribute that
lives on the player record.

---

## 4. Rooms

| Socket.IO room | Members | Purpose |
|---|---|---|
| `room:{roomId}` | Every admitted, connected member | All public broadcasts |
| (none) | — | **There is deliberately no drawer room.** |

**There is no secret-bearing room.** Socket.IO rooms are joinable and their membership
is enumerable, so a "drawer room" would be a structural secret leak. Drawer-private
payloads are emitted **only to the drawer's own socket ids** (a player may have more
than one live socket during a reconnect overlap).

Public broadcasts that must exclude the drawer use `io.to(roomId).except(drawerSocketIds)`
(`except` verified present in 4.8.4 — see `architecture-research.md` §5.3).

---

## 5. Envelope conventions

### 5.1 Client → server envelope

Every state-changing client event carries:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `eventId` | `string` (UUID v4) | yes | Idempotency key, client-generated, unique per attempt |
| `_probe` | `{ t0: number }` | no | AD-004 instrumentation only. `t0` is the client send time in ms. **Never read by game logic.** |
| (payload) | event-specific | — | See the tables below |

No `playerId`, no `roomId`, no `role`, no `nickname`.

### 5.2 Acknowledgement envelope

Every client event is emitted with an ack callback:

```
// success
{ ok: true, eventId: string, version: number, ...eventSpecificFields }

// failure
{ ok: false, eventId: string, code: ErrorCode, message: string, retryable: boolean }
```

`version` is the room's authoritative sequence number *after* the action was applied
(or the unchanged value if the action was rejected). `message` is user-safe
(`docs/AGENTS.md` §13).

### 5.3 Server → client envelope

Server events are plain named events with a typed payload. Every server payload that
changes state carries the room `version` so a client can detect out-of-order or stale
application (it applies a payload only when `version >= lastAppliedVersion`).

---

## 6. Client → server events

Names marked LOCKED already exist in the client's `ClientToServerEvent` enum and must
not be renamed.

| Event name | Status | Payload | Authorization | Idempotency |
|---|---|---|---|---|
| `join:room` | LOCKED | `{ eventId, roomCode }` | Valid session token **and** an existing admission record for this room | Re-join replaces the previous binding; safe to repeat |
| `leave:room` | LOCKED | `{ eventId }` | Any room member | Repeat is a no-op |
| `guess:submit` | LOCKED | `{ eventId, guess: string, _probe? }` | Must be a GUESSER in `ROUND_ACTIVE` and not already correct | `eventId` dedupe |
| `chat:message` | LOCKED | `{ eventId, text: string }` | Room member, not muted, under rate limit | `eventId` dedupe |
| `hint:request` | LOCKED | `{ eventId }` | Must be the current DRAWER, `hintsRemaining > 0`, `ROUND_ACTIVE` | `eventId` dedupe; a second request in the same tick is a no-op |
| `game:start` | LOCKED | `{ eventId }` | Must be the host; phase `WAITING` or `GAME_FINISHED`; roster >= minimum | `eventId` dedupe |
| `draw:start` | LOCKED | `{ eventId, strokeId, strokeSeq, color, brushSize, points[], _probe? }` | Must be the current DRAWER in `ROUND_ACTIVE` | `eventId` dedupe + `strokeSeq` ordering |
| `draw:move` | LOCKED | `{ eventId, strokeId, pointIndex, points[] (<=10), _probe? }` | Same as `draw:start` | `eventId` dedupe + `pointIndex` monotonicity |
| `draw:end` | LOCKED | `{ eventId, strokeId, _probe? }` | Same as `draw:start` | `eventId` dedupe |
| `canvas:clear` | LOCKED | `{ eventId, _probe? }` | Must be the current DRAWER in `ROUND_ACTIVE` | `eventId` dedupe |
| `request:state:snapshot` | NEW (named by AD-009) | `{ eventId, lastVersion?: number }` | Any room member | Always safe; returns the current snapshot |

---

## 7. Server → client events

| Event name | Status | Audience | Purpose |
|---|---|---|---|
| `room:joined` | LOCKED | Joiner | Initial room + game snapshot on join |
| `player:joined` | LOCKED | Room | Roster addition |
| `player:left` | LOCKED | Room | Roster removal (a *real* leave, not a disconnect) |
| `host:transferred` | LOCKED | Room | New `hostPlayerId` |
| `game:started` | LOCKED | Room | `STARTING` entered; roster frozen |
| `round:started` | LOCKED | Room | `ROUND_ACTIVE` entered; timer + masked word |
| `drawer:selected` | LOCKED | Room (public variant) **and** drawer socket (private variant) | Drawer identity; role-split payload |
| `draw:start` | LOCKED | Room except drawer | Remote stroke opened |
| `draw:move` | LOCKED | Room except drawer | Remote stroke points appended |
| `draw:end` | LOCKED | Room except drawer | Remote stroke closed |
| `guess:submitted` | LOCKED | Room | A wrong/close guess was spoken (echoed as chat, see §9) |
| `guess:correct` | LOCKED | Room | A player guessed correctly, with rank and points. **Never carries the word.** |
| `hint:revealed` | LOCKED | Room | New masked word + remaining hints |
| `round:ended` | LOCKED | Room | Round result: rankings, word reveal, end reason |
| `score:updated` | LOCKED | Room | Authoritative score map |
| `game:finished` | LOCKED | Room | Final scores, rankings, winner |
| `connection:lost` | LOCKED | One socket | Server-initiated connection termination with a code |
| `room:config:updated` | **NEW** | Room | `room.config` writer (ADR §7 names it; the enum lacks it) |
| `chat:message` | **NEW** | Room | Chat entry; discriminated by `type` |
| `canvas:cleared` | **NEW** | Room except drawer | Canvas reset for the current round |
| `player:disconnected` | **NEW** | Room | A member's transport dropped (seat retained) |
| `player:reconnected` | **NEW** | Room | A member's transport returned |
| `response:state:snapshot` | **NEW** (named by AD-009) | One socket | Authoritative snapshot; role-scoped |

---

## 8. Additive extensions required to the Stage 02 client contract

These are **additions**, not changes. No locked name is renamed, no locked payload
field changes meaning. They must be applied to `src/types/index.ts` in the Stage 03
*implementation* stage, with the client toolchain re-verified afterwards.

| # | Gap found in the locked client contract | Consequence |
|---|---|---|
| E-01 | ADR §7 names `ROOM_CONFIG_UPDATED` as the writer of `room.config`, but no such server event exists in the enum | `room.config` has no writer |
| E-02 | ADR §7 names `CHAT_MESSAGE`, `CORRECT_GUESS_MESSAGE`, `SYSTEM_MESSAGE` as writers of `game.chats`, but no such server events exist in the enum | `game.chats` has no writer |
| E-03 | `Player.isConnected` exists but no event writes it | per-player connection state is unwritable |
| E-04 | ADR §13.4 requires canvas clearance to reset strokes; `canvas:clear` exists only client → server | peers cannot learn of a clear |
| E-05 | ADR AD-009 requires the `request:state:snapshot` / `response:state:snapshot` pair; neither name exists in the enums | reconnection has no contract |

E-02 is resolved by **one** event (`chat:message`) with a `type` discriminator rather
than three names: the ADR's three names map to `type: 'NORMAL' | 'SYSTEM' |
'CORRECT_GUESS'`, and `GUESS` is added for wrong/close guesses. One event with a
discriminated union is a smaller contract than three parallel events with three
payload shapes.

---

## 9. Payload schemas

Payloads are declared as types here; runtime validation is Zod at the server boundary
(D02-014) and mirrored on the client.

### 9.1 Role-split `drawer:selected`

```
// emitted to the drawer's own socket ids only
type DrawerSelectedPrivate = {
  type: 'drawer:selected'
  playerId: string
  secretWord: string
  maskedWord: string
  roundNumber: number
  version: number
}

// emitted to room:{roomId} excluding the drawer's sockets
type DrawerSelectedPublic = {
  type: 'drawer:selected'
  playerId: string
  maskedWord: string
  roundNumber: number
  version: number
}
```

The public variant has **no `secretWord` property at all** — not `null`, not `''`,
absent. A test asserts the property is absent (see `testing-strategy.md`).

### 9.2 `round:started`

```
type RoundStartedPayload = {
  type: 'round:started'
  roomId: string
  roundNumber: number
  drawerPlayerId: string
  maskedWord: string
  hintsRemaining: number
  timer: { roundEndTime: number }   // server clock, epoch ms
  serverNow: number                 // server clock at emit, epoch ms
  version: number
}
```

`serverNow` lets the client compute a clock offset and render the countdown without
trusting the local clock (IA §14).

### 9.3 `chat:message`

```
type ChatMessagePayload = {
  type: 'chat:message'
  id: string
  messageType: 'NORMAL' | 'GUESS' | 'SYSTEM' | 'CORRECT_GUESS'
  senderPlayerId: string | null     // null for SYSTEM
  senderNickname: string | null
  text: string
  createdAt: number                 // server clock, epoch ms
  version: number
}
```

`CORRECT_GUESS` messages carry the nickname, rank and points in `text`/system fields
and **must not contain the secret word**.

### 9.4 `guess:correct`

```
type GuessCorrectPayload = {
  type: 'guess:correct'
  playerId: string
  nickname: string
  rank: number          // 1-based, assigned by the server
  points: number
  correctCount: number
  version: number
}
```

### 9.5 `round:ended`

```
type RoundEndedPayload = {
  type: 'round:ended'
  roundNumber: number
  endReason: 'TIMER_EXPIRED' | 'ALL_GUESSERS_CORRECT' | 'DRAWER_ABANDONED' | 'SERVER_TERMINATED'
  word: string          // revealed only now, because the round is over
  rankings: { playerId: string; nickname: string; rank: number; points: number }[]
  drawerBonus: number
  drawerPoints: number
  version: number
}
```

### 9.6 `game:finished`

```
type GameFinishedPayload = {
  type: 'game:finished'
  finalScores: Record<string, number>
  rankings: { playerId: string; nickname: string; rank: number; score: number }[]
  winnerId: string
  version: number
}
```

### 9.7 `response:state:snapshot`

See `reconnect-protocol.md` §3 for the full schema and the role-scoping rule.

### 9.8 `draw:move`

```
type DrawMovePayload = {
  type: 'draw:move'
  strokeId: string
  pointIndex: number        // index of the first point in this batch
  points: { x: number; y: number; pressure?: number }[]   // length 1..10
  version: number
}
```

---

## 10. Acknowledgement and error semantics

### 10.1 Ack result shape

```
type Ack<T> =
  | ({ ok: true; eventId: string; version: number } & T)
  | { ok: false; eventId: string; code: ErrorCode; message: string; retryable: boolean }
```

### 10.2 Error codes (realtime)

| Code | Meaning | `retryable` |
|---|---|---|
| `VALIDATION_ERROR` | Payload failed its Zod schema or a bound was exceeded | no |
| `UNAUTHENTICATED` | Missing/invalid session token | no |
| `FORBIDDEN` | Authenticated but not permitted (e.g. not the drawer) | no |
| `NOT_ADMITTED` | No admission record for this room | no |
| `ROOM_NOT_FOUND` | Room does not exist | no |
| `ROOM_FULL` | Capacity reached (FR-017) | no |
| `ROOM_ALREADY_STARTED` | Join attempted after `STARTING` | no |
| `ROOM_CLOSED` | Room TTL expired or closed | no |
| `BAD_STATE` | Action not allowed in the current phase | yes (after the phase changes) |
| `NOT_DRAWER` | A drawing action from a non-drawer | no |
| `DRAWER_CANNOT_GUESS` | Drawer submitted a guess (PRD Drawer) | no |
| `ALREADY_GUESSED` | Correct guesser guessing again (FR-009/FR-030) | no |
| `RATE_LIMITED` | Chat/guess rate limit exceeded (NFR-012) | yes |
| `MUTED` | Player is muted by the host | no |
| `SESSION_EXPIRED` | Token expired | no (re-auth) |
| `INTERNAL_ERROR` | Unexpected server failure | yes |

`message` is user-safe and maps onto the same vocabulary the client already uses in
`src/api/client.ts` (`ApiError.userMessage()`), so the client needs no new
user-facing strings.

### 10.3 Ack timeout

The client sets an explicit ack timeout per event class. Recommended values (a
*proposal*, recorded as such): 5 s for gameplay actions, 10 s for
`request:state:snapshot`, 2 s for `draw:*` (a dropped drawing batch is non-fatal).
On timeout the client does **not** silently apply the action; it either retries with
the same `eventId` (making the retry idempotent) or surfaces a non-blocking notice.

---

## 11. Ordering, duplicates, and retries

| Concern | Mechanism |
|---|---|
| Per-socket ordering | Engine.IO/WebSocket delivers in order; no reordering layer is added |
| Cross-socket ordering | Not assumed. Any order-sensitive decision (guess rank) is resolved server-side at receipt (D03-017) |
| Duplicate delivery | `eventId` dedupe: the server keeps a bounded per-player LRU of applied `eventId`s (~64 entries) and replays the cached ack instead of re-applying |
| Drawing point duplicates | `pointIndex` monotonicity per `strokeId`; a batch with `pointIndex <= lastPointIndex` is dropped |
| Late drawing for a closed stroke | `strokeId` must be the current open stroke for that round; otherwise dropped |
| Stale server payloads | Every server payload carries `version`; the client applies only non-decreasing versions |
| Retry storm | `retryable: false` acks must not be retried |

---

## 12. Event → state writer mapping (server side of ADR §7)

| Client state field (ADR §7) | Writing event(s) | Status |
|---|---|---|
| `room.id`, `room.code` | `room:joined` | present |
| `room.config` | `room:config:updated`, `room:joined` | **needs E-01** |
| `room.players` | `player:joined`, `player:left` | present |
| `room.host` | `host:transferred`, `room:joined` | present |
| `game.phase` | `game:started`, `round:started`, `round:ended`, `game:finished`, `room:joined`, `response:state:snapshot` | present + E-05 |
| `game.drawer` | `drawer:selected`, `round:started` | present |
| `game.secretWord` | `drawer:selected` (private variant), `response:state:snapshot` | present + E-05 |
| `game.maskedWord` | `drawer:selected` (public variant), `hint:revealed`, `round:started` | present |
| `game.timer.roundEndTime` | `round:started`, `response:state:snapshot` | present + E-05 |
| `game.scores` | `score:updated`, `game:finished` | present |
| `game.guessRanking` | `guess:correct`, `round:ended` | present |
| `game.hintsRemaining` | `round:started`, `hint:revealed` | present |
| `game.chats` | `chat:message` / `guess:submitted` | **needs E-02** |
| `ui.drawings[strokeId]` | `draw:start`, `draw:move`, `draw:end`, `canvas:cleared`, `response:state:snapshot` | present + E-04, E-05 |
| per-player connection | `player:disconnected`, `player:reconnected`, `response:state:snapshot` | **needs E-03** |

---

## 13. What this contract deliberately excludes (V1)

- No voice/video signalling, no spectator channel, no global matchmaking events.
- No per-stroke persistence events; strokes are volatile (PRD: strokes need not be
  persisted in V1).
- No event carries a secret to a room.
- No client event carries an identity field the server already owns.
- No namespace beyond `/`.