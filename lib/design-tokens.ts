/**
 * Synthex Design Tokens
 * @description Centralized design system tokens for consistent UI/UX
 * @version 2.0.0
 */

// ============================================================================
// COLORS
// ============================================================================
export const colors = {
  // Primary brand colors
  primary: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
    950: '#2e1065',
  },
  
  // Accent colors
  accent: {
    violet: '#8b5cf6',
    fuchsia: '#d946ef',
    cyan: '#06b6d4',
    amber: '#f59e0b',
    rose: '#f43f5e',
    emerald: '#10b981',
  },
  
  // Semantic colors
  semantic: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  
  // Grayscale
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },
  
  // Dark mode specific
  dark: {
    background: '#0f172a',
    surface: '#1e293b',
    surfaceHover: '#334155',
    border: '#334155',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
  }
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    display: ['Inter', 'system-ui', 'sans-serif'],
  },
  
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
    '6xl': '3.75rem',   // 60px
  },
  
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  }
} as const;

// ============================================================================
// SPACING
// ============================================================================
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',    // 2px
  1: '0.25rem',       // 4px
  1.5: '0.375rem',    // 6px
  2: '0.5rem',        // 8px
  2.5: '0.625rem',    // 10px
  3: '0.75rem',       // 12px
  3.5: '0.875rem',    // 14px
  4: '1rem',          // 16px
  5: '1.25rem',       // 20px
  6: '1.5rem',        // 24px
  7: '1.75rem',       // 28px
  8: '2rem',          // 32px
  9: '2.25rem',       // 36px
  10: '2.5rem',       // 40px
  12: '3rem',         // 48px
  14: '3.5rem',       // 56px
  16: '4rem',         // 64px
  20: '5rem',         // 80px
  24: '6rem',         // 96px
  28: '7rem',         // 112px
  32: '8rem',         // 128px
  36: '9rem',         // 144px
  40: '10rem',        // 160px
  44: '11rem',        // 176px
  48: '12rem',        // 192px
  52: '13rem',        // 208px
  56: '14rem',        // 224px
  60: '15rem',        // 240px
  64: '16rem',        // 256px
  72: '18rem',        // 288px
  80: '20rem',        // 320px
  96: '24rem',        // 384px
} as const;

// ============================================================================
// BREAKPOINTS
// ============================================================================
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================
export const borderRadius = {
  none: '0',
  sm: '0.125rem',     // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',     // 6px
  lg: '0.5rem',       // 8px
  xl: '0.75rem',      // 12px
  '2xl': '1rem',      // 16px
  '3xl': '1.5rem',    // 24px
  full: '9999px',
} as const;

// ============================================================================
// SHADOWS
// ============================================================================
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: 'none',
  // Glow effects
  glow: '0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(139, 92, 246, 0.1)',
  'glow-lg': '0 0 30px rgba(139, 92, 246, 0.5), 0 0 60px rgba(139, 92, 246, 0.2)',
  'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.3), 0 0 40px rgba(6, 182, 212, 0.1)',
} as const;

// ============================================================================
// ANIMATION TIMING
// ============================================================================
export const animation = {
  duration: {
    fastest: '100ms',
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
    slowest: '500ms',
  },
  
  easing: {
    linear: 'linear',
    ease: 'ease',
    'ease-in': 'ease-in',
    'ease-out': 'ease-out',
    'ease-in-out': 'ease-in-out',
    // Custom cubic bezier curves
    'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
    'snappy': 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
  
  delay: {
    none: '0ms',
    fast: '50ms',
    normal: '100ms',
    slow: '200ms',
  }
} as const;

// ============================================================================
// Z-INDEX SCALE
// ============================================================================
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// ============================================================================
// GLASS MORPHISM PRESETS (Unified v3.0)
// These values map to CSS custom properties defined in globals.css
// ============================================================================
export const glass = {
  /** Base tier - subtle, minimal glass effect */
  base: {
    background: 'var(--glass-bg-base)',        // rgba(255, 255, 255, 0.02)
    border: 'var(--glass-border-subtle)',      // rgba(255, 255, 255, 0.06)
    blur: 'var(--glass-blur-md)',              // 12px
  },
  /** Elevated tier - standard components */
  elevated: {
    background: 'var(--glass-bg-elevated)',    // rgba(255, 255, 255, 0.05)
    border: 'var(--glass-border-default)',     // rgba(255, 255, 255, 0.1)
    blur: 'var(--glass-blur-xl)',              // 20px
  },
  /** Premium tier - hero sections, featured content */
  premium: {
    background: 'var(--glass-bg-premium)',     // rgba(255, 255, 255, 0.08)
    border: 'var(--glass-border-prominent)',   // rgba(255, 255, 255, 0.15)
    blur: 'var(--glass-blur-xl)',              // 20px
  },
  /** Solid glass - dark background variant */
  solid: {
    background: 'var(--glass-bg-solid)',       // rgba(15, 23, 42, 0.8)
    border: 'var(--glass-border-default)',     // rgba(255, 255, 255, 0.1)
    blur: 'var(--glass-blur-xl)',              // 20px
  },
  // Legacy aliases for backward compatibility
  light: {
    background: 'rgba(255, 255, 255, 0.7)',
    border: 'rgba(255, 255, 255, 0.5)',
    blur: '12px',
  },
  dark: {
    background: 'rgba(15, 23, 42, 0.7)',
    border: 'rgba(255, 255, 255, 0.1)',
    blur: '12px',
  },
} as const;

// ============================================================================
// GRADIENT PRESETS
// ============================================================================
export const gradients = {
  primary: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
  secondary: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  success: 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)',
  warning: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  error: 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)',
  dark: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  mesh: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 50%, #06b6d4 100%)',
} as const;

// ============================================================================
// COMPONENT-SPECIFIC TOKENS
// ============================================================================
export const componentTokens = {
  button: {
    height: {
      sm: '2rem',      // 32px
      md: '2.5rem',    // 40px
      lg: '3rem',      // 48px
    },
    padding: {
      sm: '0 0.75rem',
      md: '0 1rem',
      lg: '0 1.5rem',
    }
  },
  
  input: {
    height: {
      sm: '2rem',
      md: '2.5rem',
      lg: '3rem',
    },
    padding: {
      sm: '0 0.625rem',
      md: '0 0.75rem',
      lg: '0 1rem',
    }
  },
  
  card: {
    padding: {
      sm: '1rem',
      md: '1.5rem',
      lg: '2rem',
    },
    gap: {
      sm: '0.75rem',
      md: '1rem',
      lg: '1.5rem',
    }
  }
} as const;

// ============================================================================
// DARK MODE OVERRIDES
// ============================================================================
export const darkModeOverrides = {
  colors: {
    background: colors.dark.background,
    foreground: colors.dark.text,
    muted: colors.gray[700],
    'muted-foreground': colors.gray[400],
    border: colors.dark.border,
  }
} as const;

// Export all tokens as a single object for convenience
export const designTokens = {
  colors,
  typography,
  spacing,
  breakpoints,
  borderRadius,
  shadows,
  animation,
  zIndex,
  glass,
  gradients,
  componentTokens,
  darkModeOverrides,
} as const;

export default designTokens;
