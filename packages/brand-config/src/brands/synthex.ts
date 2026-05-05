import { BrandConfig, FORBIDDEN_PRONOUNS } from '../types';

// STUB — refined by remotion-brand-research before first render.
export const synthex: BrandConfig = {
  slug: 'synthex',
  legalName: 'Synthex',
  displayName: 'Synthex',
  tagline: 'Synthetic intelligence at production scale.',
  voice: {
    tone: ['expert', 'authoritative'],
    forbiddenWords: [...FORBIDDEN_PRONOUNS, 'leverage', 'synergy'],
    requiredCadence: 'medium',
  },
  colour: {
    primary: '#6366F1',     // indigo — synthetic / abstract
    secondary: '#0F172A',   // slate-900
    accent: '#22D3EE',      // cyan — signal / output
    neutral: { 50: '#F8FAFC', 100: '#E2E8F0', 500: '#64748B', 900: '#0F172A' },
    semantic: { success: '#10B981', warning: '#F59E0B', danger: '#EF4444' },
    family: 'industrial',
  },
  typography: {
    display: { family: 'Inter', weight: 800, src: 'fonts/synthex/Inter-ExtraBold.woff2' },
    body: { family: 'Inter', weight: 400, src: 'fonts/synthex/Inter-Regular.woff2' },
    mono: { family: 'JetBrains Mono', weight: 500, src: 'fonts/synthex/JetBrainsMono-Medium.woff2' },
  },
  logo: {
    primary: 'logos/synthex/primary.svg',
    inverted: 'logos/synthex/inverted.svg',
    icon: 'logos/synthex/icon.svg',
    safeAreaPx: 40,
  },
  motion: {
    durations: { fast: 8, base: 16, slow: 32 },
    easing: {
      in: 'cubic-bezier(0.22, 1, 0.36, 1)',
      out: 'cubic-bezier(0.64, 0, 0.78, 0)',
      inOut: 'cubic-bezier(0.83, 0, 0.17, 1)',
    },
    signature: 'sweep',
    transitionFrames: 12,
  },
  voiceover: {
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    style: 'narration',
    locale: 'en-AU',
  },
  doNot: [
    'never imply Synthex generates training data without consent',
    'never use stock AI-cliché imagery (glowing brains, blue particles)',
  ],
  audience: {
    primary: 'ML engineers and platform teams shipping AI products',
    secondary: 'CTOs evaluating synthetic-data infrastructure',
  },
  defaultChannel: 'linkedin',
};
