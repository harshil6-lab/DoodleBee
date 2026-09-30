# Stage 03 — Server-Authoritative State Machine

**Stage:** 03 — Realtime + Backend Architecture
**Document:** Game/room state machine
**Version:** 1.0
**Status:** DESIGNED — decisions recorded in `decision.md` (D03-010 … D03-014, D03-020, D03-026, D03-027, D03-028)
**Project:** DoodleBee
**Date:** 2026-09-30
**Authority:** Implements `decision.md` and the PRD "Game State" requirement.

The client is never responsible for an authoritative transition
(`docs/AGENTS.md` §9, `ProjectDocs/01-information-architecture.md` §9).

---

## 1. Two lifecycles, not one

The PRD names one state machine. In reality a room and a game have different
lifetimes: a room can host several games ("play again", PRD "Final Scoreboard"), and a
room exists before and after any game. `docs/projectInfo.md` §7 states the distinction
explicitly: `Room != Game != Round`.

| Concept | Lifetime | Status field |
|---|---|---|
| Room | Created → closed (TTL) | `room.status` |
| Game | `game:start` → `GAME_FINISHED` | `game.phase` |
| Round | `round:started` → `round:ended` | row in `rounds` |

### 1.1 Room status (resolves the `Room.status` gap, C-01)

| `room.status` | Meaning | Set by |
|---|---|---|
| `WAITING` | Room exists and is accepting members | `RoomService` on create |
| `IN_GAME` | A game is in progress; joins are refused (FR-017/FR-019 context) | `GameStateMachine` on `~AR` STARTING |
| `CLOSED` | Room is finished or timed out; no further actions | `RoomService` on TTL expiry or explicit close |

`room.status` is **not** the game phase. `WAITING` covers both "lobby" and "between
games"; the PRD's `WAITING` phase maps to room `WAITING` plus a game phase of `NONE`.

### 1.2 Game phase

Exactly the six names from the PRD: `WAITING`, `STARTING`, `ROUND_ACTIVE`,
`ROUND_FINISHED`, `NEXT_ROUND`, `GAME_FINISHED`. The PRD's first state, `WAITING`, is
the lobby game phase and is distinct from `room.status = WAITING` only in ownership.

---

## 2. Transition graph

```
                 game:start (host, roster >= 2)
   WAITING  -------------------------------->  STARTING
      ^                                          |
      |                                          | countdown elapsed
      |                                          v
      |                                     ROUND_ACTIVE <-------------+
      |                                          |                     |
      |                    round end (3 triggers)|                     |
      |                                          v                     |
      |                                   ROUND_FINISHED               |
      |                                          |                     |
      |                                          | results window      |
      |                                          v                     |
      |                                    NEXT_ROUND --------------- +
      |                                          |
      |             roundNumber == roundsPlanned |
      |                                          v
      |                                   GAME_FINISHED
      |                                          |
      +------------------------------------------+
                 game:start (host, "play again")
```

Terminal-for-the-room path: any state → `room.status = CLOSED` on room TTL expiry.

---

## 3. State definitions

Each state is defined with: entry condition, authoritative owner, allowed
transitions, timer, permitted player actions, emitted events, persistence obligation,
and reconnect representation.

### 3.1 `WAITING`

| Aspect | Definition |
|---|---|
| Entry condition | Room created and at least one player present |
| Authoritative owner | `RoomService` (roster, config, host); `GameStateMachine` writes the phase |
| Allowed transitions | `~AR STARTING` when the host emits `game:start` **and** the connected roster size >= `MIN_PLAYERS` (2, see §6) |
| Timer | None |
| Player actions | `join:room`, `leave:room`, `chat:message`, host-only config update via `PUT /rooms/:id/config` |
| Emitted events | `room:joined`, `player:joined`, `player:left`, `host:transferred`, `room:config:updated`, `chat:message`, `player:disconnected`, `player:reconnected` |
| Persistence | `rooms` row (`status = WAITING`), `room_players` rows |
| Reconnect | Full room snapshot; no game data; no secret |
| Notes | Joins are allowed; capacity enforced (FR-017). "Play again" returns here from `GAME_FINISHED` with scores reset. |

### 3.2 `STARTING`

