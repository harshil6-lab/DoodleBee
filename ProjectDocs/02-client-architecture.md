# DoodleBee V1 — Stage 2: Client Architecture

**Stage:** 02
**Status:** IN PROGRESS
**Owner:** Architecture Lead
**Implementation Agents:** Claude Code, Codex, Nara CLI

---

# 1. Objective

Define the production architecture of the DoodleBee Android/iOS client.

The architecture must:

- implement the approved Figma UI
- support all approved V1 states
- support realtime multiplayer gameplay
- support 8 players per room
- support reconnection
- separate server state from local UI state
- remain maintainable
- preserve TypeScript safety
- avoid unnecessary complexity

---

# 2. PRD Baseline

The PRD recommends:

    React Native
    Expo
    TypeScript
    Expo Router
    Zustand
    REST
    WebSocket / Socket.IO
    React Hook Form
    Zod
    Reanimated
    React Native-compatible drawing library

The drawing library must be evaluated before locking.

---

# 3. Proposed Client Layers

Initial architecture hypothesis:

    Presentation
        ↓
    Feature Components
        ↓
    Application State
        ↓
    Domain Models
        ↓
    API / Realtime Services
        ↓
    Transport

Potential structure:

    app/
    src/
        components/
        features/
        stores/
        domain/
        hooks/
        api/
        realtime/
        drawing/
        theme/
        validation/
        utils/

This is a proposal, not yet an irreversible decision.

---

# 4. Navigation

Use Expo Router.

Production routes:

    /
    /nickname
    /create-room
    /join-room
    /lobby/[roomId]
    /game/[roomId]
    /round-result/[roomId]
    /final-result/[roomId]
    /settings

Do not implement the Figma prototype bottom navigation.

---

# 5. State Categories

The client must distinguish:

## Server/game state

Examples:

    room
    players
    host
    game
    round
    drawer
    score
    timer
    maskedWord
    connection state

## Local UI state

Examples:

    chatExpanded
    selectedColor
    brushSize
    modal
    bottomSheet
    animation
    toast

## Session state

Examples:

    playerId
    nickname
    roomId
    session token/identity
    reconnect information

---

# 6. State Ownership Rule

Server state should have one authoritative synchronization path.

Do not allow:

    REST state
    WebSocket state
    local state

to independently become competing sources of truth.

Define how each piece of state enters and leaves the client.

---

# 7. Realtime Architecture

Realtime gameplay uses WebSocket or Socket.IO.

Required event families include:

    PLAYER_JOINED
    PLAYER_LEFT
    GAME_STARTED
    ROUND_STARTED
    DRAWER_SELECTED
    DRAW_START
    DRAW_MOVE
    DRAW_END
    GUESS_SUBMITTED
    GUESS_CORRECT
    HINT_REVEALED
    ROUND_ENDED
    SCORE_UPDATED
    GAME_FINISHED

The final contract is defined in a later stage.

---

# 8. Drawing Architecture

The drawing system must support:

    local touch input
    smooth rendering
    DRAW_START
    DRAW_MOVE
    DRAW_END
    remote rendering
    reconnection recovery

The exact drawing library must be evaluated before implementation is locked.

---

# 9. API Architecture

REST should handle request/response operations such as:

    session/player setup
    room creation
    room lookup/join
    room configuration
    settings where appropriate

Realtime gameplay belongs to WebSocket/Socket.IO.

Exact endpoints are NOT locked in Stage 2.

---

# 10. Forms

Use:

    React Hook Form
    +
    Zod

for complex validated forms.

Examples:

    nickname
    room creation
    room code

Simple UI controls do not need unnecessary form abstraction.

---

# 11. Animation

Use:

    React Native Reanimated

for approved interaction and game feedback.

Animation must not interfere with drawing performance.

---

# 12. Design Integration

Figma is the visual source of truth.

Implementation should:

- reproduce approved visual hierarchy
- use reusable components
- preserve design tokens
- support responsive dimensions
- support safe areas
- preserve mascot/brand identity

Do not redesign.

---

# 13. Agent Investigation Tasks

Stage 2 is intentionally agent-heavy.

Agents should investigate:

### TASK A
Expo Router architecture

### TASK B
Zustand store boundaries

### TASK C
React Query/server-state strategy if needed

### TASK D
WebSocket vs Socket.IO client implications

### TASK E
Drawing/canvas library options

### TASK F
React Native performance implications

### TASK G
Reconnect/session persistence

### TASK H
shared client/server type strategy

### TASK I
testing architecture

### TASK J
Expo/EAS constraints

---

# 14. Architecture Decision Requirement

Each investigated topic must produce:

    recommendation
    alternatives
    tradeoffs
    compatibility
    risks
    implementation impact

No technology should be selected merely because:

    "it is popular."

---

# 15. Stage 2 Outputs

Stage 2 must produce:

    client architecture diagram
    production folder structure
    navigation structure
    state ownership map
    Zustand store plan
    API client architecture
    realtime client architecture
    drawing architecture
    design-token architecture
    form/validation strategy
    error handling strategy
    persistence strategy
    testing strategy
    dependency list
    architecture decision record

---

# 16. Stage 2 Completion Gate

Stage 2 is complete only when:

[ ] Expo Router structure approved
[ ] Folder/module architecture approved
[ ] State ownership approved
[ ] Zustand boundaries approved
[ ] REST client strategy approved
[ ] WebSocket/Socket.IO client strategy approved
[ ] Drawing library selected
[ ] Reconnect strategy defined
[ ] Session persistence defined
[ ] Design token strategy defined
[ ] Error strategy defined
[ ] Testing architecture defined
[ ] Dependencies reviewed
[ ] Architecture decisions documented

---

# 17. Next Stage

After Stage 2:

    STAGE 3 — GAME STATE MACHINE

Stage 3 will define:

    room state
    game state
    round state
    player state
    drawer lifecycle
    timer lifecycle
    guess lifecycle
    scoring lifecycle
    disconnect lifecycle
    reconnect lifecycle
    host transfer
    round transitions
    game completion

Stage 3 becomes the backend/game-engine contract.