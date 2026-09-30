# Stage 03 — Security Model

**Stage:** 03 — Realtime + Backend Architecture
**Document:** Trust model, anti-cheat, secret-word protection, moderation
**Version:** 1.0
**Status:** DESIGNED — decisions recorded in `decision.md` (D03-015, D03-017, D03-018, D03-022, D03-029)
**Project:** DoodleBee
**Date:** 2026-09-30

Satisfies PRD NFR-005 (server authority), NFR-006 (anti-cheat), NFR-012 (abuse
prevention) and `docs/AGENTS.md` §9, §10.

---

## 1. Trust model

| Actor | Trusted for | Never trusted for |
|---|---|---|
| Client (authenticated) | Its own input (nickname, guesses, chat text, drawing coordinates), its own UI state | Roles, identity, correctness, timing, scores, room membership |
| Client (unauthenticated) | Nothing | Everything |
| Load balancer | Transport only | Content |
| Server | Everything authoritative | — |

Every authorization decision is made from server-held state (`socket.data`,
the room aggregate), never from a payload field.

---

## 2. Server authority (mirrors `docs/AGENTS.md` §9)

| Concern | Owner | Enforcement point |
|---|---|---|
| drawer selection | Server | `DrawerSelector`; the client has no way to request a role |
| secret word | Server | `WordSelector`; role-scoped projection (D03-015) |
| player role | Server | `room.{id}:members`; `socket.data.role` is set by the server |
| round state | Server | `GameStateMachine`; client transitions are ignored |
| round completion | Server | `RoundTimer` / `RoundService`; a client that renders 0:00 changes nothing |
| timer completion | Server | `roundEndTime` comparison on the server clock |
| guess correctness | Server | `GuessService` normalizes and compares against the aggregate |
| guess ranking | Server | atomic `INCR` inside the Redis script (D03-017) |
| score | Server | `ScoreService`; the client never sends points |
| final game completion | Server | `GameFinalizer` |
| room capacity | Server | `POST /rooms/join` transaction + `room.members` hash |
| host transfer | Server | `HostTransferService` |
| hint reveals | Server | `HintService` |
| chat moderation | Server | `ChatService` (filter, rate limit, mute) |

**Structural point.** No client-to-server event payload contains a field the server
already owns (`realtime-contract.md` §3). Spoofing requires forging the session token,
not editing a payload.

---

## 3. Secret-word protection

The word exists in exactly four places, and nowhere else.

| Location | Form | Who can read |
|---|---|---|
| Redis `room:{id}:secret` | literal | server only |
| `rounds.word_id` (PostgreSQL) | an FK, not the literal | server only |
| `drawer:selected` private variant | literal | the drawer's own sockets |
| `response:state:snapshot` for the drawer | literal | the drawer's socket |
| `round:ended` / `rounds.masked_word_final` | literal, **after** the round ended | the whole room |

### 3.1 Transport rules

1. **Never emitted to a Socket.IO room.** Not on `drawer:selected`, not on
   `round:started`, not on `hint:revealed`, not on `score:updated`.
2. The drawer variant is emitted to `socket.data.socketIds` for the drawer only. During
   a reconnect overlap this is a set, and every member of it is the same player.
3. The public variant is emitted with `io.to(roomId).except(drawerSocketIds)` and its
   type has **no `secretWord` property** — the field is absent, not null.
4. `round:ended` may carry the word because the PRD requires the round result screen to
   show it and the round is over. This is the *only* room-scoped payload that may ever
   contain it, and only in phase `ROUND_FINISHED`.

### 3.2 Projection rules

One projector, one role parameter, applied at send time (`reconnect-protocol.md` §4).
No per-role cached snapshot exists, so there is no second object that can drift into
holding the word.

### 3.3 Guess handling without leaking

| Case | Broadcast | Contains the word? |
|---|---|---|
| Wrong guess | `chat:message` with `messageType: 'GUESS'` and the guesser's own text | no (it is the guesser's text, which is by definition wrong) |
| Near-match ("close") guess | Same as wrong, plus `result: 'CLOSE'` in the submitter's ack | no |
| Correct guess | `guess:correct { playerId, nickname, rank, points }` + a `chat:message` of type `CORRECT_GUESS` | **no** — the word is not in either payload |

