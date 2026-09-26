# DoodleBee V1 — Information Architecture

**Document:** 01-information-architecture.md  
**Version:** V1  
**Status:** APPROVED FOR IMPLEMENTATION  
**Product:** DoodleBee — Draw & Guess  
**Platforms:** Android + iOS

---

## 1. Purpose

This document defines the production information architecture of DoodleBee V1.

It converts the visual Figma design into a practical application structure.

IMPORTANT:

The Figma export contains approximately 61 screens/states.

Those 61 visual screens MUST NOT become 61 production navigation routes.

Many Figma screens represent different states of the same production screen.

Example:

- Drawer normal
- Drawer low timer
- Drawer hint
- Drawer color picker
- Drawer disconnected

are all states of:

    /game/:roomId

The production application should use a small number of meaningful routes and represent gameplay variations through application state.

---

# 2. Product Boundary

DoodleBee V1 is a real-time multiplayer mobile Draw & Guess game.

Core model:

    2–8 players
        ↓
    private room
        ↓
    room code
        ↓
    lobby
        ↓
    host starts game
        ↓
    server selects drawer
        ↓
    server selects secret word
        ↓
    drawer draws
        ↓
    other players guess
        ↓
    server evaluates guesses
        ↓
    scores calculated
        ↓
    round ends
        ↓
    next drawer
        ↓
    next round
        ↓
    final scoreboard

---

# 3. Production Navigation

The application uses the following production-level routes.

    /
    /nickname
    /create-room
    /join-room
    /lobby/:roomId
    /game/:roomId
    /round-result/:roomId
    /final-result/:roomId
    /settings

These routes represent application destinations.

They do NOT represent every visual state.

---

# 4. Route Responsibilities

## 4.1 Home

Route:

    /

Responsibilities:

- display DoodleBee branding
- display nickname/player identity
- Create Room entry point
- Join Room entry point
- Settings entry point
- basic game information

Primary actions:

    CREATE ROOM
    JOIN ROOM
    SETTINGS

---

## 4.2 Nickname

Route:

    /nickname

Responsibilities:

- allow player to enter nickname
- validate nickname
- store local player identity for the current session

States:

    EMPTY
    VALID
    INVALID
    SUBMITTING

The exact nickname validation policy must be defined separately before implementation.

---

## 4.3 Create Room

Route:

    /create-room

Responsibilities:

- collect room configuration
- create a room
- transition the creator into the lobby

Configuration:

    roomName
    maxPlayers
    rounds
    roundDuration
    hints

States:

    FORM
    VALIDATING
    CREATING
    SUCCESS
    ERROR

On successful creation:

    create room
        ↓
    receive room identity
        ↓
    navigate to /lobby/:roomId

The room creator becomes the host.

---

## 4.4 Join Room

Route:

    /join-room

Responsibilities:

- collect room code
- validate/join room
- handle join failures

States:

    EMPTY
    ENTERING
    VALIDATING
    JOINING
    SUCCESS

Failure states:

    INVALID_CODE
    ROOM_FULL
    GAME_ALREADY_STARTED
    ROOM_EXPIRED
    NETWORK_ERROR

Successful join:

    join room
        ↓
    /lobby/:roomId

---

# 5. Lobby

Route:

    /lobby/:roomId

The lobby is a real-time multiplayer screen.

Responsibilities:

- display room information
- display room code
- display current players
- display current player count
- identify host
- display game configuration
- allow host to configure settings
- allow host to start game
- allow player to leave
- reflect player joins/leaves in real time

Primary states:

    HOST
    GUEST

Player states:

    PRESENT
    DISCONNECTED
    LEFT

Lobby events may produce UI states such as:

    PLAYER_JOINED
    PLAYER_LEFT
    HOST_TRANSFERRED

Host controls:

    EDIT_SETTINGS
    START_GAME
    LEAVE_ROOM

Guest controls:

    VIEW_SETTINGS
    LEAVE_ROOM

Guests cannot start the game.

---

# 6. Game

Route:

    /game/:roomId

This is the core gameplay route.

The same route serves both:

    DRAWER
    GUESSER

The role is determined by authoritative server state.

---

# 7. Game Modes

## 7.1 Drawer

The drawer receives:

- secret word
- drawing canvas
- timer
- drawing tools
- hint availability
- current score
- player/game information

The drawer cannot submit guesses for their own word.

