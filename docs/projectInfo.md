# DoodleBee — Project Information

**Version:** V1
**Status:** MASTER PROJECT CONTEXT
**Source:** Draw_and_Guess_PRD.pdf + approved Figma V1 design
**Date:** September 2026

---

# 1. Project Identity

Product:

    DoodleBee — Draw & Guess

Product type:

    Real-time multiplayer mobile party game

Platforms:

    Android
    iOS

Maximum players:

    8 players per room

Primary game mode:

    Private room / Join by code

Authentication model:

    Guest-first in V1

Core mechanic:

    One player draws a randomly selected word while other players attempt to guess it in real time.

---

# 2. Core Product Flow

    APPLICATION
        │
        ├── CREATE ROOM
        │      ↓
        │   Configure Room
        │
        └── JOIN ROOM
               ↓
           Enter Room Code
               │
               ▼
             LOBBY
               │
           2–8 players
               │
          Host starts
               │
               ▼
          GAME STARTS
               │
       Random drawer
               │
        Secret word
               │
       ┌───────┴───────┐
       │               │
     DRAWER          GUESSERS
       │               │
    Draws canvas     Guess chat
       │               │
       └───────┬───────┘
               ↓
        Correct guesses
               ↓
         Ranking/points
               ↓
          Round complete
               ↓
         Next drawer
               ↓
             ...
               ↓
        Final scoreboard
               ↓
          GAME COMPLETE

---

# 3. Functional Requirements

## FR-001

A player shall be able to enter a nickname.

## FR-002

A player shall be able to create a room.

## FR-003

A player shall be able to join an existing room using a room code.

## FR-004

A player shall be able to leave a room.

## FR-005

A player shall be able to see the players currently present in the room.

## FR-006

A player shall be able to see their current score.

## FR-007

A player shall be able to submit guesses through the room chat.

## FR-008

A player shall receive immediate feedback when their guess is correct.

## FR-009

A player shall be prevented from guessing after correctly guessing the current word.

## FR-010

A player shall be able to reconnect after a temporary network interruption where technically possible.

---

## FR-011

The system shall generate a unique room code.

## FR-012

The host shall be able to configure the maximum number of players.

## FR-013

The maximum room capacity shall not exceed 8 players.

## FR-014

The host shall be able to configure the number of rounds.

## FR-015

The host shall be able to configure the duration of each round.

## FR-016

The host shall be able to configure the number of hints.

## FR-017

The system shall prevent additional players from joining when the room reaches its configured capacity.

## FR-018

Only the host shall be able to start the game.

## FR-019

The room shall not start unless the minimum player requirement is satisfied.

---

## FR-020

Players joining the room shall appear in the lobby in real time.

## FR-021

Players leaving shall disappear from the lobby in real time.

## FR-022

The current player count shall update in real time.

## FR-023

The host shall be clearly identified.

## FR-024

The host shall be able to start the game.

## FR-025

The host shall be able to leave the room.

## FR-026

If the host leaves, host ownership shall be transferred to another eligible player.

---

## FR-027

Guesses shall be processed by the server.

## FR-028

The system shall normalize guesses before comparison, including case and whitespace.

## FR-029

The system shall record the order in which players correctly guess.

## FR-030

A player who has already guessed correctly shall not receive another guess ranking.

## FR-031

The server shall determine the final ranking.

---

# 4. Room Code Rules

Room code:

    5–6 characters

Properties:

- case insensitive
- easy to communicate verbally
- avoid ambiguous characters such as O/0 and I/1
- active room codes must be unique

Recommended implementation default:

    6 characters

Supported:

    5–6 characters

---

# 5. Player Model

Players are guest-first in V1.

Player information required for gameplay includes:

- player identity
- nickname
- room membership
- host status
- current score
- current role
- connection status

The PRD does not require a full social profile system for V1.

---

# 6. Room

The room is the multiplayer container.

Room configuration:

    roomName
    maxPlayers
    rounds
    roundDuration
    hints

Room properties:

    roomId
    roomCode
    host
    players
    status
    configuration

Room capacity:

    2–8 players

The exact minimum player threshold must follow the approved game validation rule.

---

# 7. Game

Important distinction:

    Room ≠ Game ≠ Round

Room:

    multiplayer container

Game:

    complete multi-round session

Round:

    one drawer/word/drawing/guessing cycle

---

# 8. Game Start

Server process:

    1. Validate room
    2. Select random drawer
    3. Select word
    4. Send secret word only to drawer
    5. Send masked word to other players
    6. Start round timer

