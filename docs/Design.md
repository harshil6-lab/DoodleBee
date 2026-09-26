# DoodleBee — Design System & UI Implementation Contract

**Version:** V1
**Status:** FROZEN FOR IMPLEMENTATION

---

# 1. Purpose

This document defines how the approved DoodleBee Figma design must be translated into the mobile application.

Figma is the visual source of truth.

The approximately 61 exported Figma screens represent the approved V1 visual language and application states.

---

# 2. Product Personality

DoodleBee is:

- playful
- social
- competitive
- chaotic
- expressive
- youthful/adult
- college-friendly
- party-game oriented
- humorous

It is NOT:

- corporate
- enterprise
- educational
- sterile
- childish
- generic
- professional productivity software

---

# 3. Target Experience

The interface should make users feel:

    "I want to join."

    "I want to beat my friends."

    "One more round."

The product is intended for adult users and should maintain an adult social-party personality without relying on explicit sexual content.

---

# 4. Visual Language

Approved characteristics:

- warm cream/off-white base
- dark ink/deep purple outlines
- purple accents
- pink accents
- yellow accents
- mint/green accents
- blue accents
- rounded bold typography
- thick outlines
- playful cards
- doodle decorations
- hand-drawn visual accents
- sticker/comic language
- mischievous bee mascot

---

# 5. Mascot

The DoodleBee mascot is a recurring product character.

Use it for:

- splash
- loading
- success
- errors
- reconnecting
- celebration
- empty states
- transitions

Do not:

- distort the mascot
- replace it with unrelated characters
- use random stock illustrations
- create incompatible mascot styles

---

# 6. Background Decoration

Doodle decorations are part of the visual identity.

However:

Visual density must adapt to context.

Recommended:

    Splash        HIGH
    Home          HIGH
    Create/Join   MEDIUM-HIGH
    Lobby         MEDIUM
    Gameplay      MEDIUM-LOW
    Canvas        LOW
    Results       HIGH

The drawing canvas must remain the primary visual focus during active gameplay.

---

# 7. Typography

Typography should preserve:

- bold playful headings
- rounded display treatment
- highly readable body text
- strong button typography
- clear hierarchy

Do not replace approved fonts with arbitrary alternatives.

If the exact font is unavailable technically:

1. identify the approved font
2. determine licensing/availability
3. choose the closest compatible fallback
4. document the decision

---

# 8. Colors

Do not introduce arbitrary brand colors.

Use design tokens.

Required token categories:

    background
    surface
    textPrimary
    textSecondary
    border
    primary
    secondary
    success
    warning
    danger
    disabled

Game feedback may use stronger colors for:

- correct
- warning
- timeout
- disconnect
- celebration

---

# 9. Components

Build reusable components from the approved visual system.

Core components:

    Button
    Input
    PlayerCard
    Badge
    Avatar
    Timer
    Card
    Toast
    Modal
    BottomSheet
    ChatBubble
    ChatInput
    ScoreBadge
    LeaderboardRow
    DrawingToolbar
    ColorPicker
    BrushSizePicker
    MaskedWord
    SecretWordCard
    ConnectionBanner

---

# 10. Component Variants

Components should support variants rather than duplicated implementations.

Example:

Button:

    primary
    secondary
    ghost
    danger
    disabled
    loading

PlayerCard:

    normal
    host
    self
    drawer
    guessed
    disconnected
    winner

Timer:

    normal
    warning
    critical
    expired

---

# 11. Gameplay Design

Gameplay has two roles:

    DRAWER
    GUESSER

Drawer:

- secret word
- canvas
- tools
- hints
- timer
- score
- chat

Guesser:

- canvas
- masked word
- chat
- guess input
- timer
- score

The two experiences must remain visually distinguishable.

---

# 12. Drawing Canvas

The canvas is the visual center of gameplay.

Requirements:

- large usable area
- smooth interaction
- clear boundaries
- responsive sizing
- safe-area awareness
- minimal decorative interference

