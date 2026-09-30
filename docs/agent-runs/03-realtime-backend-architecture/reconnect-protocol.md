# Stage 03 — Reconnect Protocol

**Stage:** 03 — Realtime + Backend Architecture
**Document:** Disconnect, grace period and snapshot restoration
**Version:** 1.0
**Status:** DESIGNED — decisions recorded in `decision.md` (D03-019, D03-020, D03-028, D03-030)
**Project:** DoodleBee
**Date:** 2026-09-30

Satisfies PRD FR-010, NFR-004, and the Stage 02 decision D02-010 / AD-009
("snapshot-based restoration; exact protocol in Stage 3").

---

## 1. Reconnect identity

Reconnecting is **not** re-joining. The identity of a returning player is the same
`playerId` they had before, so their seat, role and score survive.

| Element | Value | Where it lives |
|---|---|---|
| Identity | `playerId` | Server-issued at `POST /session` |
| Proof | `sessionToken` | Redis `session:{token}` (TTL 24 h, proposal) |
| Transport | `handshake.auth.token` | Socket.IO handshake |
| Client-side memory | `reconnectInfo { playerId, lastRoomId, lastRoomCode }` | AsyncStorage via `zustand/persist` (D02-011) |

**Rule.** `playerId` is never accepted from a client payload. The server resolves it from
the token on every connection. A client that presents an unknown token is
`UNAUTHENTICATED` and never reaches a room handler.

---

## 2. Reconnect sequence

```
Client                                      Server
  |  transport drops (network loss / backgrounding)
  |  -------------------------------------------------->
  |                                    ConnectionRegistry:
  |                                      isConnected = false
  |                                      graceDeadline = now + grace(role)
  |                                      emit player:disconnected (room)
  |  <--------------------------------------------------
  |
  |  (Socket.IO auto-reconnect, exponential backoff)
  |  connect(auth.token)  ----------------------------->
  |                                    resolve playerId from session:{token}
  |  <-------------------------- join required
  |  join:room { eventId }  --------------------------->
  |                                    RoomService.rebind(playerId, socket)
  |                                      cancel grace; isConnected = true
  |  <----- join:room ack { ok, room, you, version }
  |                                    emit player:reconnected (room)
  |  <--------------------------------------------------
  |  request:state:snapshot { eventId, lastVersion }
  |  -------------------------------------------------->
  |                                    SnapshotProjector.project(roomId, playerId)
  |  <----- response:state:snapshot { ... }
  |  apply atomically if snapshot.version >= lastAppliedVersion
```

The client does not "merge" incrementally. ADR §15 locks atomic replacement.

---

## 3. `response:state:snapshot` schema

```
type StateSnapshot = {
  type: 'response:state:snapshot'
  version: number                 // room sequence at projection time
  serverNow: number               // server clock, epoch ms (for countdown rendering)
  room: {
    roomId: string
    roomCode: string
    roomName: string
    status: 'WAITING' | 'IN_GAME' | 'CLOSED'
    hostPlayerId: string
    config: { roomName, maxPlayers, rounds, roundDuration, hints }
  }
  players: {
    playerId: string
    nickname: string
    score: number
    isConnected: boolean
    isHost: boolean
    seatOrder: number
  }[]
  you: {
    playerId: string
    nickname: string
    role: 'DRAWER' | 'GUESSER'
    score: number
    hasGuessedCorrectly: boolean
  }
  game: {
    gameId: string | null
    phase: 'WAITING' | 'STARTING' | 'ROUND_ACTIVE' | 'ROUND_FINISHED' | 'NEXT_ROUND' | 'GAME_FINISHED'
    roundNumber: number
    roundsPlanned: number
  }
  round: {
    roundId: string | null
    drawerPlayerId: string | null
    maskedWord: string
    revealedPositions: number[]
    hintsRemaining: number
    timer: { roundEndTime: number | null; paused: boolean }
    endReason?: 'TIMER_EXPIRED' | 'ALL_GUESSERS_CORRECT' | 'DRAWER_ABANDONED' | 'SERVER_TERMINATED'
    word?: string                 // ROUND_FINISHED only: the round is over
    secretWord?: string           // PRESENT ONLY WHEN you.role === 'DRAWER' AND phase === 'ROUND_ACTIVE'
    startingDeadline?: number     // STARTING only
    resultsDeadline?: number      // ROUND_FINISHED only
    nextDrawerPlayerId?: string   // NEXT_ROUND only
  }
  correctGuessers: { playerId: string; nickname: string; rank: number; points: number }[]
  strokes: Stroke[]               // last 30 s, ROUND_ACTIVE only, else []
  chat: ChatMessagePayload[]      // last 50
  scores: Record<string, number>
  leaderboard: { playerId: string; nickname: string; score: number; rank: number }[]
}
```