---

# 9. Drawer

Drawer receives:

- secret word
- drawing canvas
- timer
- brush
- eraser
- clear canvas
- color selection
- brush size
- hints

Drawer MUST NOT submit guesses for their own word.

---

# 10. Drawing System

Drawing is synchronized through discrete operations.

Required conceptual events:

    DRAW_START
    DRAW_MOVE
    DRAW_END

Do NOT repeatedly transmit complete canvas screenshots.

The server distributes drawing events to connected players.

Drawing strokes do not need permanent persistence in V1.

---

# 11. Guessing

Guesses are submitted through room chat/game interface.

Server:

    normalize
    compare
    validate eligibility
    determine correctness
    record ranking
    calculate points
    broadcast result

The client never determines authoritative correctness.

---

# 12. Scoring

Default scoring:

| Position | Points |
|---|---:|
| 1st | 500 |
| 2nd | 350 |
| 3rd | 100 |
| 4th | 50 |
| 5th | 15 |
| 6th | 2 |
| 7th | 0 |
| 8th | 0 |

Scoring should remain server-configurable for future scoring modes.

---

# 13. Drawer Scoring

Recommended initial rule:

    Drawer Score =
    Number of players who guessed correctly
    ×
    Drawer Bonus

The exact drawer bonus is configurable.

---

# 14. Timer

Server owns:

    roundEndTime

Client displays remaining time using authoritative server state.

Client MUST NOT independently determine authoritative round completion.

---

# 15. Hints

Host configures number of hints.

Hints reveal partial information.

Example:

    Initial:
    _ _ _ _ _ _ _ _

    Hint 1:
    _ _ E _ _ _ _ _

    Hint 2:
    _ _ E P _ _ _ _

Hints must never reveal the complete answer immediately.

---

# 16. Round Completion

A round ends when:

1. timer reaches zero
2. all eligible guessers correctly guess
3. server terminates round because of an exceptional condition

After round completion:

    leaderboard is updated
    next drawer selected

---

# 17. Multiple Rounds

The system selects the next drawer after each round.

The same player should not unnecessarily receive consecutive turns when other eligible players are available.

---

# 18. Final Scoreboard

Displays:

- player
- final score
- position
- winner
- play again
- return home

---

# 19. Chat

Chat supports:

- guess messages
- normal discussion
- system messages
- correct-answer notifications

Required protections include:

- maximum message length
- rate limiting
- spam protection
- profanity filtering
- player mute
- host kick

Report functionality is identified in the PRD as a later-version item.

---

# 20. Player Disconnection

## Guesser

If a guesser disconnects:

    game continues

## Drawer

If drawer disconnects:

    grace period begins
        ↓
    reconnect?
       / \
     YES  NO
      |    |
      |    ↓
      |  round ends
      |    ↓
      |  new drawer
      |
      ↓
    continue

Grace period duration is configurable.

---

# 21. Game State Machine

Server-authoritative:

    WAITING
        ↓
    STARTING
        ↓
    ROUND_ACTIVE
        ↓
    ROUND_FINISHED
        ↓
    NEXT_ROUND
        ↓
    ROUND_ACTIVE
        ↓
       ...
        ↓
    GAME_FINISHED

Client is never responsible for authoritative game-state transitions.

---

# 22. Non-Functional Requirements

## NFR-001 — Real-Time Responsiveness

Typical event propagation under 200ms.

Game should remain playable under normal mobile-network conditions.

---

## NFR-002 — Availability

Backend designed for high availability.

Failure in one room should not terminate unrelated rooms.

---

## NFR-003 — Scalability

System must support multiple simultaneous rooms.

Architecture must not assume a single active game.

---

## NFR-004 — Reliability

Must handle:

- network interruption
- WebSocket disconnection
- app backgrounding/reopening
- player leaving
- host leaving
- server timeout
- duplicate events
- duplicate guesses

---

## NFR-005 — Security

Server is authoritative for:

- secret word
- player role
- round state
- timer
- guess ranking
- score
- game completion

Clients are never trusted for these.

---

## NFR-006 — Anti-Cheat

- secret word transmitted only to drawer
- scoring calculated server-side

---

## NFR-007 — Data Privacy

Collect only data required for functionality/analytics.

Provide:

- privacy policy
- data disclosure
- consent
- deletion mechanisms

---

## NFR-008 — Performance

Requirements:

