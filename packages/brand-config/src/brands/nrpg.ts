import { BrandConfig, FORBIDDEN_PRONOUNS } from '../types';

// [decided-2026-10-23 · colour.primary/secondary] Phill set NRPG's colours to the approved logo's blue and navy
// (brand-assets/nrpg); BRAND_CONTENT['nrpg'].brandColour in lib/remotion/brand-content.ts matches.
// Other fields (voice / audience / voiceover / motion) still pending refinement against ceo-foundation.md.
export const nrpg = {
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
    primary: '#0047FF', // NRPG blue, from the approved logo
    secondary: '#0F2742', // NRPG navy, from the approved logo
    accent: '#F2B33D',
    neutral: { 50: '#FAF8F2', 100: '#EDE7D6', 500: '#7A7468', 900: '#0F1626' },
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
    elevenLabsVoiceId: 'tAtHhBlA3E0eKZJKNSKE', // Margot — founder decision 16/10/2026: all Phill's products use Margot
    style: 'narration',
    locale: 'en-AU',
  },
  doNot: [
    'never present NRPG as a regulatory body — it is an industry standard',
  ],
  audience: {
    primary: 'industry training coordinators and response-network operators',
  },
  defaultChannel: 'linkedin',
} as const satisfies BrandConfig;