### 3.1 Field-by-field reconnect representation

| ADR §15 requirement | Snapshot field |
|---|---|
| reconnect identity | resolved before projection; echoed as `you.playerId` |
| room rejoin | `room`, `players` |
| current state | `game.phase` |
| player list | `players[]` (incl. `isConnected`) |
| round | `game.roundNumber`, `round.roundId` |
| timer | `round.timer.roundEndTime` + `serverNow` |
| score | `you.score`, `scores`, `leaderboard` |
| drawer role | `you.role`, `round.drawerPlayerId` |
| drawing state | `strokes[]` |
| chat state | `chat[]` |
| secret-word visibility | `round.secretWord` present only for the drawer (§4) |
| sequence/version number | `version` |
| stale client detection | §5 |

---

## 4. Secret-word visibility in a snapshot

The snapshot is produced by **one projector with one role parameter**, and the
projection is applied **at send time**, never cached per role.

```
project(roomId, requesterPlayerId):
  snapshot = readAggregate(roomId)              // may contain the word
  if requesterPlayerId !== snapshot.round.drawerPlayerId:
      delete snapshot.round.secretWord          // property removed, not nulled
  if snapshot.game.phase !== 'ROUND_ACTIVE':
      delete snapshot.round.secretWord
  return snapshot
```

Rules, all testable:

1. `secretWord` is **absent** (not `null`, not `''`, not masked) for a guesser.
2. It is present only when the requester is the current drawer **and** the phase is
   `ROUND_ACTIVE`.
3. There is no second "public snapshot" object to keep in sync — one projector, one
   deletion step.
4. The projector is read-only: it is not a writer in `server-state-writer-map.md`.
5. The raw aggregate is never placed in a Socket.IO room.

This is the reconnect half of D03-015 and is covered by the tests in
`security-model.md` §7.

---

## 5. Staleness and ordering

| Concern | Mechanism |
|---|---|
| Applying an old payload after a newer one | The client applies a server payload only when `version >= lastAppliedVersion` |
| A snapshot older than the client's state | The client keeps its state and may re-request; the server treats `lastVersion` as advisory |
| Missing packets while disconnected | The snapshot supersedes them; no replay is required |
| Clock drift for the countdown | `serverNow` + `round.timer.roundEndTime` give the client an offset estimate; the client never ends the round |
| Server-initiated resync | The server may emit `response:state:snapshot` unsolicited at any time (for example after an ack timeout or a detected gap). The client applies it under the same version rule |

An unsolicited snapshot is the one mechanism that keeps a *connected but diverged*
client convergent without inventing a per-field reconciliation protocol.

---

## 6. Grace periods

| Role | Grace | Default | Rationale |
|---|---|---|---|
| Guesser | `guesserGrace` | 30 s (**proposal**) | The game continues; the seat and score must survive a short tunnel/backgrounding |
| Drawer | `drawerGrace` | 15 s (**proposal**, range 5–60 s) | The PD draws nothing while absent; the PRD calls the duration configurable |
| Host | (none) | 0 s | Host authority transfers immediately (FR-026); the host's *seat* keeps the guesser grace |

`drawerGrace` is the PRD's "configurable grace period". No approved value exists, so the
default is recorded as a proposal and is a configuration value, not a constant.

### 6.1 Guesser grace expiry

1. Mark the player `isConnected = false` (already done at disconnect).
2. Keep the seat, role and score for the whole game. The player is excluded from
   `eligibleGuessers` while disconnected (so `ALL_GUESSERS_CORRECT` can still fire).
3. No `player:left` is emitted: the member has not left. `player:disconnected` was
   already emitted at disconnect time.
4. `room_players.left_at` is **not** set on a mere disconnect.

### 6.2 Drawer grace expiry

1. `roundTimerPaused` is already `true`; the round has been visibly paused.
2. The round ends with `endReason = 'DRAWER_ABANDONED'` (the PRD's "server terminates
   the round due to an exceptional condition").
3. The drawer is excluded from the next round's drawer-selection pool (they are
   disconnected) but keep their seat, score and eligibility to return.