- fast startup
- smooth drawing
- minimal network overhead
- minimal battery overhead
- reliable with 8 players/room
- graceful degradation on poor connectivity

---

## NFR-009 — Mobile Compatibility

Support modern Android and iOS devices.

Adapt to:

- screen sizes
- aspect ratios
- safe areas
- orientations
- densities

---

## NFR-010 — Maintainability

Use:

- TypeScript
- modular architecture
- shared client/server types
- automated tests
- linting
- formatting
- CI/CD
- environment-based configuration

---

## NFR-011 — Observability

Provide:

- structured logs
- error tracking
- performance metrics
- WebSocket/room metrics
- crash reporting
- basic analytics

---

## NFR-012 — Abuse Prevention

Provide:

- rate limiting
- chat throttling
- room creation limits
- invalid room-code protection
- message length limits
- content moderation

---

# 23. Recommended Technology Stack

## Mobile

    React Native
    Expo
    TypeScript
    Expo Router

## State

    Zustand

## API

    REST

Possible implementation:

    Fetch
    or
    Axios

## Real-Time

    WebSocket
    or
    Socket.IO

## Forms

    React Hook Form

## Validation

    Zod

## Animation

    React Native Reanimated

## Drawing

    React Native-compatible Canvas/Drawing library

The drawing library must be evaluated before locking.

---

# 24. Backend

Recommended:

    Node.js
    TypeScript
    Fastify OR NestJS
    WebSocket / Socket.IO

Backend responsibilities:

    REST
    WebSocket
    authentication/session handling
    game engine
    validation
    scoring
    timer authority
    room management

---

# 25. Database

PostgreSQL for persistent data.

Expected entities:

    users
    rooms
    room_players
    games
    rounds
    scores
    words
    game_results

Drawing strokes do not need permanent persistence in V1.

---

# 26. Redis

Redis is for fast/transient state.

Expected uses:

    active rooms
    room state
    connected players
    game state
    timers
    session state
    rate limiting
    pub/sub

---

# 27. Infrastructure

Recommended architecture:

    Android
    iOS
      │
      │ HTTPS / WSS
      ▼
    Load Balancer
      │
      ▼
    Node.js Backend
      │
      ├── Game Engine
      ├── WebSocket
      └── REST/Auth
          │
          ├── Redis
          └── PostgreSQL

---

# 28. V1 Backend Architecture Rule

For V1:

    SINGLE BACKEND SERVICE

Do NOT begin with:

- microservices
- Kubernetes
- Kafka
- service mesh
- multiple databases

Build the core game first.

---

# 29. DevOps

Flow:

    GitHub
       ↓
    GitHub Actions
       ↓
    Test
       ↓
    Lint
       ↓
    Build
       ↓
    Deploy

Environments:

    development
    staging
    production

Never hardcode production credentials into the mobile application.

---

# 30. Testing Requirements

## Unit

Test:

- score calculation
- hint generation
- word matching
- room validation
- game-state transitions

## Integration

Test:

- create room
- join room
- start game
- submit guess
- complete round
- calculate score

## Multiplayer

Test:

    2 players
    4 players
    8 players

## Failure

Test:

- drawer disconnect
- guesser disconnect
- host disconnect
- internet disappears
- internet returns
- server restart
- simultaneous guesses
- room full
- invalid room code
- duplicate guess
- spam messages

---

# 31. Load Testing

Progressive load targets specified by the PRD:

    100 rooms
        ↓
    500 players
        ↓
    1,000 players
        ↓
    5,000+ players

Actual launch scale determines which level is required.

The architecture must support multiple simultaneous rooms.

---

# 32. Analytics

Important events:

    APP_OPENED
    ROOM_CREATED
    ROOM_JOINED
    GAME_STARTED
    ROUND_STARTED
    GUESS_SUBMITTED
    GUESS_CORRECT
    GAME_COMPLETED
    GAME_ABANDONED
    ROOM_LEFT
    PLAYER_DISCONNECTED

Analytics must remain privacy-conscious.

---

# 33. App Store Requirements

## Google Play

Required areas include:

- Android App Bundle
- signing
- store listing
- privacy policy
- data safety declaration
- content rating
- icon
- screenshots
- release management

## Apple App Store

Required areas include:

- iOS build
- signing
- App Store Connect
- privacy information
- age rating
- screenshots
- metadata
- review requirements

Internal/beta distribution should be used before public launch.

---

# 34. V1 Scope

V1 MUST have:

- Android
- iOS
- guest nickname
- create room
- join room
- room code
- lobby
- 2–8 players
- host
- random drawer
- word selection
- drawing canvas
- real-time drawing
- real-time chat
- guess detection
- hint system
- timer
- scoring
- multiple rounds
- final scoreboard
- reconnection
- basic anti-cheat
- basic moderation

---

# 35. Explicitly Out of V1

Do not implement:

- voice chat
- video chat
- global matchmaking
- friends system
- complex profiles
- avatar/cosmetics marketplace
- clans
- tournaments
- AI-generated drawings
- AI-generated words
- microservices

---

# 36. V2

PRD-listed future capabilities include:

- friends
- private friend rooms
- quick join
- public rooms
- leaderboards
- player statistics
- achievements
- daily challenges
- more word categories
- custom word packs
- reactions
- better moderation
- player profiles
- avatars
- themes

---

# 37. V3 / Growth

PRD-listed future capabilities include:

- matchmaking
- global leaderboard
- ranked mode
- seasonal events
- tournaments
- creator rooms
- custom room rules
- voice chat
- spectator mode
- replay drawings
- shareable results
- referral system
- social accounts
- advanced analytics

---

# 38. Monetization

V1:

    Focus on fun and stability.

Future possibilities:

- advertisements
- remove-ads purchase
- cosmetic themes
- drawing backgrounds
- premium word packs

Never sell competitive advantage.

Do not sell:

- extra points
- answer reveals
- extra guessing time

---

# 39. Competitive Position

The core draw → guess → score mechanic is not novel.

Differentiation should come from execution:

- fast rounds
- excellent mobile drawing UX
- fun realtime chat
- smart hints
- competitive scoring
- tight private rooms
- strong social presentation
- future reactions
- themes
- multilingual support
- future friends/features

Do not claim novelty of the base mechanic.

---

# 40. Core Architectural Principle

    THE CLIENT RENDERS THE GAME.
    THE SERVER OWNS THE GAME.

Server decides:

- drawer
- word
- round start
- round end
- correct guess
- guess order
- score
- game completion

Client handles:

- UI
- drawing input
- chat input
- state display
- animations
- local interaction

---

# 41. V1 Success Criterion

V1 is NOT complete merely because individual screens work.

The real success sequence is:

    8 players join one room
        ↓
    host starts
        ↓
    drawer draws
        ↓
    7 players see drawing
        ↓
    players guess simultaneously
        ↓
    server correctly ranks them
        ↓
    scores update
        ↓
    drawer changes
        ↓
    next round starts
        ↓
    one player disconnects
        ↓
    game continues
        ↓
    player reconnects
        ↓
    state restores
        ↓
    all rounds complete
        ↓
    final leaderboard appears

No desynchronization.

This is the real definition of seamless V1 gameplay.

---

# 42. Current Approved Architecture Direction

Mobile:

    React Native
    Expo
    TypeScript
    Expo Router
    Zustand

Backend:

    Node.js
    TypeScript
    Fastify OR NestJS
    WebSocket/Socket.IO

Persistent:

    PostgreSQL

Transient:

    Redis

Validation:

    Zod

Animation:

    Reanimated

Drawing:

    React Native-compatible canvas library
    TO BE EVALUATED

CI/CD:

    GitHub Actions

Build:

    Expo / EAS

---

# 43. Architecture Decisions Still Pending

These MUST be decided during Stage 2/3 rather than invented by agents:

    Fastify vs NestJS

    WebSocket vs Socket.IO

    Exact drawing/canvas library

    Expo Router organization

    Zustand store boundaries

    Server-state synchronization strategy

    REST client implementation

    WebSocket client architecture

    offline/reconnect persistence strategy

    shared type package structure

    exact authentication/session mechanism

    PostgreSQL ORM/query layer

    Redis client/library

    deployment topology

    observability provider

---

# 44. Source-of-Truth Hierarchy

For requirements:

    Draw_and_Guess_PRD.pdf

For visual design:

    Approved DoodleBee Figma V1

For production navigation:

    docs/01-information-architecture.md

For screen/state mapping:

    docs/01-screen-state-map.md

For design restrictions:

    docs/Design.md

For agent behavior:

    docs/Agents.md

For current project context:

    docs/projectInfo.md

For architecture decisions:

    stage-specific architecture documents

---

# 45. Golden Rule

When uncertain:

    DO NOT GUESS.

Identify:

    what is specified
    what is not specified
    what is being proposed

Then document the proposal before implementation.