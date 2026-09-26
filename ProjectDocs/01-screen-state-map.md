# DoodleBee V1 — Screen / State Map

**Version:** V1
**Status:** APPROVED

---

# 1. Purpose

This document maps the visual Figma states into production screens, UI states and major components.

The Figma export contains approximately 61 visual screens.

The application does NOT contain 61 navigation routes.

---

# 2. Home

Production route:

    /

Visual states:

    SPLASH
    HOME
    NICKNAME_EMPTY
    NICKNAME_READY

Primary components:

    AppLogo
    BeeMascot
    NicknameInput
    CreateRoomButton
    JoinRoomButton
    SettingsButton
    GameInfo

Actions:

    CREATE_ROOM
    JOIN_ROOM
    SETTINGS
    ENTER_NICKNAME

---

# 3. Nickname

Route:

    /nickname

States:

    EMPTY
    VALID
    INVALID
    SUBMITTING

Components:

    BackButton
    NicknameInput
    SuggestionChip
    ContinueButton

Actions:

    SET_NICKNAME
    CONTINUE

---

# 4. Create Room

Route:

    /create-room

States:

    DEFAULT
    VALIDATING
    CREATING
    CREATED
    ERROR

Fields:

    roomName
    maxPlayers
    rounds
    roundDuration
    hints

Components:

    RoomNameInput
    PlayerCapacitySelector
    RoundSelector
    DurationSelector
    HintSelector
    CreateRoomButton

Errors:

    INVALID_CONFIGURATION
    NETWORK_ERROR
    SERVER_ERROR

Success:

    navigate → /lobby/:roomId

---

# 5. Join Room

Route:

    /join-room

States:

    EMPTY
    ENTERING
    COMPLETE_CODE
    JOINING
    INVALID_CODE
    ROOM_FULL
    GAME_ALREADY_STARTED
    ROOM_EXPIRED
    NETWORK_ERROR

Components:

    RoomCodeInput
    JoinRoomButton
    ErrorBanner
    LoadingState
    BeeMascot

Actions:

    ENTER_CODE
    JOIN_ROOM
    RETRY

---

# 6. Lobby

Route:

    /lobby/:roomId

Core state:

    room
    players
    host
    gameConfig
    connection

Visual states:

    HOST
    GUEST
    PLAYER_JOINED
    PLAYER_LEFT
    HOST_TRANSFERRED
    ROOM_NOT_READY
    ROOM_READY
    LEAVING

Components:

    LobbyHeader
    RoomCodeCard
    CopyCodeButton
    ShareCodeButton
    PlayerGrid
    PlayerCard
    HostBadge
    GameSettingsCard
    StartGameButton
    LeaveRoomButton
    Toast

PlayerCard states:

    NORMAL
    HOST
    YOU
    DISCONNECTED
    WAITING

Actions:

    COPY_CODE
    SHARE_CODE
    EDIT_SETTINGS
    START_GAME
    LEAVE_ROOM

---

# 7. Game

Route:

    /game/:roomId

Core state:

    gameStatus
    round
    playerRole
    players
    score
    timer
    connection

Roles:

    DRAWER
    GUESSER

---

# 8. Drawer

Route:

    /game/:roomId

Role:

    DRAWER

States:

    NORMAL
    LOW_TIMER
    FINAL_SECONDS
    HINT_AVAILABLE
    HINT_USED
    COLOR_PICKER
    BRUSH_SIZE_PICKER
    CLEAR_CONFIRMATION
    CHAT_COLLAPSED
    CHAT_EXPANDED
    DISCONNECTED
    RECONNECTING
    RECONNECTED
    RECONNECT_FAILED

Components:

    GameHeader
    RoundIndicator
    Timer
    ScoreBadge
    SecretWordCard
    DrawingCanvas
    DrawingToolbar
    BrushButton
    EraserButton
    ColorButton
    BrushSizeButton
    MoreToolsButton
    ClearButton
    HintButton
    ChatPreview
    ChatPanel

Drawer restrictions:

    CANNOT_GUESS_OWN_WORD

---

# 9. Guesser

Route:

    /game/:roomId

Role:

    GUESSER

States:

    NORMAL
    WRONG_GUESS
    CLOSE_GUESS
    CORRECT_GUESS
    ALREADY_GUESSED
    HINT_REVEALED
    LOW_TIMER
    FINAL_SECONDS
    TIME_UP
    CHAT_COLLAPSED
    CHAT_EXPANDED
    DISCONNECTED
    RECONNECTING
    RECONNECTED

Components:

    GameHeader
    RoundIndicator
    Timer
    ScoreBadge
    DrawingCanvas
    MaskedWord
    ChatPanel
    GuessInput
    SendGuessButton
    GuessFeedback
    CorrectGuessCelebration

---

# 10. Drawing

DrawingCanvas is shared between Drawer and Guesser.

Drawer:

    editable

Guesser:

    read-only synchronized rendering