| Aspect | Definition |
|---|---|
| Entry condition | `game:start` accepted (host + roster >= 2) |
| Authoritative owner | `GameStateMachine` |
| Allowed transitions | `~AR ROUND_ACTIVE` when the countdown deadline passes |
| Timer | `startingDeadline`, server-owned, absolute server-clock instant. Default window 3 s (**proposal** — the IA §10 shows a countdown but approved documents give no duration) |
| Player actions | `chat:message`, `leave:room`. Join is refused (`ROOM_ALREADY_STARTED`) |
| Emitted events | `game:started` (roster, round plan), `player:disconnected`, `player:reconnected` |
| Persistence | `games` row created (`status = STARTING`); roster snapshot frozen into `room_players` (already present) |
| Reconnect | Snapshot with `phase = STARTING` and `startingDeadline`; the client renders the countdown |
| Notes | A player who disconnects during `STARTING` is excluded from the round's eligible set if their grace period expires before `ROUND_ACTIVE`. Rule recorded in §6.2. |

### 3.3 `ROUND_ACTIVE`

| Aspect | Definition |
|---|---|
| Entry condition | Drawer selected (D03-011) and word selected (D03-015); `games` row exists |
| Authoritative owner | `RoundService` (round aggregate); `GameStateMachine` writes the phase |
| Allowed transitions | `~AR ROUND_FINISHED` on any of the three round-end triggers (§5) |
| Timer | `roundEndTime`, absolute server clock, epoch ms. Written on entry, on drawer-grace pause, and on resume. Never a countdown |
| Player actions | Drawer: `draw:start`/`draw:move`/`draw:end`, `canvas:clear`, `hint:request`. Guesser: `guess:submit`. All: `chat:message`, `leave:room` |
| Emitted events | `round:started`, `drawer:selected` (role-split), `draw:start`/`draw:move`/`draw:end`, `canvas:cleared`, `guess:submitted`, `guess:correct`, `hint:revealed`, `score:updated`, `chat:message`, `player:left`, `player:disconnected`, `player:reconnected`, `host:transferred` |
| Persistence | `rounds` row created (`started_at` set, `status = ACTIVE`). Guesses and strokes are **not** persisted per event |
| Reconnect | Snapshot with phase, round number, drawer id, masked word, remaining timer, last-30 s strokes, correct-guesser list, chat tail; `secretWord` only if the requester is the drawer |
| Notes | Two sub-states are represented by flags, not by new phase names: `roundTimerPaused` (drawer grace) and `drawerAbsent` |

### 3.4 `ROUND_FINISHED`

| Aspect | Definition |
|---|---|
| Entry condition | A round-end trigger fired |
| Authoritative owner | `RoundService` |
| Allowed transitions | `~AR NEXT_ROUND` when the results window elapses |
| Timer | `resultsDeadline`, server-owned. Default window 8 s (**proposal**; it exists so that `/round-result` has a server-owned duration and late reconnects land on the same screen) |
| Player actions | `chat:message`, `leave:room`. Drawing and guessing are refused (`BAD_STATE`) |
| Emitted events | `round:ended` (rankings + word reveal + end reason), `score:updated`, `chat:message`, `player:disconnected`, `player:reconnected` |
| Persistence | `rounds` row updated (`ended_at`, `end_reason`); `scores` rows inserted **in one transaction** (idempotent via the unique key in `data-model.md` §5) |
| Reconnect | Round-result snapshot: rankings, word, score deltas |
| Notes | Revealing the word here is safe: the round is over. This is the only server payload other than the drawer-private ones that may contain the word, and its audience is the whole room *after* the round ended |

### 3.5 `NEXT_ROUND`

| Aspect | Definition |
|---|---|
| Entry condition | Results window elapsed and `roundNumber < roundsPlanned` |
| Authoritative owner | `GameStateMachine` |
| Allowed transitions | `~AR ROUND_ACTIVE` after selecting the next drawer and word |
| Timer | Transition is server-driven and short. The state is observable (clients render the next-drawer reveal) but its duration is an implementation detail, not a client-controlled wait |
| Player actions | `chat:message`, `leave:room` |
| Emitted events | `round:started` (carries the new drawer), `chat:message`, `player:disconnected`, `player:reconnected` |
| Persistence | `games.rounds_completed` increment |
| Reconnect | Snapshot with `phase = NEXT_ROUND`, `nextDrawerPlayerId`, `roundNumber` (next) |
| Notes | Drawer selection happens here, not in `STARTING`, so that every round goes through the same selection rule |

