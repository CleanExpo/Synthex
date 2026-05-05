import { BrandConfig, FORBIDDEN_PRONOUNS } from '../types';

export const ra: BrandConfig = {
  slug: 'ra',
  legalName: 'RestoreAssist Pty Ltd',
  displayName: 'RestoreAssist',
  tagline: 'One National Inspection Standard.',
  voice: {
    tone: ['expert', 'urgent'],
    forbiddenWords: [...FORBIDDEN_PRONOUNS, 'leverage', 'utilise', 'best-in-class'],
    requiredCadence: 'short',
  },
  colour: {
    primary: '#0E7C7B',     // teal — restoration / clarity
    secondary: '#2A3D45',   // slate
    accent: '#C5E063',      // lime — action / NIR highlight
    neutral: { 50: '#F5F7F8', 100: '#E4E9EC', 500: '#6F7B82', 900: '#0E1518' },
    semantic: { success: '#3FA34D', warning: '#E0A800', danger: '#C0392B' },
    family: 'restoration',
    darkVariant: {
      primary: '#16B5B3',
      secondary: '#1A2428',
      neutral: { 50: '#0E1518', 100: '#1A2428', 500: '#A6B0B6', 900: '#F5F7F8' },
    },
  },
  typography: {
    display: { family: 'Inter', weight: 800, src: 'fonts/ra/Inter-ExtraBold.woff2' },
    body: { family: 'Inter', weight: 400, src: 'fonts/ra/Inter-Regular.woff2' },
    mono: { family: 'JetBrains Mono', weight: 500, src: 'fonts/ra/JetBrainsMono-Medium.woff2' },
  },
  logo: {
    primary: 'logos/ra/primary.svg',
    inverted: 'logos/ra/inverted.svg',
    icon: 'logos/ra/icon.svg',
    safeAreaPx: 48,
  },
  motion: {
    durations: { fast: 8, base: 18, slow: 36 },          // frames @ 30fps
    easing: {
      in: 'cubic-bezier(0.22, 1, 0.36, 1)',              // expo-out
      out: 'cubic-bezier(0.64, 0, 0.78, 0)',             // expo-in
      inOut: 'cubic-bezier(0.83, 0, 0.17, 1)',           // expo-in-out
    },
    signature: 'sweep',                                   // horizontal reveal — decisive
    transitionFrames: 14,
  },
  voiceover: {
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',           // Sarah — neutral AU/UK; replace with cloned voice when available
    style: 'narration',
    locale: 'en-AU',
  },
  doNot: [
    'never abbreviate the company name to "RA" in voiceover or on-screen titles',
    'never use red as a primary brand colour (reserved for danger only)',
    'never imply the NIR is optional or vendor-specific',
  ],
  audience: {
    primary: 'restoration company owners and field technicians (AU)',
    secondary: 'insurer claims teams and assessor networks',
  },
  defaultChannel: 'linkedin',
};
