/**
 * Synthex UI Component Library
 * @description Comprehensive design system components for Synthex AI Platform
 * @version 2.0.0
 */

// ============================================================================
// FORM COMPONENTS
// ============================================================================
export * from './button';
export * from './input';
export * from './label';
export * from './textarea';
export * from './checkbox';
export * from './switch';
export * from './select';
export * from './radio-group';
export * from './slider';
export * from './form-field';

// ============================================================================
// OVERLAY COMPONENTS
// ============================================================================
export * from './dialog';
export * from './popover';
export * from './tooltip';
export * from './sheet';
export * from './alert';
export * from './toast';

// ============================================================================
// NAVIGATION COMPONENTS
// ============================================================================
export * from './dropdown-menu';
export * from './tabs';
export * from './command';
export * from './scroll-area';

// ============================================================================
// DISPLAY COMPONENTS
// ============================================================================
export * from './card';
export * from './badge';
export * from './avatar';
export * from './separator';
export * from './progress';
export * from './skeleton';
export * from './skeleton-extended';

// ============================================================================
// DATE & TIME COMPONENTS
// ============================================================================
export * from './calendar';
export * from './date-range-picker';

// ============================================================================
// DESIGN SYSTEM EXPORTS
// ============================================================================
export { cn } from '@/lib/utils';

// Animation variants for consistent motion
export const animationVariants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.3 }
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3 }
  },
  cardEntrance: {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
  }
} as const;

// Glass morphism utility classes
export const glassStyles = {
  base: 'bg-white/[0.02] backdrop-blur-xl border border-white/[0.06]',
  hover: 'hover:bg-white/[0.05] hover:border-white/[0.12]',
  solid: 'bg-slate-900/80 backdrop-blur-xl border border-white/[0.08]',
  gradient: 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl border border-white/[0.08]',
  button: 'bg-white/[0.05] backdrop-blur-md border border-white/[0.1] hover:bg-white/[0.1]',
  buttonPrimary: 'bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 backdrop-blur-md border border-violet-500/30'
} as const;

// Spacing scale
export const spacing = {
  xs: '0.5rem',    // 8px
  sm: '0.75rem',   // 12px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem'    // 64px
} as const;

// Border radius scale
export const radius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px'
} as const;

// Shadow scale
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  glow: '0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(139, 92, 246, 0.1)',
  'glow-lg': '0 0 30px rgba(139, 92, 246, 0.5), 0 0 60px rgba(139, 92, 246, 0.2)'
} as const;
