# DoodleBee — Agent Operating Rules

**Document:** Agents.md
**Version:** V1
**Status:** REQUIRED
**Applies To:** Claude Code, Codex, Nara CLI, MCP agents, future coding agents

---

# 1. Mission

Agents are implementation and research workers for DoodleBee.

Agents MUST NOT silently redefine product requirements or architecture.

Human/project-owner decisions and approved project documents have priority.

Primary sources:

1. docs/projectInfo.md
2. docs/01-information-architecture.md
3. docs/01-screen-state-map.md
4. docs/Design.md
5. stage-specific architecture documents
6. Draw_and_Guess_PRD.pdf

When a conflict exists:

    Source/approved decision
        >
    architecture contract
        >
    agent assumption

Agents MUST surface conflicts instead of silently resolving them.

---

# 2. Agent Roles

## Claude Code

Primary role:

- implementation
- repository changes
- feature development
- refactoring
- tests
- documentation
- Figma/MCP UI implementation where applicable
- integration work

Claude Code may implement approved architecture.

Claude Code MUST NOT independently redesign the architecture.

---

## Codex

Primary role:

- code review
- architecture review
- correctness review
- security review
- test review
- bug detection
- implementation validation
- alternative implementation research

Codex should challenge assumptions and identify problems.

Codex does not automatically modify architecture unless explicitly instructed.

---

## Nara CLI

Primary role:

- CLI/tooling assistance
- environment inspection
- repository inspection
- MCP/tool orchestration where configured
- build/test execution
- developer workflow automation
- diagnostics

Nara MUST NOT introduce product behavior merely because a tool makes it convenient.

---

## Human / Project Owner

The human owns:

- product decisions
- final architecture decisions
- scope decisions
- technology acceptance/rejection
- design approval
- release decisions

---

## ChatGPT / Architecture Lead

Role:

- architecture planning
- requirements interpretation
- contract design
- agent prompt generation
- cross-agent consistency
- review
- decision documentation
- identifying conflicts between PRD, Figma and implementation
- maintaining architectural coherence

---

# 3. Agent Priority

When multiple agents are working:

    Correctness
        >
    Security
        >
    Requirements
        >
    Architecture consistency
        >
    Maintainability
        >
    Performance
        >
    Developer convenience

Do not sacrifice correctness for speed of implementation.

---

# 4. Required Workflow

Every meaningful task follows:

    READ
      ↓
    PLAN
      ↓
    IMPLEMENT / RESEARCH
      ↓
    TEST
      ↓
    REVIEW
      ↓
    DOCUMENT
      ↓
    REPORT

Agents must not jump directly from request to implementation for architecture-sensitive tasks.

---

# 5. Before Coding

Agent MUST inspect:

- relevant docs
- current repository structure
- package configuration
- existing implementation
- environment configuration
- tests
- stage-specific instructions

Do not assume the repository is empty.

Do not overwrite existing work without inspection.

---

# 6. Before Changing Architecture

The agent must identify:

1. Current architecture
2. Proposed change
3. Why change is needed
4. Alternatives considered
5. Impact
6. Migration requirement
7. Testing requirement

Architecture-changing work must be recorded in:

    docs/agent-runs/<stage>/architecture-decision.md

---

# 7. No Silent Scope Expansion

Agents MUST NOT add:

- voice chat
- video chat
- matchmaking
- friends
- clans
- tournaments
- social accounts
- AI word generation
- AI drawing generation
- cosmetic marketplace
- pay-to-win mechanics
- microservices

unless explicitly approved.

These are outside V1.

---

# 8. No Microservices for V1

The PRD explicitly recommends a single backend service for V1.

Do not introduce:

- Kubernetes
- Kafka
- service mesh
- independent microservices
- distributed event infrastructure

unless a documented architecture decision explicitly approves a change.

---

# 9. Server Authority

Never trust the client for:

- drawer selection
- secret word
- player role
- round state
- round completion
- timer completion
- guess correctness
- guess ranking
- score
- final game completion

Client:

    requests
    renders
    interacts

Server:

    decides
    validates
    calculates
    broadcasts

---

# 10. Secret Information

The secret word MUST only be available to the drawer.

Agents MUST NOT:

- place the secret word in public game state
- broadcast the secret word to all clients
- log the secret word unnecessarily
- expose the secret word in client debugging output
- persist the secret word where unnecessary

---

# 11. TypeScript Rules

Use TypeScript strictly.

Avoid:

    any

unless there is a documented reason.

Prefer:

- explicit types
- discriminated unions
- readonly data where appropriate
- domain types
- schema validation
- type-safe event contracts

---

# 12. Validation

Use schema validation at boundaries.

The PRD specifies Zod.

Validate:

- API input
- WebSocket messages
- room configuration
- room codes
- nickname input
- chat messages
- drawing event payloads
- server event payloads

Never trust external input.

---

# 13. Error Handling

No silent failures.

Errors must:

