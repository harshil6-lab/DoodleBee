# Stage 03 — API Contract (REST) and Error Model

**Stage:** 03 — Realtime + Backend Architecture
**Document:** REST surface + error taxonomy
**Version:** 1.0
**Status:** DESIGNED — decisions recorded in `decision.md` (D03-021, D03-022)
**Project:** DoodleBee
**Date:** 2026-09-30

---

## 1. Boundary rule

REST handles **request/response** operations only. Everything that is game state,
realtime, drawing or guessing is Socket.IO (`docs/AGENTS.md` §14, ADR §10).

The Stage 02 ADR fixed this boundary and a six-endpoint skeleton. Stage 03 keeps the
skeleton and adds exactly **one** endpoint. No endpoint is added "for symmetry".

---

## 2. Endpoints

`L` = locked by ADR §10 / implemented client. `N` = new in Stage 03.

| # | Method | Path | S | Auth | Purpose |
|---|---|---|---|---|---|
| 1 | `POST` | `/session` | L | none | Create a guest session |
| 2 | `PUT` | `/session/nickname` | L | token | Set/change the nickname |
| 3 | `POST` | `/rooms` | L | token | Create a room; creator becomes host |
| 4 | `POST` | `/rooms/join` | L | token | Admission by room code |
| 5 | `PUT` | `/rooms/:id/config` | L | token (host) | Update room config while `WAITING` |
| 6 | `GET` | `/settings` | L | none | Client settings defaults |
| 7 | `GET` | `/health` | N | none | Liveness/readiness for the load balancer |

### 2.1 Why only one new endpoint

- A "get room" endpoint was considered and **rejected**: the socket's `room:joined` and
  `response:state:snapshot` already deliver the room, and `POST /rooms/join` returns it
  on admission. A REST room read would create a second, differently-shaped source of
  the same data — a duplicate reader path for no benefit.
- A "leave room" endpoint was considered and **rejected**: `leave:room` is a locked
  client socket event and leaving is inherently a realtime presence change.
- `GET /health` is required because the PRD's infrastructure diagram places a load
  balancer in front of the backend; without a health endpoint the balancer cannot
  distinguish a live process from a wedged one.
- No word/category endpoint: words are selected server-side and are never enumerated to
  a client except as the round's own word (D03-015).

---

## 3. Endpoint contracts

### 3.1 `POST /session`

```
Request:  {}
Response: 201 { playerId: string, sessionToken: string, nickname: string | null }

Errors: 500
```

The response field `sessionToken` is added to the Stage 02 skeleton (which returned only
`playerId`). The client uses it as `handshake.auth.token` (see
`realtime-contract.md` §3). A session is a guest identity: the PRD specifies
guest-first authentication for V1.

### 3.2 `PUT /session/nickname`

```
Request:  { nickname: string }                 // 1..20 chars, [A-Za-z0-9_]
Response: 200 { nickname: string }

Errors: 400 VALIDATION_ERROR, 401 UNAUTHENTICATED, 429 RATE_LIMITED
```

Validation mirrors the locked client schema `NicknameSchema`
(`src/validation/schemas.ts`) exactly. There is one nickname rule in the system.

### 3.3 `POST /rooms`

```
Request:  { roomName: string, maxPlayers: number, rounds: number,
            roundDuration: number, hints: number }
Response: 201 { roomId: string, roomCode: string, config: RoomConfig }

Errors: 400 VALIDATION_ERROR, 401 UNAUTHENTICATED, 429 RATE_LIMITED
```

Bounds mirror the locked client schema `RoomConfigSchema`: `maxPlayers` 2..8,
`rounds` 1..20, `roundDuration` 30..300, `hints` 0..5, `roomName` 1..30. The server
re-validates with the same Zod schema; the client's bounds are not trusted.

Room-code generation: 5–6 characters from an alphabet **excluding `O`, `0`, `I`, `1`**
(PRD "Room Code"), unique among active rooms (enforced by the partial index in
`data-model.md` §2.3). Generation retries on collision.

### 3.4 `POST /rooms/join`

```
Request:  { roomCode: string }
Response: 200 { room: { roomId, roomCode, config, players, host },
                isHost: boolean,
                admittedAt: string }

Errors: 400 VALIDATION_ERROR, 401 UNAUTHENTICATED,
        404 ROOM_NOT_FOUND, 409 ROOM_FULL, 409 ROOM_ALREADY_STARTED,
        429 RATE_LIMITED
```

This call performs **admission**: it validates the code, enforces capacity (FR-017),
records the `room_players` row, and returns the room snapshot. It is the persistence
half of joining. The socket `join:room` is the realtime half (presence + binding) and
refuses a player with no admission record (`NOT_ADMITTED`).

This split is deliberate: admission failure is a fast, well-typed HTTP error the client
can act on before opening realtime state, and it keeps capacity enforcement in one
transactional place.

`INVALID_ROOM_CODE` from the client's vocabulary maps onto `404 ROOM_NOT_FOUND`; no new
HTTP status is invented for it.

### 3.5 `PUT /rooms/:id/config`

```
Request:  Partial<RoomConfig>
Response: 200 { config: RoomConfig }

Errors: 400 VALIDATION_ERROR, 401 UNAUTHENTICATED, 403 FORBIDDEN,
        404 ROOM_NOT_FOUND, 409 BAD_STATE (not WAITING), 429 RATE_LIMITED
```

Host-only (FR-024 context). Refused once the room is `IN_GAME`. On success the server
broadcasts `room:config:updated` so that non-host members converge (this is the writer
that ADR §7 names but the locked client enum lacks — extension E-01).

