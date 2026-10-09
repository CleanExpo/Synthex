import { BrandConfig, FORBIDDEN_PRONOUNS } from '../types';

// Remotion brand-content uses this navy primary (SYN-1113); the doNot rule
// prohibits primary red. Semantic danger red remains available for warnings.
export const dr = {
  slug: 'dr',
  legalName: 'Disaster Recovery Pty Ltd',
  displayName: 'Disaster Recovery',
  tagline: 'When the worst happens, ready answers.',
  voice: {
    tone: ['authoritative', 'reassuring'],
    forbiddenWords: [...FORBIDDEN_PRONOUNS],
    requiredCadence: 'medium',
  },
  colour: {
    primary: '#0B2545',
    secondary: '#13315C',
    accent: '#FF8A00',
    neutral: { 50: '#F4F6F8', 100: '#E2E7EC', 500: '#6F7B82', 900: '#0B1726' },
    semantic: { success: '#3FA34D', warning: '#E0A800', danger: '#C0392B' },
    family: 'safety',
  },
  typography: {
    display: {
      family: 'Inter',
      weight: 800,
      src: 'fonts/ra/Inter-ExtraBold.woff2',
    },
    body: { family: 'Inter', weight: 400, src: 'fonts/ra/Inter-Regular.woff2' },
  },
  logo: {
    primary: 'logos/dr/primary.svg',
    inverted: 'logos/dr/inverted.svg',
    icon: 'logos/dr/icon.svg',
    safeAreaPx: 48,
  },
  motion: {
    durations: { fast: 10, base: 22, slow: 40 },
    easing: {
      in: 'cubic-bezier(0.22, 1, 0.36, 1)',
      out: 'cubic-bezier(0.64, 0, 0.78, 0)',
      inOut: 'cubic-bezier(0.83, 0, 0.17, 1)',
    },
    signature: 'rise',
    transitionFrames: 16,
  },
  voiceover: {
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    style: 'narration',
    locale: 'en-AU',
  },
  doNot: [
    'never trivialise loss in voiceover or on-screen text',
    'never use red as a primary brand colour',
  ],
  audience: { primary: 'business owners and facility managers post-incident' },
  defaultChannel: 'linkedin',
} as const satisfies BrandConfig;
