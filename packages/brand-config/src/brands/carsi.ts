import { BrandConfig, FORBIDDEN_PRONOUNS } from '../types';

// STUB — refined by remotion-brand-research.
export const carsi: BrandConfig = {
  slug: 'carsi',
  legalName: 'CARSI',
  displayName: 'CARSI',
  tagline: 'Inspection-led training.',
  voice: {
    tone: ['expert', 'warm'],
    forbiddenWords: [...FORBIDDEN_PRONOUNS],
    requiredCadence: 'medium',
  },
  colour: {
    primary: '#B85C38',
    secondary: '#2D2A26',
    accent: '#F2E8D5',
    neutral: { 50: '#FBF8F2', 100: '#EFE7D9', 500: '#736B5E', 900: '#1A1714' },
    semantic: { success: '#3FA34D', warning: '#E0A800', danger: '#C0392B' },
    family: 'training',
  },
  typography: {
    display: { family: 'Lora', weight: 700, src: 'fonts/carsi/Lora-Bold.woff2' },
    body: { family: 'Inter', weight: 400, src: 'fonts/carsi/Inter-Regular.woff2' },
  },
  logo: {
    primary: 'logos/carsi/primary.svg',
    inverted: 'logos/carsi/inverted.svg',
    icon: 'logos/carsi/icon.svg',
    safeAreaPx: 48,
  },
  motion: {
    durations: { fast: 12, base: 24, slow: 42 },
    easing: {
      in: 'cubic-bezier(0.22, 1, 0.36, 1)',
      out: 'cubic-bezier(0.64, 0, 0.78, 0)',
      inOut: 'cubic-bezier(0.83, 0, 0.17, 1)',
    },
    signature: 'iris',
    transitionFrames: 18,
  },
  voiceover: {
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    style: 'narration',
    locale: 'en-AU',
  },
  doNot: ['never use clinical jargon without on-screen definition'],
  audience: { primary: 'restoration trainees and technical inspectors' },
  defaultChannel: 'youtube',
};