Drawer UI states include:

    NORMAL
    LOW_TIMER
    FINAL_SECONDS

    HINT_AVAILABLE
    HINT_USED

    COLOR_PICKER_OPEN
    BRUSH_SIZE_OPEN
    CLEAR_CONFIRMATION

    CHAT_COLLAPSED
    CHAT_EXPANDED

    DISCONNECTED
    RECONNECTING
    RECONNECTED
    RECONNECT_FAILED

These are UI/game states of:

    /game/:roomId

They are NOT separate routes.

---

# 8. Guesser

The guesser receives:

- drawing canvas
- masked word
- timer
- chat
- guess input
- score
- player information

Guesser states include:

    NORMAL
    WRONG_GUESS
    CLOSE_GUESS
    CORRECT_GUESS
    ALREADY_GUESSED

    HINT_REVEALED

    LOW_TIMER
    FINAL_SECONDS

    CHAT_COLLAPSED
    CHAT_EXPANDED

    DISCONNECTED
    RECONNECTING
    RECONNECTED

These are states of:

    /game/:roomId

---

# 9. Game State

The authoritative game state follows:

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

The client MUST NOT independently transition the authoritative game state.

The server owns authoritative game-state transitions.

---

# 10. Game Start

The production sequence is:

    Lobby
        ↓
    Host presses START GAME
        ↓
    Server validates request
        ↓
    STARTING
        ↓
    countdown
        ↓
    server selects drawer
        ↓
    server selects word
        ↓
    ROUND_ACTIVE

Drawer receives:

    secretWord

Other players receive:

    maskedWord

The secret word MUST NOT be sent to guessers.

---

# 11. Drawing

Drawing is part of:

    /game/:roomId

The drawing system uses operations rather than repeatedly sending complete canvas screenshots.

Conceptual drawing operations:

    DRAW_START
    DRAW_MOVE
    DRAW_END

The server distributes drawing events to connected players.

The mobile client is responsible for:

- touch/pointer input
- rendering
- local drawing interaction
- tool selection

The server remains responsible for authoritative game state.

---

# 12. Guessing

Guess submission occurs inside:

    /game/:roomId

The user enters a guess through the game chat/guess interface.

Client sends a guess request.

Server:

    normalizes guess
        ↓
    checks correctness
        ↓
    checks whether player already guessed correctly
        ↓
    records correct-guess order
        ↓
    determines ranking
        ↓
    calculates score
        ↓
    broadcasts resulting state/events

The client MUST NOT determine authoritative correctness or score.

---

# 13. Chat

Chat is a subsystem of the game.

It is NOT a separate navigation route.

Structure:

    /game/:roomId
        └── Chat

Chat states:

    COLLAPSED
    EXPANDED

Message types:

    GUESS
    NORMAL
    SYSTEM
    CORRECT_GUESS

Additional UI states:

    MUTED
    RATE_LIMITED
    PROFANITY_FILTERED

Chat must remain visually accessible without unnecessarily destroying drawing canvas space.

---

# 14. Timer

The game timer is authoritative server state.

The server owns:

    roundEndTime

The client calculates/displays remaining time using synchronized server state.

The client MUST NOT decide authoritative round completion solely because its local timer reached zero.

Visual timer states:

    NORMAL
    LOW
    FINAL_SECONDS
    EXPIRED

---

# 15. Hints

Hints are part of the active game.

States:

    AVAILABLE
    REQUESTING
    REVEALED
    EXHAUSTED

The server determines the hint result.

A hint must not immediately reveal the complete answer.

Example:

    Initial:
    _ _ _ _ _ _ _ _

    Hint 1:
    _ _ E _ _ _ _ _

    Hint 2:
    _ _ E P _ _ _ _

---

# 16. Round Result

Route:

    /round-result/:roomId

Responsibilities:

- display completed round
- display word/result information
- display correct-guess ranking
- display points
- display updated leaderboard
- show next-drawer transition
- transition into the next round

Visual states may include:

    ROUND_OVER
    SCORE_REVEAL
    NEXT_DRAWER
    NEXT_ROUND

---

# 17. Next Drawer

Next drawer selection is a game transition.

It should not create a new route.

Flow:

    ROUND_FINISHED
        ↓
    score/result presentation
        ↓
    next drawer selected by server
        ↓
    transition
        ↓
    ROUND_ACTIVE

The same player should not unnecessarily receive consecutive turns when other eligible players are available.

---

# 18. Final Result

Route:

    /final-result/:roomId

Responsibilities:

- final ranking
- final scores
- player positions
- winner
- Play Again
- Return Home

States:

    FINAL_RESULTS
    PLAY_AGAIN
    RETURN_HOME

---

# 19. Play Again

