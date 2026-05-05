import { BrandConfig, FORBIDDEN_PRONOUNS } from '../types';

// STUB — refined by remotion-brand-research before first render.
export const unite: BrandConfig = {
  slug: 'unite',
  legalName: 'Unite Group',
  displayName: 'Unite Group',
  tagline: 'Connected service for the field.',
  voice: {
    tone: ['warm', 'expert'],
    forbiddenWords: [...FORBIDDEN_PRONOUNS],
    requiredCadence: 'medium',
  },
  colour: {
    primary: '#1D4ED8',     // blue — trust, network
    secondary: '#1E293B',
    accent: '#FBBF24',      // amber — signal
    neutral: { 50: '#F8FAFC', 100: '#E2E8F0', 500: '#64748B', 900: '#0F172A' },
    semantic: { success: '#16A34A', warning: '#D97706', danger: '#DC2626' },
    family: 'industrial',
  },
  typography: {
    display: { family: 'Inter', weight: 700, src: 'fonts/unite/Inter-Bold.woff2' },
    body: { family: 'Inter', weight: 400, src: 'fonts/unite/Inter-Regular.woff2' },
  },
  logo: {
    primary: 'logos/unite/primary.svg',
    inverted: 'logos/unite/inverted.svg',
    icon: 'logos/unite/icon.svg',
    safeAreaPx: 40,
  },
  motion: {
    durations: { fast: 10, base: 20, slow: 36 },
    easing: {
      in: 'cubic-bezier(0.22, 1, 0.36, 1)',
      out: 'cubic-bezier(0.64, 0, 0.78, 0)',
      inOut: 'cubic-bezier(0.83, 0, 0.17, 1)',
    },
    signature: 'rise',
    transitionFrames: 14,
  },
  voiceover: {
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    style: 'conversational',
    locale: 'en-AU',
  },
  doNot: [
    'never present Unite Group as a single-vertical company — it spans multiple service lines',
  ],
  audience: { primary: 'field-services operators across the Unite portfolio' },
  defaultChannel: 'linkedin',
};
