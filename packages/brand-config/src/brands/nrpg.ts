import { BrandConfig, FORBIDDEN_PRONOUNS } from '../types';

// STUB — sister brand to DR, shares safety colour family. Refined by remotion-brand-research.
export const nrpg: BrandConfig = {
  slug: 'nrpg',
  legalName: 'NRPG',
  displayName: 'NRPG',
  tagline: 'Standards for the response network.',
  voice: {
    tone: ['authoritative', 'expert'],
    forbiddenWords: [...FORBIDDEN_PRONOUNS],
    requiredCadence: 'medium',
  },
  colour: {
    primary: '#1A2A4F',
    secondary: '#2A3D5F',
    accent: '#F2B33D',
    neutral: { 50: '#FAF8F2', 100: '#EDE7D6', 500: '#7A7468', 900: '#0F1626' },
    semantic: { success: '#3FA34D', warning: '#E0A800', danger: '#C0392B' },
    family: 'safety',
  },
  typography: {
    display: { family: 'Inter', weight: 800, src: 'fonts/nrpg/Inter-ExtraBold.woff2' },
    body: { family: 'Inter', weight: 400, src: 'fonts/nrpg/Inter-Regular.woff2' },
  },
  logo: {
    primary: 'logos/nrpg/primary.svg',
    inverted: 'logos/nrpg/inverted.svg',
    icon: 'logos/nrpg/icon.svg',
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
  doNot: ['never present NRPG as a regulatory body — it is an industry standard'],
  audience: { primary: 'industry training coordinators and response-network operators' },
  defaultChannel: 'linkedin',
};