### 3.6 `GAME_FINISHED`

| Aspect | Definition |
|---|---|
| Entry condition | Results window elapsed and `roundNumber == roundsPlanned` |
| Authoritative owner | `GameFinalizer` |
| Allowed transitions | `~AR WAITING` (room status stays `WAITING`-equivalent) when the host emits `game:start` again ("play again") |
| Timer | None. The room stays alive until its TTL expires |
| Player actions | `chat:message`, `leave:room`, host `game:start` |
| Emitted events | `game:finished` (final scores, rankings, winner), `chat:message`, `player:disconnected`, `player:reconnected` |
| Persistence | `games` row (`ended_at`, `status = FINISHED`); `game_results` rows inserted **in one transaction** |
| Reconnect | Final-result snapshot |
| Notes | "Play again" resets scores, round number and round plan, keeps the roster and the room code. It is a *new* `games` row, so history is preserved |

---

## 4. Transition guard table

Every transition has exactly one writer and one guard.

| From | To | Guard | Single writer |
|---|---|---|---|
| `WAITING` | `STARTING` | sender is host; `connectedRoster >= 2`; `room.status = WAITING` | `GameStateMachine` |
| `STARTING` | `ROUND_ACTIVE` | `now >= startingDeadline` and roster still >= 2 | `GameStateMachine` |
| `STARTING` | `WAITING` | roster dropped below 2 before the countdown elapsed (all remaining players disconnected) | `GameStateMachine` |
| `ROUND_ACTIVE` | `ROUND_FINISHED` | any round-end trigger (§5) | `RoundService` |
| `ROUND_FINISHED` | `NEXT_ROUND` | `now >= resultsDeadline` and `roundNumber < roundsPlanned` | `GameStateMachine` |
| `ROUND_FINISHED` | `GAME_FINISHED` | `now >= resultsDeadline` and `roundNumber == roundsPlanned` | `GameFinalizer` |
| `NEXT_ROUND` | `ROUND_ACTIVE` | next drawer + word selected successfully | `GameStateMachine` |
| `GAME_FINISHED` | `WAITING` | sender is host; `game:start` | `GameStateMachine` |

All transitions are applied inside one room-scoped critical section, followed by a
single `version` increment (`server-state-writer-map.md` §3).

---

## 5. Round-end triggers (exactly three)

The PRD defines three; no fourth is added.

| Trigger | `endReason` | Condition |
|---|---|---|
| Timer expired | `TIMER_EXPIRED` | `now >= roundEndTime` while `ROUND_ACTIVE` and the timer is not paused |
| All eligible guessers correct | `ALL_GUESSERS_CORRECT` | `correctCount == eligibleGuesserCount` |
| Server terminates exceptionally | `DRAWER_ABANDONED` (the only V1 case) or `SERVER_TERMINATED` | drawer grace expired, or the room is being force-closed |

`server terminates the round due to an exceptional condition` is the PRD's own wording;
V1 narrows "exceptional" to exactly two cases so that the reason is always
attributable in the audit trail.

**Drawer scoring on each path.** The drawer bonus is computed at round end on every
path, including `TIMER_EXPIRED` and `DRAWER_ABANDONED`:

- `TIMER_EXPIRED` and `ALL_GUESSERS_CORRECT`: `drawerPoints = correctCount x drawerBonus`.
- `DRAWER_ABANDONED`: `drawerPoints = 0`. Rationale: a drawer who abandoned the round
  did not produce a guessable drawing to completion. This is a **proposal** (the PRD
  states the bonus formula but not the abandoned-drawer case) and is recorded as such.

---

## 6. Selection rules

### 6.1 Drawer selection (D03-011)

Rule:

1. Eligible pool = connected players who are not the immediately previous drawer.
2. If the pool is empty (only one connected player, or everyone was the previous
   drawer), fall back to all connected players.
3. Choose uniformly at random from the pool.

Evidence: PRD "Multiple Rounds" — "The system selects the next drawer after each
round. The same player should not unnecessarily receive consecutive turns when other
eligible players are available."

This satisfies the PRD exactly and is deterministic in its *constraints* while random
in its *choice*, which is what the PRD asks for. The randomness source is the server's
CSPRNG; the selected id is written only by `DrawerSelector` (see
`server-state-writer-map.md`).

