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
  | 'floor'
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
  /**
   * Floor shots (and a scene end card): crop of the owned photo, in source
   * pixels, at the 1188:2112 frame ratio. The render script prepares it with
   * lanczos + unsharp (no AI) so the browser does not stretch a soft crop.
   */
  crop?: { x: number; y: number; w: number; h: number };
  /** Floor shots: type lying flat on the floor plane. */
  floorLines?: string[];
  /** Floor type size in px (default 188); smaller for long words. */
  floorSize?: number;
  /** Floor shots: the spoken line as kinetic type. */
  kinetic?: string[];
  /** Floor shots: the source, printed on a slip on the floor. */
  sourceSlip?: string;
  /** Floor shots: water ripple through the floor type (0 to 1). */
  rippleTo?: number;
  rippleFrom?: number;
  /** No burned-in captions while this shot is on (its type is the words). */
  noCaptions?: boolean;
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
const STRYKER = `${WDR}/ccw-dri-eaz-extraction-wand-stryker`;
const PREFILTER = `${WDR}/ccw-injectidry-interceptor-pre-filter-10pack`;
const HEPA = `${WDR}/ccw-injectidry-interceptor-replacement-hepa-filter`;

const EXTRACTION = 'carpet-cleaning/carpet-cleaning-extraction';
const SOLUTION = 'carpet-cleaning/carpet-cleaning-solution';
const scene = (name: string) => `carpet-cleaning/carpet-cleaning-${name}.webp`;
/** Wet tiles, boots and extractor (extraction-01), tight on boot and tool. */
const TILES = { x: 572, y: 40, w: 344, h: 612 };
/** Open van, driveway, hose reel (solution-01). */
const VAN = { x: 150, y: 0, w: 349, h: 620 };
const SOURCE = '5 to 8 cyclones: ECMWF modelling, via ABC News';

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
    // Concept A "Quiet on paper" (blind judge pick, 08/11/2026). Scenes are
    // owned job photos; the forecast lives on the floor, not on a card.
    videoId: 'ccw-w1-d1-pm',
    cta: 'See the drying range',
    url: 'ccwonline.com.au',
    shots: [
      {
        trigger: 'Five to eight',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [scene('extraction-01')],
        crop: TILES,
        floorLines: ['5 TO 8', 'CYCLONES'],
        floorSize: 156,
        sourceSlip: SOURCE,
        noCaptions: true,
      },
      {
        trigger: 'against a long-term',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [scene('extraction-04')],
        crop: { x: 430, y: 0, w: 405, h: 720 },
        floorLines: ['AVERAGE', '11'],
        sourceSlip: SOURCE,
        noCaptions: true,
      },
      {
        trigger: 'Quiet, on paper',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [scene('extraction-01')],
        crop: TILES,
        floorLines: ['QUIET', 'ON PAPER'],
        noCaptions: true,
      },
      {
        trigger: 'Near the Queensland',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [scene('extraction-02')],
        crop: { x: 560, y: 0, w: 405, h: 720 },
      },
      {
        trigger: 'and one system',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [scene('extraction-03')],
        crop: { x: 600, y: 0, w: 405, h: 720 },
      },
      {
        trigger: 'Quiet does not',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [scene('extraction-01')],
        crop: TILES,
        floorLines: ['QUIET', 'ON PAPER'],
        kinetic: ['Quiet', 'does', 'not', 'mean', 'dry.'],
        sourceSlip: SOURCE,
        rippleTo: 0.35,
        rippleFrom: 0.15,
        noCaptions: true,
      },
      {
        trigger: 'Be ready',
        kind: 'lineup',
        subjects: [STRYKER, X800],
        images: [img(STRYKER, '51412327399637'), img(X800, '20568158994585')],
        label: 'Ready for the work',
      },
      {
        trigger: 'Load the truck',
        kind: 'floor',
        subjects: [SOLUTION],
        images: [scene('solution-01')],
        crop: VAN,
      },
      {
        trigger: 'See the drying range',
        kind: 'end',
        subjects: [SOLUTION],
        images: [scene('solution-01')],
        crop: VAN,
      },
    ],
  },
];