The PRD requires a "correct-answer notification". The notification is expressed as
*who* guessed correctly and *what they scored*, which is what the approved UI shows
(`ProjectDocs/01-screen-state-map.md` §13: player, rank, points). The word is not part
of that notification while the round is live.

### 3.4 Near-match computation

`CLOSE` is required by the approved UI (IA §8, screen-state map §12) but not stated
by the PRD (recorded as C-09). It is computed **entirely server-side**:

```
normalize(input) -> NFKC, trim, collapse whitespace, lowercase
close(guess, word) := levenshtein(normalize(guess), normalize(word)) <= threshold(len(word))
```

The threshold is a **proposal** (no approved value). The computation never returns or
broadcasts the word, only a boolean, so a guessed near-match cannot be used to probe the
answer one character at a time: the response distinguishes only "close" from "not
close", and only for the guesser's own submission.

Residual risk recorded: a determined player could binary-search the word using the
`CLOSE` signal. Mitigations that exist: (a) `CLOSE` is returned only to the submitter,
(b) guesses are rate limited, (c) the round timer bounds the number of probes, and
(d) a `CLOSE` result is public as a chat message so other players see the probing.
Whether to rate-limit `CLOSE` results further is left as an open implementation-stage
tuning item rather than an architectural promise.

### 3.5 Logging, analytics and error surfaces

| Surface | Rule |
|---|---|
| Application logs | pino `redact` covers `secretWord`, `*.secretWord`, `round.secretWord`; the word is never interpolated into a log message |
| Error objects | handlers must not attach the aggregate to a thrown error; errors carry ids, not state |
| Analytics | the word is not an event property; the PRD's analytics list contains no such field |
| Crash reporting | the client never receives the word unless it is the drawer, so client-side crash payloads cannot contain it for a guesser |
| Tests | a test asserts every registered server → client payload schema has no `secretWord` except the two allow-listed cases (`drawer:selected` private variant, drawer-only snapshot) |
| Debug endpoints | none exist |

### 3.6 Required security tests

| # | Assertion |
|---|---|
| S-01 | `PublicDrawerSelectedPayload` has no `secretWord` key (`'secretWord' in payload === false`) |
| S-02 | A guesser's `response:state:snapshot` has no `secretWord` key |
| S-03 | The drawer's `response:state:snapshot` has `secretWord` while `ROUND_ACTIVE` |
| S-04 | `round:ended` is the only room-scoped payload with a word field, and only in `ROUND_FINISHED` |
| S-05 | The logger output for a round start contains no word literal |
| S-06 | A payload-schema registry scan finds no other `secretWord` carrier |
| S-07 | A wrong guess does not produce a payload containing the correct word |
| S-08 | `guess:correct` and the `CORRECT_GUESS` chat message contain no word |
| S-09 | A non-drawer `draw:*` emits nothing to the room |
| S-10 | A guess from the drawer is refused with `DRAWER_CANNOT_GUESS` and is not broadcast |

S-01, S-02 and S-06 are the highest-value tests: they are static/structural, so they
cannot be defeated by a single missed runtime branch.

---

## 4. Anti-cheat summary

| Cheat attempted | Why it fails |
|---|---|
| "I am the drawer" | The role is server state; no payload field carries it |
| Read the word from a guesser's client | The word is never sent to a guesser |
| Read the word from a score/chat payload | Those payloads do not contain it |
| Read the word from a reconnect snapshot | The projector deletes it for non-drawers |
| Read the word from a log/analytics event | Redaction + no field |
| Guess as the drawer | `DRAWER_CANNOT_GUESS` |
| Guess twice for a second rank | Atomic membership check; `ALREADY_GUESSED` |
| Forge a rank | Ranks are assigned inside a Redis script; the client sends only text |
| Report a fake score | The client never sends points |
| Draw as a guesser | Server role check on every `draw:*` |
| Extend the round | The client has no mechanism; `roundEndTime` is server-written |
| Join a full room | Capacity is enforced transactionally on admission |
| Rejoin after being kicked | The kicked player is added to `room:{id}:blocked` |
| Replay a captured `eventId` | Dedupe replays the stored ack instead of re-applying |

