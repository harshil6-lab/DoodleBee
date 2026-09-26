/**
 * DoodleBee Design Tokens — centralized token system per Design.md §8.
 * All components consume these tokens — no hardcoded values in components.
 * Based on approved visual language: warm cream base, purple/pink/yellow accents.
 */

export const tokens = {
  colors: {
    // Background
    background: '#FAF7F0',
    backgroundAlt: '#FFFFFF',

    // Surface
    surface: '#FFFFFF',
    surfaceElevated: '#FEFCF8',

    // Text
    textPrimary: '#1A1A2E',
    textSecondary: '#4A4A6A',
    textMuted: '#8888A0',
    textInverse: '#FAF7F0',

    // Borders
    border: '#2D2D44',
    borderLight: '#E0DDD5',

    // Brand accents
    primary: '#7B2CBF',
    primaryDark: '#5A1D91',
    secondary: '#FF6B9D',
    accentYellow: '#FFD166',
    accentMint: '#06D6A0',
    accentBlue: '#118AB2',

    // Feedback
    success: '#06D6A0',
    warning: '#FFD166',
    danger: '#EF476F',
    disabled: '#C4C4C4',

    // Game-specific
    timerNormal: '#1A1A2E',
    timerWarning: '#FFD166',
    timerCritical: '#EF476F',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },

  radius: {
    sm: 8,
    md: 16,
    lg: 24,
    full: 9999,
  },

  typography: {
    display: {
      fontFamily: 'System',
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 1.1,
      letterSpacing: -0.5,
    },
    heading: {
      fontFamily: 'System',
      fontSize: 24,
      fontWeight: '700' as const,
      lineHeight: 1.2,
    },
    body: {
      fontFamily: 'System',
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 1.5,
    },
    caption: {
      fontFamily: 'System',
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 1.4,
    },
    button: {
      fontFamily: 'System',
      fontSize: 18,
      fontWeight: '700' as const,
      lineHeight: 1.2,
      letterSpacing: 0.3,
    },
  },

  animation: {
    durationFast: 150,
    durationNormal: 300,
    durationSlow: 500,
    easeOut: 'ease-out' as const,
    easeIn: 'ease-in' as const,
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