Drawer tools:

    BRUSH
    ERASER
    COLOR
    BRUSH_SIZE
    CLEAR

Drawing event model:

    DRAW_START
    DRAW_MOVE
    DRAW_END

Do not transmit full screenshots for every drawing update.

---

# 11. Chat

Chat is embedded inside Game.

States:

    COLLAPSED
    EXPANDED

Message types:

    NORMAL
    GUESS
    SYSTEM
    CORRECT_GUESS

Additional states:

    MUTED
    RATE_LIMITED
    PROFANITY_FILTERED

Components:

    ChatPreview
    ChatPanel
    ChatMessage
    ChatInput
    SendButton
    SystemMessage
    CorrectGuessMessage

---

# 12. Guess Feedback

States:

    WRONG
    CLOSE
    CORRECT
    ALREADY_GUESSED

Wrong:

    "Not quite"

Close:

    "OOOH... CLOSE"

Correct:

    display rank
    display points
    celebration

Example:

    NAILED IT!
    +500
    1ST GUESS

Already guessed:

    disable further guessing

---

# 13. Correct Guess Celebration

This is an overlay/state.

It is NOT a route.

Data:

    player
    rank
    points

Visual:

    modal/overlay
    confetti
    score animation
    bee reaction

After celebration:

    player remains in current round
    unless round has ended

---

# 14. Hints

States:

    AVAILABLE
    REQUESTING
    REVEALED
    EXHAUSTED

Data:

    hintsRemaining
    maskedWord

Example:

    _ _ _ _ _ _ _ _

then:

    _ _ E _ _ _ _ _

then:

    _ _ E P _ _ _ _

Hint result comes from the server.

---

# 15. Timer

States:

    NORMAL
    LOW
    FINAL_SECONDS
    EXPIRED

The client renders the authoritative timer.

The server owns:

    roundEndTime

The client MUST NOT authoritatively end the round.

---

# 16. Round Result

Route:

    /round-result/:roomId

States:

    ROUND_OVER
    SCORE_REVEAL
    LEADERBOARD
    NEXT_DRAWER
    TRANSITION

Components:

    RoundResultHeader
    WordResult
    DrawingPreview
    GuessRanking
    ScoreChange
    Leaderboard
    NextDrawerCard
    NextRoundTransition

---

# 17. Final Result

Route:

    /final-result/:roomId

States:

    WINNER
    FINAL_LEADERBOARD
    PLAY_AGAIN
    RETURN_HOME

Components:

    WinnerCard
    FinalLeaderboard
    PlayerFinalScore
    PlayAgainButton
    ReturnHomeButton

---

# 18. Connection

Connection state is global/cross-cutting.

States:

    CONNECTED
    DISCONNECTED
    RECONNECTING
    RECONNECTED
    RECONNECT_FAILED

Guesser disconnect:

    game continues

Drawer disconnect:

    grace period
        ↓
    reconnect → continue
    timeout → round ends → new drawer

UI presentation:

    banner
    modal
    overlay
    inline status

Avoid dedicated navigation routes for these states.

---

# 19. Moderation

Game context:

    PlayerContextMenu

Actions:

    MUTE
    REPORT
    KICK

Host-only:

    KICK

UI:

    BottomSheet
    ConfirmationModal
    Toast

Chat protection:

    PROFANITY_FILTER
    RATE_LIMIT
    SPAM_PROTECTION

---

# 20. Settings

Route:

    /settings

Sections:

    Sound
    Music
    Vibration
    Privacy
    Terms
    About
    Age / Content Information

---

# 21. Temporary Figma Navigation

The Figma bottom navigation showing items such as:

    SPLASH
    HOME
    NAME
    READY
    CREATE
    CONFIGURED
    etc.

is development/prototype navigation only.

Production implementation:

    DO NOT BUILD IT.

---

# 22. Design-System Reference

The final Figma design-system/reference screen containing:

    buttons
    boxes
    typography
    fonts
    templates
    component examples

is not an application screen.

It exists only as a design reference.

---

# 23. Route Summary

Production routes:

    /
    /nickname
    /create-room
    /join-room
    /lobby/:roomId
    /game/:roomId
    /round-result/:roomId
    /final-result/:roomId
    /settings

---

# 24. Route Count

Production route count:

    9

Figma visual screens/states:

    ~61

Relationship:

    Many visual states
          ↓
    fewer production routes

This is intentional.

---

# 25. Implementation Rule

Never create a new navigation route merely because a new Figma frame exists.

First classify the frame as:

    ROUTE
    SCREEN STATE
    UI STATE
    OVERLAY
    MODAL
    BOTTOM SHEET
    TOAST
    TRANSITION
    DESIGN REFERENCE

Only ROUTE-level entities belong in production navigation.

---

# 26. Stage 1 Completion

Status:

    APPROVED

Next stage:

    STAGE 2 — CLIENT ARCHITECTURE