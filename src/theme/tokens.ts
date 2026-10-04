/**
 * DoodleBee Design Tokens.
 *
 * Authoritative source: the approved Figma Make design system
 * (fileKey `Dawg8P0YDyqCvAbwdUZ9Qv`, `src/index.css` `@theme` block plus the
 * `.btn-comic`, `.sticker` and `.paper-dots` primitives).
 *
 * Per ADR AD-010 components consume tokens only - no raw colors, spacing,
 * radii or timings in component files.
 */

export const fonts = {
  /** Display / headings / buttons - Paytone One. */
  game: 'PaytoneOne_400Regular',
  /** Body copy - Nunito. */
  sans: 'Nunito_400Regular',
  sansSemiBold: 'Nunito_600SemiBold',
  sansBold: 'Nunito_700Bold',
  sansExtraBold: 'Nunito_800ExtraBold',
} as const;

export const tokens = {
  colors: {
    // Base surfaces
    cream: '#FFF8ED',
    white: '#FFFFFF',
    outerBackdrop: '#120720',

    // Ink - borders, hard shadows, primary text
    ink: '#1A0A2E',

    // Brand accents
    purple: '#7C3AED',
    hotPink: '#F91F7A',
    beeYellow: '#FFD60A',
    mint: '#10B981',
    tangerine: '#FF6B35',
    electricBlue: '#3B82F6',

    // Mascot
    wing: '#CCF2FF',
    cheek: '#FFB3C6',

    // Neutrals
    stone: '#E3DBD5',
    muted: '#9A8FA8',
    borderLight: '#E5DCCF',

    // Translucent tints used by the approved Make screens (error banners,
    // highlight cards). They composite over the cream paper background the
    // same way the design's rgba() overlays do.
    tangerineWash: 'rgba(255,107,53,0.12)',
    purpleWash: 'rgba(124,58,237,0.14)',
    mintWash: 'rgba(16,185,129,0.14)',
    lavender: '#F3F0FF',

    // ---- Back-compat aliases used across the existing client ----
    background: '#FFF8ED',
    backgroundAlt: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFDF7',
    textPrimary: '#1A0A2E',
    textSecondary: '#5B4B6E',
    textMuted: '#9A8FA8',
    textInverse: '#FFF8ED',
    border: '#1A0A2E',
    primary: '#7C3AED',
    primaryDark: '#6425D0',
    secondary: '#F91F7A',
    accentYellow: '#FFD60A',
    accentMint: '#10B981',
    accentBlue: '#3B82F6',
    success: '#10B981',
    warning: '#FFD60A',
    danger: '#F91F7A',
    disabled: '#C9C2D6',
    timerNormal: '#1A0A2E',
    timerWarning: '#FFD60A',
    timerCritical: '#F91F7A',
  },

  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },

  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    card: 20,
    sheet: 28,
    full: 9999,
  },

  /** Comic border widths from `.btn-comic` (3) and `.sticker` (2.5). */
  border: {
    hairline: 1.5,
    sticker: 2.5,
    comic: 3,
  },

  /** Hard, un-blurred offset shadows from `.btn-comic` / `.sticker`. */
  hardShadow: {
    comic: 5,
    sticker: 3,
    comicPressed: 3,
    comicActive: 1,
  },

  typography: {
    logo: {
      fontFamily: fonts.game,
      fontSize: 26,
      lineHeight: 30,
      letterSpacing: 0.2,
    },
    display: {
      fontFamily: fonts.game,
      fontSize: 40,
      lineHeight: 42,
      letterSpacing: -0.4,
    },
    heading: {
      fontFamily: fonts.game,
      fontSize: 24,
      lineHeight: 28,
      letterSpacing: 0,
    },
    subheading: {
      fontFamily: fonts.game,
      fontSize: 19,
      lineHeight: 24,
      letterSpacing: 0.1,
    },
    body: {
      fontFamily: fonts.sans,
      fontSize: 15,
      lineHeight: 21,
      letterSpacing: 0,
    },
    bodyBold: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      lineHeight: 21,
      letterSpacing: 0,
    },
    button: {
      fontFamily: fonts.game,
      fontSize: 19,
      lineHeight: 22,
      letterSpacing: 0.6,
    },
    caption: {
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0,
    },
    label: {
      fontFamily: fonts.sansExtraBold,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 1.2,
    },
  },

  /** Durations mirroring the Make project keyframes. */
  motion: {
    popIn: 350,
    slideUp: 400,
    feedbackPop: 380,
    timerThrob: 700,
    floatBee: 3200,
    press: 80,
  },

  /** `.paper-dots` - cream base with a 22px dot grid. */
  paperDots: {
    spacing: 22,
    dotRadius: 1,
    dotColor: 'rgba(26,10,46,0.12)',
  },

  zIndex: {
    overlay: 100,
    modal: 200,
    bottomSheet: 300,
    toast: 400,
    connectionBanner: 500,
  },
} as const;

export type Token = typeof tokens;