Do not cover the canvas with unnecessary UI.

---

# 13. Chat

Chat should be:

- readable
- compact by default
- expandable
- social
- visually connected to gameplay

Message types:

    normal
    guess
    system
    correct

Do not allow chat to permanently consume the majority of drawing space.

---

# 14. Game Feedback

Correct guesses should feel rewarding.

Use:

- score popups
- confetti
- doodle bursts
- mascot reactions
- celebratory typography

Wrong guesses should feel playful rather than punitive.

Examples:

    "Not quite 😂"
    "OOOH... CLOSE 👀"

---

# 15. Timer

Timer visual states:

    normal
    warning
    critical
    expired

Critical states can use stronger animation.

Do not rely solely on color to communicate urgency.

---

# 16. Error Design

Errors should feel:

- clear
- friendly
- actionable
- non-technical

Avoid exposing infrastructure terminology.

Bad:

    "Redis connection failed."

Good:

    "UH OH 📡"
    "Your connection disappeared."
    "RETRY"

---

# 17. Loading Design

Use the bee and playful motion.

Examples:

    "Finding your friends..."
    "Reconnecting..."
    "Hang tight while we buzz you in..."

Loading states must not feel like frozen screens.

---

# 18. Accessibility

Maintain:

- readable contrast
- usable touch targets
- readable timer
- readable chat
- clear states
- text alternatives where necessary
- state communication beyond color alone

---

# 19. Mobile Rules

Support:

- Android
- iOS
- different aspect ratios
- safe areas
- different densities
- small phones
- large phones

Do not hardcode a single device's dimensions.

---

# 20. Orientation

Follow the approved product orientation strategy.

Do not introduce alternate layouts unless required.

If implementation reveals a platform-specific issue:

    document
    reproduce
    propose
    review
    fix

---

# 21. Animations

Approved animation personality:

- playful
- quick
- expressive
- responsive

Use animations for:

- score changes
- correct guesses
- countdown
- transitions
- connection changes
- loading
- hints

Avoid:

- excessive animation
- long blocking animations
- animation that interferes with drawing
- animation that harms accessibility/performance

The PRD recommends React Native Reanimated.

---

# 22. Figma Bottom Navigation

The bottom navigation present in the Figma export is:

    DEVELOPMENT / PROTOTYPE ONLY

It MUST NOT be implemented in production.

---

# 23. Design-System Reference Screen

The final Figma design-system screen is:

    REFERENCE ONLY

It is not an application screen.

It defines examples of:

- buttons
- boxes
- typography
- templates
- components
- spacing
- styles

---

# 24. Design Restrictions

Agents MUST NOT:

- redesign approved screens
- change brand palette
- invent navigation
- introduce unrelated components
- use stock illustrations
- add fake decorative emojis randomly
- replace the bee mascot
- introduce glassmorphism as a new visual direction
- introduce enterprise dashboard patterns
- introduce childish kindergarten styling
- add excessive gradients
- add unnecessary bottom navigation

---

# 25. Design Allowances

Agents MAY:

- adapt spacing for device sizes
- use platform-safe-area adjustments
- improve keyboard handling
- improve accessibility
- optimize layout for small/large devices
- create reusable components
- convert Figma patterns into responsive components
- use platform-native behavior where required
- create loading/error variants when required by functionality
- add subtle motion consistent with the design system

---

# 26. Design Conflict Rule

If implementation conflicts with Figma:

DO NOT silently redesign.

Record:

    problem
    affected screen
    technical limitation
    proposed solution

Then resolve the conflict through an architecture/design decision.

---

# 27. Production Principle

Figma defines:

    visual appearance
    hierarchy
    interaction intent
    component style

Implementation defines:

    responsiveness
    state handling
    networking
    accessibility
    performance
    platform integration

Never confuse visual reference with backend behavior.

---

# 28. Final Rule

The application should feel like:

    "A real party game my friends would actually play."

Not:

    "A UI prototype wrapped around a backend."