### 3.6 `GET /settings`

```
Response: 200 { defaults: { maxPlayers, rounds, roundDuration, hints },
                limits: { minPlayers, maxPlayers, minRounds, maxRounds,
                          minRoundDuration, maxRoundDuration, minHints, maxHints } }
```

Read-only defaults so the create-room form and the server agree on one set of bounds.

### 3.7 `GET /health`

```
Response: 200 { status: 'ok', uptimeSeconds: number,
                dependencies: { postgres: 'ok'|'down', redis: 'ok'|'down' } }
Errors:   503 when a required dependency is down
```

Returns `503` rather than `200` with a flag, so the load balancer can act without
parsing the body. No version string is exposed (it is a fingerprinting surface).

---

## 4. Authentication

| Aspect | Decision |
|---|---|
| Scheme | Opaque bearer token in `Authorization: Bearer <sessionToken>` |
| Issued by | `POST /session` |
| Stored | Redis `session:{token}`, TTL 24 h (**proposal**) |
| Realtime use | the same token in `handshake.auth.token` |
| Not used | no JWT, no cookie, no OAuth (see `decision.md` → D03-019) |

Rationale: at this trust level a signed token buys nothing an opaque random token plus
a server-side lookup does not, at the cost of key management and rotation. No approved
document requires stateless auth, and V1 is a single service.

---

## 5. Error model

### 5.1 REST envelope

```
{ "error": { "code": "ROOM_FULL", "message": "That room is full." } }
```

`message` is user-safe and never contains infrastructure detail (`docs/AGENTS.md` §13).
Internal detail is logged server-side with a correlation id; the correlation id is
**not** returned to the client (it would be an information leak with no user benefit).

### 5.2 HTTP status mapping

The mapping is constrained by the client already shipping an `ApiError.userMessage()`
switch on `0/400/401/404/409/429/500`. Every code below maps onto one of those statuses
so no client change is required.

| Code | HTTP | Category | User-facing meaning |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | validation | invalid input |
| `UNAUTHENTICATED` | 401 | authorization | session expired; re-enter nickname |
| `SESSION_EXPIRED` | 401 | reconnect/auth | token expired |
| `FORBIDDEN` | 403 | authorization | not permitted (e.g. not the host) |
| `ROOM_NOT_FOUND` | 404 | room | room not found / invalid code |
| `NOT_ADMITTED` | 404 | room | no admission record |
| `ROOM_FULL` | 409 | room | room is full |
| `ROOM_ALREADY_STARTED` | 409 | game state | already started |
| `ROOM_CLOSED` | 409 | room | room closed |
| `BAD_STATE` | 409 | game state | not allowed right now |
| `ALREADY_GUESSED` | 409 | game state | already guessed correctly |
| `NOT_DRAWER` | 409 | game state | not the drawer |
| `DRAWER_CANNOT_GUESS` | 409 | game state | the drawer cannot guess |
| `MUTED` | 409 | moderation | muted by the host |
| `RATE_LIMITED` | 429 | rate limit | too many attempts |
| `INTERNAL_ERROR` | 500 | server | generic, detail logged only |

### 5.3 Realtime errors

Realtime errors travel in the ack envelope, not over HTTP:

```
{ ok: false, eventId, code, message, retryable }
```

The same code vocabulary is used, so one error taxonomy serves both transports. The
full table with `retryable` semantics is in `realtime-contract.md` §10.

### 5.4 Errors that have no user-facing message

Some conditions are handled silently by design, because surfacing them would leak
information or would be noise:

| Condition | Handling |
|---|---|
| A guess that is wrong | The guess is broadcast as chat; the submitter sees "Not quite". No error |
| A guess that is a near-match | Ack carries `result: 'CLOSE'`; broadcast as chat. No error |
| Duplicate `eventId` | The cached ack is replayed; it is not an error |
| A malformed ack from a buggy client | Counted as a protocol-violation metric, not surfaced |
| A sender is not the drawer | `NOT_DRAWER` ack; **not** broadcast to the room (would be noise, and it tells others who fumbled) |

---

## 6. Rate limits

| Scope | Endpoint/event | Limit (proposal) |
|---|---|---|
| Session create | `POST /session` | 10 / minute / IP |
| Room create | `POST /rooms` | 5 / minute / session, 30 / hour / IP |
| Room join attempts | `POST /rooms/join` | 10 / minute / session (invalid-code protection, NFR-012) |
| Config update | `PUT /rooms/:id/config` | 10 / minute / room |
| Chat | `chat:message` | 5 / 5 s with a burst of 8, per player |
| Guesses | `guess:submit` | 10 / 10 s, per player |
| Drawing | `draw:*` | 60 / s sustained, burst 120, per socket |
| Snapshot | `request:state:snapshot` | 6 / minute / socket |

All values are proposals (no approved document states numbers) and are configuration,
not code constants. Exceeding a limit returns `RATE_LIMITED` with `retryable: true` and,
for chat, sets the client's `RATE_LIMITED` UI state (IA §13).

---

## 7. CORS and transport

- The mobile client is not a browser, so CORS is **not** required for V1. The
  `@fastify/cors` plugin is therefore **not** installed. If a web target is ever added,
  CORS becomes a requirement of that target, not a speculative default now.
- HTTPS/WSS terminates at the load balancer (PRD "Infrastructure").
- Payload compression is enabled (ADR §21.2).

---

## 8. Excluded from REST (unchanged from ADR §10)

Game-state synchronization, realtime events, drawing operations, guess submission,
hints, scoring, chat, moderation actions, and reconnection snapshots. All of these are
Socket.IO. Nothing in this document adds a REST path for any of them.