4. `round:ended` is emitted to the room with the revealed word and the current rankings,
   so the score reveal matches a normal round end.
5. If the drawer returns *after* expiry, they rejoin as a guesser in the next round with
   a restored snapshot — exactly the behaviour ADR §15 specifies.

### 6.3 Timer interaction (D03-020)

While the drawer is in grace and the phase is `ROUND_ACTIVE`:

- `roundTimerPaused = true` is broadcast.
- On reconnect within grace, `roundEndTime` is extended by the paused duration and the
  round resumes. The clock is never shortened.
- On grace expiry, the round ends immediately regardless of remaining time.

The PRD does not state whether the round clock pauses. Two alternatives were considered
(let it run; end the round immediately on drawer disconnect) and are recorded in
`decision.md` → D03-020 with the reasoning for pausing. This is a **proposal**
(the ambiguity is recorded as C-06).

---

## 7. Disconnect handling matrix

| Situation | Round | Roster | Events | Score |
|---|---|---|---|---|
| Guesser disconnects | continues | seat kept, `isConnected = false` | `player:disconnected` | kept |
| Guesser reconnects in grace | continues | `isConnected = true` | `player:reconnected` | kept |
| Guesser reconnects after grace | continues | seat kept; re-included in `eligibleGuessers` | `player:reconnected` | kept |
| Guesser never returns | rounds proceed without them | seat kept until room close | none further | kept |
| Drawer disconnects | paused, then ends after grace | seat kept | `player:disconnected` (+ pause notice) | kept |
| Drawer reconnects in grace | resumes, timer extended | `isConnected = true` | `player:reconnected` | kept |
| Drawer grace expires | ends (`DRAWER_ABANDONED`) | seat kept | `round:ended` | kept + drawer bonus 0 |
| Host disconnects | unchanged | transfer | `host:transferred`, `player:disconnected` | kept |
| Host reconnects | unchanged | host role does **not** revert | `player:reconnected` | kept |
| All players disconnect | round timer keeps running until it expires, then the game ends as `ABANDONED` on room TTL | keys TTL out | none | persisted best-effort |
| Server restarts | in-flight game restored from Redis within TTL | members rebind on reconnect | `connection:lost` (shutdown), then reconnect | kept |
| Server restart beyond room TTL | game lost; `games.status = 'ABANDONED'` | room closed | `ROOM_CLOSED` on reconnect | partial best-effort |

The "all players disconnect" row is a proposal: the PRD does not define it, and ending
the game on TTL keeps the Redis aggregate from lingering.

---

## 8. Client-side contract

The client must:

1. Persist `reconnectInfo { playerId, lastRoomId, lastRoomCode }` (already locked).
2. On app open with `reconnectInfo`, attempt a socket connection with the stored
   `sessionToken` before navigating to `/nickname`.
3. On `join:room` ack, immediately emit `request:state:snapshot`.
4. Apply the snapshot atomically, preserving only `ui.*` fields (ADR §7 rule 4).
5. Show `RECONNECTING` / `RECONNECTED` / `RECONNECT_FAILED` states per
   `ProjectDocs/01-screen-state-map.md` §18 without adding routes.
6. On `connection:lost` with `SESSION_EXPIRED`, clear `reconnectInfo` and return to
   `/nickname`.

Storage of `sessionToken` on the client is a Stage 03 implementation detail; the
existing client persists `playerId`/`lastRoomId` today. The token must live in the same
store, and the client must treat it as a credential (not logged).

---

## 9. Known limits (stated, not hidden)

1. **Strokes drawn while the drawer's socket is down are unrecoverable.** The server
   cannot hold what it never received; the drawer's local canvas keeps them, but peers
   will have a gap for that interval. Bounded by `drawerGrace`.
2. **The 30 s stroke buffer is a window, not a history.** A reconnect after 30 s in the
   same round restores a partial canvas. Extending it worsens the snapshot size; the
   PRD does not require full stroke history, and strokes are not persisted at all.
3. **A reconnect after the room TTL loses the game.** This is the documented
   consequence of Redis being the home of the live aggregate.
4. `connectionStateRecovery` is optional and, when enabled, still does not replace the
   snapshot — it can only reduce how much is missed.