Play Again returns players to another playable session using the existing room context where the server supports this behavior.

Important domain distinction:

    Room
    ≠
    Game
    ≠
    Round

A room is the multiplayer container.

A game is a complete sequence of rounds.

A round is one drawer/word/drawing/guessing cycle.

This distinction MUST be preserved in the implementation.

---

# 20. Settings

Route:

    /settings

Responsibilities:

- sound
- music
- vibration
- privacy
- terms
- about
- age/content information

Settings are independent of the active game.

---

# 21. Connection States

Connection state is cross-cutting.

It should generally be represented through:

- banners
- overlays
- modals
- inline status
- reconnecting UI

rather than separate navigation routes.

---

## 21.1 Guesser Disconnect

Behavior:

    GUESSER DISCONNECTS
        ↓
    game continues
        ↓
    player may reconnect

---

## 21.2 Drawer Disconnect

Behavior:

    DRAWER DISCONNECTS
        ↓
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
    continue current round

---

# 22. Room/Error States

These are generally states of existing screens rather than independent routes.

Examples:

    INVALID_CODE
    ROOM_FULL
    GAME_ALREADY_STARTED
    ROOM_EXPIRED
    SERVER_ERROR
    NETWORK_ERROR

Example:

    /join-room
        ├── normal
        ├── invalid code
        ├── room full
        ├── game already started
        └── loading

NOT:

    /invalid-code
    /room-full
    /game-started

unless a future UX requirement explicitly demands a dedicated route.

---

# 23. Moderation

Moderation actions remain inside the game context.

Examples:

    MUTE_PLAYER
    KICK_PLAYER
    REPORT_PLAYER
    PROFANITY_FILTER
    RATE_LIMIT

Typical interaction:

    Game
      ↓
    Player context menu
      ├── Mute
      ├── Report
      └── Host → Kick

These should generally use:

    BottomSheet
    Modal
    Toast
    Inline feedback

rather than navigation routes.

---

# 24. Production Navigation Summary

Final production routes:

    /
    /nickname
    /create-room
    /join-room
    /lobby/:roomId
    /game/:roomId
    /round-result/:roomId
    /final-result/:roomId
    /settings

No production route should exist solely because a Figma screen exists.

---

# 25. Screen vs State Rule

Use this rule throughout the project:

IF a visual difference changes the user's destination:
    consider a route.

IF a visual difference changes the state of the current experience:
    use application/UI state.

Examples:

    Home → Create Room
    = route

    Game → Drawer
    = state

    Game → Guesser
    = state

    Game → Correct Guess
    = state/overlay

    Game → Low Timer
    = state

    Game → Chat Expanded
    = UI state

    Join → Invalid Code
    = screen state

    Lobby → Player Joined
    = realtime state/event

---

# 26. Bottom Prototype Navigation

The Figma export contains a temporary bottom navigation bar used only to make development/prototype navigation easier.

This navigation is NOT part of production.

It MUST NOT be implemented as application navigation.

Production navigation is defined only by this document.

---

# 27. Figma Design-System Screen

The final Figma screen containing:

- boxes
- buttons
- typography
- text styles
- components
- templates
- design references

is a DESIGN REFERENCE.

It is not an application route or user-facing screen.

---

# 28. V1 Scope Boundary

Included:

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
- guess processing
- hints
- timer
- scoring
- multiple rounds
- final scoreboard
- reconnection
- basic anti-cheat
- basic moderation

Explicitly outside V1:

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
- microservices architecture

Do not implement V2/V3 features merely because they appear desirable.

---

# 29. Architectural Principle

DoodleBee follows this rule:

    Figma
        ↓
    defines what the user sees

    PRD
        ↓
    defines required product behavior

    Server
        ↓
    defines authoritative game truth

    Client
        ↓
    renders server truth and handles local interaction

The client must never become the authority for:

- drawer selection
- secret word
- round state
- timer completion
- guess correctness
- guess ranking
- score
- game completion

---

# 30. Definition of Done for Stage 1

Stage 1 is complete when:

[ x ] Production routes are defined
[ x ] Figma screens are separated from production routes
[ x ] Game roles are defined
[ x ] Drawer and Guesser are modeled as game states
[ x ] Error states are modeled as screen states
[ x ] Connection states are modeled as cross-cutting states
[ x ] Round/game/room distinction is established
[ x ] V1 scope boundary is established
[ x ] Prototype-only bottom navigation is excluded
[ x ] Design-system reference screen is excluded from production navigation

Status:

    STAGE 1 — APPROVED