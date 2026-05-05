import { BrandConfig, FORBIDDEN_PRONOUNS } from '../types';

// STUB — customer brand. Refined by remotion-brand-research.
export const ccw: BrandConfig = {
  slug: 'ccw',
  legalName: 'Carpet Cleaners Warehouse',
  displayName: 'CCW',
  tagline: 'Trade prices. Same-day dispatch.',
  voice: {
    tone: ['warm', 'urgent'],
    forbiddenWords: [...FORBIDDEN_PRONOUNS, 'cheap', 'discounted'],
    requiredCadence: 'short',
  },
  colour: {
    primary: '#D62828',
    secondary: '#003049',
    accent: '#F77F00',
    neutral: { 50: '#FFFFFF', 100: '#F5F5F5', 500: '#737373', 900: '#1A1A1A' },
    semantic: { success: '#3FA34D', warning: '#E0A800', danger: '#7B0F0F' },
    family: 'consumer',
  },
  typography: {
    display: { family: 'Outfit', weight: 800, src: 'fonts/ccw/Outfit-ExtraBold.woff2' },
    body: { family: 'Inter', weight: 400, src: 'fonts/ccw/Inter-Regular.woff2' },
  },
  logo: {
    primary: 'logos/ccw/primary.svg',
    inverted: 'logos/ccw/inverted.svg',
    icon: 'logos/ccw/icon.svg',
    safeAreaPx: 32,
  },
  motion: {
    durations: { fast: 6, base: 14, slow: 28 },
    easing: {
      in: 'cubic-bezier(0.34, 1.56, 0.64, 1)',           // overshoot — retail energy
      out: 'cubic-bezier(0.36, 0, 0.66, -0.56)',
      inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    },
    signature: 'pulse',
    transitionFrames: 10,
  },
  voiceover: {
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    style: 'conversational',
    locale: 'en-AU',
  },
  doNot: [
    'never claim products are "the cheapest" — use "trade pricing" instead',
    'never use red type on coloured backgrounds (reserve red for hero/CTA)',
  ],
  audience: { primary: 'professional carpet cleaners and restoration trades (AU)' },
  defaultChannel: 'instagram',
};
