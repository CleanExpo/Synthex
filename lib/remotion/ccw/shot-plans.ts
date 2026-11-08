/**
 * SYN-1404: zero-cost shot plans for the CCW short-form campaign.
 *
 * Replaces the paid image-to-video clips with motion built in code over CCW's
 * owned product photos (public/reference-library, rights owned or
 * supplier-authorised). Nothing here is generated: every picture is a real
 * catalogue or job photo, moved, framed and labelled in Remotion.
 *
 * Each shot starts on its trigger words in Margot's voiceover. Start times are
 * resolved from the ElevenLabs character alignment at render time
 * (scripts/render-ccw-shortform.ts).
 */

export type CcwShotKind =
  | 'hook'
  | 'hero'
  | 'lineup'
  | 'detail'
  | 'type'
  | 'fullbleed'
  | 'end';

export type CcwShot = {
  /** Words in the voiceover this shot starts on (first shot starts at 0). */
  trigger: string;
  kind: CcwShotKind;
  /** Manifest subjects ("industry/key") the pictures come from. */
  subjects: string[];
  /** Image files, relative to public/reference-library. */
  images: string[];
  /** Product name chip. */
  label?: string;
  /** Large in-world type (hook and type shots). */
  bigText?: string;
  smallText?: string;
  /** Detail shots: zoom target as fractions of the image, and zoom factor. */
  focus?: { x: number; y: number; zoom: number };
  callouts?: string[];
};

export type CcwShotPlan = {
  videoId: string;
  cta: string;
  url: string;
  shots: CcwShot[];
};

const WDR = 'water-damage-restoration';
const X800 = `${WDR}/ccw-xpower-airmover-x800-1hp-w-clamp`;
const LGR = `${WDR}/ccw-dri-eaz-dehumidifier-lgr-7000xl-230volt`;
const MAXX = `${WDR}/ccw-razorback-maxxguard-550-cfm-air-scrubber`;
const CLAW = `${WDR}/ccw-waterclaw-large-deluxe`;
const STRYKER = `${WDR}/ccw-dri-eaz-extraction-wand-stryker`;
const LOWPRO = `${WDR}/ccw-xpower-low-profile-airmover`;
const PREFILTER = `${WDR}/ccw-injectidry-interceptor-pre-filter-10pack`;
const HEPA = `${WDR}/ccw-injectidry-interceptor-replacement-hepa-filter`;

const img = (subject: string, id: string) =>
  `${subject.split('/')[0]}/${subject.split('/')[1]}-${id}.webp`;

export const CCW_SHOT_PLANS: CcwShotPlan[] = [
  {
    videoId: 'ccw-w1-d1-am',
    cta: 'See the drying range',
    url: 'ccwonline.com.au',
    shots: [
      {
        trigger: 'Cyclone season',
        kind: 'hook',
        subjects: [X800],
        images: [img(X800, '20568160796825')],
        bigText: 'Cyclone season is open',
      },
      {
        trigger: 'Your drying kit',
        kind: 'lineup',
        subjects: [X800, LGR, MAXX],
        images: [
          img(LGR, '51412266516693'),
          img(X800, '20568158994585'),
          img(MAXX, '31894806954137'),
        ],
        label: 'Your drying kit',
      },
      {
        trigger: 'The season runs',
        kind: 'type',
        subjects: [X800],
        images: [img(X800, '20568160796825')],
        bigText: '01/11 to 30/04',
        smallText: 'Cyclone season',
      },
      {
        trigger: 'Check your air movers',
        kind: 'detail',
        subjects: [X800],
        images: [img(X800, '20568160796825')],
        focus: { x: 0.62, y: 0.7, zoom: 1.55 },
        label: 'XPOWER X-800',
        callouts: ['Cords', 'Guards', 'Clamps'],
      },
      {
        trigger: 'Run every dehumidifier',
        kind: 'hero',
        subjects: [LGR],
        images: [img(LGR, '51412266877141')],
        label: 'Dri-Eaz LGR 7000XLi',
        callouts: ['Filter', 'Drain'],
      },
      {
        trigger: 'Fit a fresh pre-filter',
        kind: 'hero',
        subjects: [MAXX],
        images: [img(MAXX, '31894806921369')],
        label: 'Razorback MaxxGuard 550',
        callouts: ['Fresh pre-filter'],
      },
      {
        trigger: 'If something needs a part',
        kind: 'lineup',
        subjects: [PREFILTER, HEPA],
        images: [img(PREFILTER, '25279590203545'), img(HEPA, '25279593545881')],
        label: 'Spares and filters',
      },
      {
        trigger: 'See the drying range',
        kind: 'end',
        subjects: [X800, LGR, MAXX],
        images: [
          img(X800, '20568158994585'),
          img(LGR, '51412266516693'),
          img(MAXX, '31894806954137'),
        ],
      },
    ],
  },
  {
    videoId: 'ccw-w1-d1-pm',
    cta: 'See the drying range',
    url: 'ccwonline.com.au',
    shots: [
      {
        trigger: 'Forecasters expect',
        kind: 'hook',
        subjects: [CLAW],
        images: [img(CLAW, '51412067156181')],
        bigText: '5 to 8 named cyclones',
        smallText: 'Forecast for this season',
      },
      {
        trigger: 'The phones still ring',
        kind: 'hero',
        subjects: [CLAW],
        images: [img(CLAW, '51412067156181')],
        label: 'Water Claw Large',
      },
      {
        trigger: 'The long-term average',
        kind: 'type',
        subjects: [LOWPRO],
        images: [img(LOWPRO, '20570371195033')],
        bigText: 'Average 11',
        smallText: '5 to 8 forecast',
      },
      {
        trigger: 'Storms, flash flooding',
        kind: 'detail',
        subjects: [STRYKER],
        images: [img(STRYKER, '51412327399637')],
        focus: { x: 0.3, y: 0.82, zoom: 1.45 },
        label: 'Dri-Eaz Stryker wand',
        callouts: ['Storms', 'Flash flooding', 'Burst pipes'],
      },
      {
        trigger: 'Quiet does not mean dry',
        kind: 'detail',
        subjects: [CLAW],
        images: [img(CLAW, '51412067156181')],
        focus: { x: 0.68, y: 0.85, zoom: 1.35 },
        bigText: 'Quiet is not dry',
      },
      {
        trigger: 'So be ready',
        kind: 'lineup',
        subjects: [LOWPRO, CLAW, STRYKER],
        images: [
          img(STRYKER, '51412327399637'),
          img(LOWPRO, '20570371195033'),
          img(CLAW, '51412067156181'),
        ],
        label: 'Ready for the work',
      },
      {
        trigger: 'Check extraction tools',
        kind: 'hero',
        subjects: [LOWPRO],
        images: [img(LOWPRO, '20570371195033')],
        label: 'XPOWER low-profile air mover',
        callouts: ['Extraction tools', 'Air movers', 'Truck loaded'],
      },
      {
        // PM voiceover runs 3.7 s past "See the drying range"; re-voice with a shorter close before rendering.
        trigger: 'at CCW',
        kind: 'end',
        subjects: [CLAW, LOWPRO, STRYKER],
        images: [
          img(CLAW, '51412067156181'),
          img(LOWPRO, '20570371195033'),
          img(STRYKER, '51412327399637'),
        ],
      },
    ],
  },
];
