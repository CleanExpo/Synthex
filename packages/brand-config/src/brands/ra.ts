import { BrandConfig, FORBIDDEN_PRONOUNS } from '../types';

// [verified-2026-05-15 · Wave 1 launch codify] palette aligned to CLAUDE.md rule 17 (RA repo):
//   navy #1C2E47 · warm #8A6B4E · light tan #D4A574 · dark bg #050505.
// Supersedes the earlier RA-1985 codify pass that used candy orange #E55A2B —
// the Wave 1 director brief (briefs/ra-2026-05-15-wave-1-launch.json) explicitly
// locks the navy palette as the published portfolio identity for RA. See note in
// brief.brand_colours_locked: "RA BrandConfig palette governs THIS video — NOT
// the default Gun Metal/Candy Red portfolio defaults."
//
// Audience reality: Australian water-damage restoration tradies (sole traders +
// small companies) running insurer-facing reporting workflows. Voice is
// Australian-direct, no jargon, confident not salesy. Voiceover uses the
// `phill-elevenlabs-pro` clone — Phill's own voice — because the audience trusts
// a tradie, not a corporate narrator.
export const ra = {
  slug: 'ra',
  legalName: 'RestoreAssist Pty Ltd',
  displayName: 'RestoreAssist',
  tagline: 'Built in Brisbane for Australian tradies.',
  voice: {
    tone: ['direct', 'grounded', 'informed', 'human'],
    forbiddenWords: [
      ...FORBIDDEN_PRONOUNS,
      // Wave 1 brief must_avoid jargon
      'leverage', 'synergy', 'unlock value', 'streamline', 'revolutionise',
      'AI-powered',
      // Carry-forward from earlier RA codify
      'utilise', 'best-in-class', 'world-class', 'game-changer', 'revolutionary',
      'seamless', 'powerful', 'unlock', 'journey',
      'excited', 'thrilled', 'delighted',
      // Competitor names — must_avoid per Wave 1 brief
      'DocuSketch', 'Encircle', 'Magicplan', 'Xactimate',
    ],
    requiredCadence: 'short',
  },
  colour: {
    primary: '#1C2E47',     // navy — CLAUDE.md rule 17, canonical RA brand colour
    secondary: '#8A6B4E',   // warm earth — CLAUDE.md rule 17
    accent: '#D4A574',      // light tan — CLAUDE.md rule 17, action / highlight
    neutral: { 50: '#F5F5F4', 100: '#E7E5E4', 500: '#78716C', 900: '#050505' },
    semantic: { success: '#3FA34D', warning: '#E0A800', danger: '#C0392B' },
    family: 'restoration',
    darkVariant: {
      primary: '#D4A574',    // light tan lifts to primary on dark bg
      secondary: '#8A6B4E',
      neutral: { 50: '#050505', 100: '#1C2E47', 500: '#A8A29E', 900: '#F5F5F4' },
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
    elevenLabsVoiceId: 'phill-elevenlabs-pro',           // Phill's cloned voice — audience trusts a tradie, not a corporate narrator
    style: 'narration',
    locale: 'en-AU',
  },
  doNot: [
    'never abbreviate the company name to "RA" in voiceover or on-screen titles',
    'never use red as a primary brand colour (reserved for danger only)',
    'never write copy that creates urgency — the tradie reading this already has it',
    'never use passive voice when active voice is available',
    'never use a technical term without a plain-English explanation in the same sentence',
    "never position the brand before the reader's problem in any opening line",
    'never end with a CTA that drives traffic to a brand destination — direct the reader to act in their own interest instead',
    'never name a competitor (DocuSketch / Encircle / Magicplan / Xactimate) — position by what RA does, not what they don\'t',
    'never use "AI-powered" as standalone filler — every AI mention must name the specific lifecycle hook',
  ],
  audience: {
    primary: 'Australian water-damage restoration tradies (sole traders and small companies)',
    secondary: 'insurer claims teams and assessor networks',
  },
  defaultChannel: 'linkedin',
  pillars: {
    values: ['Honest', 'Reliable', 'Informed'],
    readingLevel: { target: 4, tolerance: 6, hardFail: 8 },
  },
} as const satisfies BrandConfig;