### 6.2 Eligible guessers

`eligibleGuessers` = connected players in the room who are not the drawer.
Disconnected players are excluded while disconnected and re-included on reconnect
within the same round. If a player is disconnected at the moment the
`ALL_GUESSERS_CORRECT` check runs, they are not counted, so a room where two players
dropped does not stall.

Edge case recorded: a player who disconnects during `STARTING` and reconnects during
`ROUND_ACTIVE` is eligible again — their seat is retained for the whole game.

### 6.3 Host transfer (FR-026)

| Aspect | Rule |
|---|---|
| Trigger | The current host's transport drops, or the host leaves the room |
| New host | The connected player with the earliest `joinedAt` among the remaining members |
| Tie-break | Lowest `playerId` (lexicographic), for determinism |
| If no other connected player | Host stays assigned to the absent player until either they return or the room closes |
| On the old host's return | The host role does **not** revert. Reverting would flap under flaky connectivity |
| Emitted | `host:transferred { hostPlayerId, version }` |
| Owner | `HostTransferService` only |

"Eligible" is not defined in any approved document. The rule above is a **proposal**
that satisfies FR-026 deterministically; it is recorded as such rather than presented
as specified.

---

## 7. Reconnect representation per state

| Phase | Snapshot contains | Secret word present? |
|---|---|---|
| `WAITING` | room, roster, config, host, `version` | no (no word exists) |
| `STARTING` | room, roster, `startingDeadline`, round plan | no |
| `ROUND_ACTIVE` | room, roster, drawer, masked word, `roundEndTime`, `serverNow`, hints remaining, revealed positions, last-30 s strokes, correct-guesser list, chat tail, scores | **only if the requester is the drawer** |
| `ROUND_FINISHED` | room, roster, round rankings, revealed word, score deltas | word revealed to everyone (round is over) |
| `NEXT_ROUND` | room, roster, next drawer, next round number | no |
| `GAME_FINISHED` | room, roster, final scores, rankings, winner | no |

Full schema: `reconnect-protocol.md` §3.

---

## 8. Timers (authority and ownership)

| Timer | Owner | Representation | Client role |
|---|---|---|---|
| Round timer | `RoundTimer` (single writer) | `roundEndTime`, epoch ms, server clock | Renders the remainder; may not end the round |
| Starting countdown | `GameStateMachine` | `startingDeadline`, epoch ms | Renders |
| Results window | `GameStateMachine` | `resultsDeadline`, epoch ms | Renders |
| Guesser grace | `ConnectionRegistry` | `graceDeadline[playerId]` | Renders the roster state only |
| Drawer grace | `ConnectionRegistry` + `RoundTimer` | `graceDeadline[drawerId]` and `roundTimerPaused` | Renders; the round is visibly paused |
| Room idle TTL | `RoomService` | Redis key TTL | none |

**Pause semantics (D03-020).** While the drawer is inside its grace period and the
phase is `ROUND_ACTIVE`, the round timer is paused: `roundEndTime` is *extended* by the
paused duration when the round resumes, and `roundTimerPaused = true` is broadcast.
Rationale: the PRD does not say what happens to the clock; letting it run would charge
the guessers for the drawer's network fault, and letting it run to zero would end a
round that no one could have been answering. The PRD is silent here, so this is
recorded as a **proposal** (C-06).

No timer is a stored countdown. All timers are absolute instants compared against the
server clock, so a process restart does not lose or drift the remaining time.

---

## 9. Concurrency and serialization

All mutations for one room are serialized. The mechanism is defined in
`decision.md` → D03-017 and `server-state-writer-map.md` §3: a per-room
asynchronous critical section backed by a Redis Lua script for the operations that
must be atomic (guess ranking, capacity admission, version bump). This is required
because NFR-004 explicitly lists "duplicate guesses" and "duplicate events" as
conditions the system must handle, and because `ALREADY_GUESSED` must be decidable
atomically.

---

## 10. What this state machine deliberately does not add

- No `PAUSED` phase. A paused round is `ROUND_ACTIVE` with `roundTimerPaused = true`,
  because adding a phase would change the PRD's state list.
- No `SPECTATOR` role. V1 has drawer and guesser only.
- No per-round "voting" or "skip" transitions.
- No second state machine for the room beyond the three room statuses in §1.1.