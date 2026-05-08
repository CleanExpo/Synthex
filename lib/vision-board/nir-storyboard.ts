/**
 * NIR explainer storyboard — SYN-921 source of truth.
 *
 * Same data feeds the Vision Board Storyboard panel AND the Remotion
 * composition (RA-Launch-NIR.tsx) when the cross-repo Remotion build runs.
 * Keeping it here means the Vision Board can preview scenes without
 * depending on Pi-CEO/Pi-Dev-Ops being present.
 */

import type { NIRStoryboard } from './types';

export const NIR_STORYBOARD: NIRStoryboard = {
  jobId: 'ra-launch-nir-2026-05-08',
  brand: 'ra',
  composition: 'Explainer',
  channel: 'linkedin',
  aspectRatio: '1920x1080',
  totalDurationSec: 90,
  voiceId: 'EXAVITQu4vr4xnSDxMaL',          // Sarah, en-AU narration (matches ra.ts)
  topic:
    'The National Inspection Report is a single IICRC-grounded format that ' +
    'replaces 50+ fragmented report formats currently used across Australian ' +
    'restoration — removing double-handling, eliminating re-inspections, and ' +
    'saving $2,000–5,000 per claim.',
  scenes: [
    {
      index: 1,
      startSec: 0,
      endSec: 18,
      durationSec: 18,
      onScreenText: '50 formats. One claim.',
      voiceover:
        'Right now, every restoration job in Australia is documented in a different format.',
      visualNote:
        'Stack of 50+ scattered report templates falling onto a desk. Sweep transitions in from the left.',
    },
    {
      index: 2,
      startSec: 18,
      endSec: 36,
      durationSec: 18,
      onScreenText: 'Re-inspections run 20–30%.\nEach one costs $2,000–$5,000.',
      voiceover:
        'That fragmentation costs the industry millions every year in re-inspections alone.',
      visualNote:
        'Two-line stat reveal. Dollar figures count up. Slate background, lime accent on the dollar amounts.',
    },
    {
      index: 3,
      startSec: 36,
      endSec: 54,
      durationSec: 18,
      onScreenText: 'The National Inspection Report\nS500 · S520 · S700',
      voiceover:
        'The National Inspection Report is one format, grounded in IICRC standards.',
      visualNote:
        'NIR icon revealed via the locked sweep signature. Three IICRC chips slide in from the right.',
    },
    {
      index: 4,
      startSec: 54,
      endSec: 72,
      durationSec: 18,
      onScreenText:
        'Inspection → AI Analysis → Scoping → Estimating → Reporting',
      voiceover:
        'Field tech captures it once. The system does the rest. No double-handling.',
      visualNote:
        '5-step horizontal sweep. Each step pops in on its own beat. Field-tech icon transitions into office-report icon.',
    },
    {
      index: 5,
      startSec: 72,
      endSec: 90,
      durationSec: 18,
      onScreenText: 'One System. Fewer Gaps. More Confidence.',
      voiceover: 'RestoreAssist. Now on the App Store.',
      visualNote:
        'RestoreAssist mark. App Store badge bottom-right. Slogan typed character-by-character.',
    },
  ],
};
