import { BrandConfig, FORBIDDEN_PRONOUNS } from '../types';

// [created-2026-05-11 · john-coutis] BrandConfig for John "JC" Coutis OAM —
// Australian inspirational speaker (johncoutis.com), confirmed as the named
// spokesman for the expanded NRPG industry association. Source dossier:
// Pi-CEO/Pi-Dev-Ops/remotion-studio/src/brands/john-coutis-research.md
//
// Boundary: visual tokens (colours, typography, spacing, components, layout,
// elevation) live in `john-coutis.design.md`. This file holds runtime + voice
// fields only, per remotion-studio/src/brands/CONTRACT.md.
//
// Open items flagged inline with `TODO confirm with John` — see dossier
// section "Gaps we'd need to fill" for the full list.
export const johnCoutis = {
  slug: 'john-coutis',
  legalName: 'John Coutis',
  displayName: 'John Coutis OAM',
  tagline: 'Half a Body, Full of Life.',
  voice: {
    tone: ['humorous', 'vulnerable', 'direct', 'warm', 'human'],
    forbiddenWords: [
      ...FORBIDDEN_PRONOUNS,
      // pity / clinical framing — JC frames his life as agency, not condition
      'suffers', 'suffered', 'unfortunate', 'poor',
      'disabled' /* never as a noun; "with disability" is acceptable in copy */,
      'wheelchair-bound', 'confined',
      'inspite', 'despite' /* his framing is 'with', not 'despite' */,
      // disability-speaker cliché overload — these dilute his earned authority
      'amazing', 'incredible', 'miraculous', 'miracle',
      // generic motivational filler that competes for his airspace
      'unlock', 'journey', 'best-self', 'best self',
      'limitless', 'unstoppable',
      // hype-bait JC explicitly does not use
      'guaranteed', 'cheapest', 'world-class', 'game-changer',
    ],
    requiredCadence: 'short',
  },
  colour: {
    // Hexes also live in john-coutis.design.md (canonical visual source per
    // CONTRACT.md). Mirrored here to satisfy the existing BrandColour type until
    // the full hex-to-design-md migration ships (see migration-check grep in
    // CONTRACT.md line 100). All values are PROPOSAL — TODO confirm with John.
    primary: '#1A1A1A',     // charcoal — dark hero surface (his wordmark renders white-on-dark)
    secondary: '#3A2E1F',   // warm umber — earned, lived-in
    accent: '#D4A437',      // Australian gold — warm, distinct from the navy every other speaker uses; nod to OAM
    neutral: { 50: '#F5F0E6', 100: '#E8DFCE', 500: '#7A6F5C', 900: '#1A1A1A' },
    semantic: { success: '#3FA34D', warning: '#E0A800', danger: '#C0392B' },
    family: 'consumer', // personal/spokesman brand — warm + human, not institutional
  },
  typography: {
    // family / weight / src declared here for licence trace + voiceover-asset paths.
    // The full type scale (display-xl down to caption) lives in john-coutis.design.md.
    display: { family: 'Bebas Neue', weight: 700, src: 'fonts/john-coutis/BebasNeue-Bold.woff2' },
    body: { family: 'Inter', weight: 400, src: 'fonts/john-coutis/Inter-Regular.woff2' },
  },
  logo: {
    primary: 'logos/john-coutis/primary.svg',   // wordmark white-on-dark
    inverted: 'logos/john-coutis/inverted.svg', // wordmark dark-on-light
    icon: 'logos/john-coutis/icon.svg',         // "JC" monogram — TODO commission, currently TBD
    safeAreaPx: 56,
  },
  motion: {
    // He is a 25-year keynote speaker, not a TikTok creator. Motion is deliberate,
    // earned, calm — never frenetic. Signature 'rise' = vertical settle that mirrors
    // the way he commands a stage by *waiting* before he speaks.
    durations: { fast: 12, base: 28, slow: 48 },
    easing: {
      in: 'cubic-bezier(0.22, 1, 0.36, 1)',   // expo-out — soft landing
      out: 'cubic-bezier(0.4, 0, 0.2, 1)',    // standard — no whip
      inOut: 'cubic-bezier(0.83, 0, 0.17, 1)', // expo-in-out
    },
    signature: 'rise',
    transitionFrames: 20,
  },
  voiceover: {
    // He IS the voice — for any video where he speaks on-camera, no synthesis is used.
    // The ElevenLabs entry below is the fallback for chyrons / B-roll narration only,
    // until a licensed voice-clone of JC is produced.
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah — neutral AU; placeholder. TODO clone JC voice w/ consent.
    style: 'conversational',
    locale: 'en-AU',
  },
  doNot: [
    'never frame his life as tragedy first — humour and agency come before hardship in every opening line',
    'never use pity language ("suffers", "unfortunate", "poor") — he refuses the script',
    'never describe his disability with medical / clinical terminology — his framing is lived, not diagnosed',
    'never reverse the vulnerable→lesson order — vulnerability lands first, the lesson lands second, never the inverse',
    'never use the word "inspirational" as a self-applied label in his copy (it is what audiences say about him, not what he claims about himself)',
    'never strip the OAM post-nominal from his name in formal speaker introductions',
    'never reduce him to "the speaker with no legs" — he is "John Coutis OAM" first; the disability is part of his story, not his identity',
    'never use stock disability imagery (wheelchair icons, ramps, accessibility symbols) — he moves on a custom skateboard, that is the visual',
    'never schedule content cadence that exceeds what he can deliver — burnout for him is a brand-trust event',
    'never position his message as motivational-keynote-cliché — the brand earns trust by being more honest than the category',
  ],
  audience: {
    primary: 'tradespeople and field operators across the property-services industry (NRPG members) — AU + NZ',
    secondary: 'corporate audiences (leadership offsites, sales kick-offs) and school assemblies (anti-bullying, resilience)',
  },
  defaultChannel: 'youtube', // YouTube is the largest single unclaimed channel — see content kickoff doc
  pillars: {
    values: ['Honest', 'Funny', 'Resilient', 'Human'],
    readingLevel: { target: 5, tolerance: 7, hardFail: 9 }, // speaks the way tradies read
  },
} as const satisfies BrandConfig;