---

## 5. Moderation

PRD "Chat" requires: max message length, rate limiting, spam protection, profanity
filtering, player mute, host kick, and report functionality **in later versions**.

| Control | Owner | Behaviour |
|---|---|---|
| Max length | `ChatService` | 200 characters (mirrors the locked client constant); longer input is rejected with `VALIDATION_ERROR`, not truncated silently |
| Rate limiting | `ChatService` | Token bucket per player (5 / 5 s, burst 8 — proposal); over-limit sets the client's `RATE_LIMITED` state |
| Spam protection | `ChatService` | N identical messages inside a window collapse to one; repeated violations escalate to a warning then a temporary mute |
| Profanity filter | `ChatService` | Applied to the **displayed** text only. It is never applied to the guess-matching path, because filtering must not create a false negative on a correct guess |
| Player mute | `ChatService` | Host-only. A muted player's messages are **dropped server-side**, not hidden client-side; the sender receives `MUTED` |
| Host kick | `RoomService` | Host-only. The socket is removed from the room, `player:left` is emitted with reason `KICKED`, and the player is added to `room:{id}:blocked` |
| Report player | **deferred** | The PRD defers report to a later version; see the contradiction below |

### 5.1 Report feature contradiction (C-03)

`ProjectDocs/01-information-architecture.md` §23 and
`01-screen-state-map.md` §19 list `REPORT_PLAYER` in the player context menu, while the
PRD states report functionality is for later versions.

Disposition (D03-029): **the PRD wins**, because `docs/projectInfo.md` §44 makes the PRD
the requirements source of truth and the IA a navigation source. The V1 context menu
therefore offers Mute and, for the host, Kick. The Report action is not implemented and
the IA is noted as needing a later correction; that correction is *not* made in this
stage (this stage does not rewrite Stage 1 documents).

---

## 6. Abuse prevention (NFR-012)

| Vector | Control |
|---|---|
| Room-create flooding | 5 / minute / session, 30 / hour / IP |
| Invalid-code probing | 10 / minute / session on `POST /rooms/join`; codes are 5–6 chars from a 30-symbol alphabet (~7.3x10^7 to 4.4x10^9 space) |
| Chat flooding | token bucket + spam collapse + mute escalation |
| Guess flooding | 10 / 10 s per player |
| Drawing flooding | 60 events/s sustained, burst 120 per socket |
| Oversized payloads | Socket.IO `maxHttpBufferSize` bounded; per-event Zod bounds (`points <= 10`, `text <= 200`, `guess <= 100`) |
| Malformed JSON | rejected by the parser before a handler runs |
| Repeated protocol violations | counted per socket; a threshold triggers a disconnect |

---

## 7. Data privacy (NFR-007)

- The only personal datum stored is a player-chosen nickname.
- No email, phone, contact list, location, device advertising id or analytics identifier.
- Analytics events (PRD "Analytics") contain a player id and room id only.
- Deletion is pseudonymization (`data-model.md` §7) so results retain their shape.
- Secrets: no credentials are hardcoded; the PRD requires separate
  development/staging/production environments and no production credentials in the
  mobile app. Session tokens are per-install and revocable by TTL.

---

## 8. Known gaps and residual risks (stated, not hidden)

| # | Gap | Bounded by |
|---|---|---|
| G-01 | `CLOSE` feedback can be used to probe the word | Rate limits, the round timer, public visibility of probes (§3.4) |
| G-02 | A player with two devices can join a room twice as two players | Capacity limits; no approved document forbids it; recorded, not silently solved |
| G-03 | A disconnected drawer's un-received strokes are lost | `drawerGrace` window |
| G-04 | Redis loss ends in-flight games | Documented (`data-model.md` §1) |
| G-05 | No TLS between the server and Redis/PostgreSQL is specified here | Deployment-stage concern; the PRD requires HTTPS/WSS to the client and separate environments |
| G-06 | Nickname collisions are allowed (two players named "hunter") | Driven by `playerId`, so no correctness impact |
| G-07 | No CSAM/illegal-content reporting path | PRD defers report; V1 ships mute + kick |