- be typed where practical
- be logged appropriately
- produce user-safe UI feedback
- avoid exposing secrets/internal infrastructure details

Do not show:

- stack traces
- database errors
- Redis errors
- internal hostnames
- secrets
- tokens

to users.

---

# 14. Networking

REST is for request/response operations.

WebSocket/Socket.IO is for realtime game state and events.

Do not implement realtime gameplay through polling unless explicitly approved.

---

# 15. WebSocket Rules

All events require:

- event name
- direction
- payload schema
- authorization rule
- validation
- expected client behavior
- server behavior
- idempotency strategy where applicable
- error behavior

Do not create undocumented WebSocket events.

---

# 16. Drawing Rules

Do not transmit complete screenshots for every drawing update.

Use discrete drawing operations:

    DRAW_START
    DRAW_MOVE
    DRAW_END

The PRD explicitly requires this model.

Optimize drawing traffic carefully.

Do not sacrifice drawing smoothness unnecessarily.

---

# 17. State Management Rules

Separate:

## Server/game state

Examples:

- room
- players
- game
- round
- scores
- timer
- drawer

## Local UI state

Examples:

- chat expanded
- color picker open
- bottom sheet open
- modal open
- animation state

Do not put every UI flag into global state.

Do not duplicate server truth unnecessarily in local state.

---

# 18. Navigation Rules

Figma contains approximately 61 visual states.

They are NOT 61 production routes.

Use approved production routes from:

    docs/01-information-architecture.md

The temporary Figma bottom navigation is NOT production navigation.

The design-system/reference screen is NOT a production screen.

---

# 19. Component Rules

Prefer reusable components.

Examples:

- Button
- Input
- PlayerCard
- Badge
- Timer
- ChatMessage
- Modal
- BottomSheet
- Toast
- DrawingToolbar

Do not create near-duplicate components without justification.

---

# 20. UI Implementation Rules

Implement from the approved Figma design.

Do not:

- redesign screens
- change colors arbitrarily
- replace typography arbitrarily
- introduce new navigation
- add random gradients
- add fake emojis
- add generic stock graphics
- invent UI flows

If Figma is technically ambiguous:

    document ambiguity
        ↓
    propose solution
        ↓
    ask/record decision
        ↓
    implement

---

# 21. Testing

Code is not complete when it compiles.

Required testing depends on feature.

At minimum:

- unit tests
- integration tests
- multiplayer tests
- failure tests

Required multiplayer coverage:

    2 players
    4 players
    8 players

---

# 22. Required Failure Testing

Test:

- drawer disconnect
- guesser disconnect
- host disconnect
- internet disappears
- internet returns
- server restart
- simultaneous guesses
- duplicate guess
- room full
- invalid room code
- duplicate events
- spam messages

---

# 23. Documentation Requirement

Every architecture-sensitive agent task MUST produce documentation.

Minimum:

    docs/agent-runs/<stage>/<agent-task>.md

Each record must contain:

    Date
    Agent
    Prompt
    Context
    Files inspected
    Work performed
    Files changed
    Tests executed
    Results
    Problems
    Decisions
    Follow-up work

---

# 24. No Fake Completion

Agents MUST NOT say:

    "Done"

unless the requested work was actually completed and validated.

If something could not be completed:

    report it explicitly.

---

# 25. No Fake Tests

Never claim a test passed unless it was actually executed.

Never invent:

- benchmark results
- load-test results
- device-test results
- network measurements
- security results

---

# 26. Dependency Rules

Do not add a dependency simply because it is popular.

Before adding a major dependency:

- identify purpose
- check compatibility
- assess bundle/runtime impact
- assess maintenance
- assess Expo compatibility
- document decision

---

# 27. Environment Rules

Never hardcode:

- API secrets
- database credentials
- Redis credentials
- JWT secrets
- production tokens
- private keys

Use environment-based configuration.

Never commit secrets.

---

# 28. Git Rules

Prefer small focused commits.

Commit messages should describe intent.

Examples:

    feat(game): add authoritative round state
    feat(canvas): synchronize drawing operations
    fix(room): prevent joining full rooms
    test(scoring): cover simultaneous guesses

Do not mix unrelated changes.

---

# 29. Agent Handoff

When an agent finishes:

    summarize
    ↓
    list changed files
    ↓
    list tests
    ↓
    list known limitations
    ↓
    update stage log

The next agent must be able to continue without asking:

"What did the previous agent do?"

---

# 30. Definition of Agent Done

A task is DONE only when:

[ ] Requirements understood
[ ] Existing code inspected
[ ] Implementation completed
[ ] Tests added/updated
[ ] Tests executed
[ ] No known regression
[ ] Documentation updated
[ ] Agent run recorded
[ ] Remaining risks documented

---

# 31. Golden Rule

DO NOT OPTIMIZE FOR:

"How quickly can I write code?"

OPTIMIZE FOR:

"How safely can I move DoodleBee toward a production-ready multiplayer game?"