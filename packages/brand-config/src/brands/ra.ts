import { BrandConfig, FORBIDDEN_PRONOUNS } from '../types';

// [verified-2026-05-05 · colour.primary] source: lib/remotion/brand-content.ts BRAND_CONTENT['restore-assist'].brandColour.
// `#E55A2B` is candy-orange-dark; the existing doNot "never use red as a primary brand colour" remains satisfied.
//
// H-1 PILOT (HER-1a / SYN-909) — voice fields rewritten 2026-05-06 to reflect the
// RestoreAssist audience reality: people in crisis (water damage at 2am, mould
// diagnosis after months of illness, house fire). The brand earns trust by being
// the most informed voice in the room with no need to impress anyone. Adequate
// for text-only LinkedIn + GBP. Run remotion-brand-research → remotion-brand-codify
// post-H-1 to refine against ceo-foundation.md. See Linear RA-1985 for context.
export const ra: BrandConfig = {
  slug: 'ra',
  legalName: 'RestoreAssist Pty Ltd',
  displayName: 'RestoreAssist',
  tagline: 'One National Inspection Standard.',
  voice: {
    tone: ['direct', 'grounded', 'informed', 'human'],
    forbiddenWords: [
      ...FORBIDDEN_PRONOUNS,
      'leverage', 'utilise', 'best-in-class',
      'world-class', 'game-changer', 'revolutionary',
      'seamless', 'powerful', 'unlock', 'journey',
      'excited', 'thrilled', 'delighted',
    ],
    requiredCadence: 'short',
  },
  colour: {
    primary: '#E55A2B',     // candy orange dark — canonical RestoreAssist brand colour
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
    'never write copy that creates urgency — the reader already has it',
    'never use passive voice when active voice is available',
    'never use a technical term without a plain-English explanation in the same sentence',
    "never position the brand before the reader's problem in any opening line",
    'never end a post with a call-to-action that drives traffic to a brand destination — direct the reader to act in their own interest instead',
  ],
  audience: {
    primary: 'restoration company owners and field technicians (AU)',
    secondary: 'insurer claims teams and assessor networks',
  },
  defaultChannel: 'linkedin',
  pillars: {
    values: ['Honest', 'Reliable', 'Informed'],
    readingLevel: { target: 4, tolerance: 6, hardFail: 8 },
  },
};
