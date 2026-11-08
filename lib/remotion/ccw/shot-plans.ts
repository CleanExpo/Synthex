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
  /**
   * Floor shots: soft focus on the room photo in px (shallow depth of field;
   * the placed units and the type stay sharp). Also spends fewer delivery
   * bits on carpet grain.
   */
  sceneBlur?: number;
  /** Floor shots: the hook type slams onto the floor. */
  slam?: boolean;
  /** Floor shots: a product photo set on the floor (image index into images). */
  product?: { image: number; x: number; y: number; w: number };
  /** No burned-in captions while this shot is on (its type is the words). */
  noCaptions?: boolean;
  /**
   * Floor shots: owned product photos set into the scene. Each one is cut
   * from its white catalogue background (flood fill from the border, no AI)
   * by the render script and stands on the floor with a contact shadow.
   */
  place?: CcwPlaced[];
};

export type CcwPlaced = {
  /** Index into `images` (0 is the scene, so 1 or more). */
  img: number;
  /** Bottom centre of the product on screen (1080x1920), in px. */
  x: number;
  y: number;
  /** Width on screen in px. */
  w: number;
  /** Mirror the photo so the unit faces the other way. */
  flip?: boolean;
  /** Seconds into the shot when the unit cuts in, already grounded (default 0). */
  at?: number;
  /**
   * Hide the bottom of the cut-out (fraction of `w`), e.g. a cord hanging below
   * the feet, so the feet become the base. A crop of the owned photo, nothing
   * generated.
   */
  clipBottom?: number;
  /** Add a dark, blurred copy of the outline under an angled unit as its shadow. */
  silhouette?: boolean;
  /**
   * Draw the unit as a flat dark outline of the owned photo, not the photo:
   * a stand-in for a model CCW does not sell (labelled on the floor with its
   * source). Same footing and contact shadow; nothing added to the shape.
   */
  outline?: boolean;
  /**
   * Draw the unit as the same owned photo graded cool and grey (use with
   * `flip`): a stand-in for a model CCW does not sell. Pair with `slip`.
   */
  twin?: boolean;
  /** A small printed label on the unit (an on-screen line: sourced). */
  slip?: string;
  /**
   * The unit's base as it appears in its photo, as [x, y] fractions of the
   * w x w box: drawn as a blurred footprint shadow instead of the ellipses, so
   * an angled unit is grounded along every edge it stands on.
   */
  footprint?: [number, number][];
  /**
   * Twin only: printed areas of the photo (maker's decal, plate) as
   * [x0, y0, x1, y1] fractions of the w x w box, unflipped. They are blurred
   * on the twin so its mirrored print never reads backwards.
   */
  decal?: [number, number, number, number][];
  /**
   * The unit's outline in its cut-out, as [x, y] fractions of the w x w box,
   * measured from the owned photo. The cut-out is clipped to it, which drops
   * the grey floor shadow baked into a catalogue render (the white flood fill
   * keeps it). Nothing is added to the shape.
   */
  matte?: [number, number][];
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

// ccw-w1-d2-am: owned air mover catalogue photos set into owned job rooms.
const X400 = `${WDR}/ccw-xpower-airmover-x400-1-2hp`;
const XLOW = `${WDR}/ccw-xpower-low-profile-airmover`;
const VELO = `${WDR}/ccw-dri-eaz-velo-low-profile-air-mover`;
const MINI = `${WDR}/ccw-airmover-mini-p-230at-1-4hp`;
const GALE = `${WDR}/ccw-dry-air-gale-force-axial-airmover`;
const ROTARY = 'carpet-cleaning/carpet-cleaning-rotary';
/** Empty room, window and corner (rotary-04), clear of the machine. */
const ROOM = { x: 700, y: 0, w: 405, h: 720 };

// ccw-w1-d2-pm: the floor's-eye view. Owned job photos at floor height (a real
// cabinet toe-kick, skirtings, a door jamb) with the two low-profile units cut
// from their catalogue photos. No bed, vanity or running job is shown.
const SCENE = (name: string) => `carpet-cleaning/carpet-cleaning-${name}.webp`;
/** Door jamb, corner guard and carpet (result-01), seen from above. */
const JAMB = { x: 680, y: 0, w: 405, h: 720 };

// ccw-w1-d3-am: "The twin". The red Max Force stands beside its twin: the same
// owned photo mirrored and graded cool, labelled "Illustration: US 115 V
// model" (the US model, which CCW's page says Dry Air lists). Every spec
// on the floor is quoted from CCW's Max Force and BD2500 listings.
const MAXF = `${WDR}/ccw-dry-air-maxforce-ventilator-50hz-220v-au-plug`;
const BD2500 = `${WDR}/ccw-dri-eaz-lgr-dehumidifier-bd2500-230volt`;
const RESULT = 'carpet-cleaning/carpet-cleaning-result';

// ccw-w1-d3-pm: "Wet tiles, then the kit". The real wet job (extraction-01)
// opens on the SafeWork NSW clean-up window; the three tools are cut from
// their catalogue photos and set flat on dry carpet. No unit is shown running
// in a wet room.
const CLAW = `${WDR}/ccw-waterclaw-med-dlx-with-injection`;
const SOSPRO = `${WDR}/ccw-sos-pro-sub-surface-extraction-tool`;
const GROOM = 'carpet-cleaning/carpet-cleaning-grooming';

// ccw-w1-d4-pm: "The stack". The MaxxGuard 550 (three catalogue photos, cut
// out, matted to their outline and set flat on owned job-room carpet). CCW
// sells two filters for it: the MERV-10 pre-filter 5 pack and the
// HEPA/activated carbon filter. No owned photo of either filter exists, so no
// filter is shown: the type names the stages, the picture is the unit they
// sit in. Every line quotes CCW's own Razorback collection or filter pages.
const MAXX_A = img(MAXX, '31894806921369');
const MAXX_B = img(MAXX, '31894806954137');
const MAXX_C = img(MAXX, '31894806986905');
/** Bases of the two angled MaxxGuard photos, read off the photos (w x w box). */
const FOOT_A: [number, number][] = [
  [0.08, 0.85],
  [0.74, 0.95],
  [0.95, 0.74],
  [0.36, 0.66],
];
const FOOT_B: [number, number][] = [
  [0.04, 0.87],
  [0.28, 0.96],
  [0.92, 0.76],
  [0.66, 0.67],
];
/** Outlines of the three MaxxGuard cut-outs (measured, see CcwPlaced.matte). */
const MATTE_A: [number, number][] = [
  [0.032, 0.231],
  [0.048, 0.205],
  [0.064, 0.167],
  [0.08, 0.166],
  [0.096, 0.148],
  [0.112, 0.13],
  [0.128, 0.117],
  [0.144, 0.112],
  [0.159, 0.107],
  [0.175, 0.106],
  [0.191, 0.107],
  [0.207, 0.104],
  [0.223, 0.097],
  [0.239, 0.081],
  [0.255, 0.076],
  [0.271, 0.077],
  [0.287, 0.08],
  [0.303, 0.077],
  [0.319, 0.082],
  [0.335, 0.095],
  [0.351, 0.112],
  [0.367, 0.112],
  [0.383, 0.111],
  [0.399, 0.11],
  [0.415, 0.085],
  [0.431, 0.085],
  [0.447, 0.084],
  [0.463, 0.081],
  [0.478, 0.081],
  [0.494, 0.083],
  [0.51, 0.085],
  [0.526, 0.091],
  [0.542, 0.094],
  [0.558, 0.096],
  [0.574, 0.124],
  [0.59, 0.12],
  [0.606, 0.122],
  [0.622, 0.133],
  [0.638, 0.136],
  [0.654, 0.14],
  [0.67, 0.181],
  [0.686, 0.175],
  [0.702, 0.173],
  [0.718, 0.159],
  [0.734, 0.156],
  [0.75, 0.159],
  [0.766, 0.159],
  [0.781, 0.151],
  [0.797, 0.124],
  [0.813, 0.121],
  [0.829, 0.128],
  [0.845, 0.125],
  [0.861, 0.144],
  [0.877, 0.163],
  [0.893, 0.184],
  [0.909, 0.204],
  [0.925, 0.224],
  [0.941, 0.249],
  [0.957, 0.472],
  [0.957, 0.542],
  [0.941, 0.624],
  [0.925, 0.762],
  [0.909, 0.789],
  [0.893, 0.803],
  [0.877, 0.822],
  [0.861, 0.836],
  [0.845, 0.851],
  [0.829, 0.864],
  [0.813, 0.88],
  [0.797, 0.894],
  [0.781, 0.909],
  [0.766, 0.92],
  [0.75, 0.932],
  [0.734, 0.949],
  [0.718, 0.953],
  [0.702, 0.954],
  [0.686, 0.953],
  [0.67, 0.951],
  [0.654, 0.94],
  [0.638, 0.929],
  [0.622, 0.928],
  [0.606, 0.926],
  [0.59, 0.924],
  [0.574, 0.923],
  [0.558, 0.922],
  [0.542, 0.921],
  [0.526, 0.919],
  [0.51, 0.918],
  [0.494, 0.915],
  [0.478, 0.912],
  [0.463, 0.911],
  [0.447, 0.908],
  [0.431, 0.904],
  [0.415, 0.903],
  [0.399, 0.9],
  [0.383, 0.896],
  [0.367, 0.892],
  [0.351, 0.89],
  [0.335, 0.885],
  [0.319, 0.881],
  [0.303, 0.878],
  [0.287, 0.874],
  [0.271, 0.869],
  [0.255, 0.867],
  [0.239, 0.868],
  [0.223, 0.865],
  [0.207, 0.866],
  [0.191, 0.865],
  [0.175, 0.865],
  [0.159, 0.863],
  [0.144, 0.856],
  [0.128, 0.837],
  [0.112, 0.817],
  [0.096, 0.813],
  [0.08, 0.802],
  [0.064, 0.753],
  [0.048, 0.731],
  [0.032, 0.278],
];
const MATTE_B: [number, number][] = [
  [0.048, 0.22],
  [0.064, 0.201],
  [0.08, 0.175],
  [0.096, 0.153],
  [0.112, 0.13],
  [0.128, 0.106],
  [0.144, 0.095],
  [0.159, 0.096],
  [0.175, 0.096],
  [0.191, 0.1],
  [0.207, 0.1],
  [0.223, 0.103],
  [0.239, 0.104],
  [0.255, 0.104],
  [0.271, 0.103],
  [0.287, 0.1],
  [0.303, 0.097],
  [0.319, 0.094],
  [0.335, 0.093],
  [0.351, 0.091],
  [0.367, 0.09],
  [0.383, 0.089],
  [0.399, 0.108],
  [0.415, 0.096],
  [0.431, 0.061],
  [0.447, 0.059],
  [0.463, 0.055],
  [0.478, 0.05],
  [0.494, 0.049],
  [0.51, 0.048],
  [0.526, 0.049],
  [0.542, 0.053],
  [0.558, 0.055],
  [0.574, 0.074],
  [0.59, 0.079],
  [0.606, 0.068],
  [0.622, 0.066],
  [0.638, 0.066],
  [0.654, 0.065],
  [0.67, 0.065],
  [0.686, 0.067],
  [0.702, 0.069],
  [0.718, 0.07],
  [0.734, 0.072],
  [0.75, 0.073],
  [0.766, 0.074],
  [0.781, 0.076],
  [0.797, 0.077],
  [0.813, 0.077],
  [0.829, 0.079],
  [0.845, 0.081],
  [0.861, 0.093],
  [0.877, 0.116],
  [0.893, 0.141],
  [0.909, 0.132],
  [0.925, 0.157],
  [0.941, 0.217],
  [0.941, 0.474],
  [0.925, 0.722],
  [0.909, 0.791],
  [0.893, 0.805],
  [0.877, 0.803],
  [0.861, 0.829],
  [0.845, 0.856],
  [0.829, 0.859],
  [0.813, 0.863],
  [0.797, 0.871],
  [0.781, 0.877],
  [0.766, 0.878],
  [0.75, 0.88],
  [0.734, 0.883],
  [0.718, 0.886],
  [0.702, 0.89],
  [0.686, 0.893],
  [0.67, 0.897],
  [0.654, 0.902],
  [0.638, 0.905],
  [0.622, 0.91],
  [0.606, 0.914],
  [0.59, 0.919],
  [0.574, 0.922],
  [0.558, 0.926],
  [0.542, 0.929],
  [0.526, 0.933],
  [0.51, 0.935],
  [0.494, 0.938],
  [0.478, 0.941],
  [0.463, 0.944],
  [0.447, 0.947],
  [0.431, 0.951],
  [0.415, 0.953],
  [0.399, 0.955],
  [0.383, 0.962],
  [0.367, 0.963],
  [0.351, 0.968],
  [0.335, 0.972],
  [0.319, 0.972],
  [0.303, 0.97],
  [0.287, 0.952],
  [0.271, 0.947],
  [0.255, 0.942],
  [0.239, 0.936],
  [0.223, 0.933],
  [0.207, 0.929],
  [0.191, 0.928],
  [0.175, 0.926],
  [0.159, 0.909],
  [0.144, 0.9],
  [0.128, 0.884],
  [0.112, 0.879],
  [0.096, 0.85],
  [0.08, 0.833],
  [0.064, 0.816],
  [0.048, 0.791],
];
const MATTE_C: [number, number][] = [
  [0.016, 0.219],
  [0.032, 0.203],
  [0.048, 0.186],
  [0.064, 0.163],
  [0.08, 0.145],
  [0.096, 0.126],
  [0.112, 0.114],
  [0.128, 0.1],
  [0.144, 0.092],
  [0.159, 0.091],
  [0.175, 0.077],
  [0.191, 0.077],
  [0.207, 0.123],
  [0.223, 0.121],
  [0.239, 0.12],
  [0.255, 0.117],
  [0.271, 0.116],
  [0.287, 0.115],
  [0.303, 0.112],
  [0.319, 0.095],
  [0.335, 0.094],
  [0.351, 0.093],
  [0.367, 0.092],
  [0.383, 0.088],
  [0.399, 0.06],
  [0.415, 0.057],
  [0.431, 0.066],
  [0.447, 0.065],
  [0.463, 0.049],
  [0.478, 0.048],
  [0.494, 0.048],
  [0.51, 0.049],
  [0.526, 0.053],
  [0.542, 0.06],
  [0.558, 0.057],
  [0.574, 0.059],
  [0.59, 0.088],
  [0.606, 0.108],
  [0.622, 0.092],
  [0.638, 0.093],
  [0.654, 0.093],
  [0.67, 0.112],
  [0.686, 0.112],
  [0.702, 0.115],
  [0.718, 0.116],
  [0.734, 0.118],
  [0.75, 0.12],
  [0.766, 0.121],
  [0.781, 0.077],
  [0.797, 0.077],
  [0.813, 0.077],
  [0.829, 0.093],
  [0.845, 0.1],
  [0.861, 0.112],
  [0.877, 0.128],
  [0.893, 0.148],
  [0.909, 0.163],
  [0.925, 0.186],
  [0.941, 0.204],
  [0.957, 0.346],
  [0.973, 0.378],
  [0.973, 0.585],
  [0.957, 0.623],
  [0.941, 0.618],
  [0.925, 0.804],
  [0.909, 0.821],
  [0.893, 0.853],
  [0.877, 0.866],
  [0.861, 0.87],
  [0.845, 0.887],
  [0.829, 0.902],
  [0.813, 0.912],
  [0.797, 0.914],
  [0.781, 0.913],
  [0.766, 0.905],
  [0.75, 0.903],
  [0.734, 0.902],
  [0.718, 0.904],
  [0.702, 0.905],
  [0.686, 0.904],
  [0.67, 0.905],
  [0.654, 0.904],
  [0.638, 0.905],
  [0.622, 0.905],
  [0.606, 0.905],
  [0.59, 0.905],
  [0.574, 0.906],
  [0.558, 0.907],
  [0.542, 0.907],
  [0.526, 0.907],
  [0.51, 0.908],
  [0.494, 0.909],
  [0.478, 0.907],
  [0.463, 0.907],
  [0.447, 0.907],
  [0.431, 0.908],
  [0.415, 0.907],
  [0.399, 0.906],
  [0.383, 0.906],
  [0.367, 0.906],
  [0.351, 0.905],
  [0.335, 0.903],
  [0.319, 0.902],
  [0.303, 0.902],
  [0.287, 0.901],
  [0.271, 0.902],
  [0.255, 0.903],
  [0.239, 0.906],
  [0.223, 0.907],
  [0.207, 0.909],
  [0.191, 0.913],
  [0.175, 0.915],
  [0.159, 0.911],
  [0.144, 0.902],
  [0.128, 0.886],
  [0.112, 0.868],
  [0.096, 0.866],
  [0.08, 0.853],
  [0.064, 0.82],
  [0.048, 0.803],
  [0.032, 0.779],
  [0.016, 0.248],
];

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
        slam: true,
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
        crop: { x: 380, y: 60, w: 340, h: 605 },
        floorLines: ['QUIET', 'ON PAPER'],
        noCaptions: true,
      },
      {
        trigger: 'Near the Queensland',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [scene('extraction-02')],
        crop: { x: 560, y: 0, w: 405, h: 720 },
        floorLines: ['QLD COAST', 'NEAR NORMAL'],
        floorSize: 132,
        noCaptions: true,
      },
      {
        trigger: 'and one system',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [scene('extraction-03')],
        crop: { x: 600, y: 0, w: 405, h: 720 },
        floorLines: ['ONE SYSTEM', 'SERIOUS', 'DAMAGE'],
        floorSize: 140,
        noCaptions: true,
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
        kind: 'floor',
        subjects: [EXTRACTION, X800],
        images: [scene('extraction-02'), img(X800, '20568158994585')],
        crop: { x: 300, y: 0, w: 405, h: 720 },
        product: { image: 1, x: 330, y: 880, w: 520 },
        kinetic: ['Ready', 'for', 'the', 'work.'],
        noCaptions: true,
      },
      {
        trigger: 'Load the truck',
        kind: 'floor',
        subjects: [SOLUTION],
        images: [scene('solution-01')],
        crop: VAN,
        kinetic: ['Load', 'the', 'truck.'],
        noCaptions: true,
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
  {
    // Concept A "Two in the middle" (blind pick, 08/11/2026). Owned air mover
    // catalogue photos, cut from white, stand in owned job rooms; the count
    // lies on the floor. No drying scene is implied: these are empty rooms.
    // Every line on screen and in the voiceover is CCW's own wording on the
    // air movers collection page (read 08/11/2026; see the script doc).
    videoId: 'ccw-w1-d2-am',
    cta: 'See the air mover range',
    url: 'ccwonline.com.au',
    shots: [
      {
        trigger: 'Four air movers',
        kind: 'floor',
        subjects: [ROTARY, X400, XLOW, VELO, MINI],
        images: [
          `${ROTARY}-04.webp`,
          img(X400, '20568472191129'),
          img(XLOW, '20570371195033'),
          img(VELO, '50827539546325'),
          img(MINI, '29365645703'),
        ],
        crop: ROOM,
        place: [
          { img: 2, x: 290, y: 770, w: 240 },
          { img: 4, x: 770, y: 780, w: 210 },
          { img: 3, x: 220, y: 1520, w: 400 },
          { img: 1, x: 810, y: 1430, w: 330, flip: true, clipBottom: 0.105 },
        ],
        floorLines: ['4 PLACED', 'BEAT 2', 'POWERFUL'],
        floorSize: 150,
        noCaptions: true,
      },
      {
        trigger: 'two powerful ones',
        kind: 'floor',
        subjects: [ROTARY, X800],
        images: [`${ROTARY}-03.webp`, img(X800, '20568160796825')],
        crop: { x: 760, y: 0, w: 405, h: 720 },
        // Side view: the pair face each other, aimed at the middle.
        place: [
          { img: 1, x: 300, y: 780, w: 380, flip: true },
          { img: 1, x: 790, y: 780, w: 380 },
        ],
        floorLines: ['THE', 'MIDDLE'],
        floorSize: 150,
        noCaptions: true,
      },
      {
        trigger: 'Evaporation',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [scene('extraction-02')],
        crop: { x: 430, y: 0, w: 405, h: 720 },
        floorLines: ['SURFACE', 'AREA'],
        rippleTo: 0.3,
        rippleFrom: 0.2,
        noCaptions: true,
      },
      {
        trigger: 'That is why',
        kind: 'floor',
        subjects: [VELO],
        images: [img(VELO, '29703296135')],
        crop: { x: 385, y: 196, w: 484, h: 860 },
        floorLines: ['UNIT', 'COUNT'],
        floorSize: 150,
        noCaptions: true,
      },
      {
        // "COUNT OVER SPEC" cut (orchestrator, 08/11/2026): UNIT COUNT on the
        // van carries that idea once; its time goes to PLACEMENT MATTERS.
        trigger: 'any one',
        kind: 'floor',
        subjects: [ROTARY, VELO, XLOW, GALE, MINI],
        images: [
          `${ROTARY}-02.webp`,
          img(VELO, '51412267729109'),
          img(XLOW, '7796773257275'),
          img(GALE, '28712740978841'),
          img(MINI, '37228686180565'),
        ],
        crop: { x: 500, y: 0, w: 405, h: 720 },
        place: [
          { img: 3, x: 250, y: 560, w: 210 },
          { img: 2, x: 800, y: 590, w: 210, flip: true },
          { img: 4, x: 860, y: 1250, w: 300, flip: true },
          { img: 1, x: 250, y: 1560, w: 420, silhouette: true },
        ],
        floorLines: ['PLACEMENT', 'MATTERS'],
        floorSize: 140,
        noCaptions: true,
      },
      {
        // Same room, the camera moves right along the skirting: a second
        // spread of units, so no hold runs past 4.5 s.
        trigger: 'Placement',
        kind: 'floor',
        subjects: [ROTARY, X800, XLOW, GALE, MINI],
        images: [
          `${ROTARY}-02.webp`,
          img(X800, '20568158994585'),
          img(XLOW, '7796773257275'),
          img(GALE, '28712740978841'),
          img(MINI, '37228686180565'),
        ],
        crop: { x: 860, y: 0, w: 405, h: 720 },
        place: [
          { img: 3, x: 260, y: 560, w: 210 },
          { img: 1, x: 800, y: 600, w: 270, flip: true },
          { img: 4, x: 850, y: 1240, w: 280 },
          { img: 2, x: 290, y: 1540, w: 400 },
        ],
        floorLines: ['BEATS', 'POWER'],
        floorSize: 140,
        noCaptions: true,
      },
      {
        trigger: 'See the air mover range',
        kind: 'end',
        subjects: [ROTARY],
        // Back to the hook room: a hard cut, not the placement room again.
        images: [`${ROTARY}-04.webp`],
        crop: ROOM,
      },
    ],
  },
  {
    // Concept B "Floor's-eye view" with concept A's hook (blind pick,
    // 08/11/2026). Every line is on CCW's own product and collection pages.
    // Units on a raised photo angle use `product` (outline drop shadow).
    videoId: 'ccw-w1-d2-pm',
    cta: 'See the low-profile units',
    url: 'ccwonline.com.au',
    shots: [
      {
        trigger: 'Most of the wet area',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [SCENE('extraction-01')],
        crop: { x: 250, y: 0, w: 405, h: 720 },
        floorLines: ['BENEATH A', 'VANITY'],
        floorSize: 150,
        slam: true,
        kinetic: ['Most', 'of', 'the', 'wet', 'area'],
        noCaptions: true,
      },
      {
        trigger: 'is under something',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [SCENE('extraction-02')],
        crop: { x: 150, y: 0, w: 405, h: 720 },
        noCaptions: true,
      },
      {
        trigger: 'Low profile goes',
        kind: 'floor',
        subjects: [ROTARY, VELO],
        images: [SCENE('rotary-04'), img(VELO, '50827539546325')],
        crop: ROOM,
        product: { image: 1, x: 420, y: 760, w: 440 },
        kinetic: ['Low', 'profile', 'goes', 'where', 'standard', 'cannot.'],
        noCaptions: true,
      },
      {
        trigger: 'under a bed',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [SCENE('extraction-03')],
        crop: { x: 0, y: 0, w: 405, h: 720 },
        noCaptions: true,
      },
      {
        trigger: 'against a skirting',
        kind: 'floor',
        subjects: ['carpet-cleaning/carpet-cleaning-result', VELO],
        images: [SCENE('result-02'), img(VELO, '51412267729109')],
        crop: { x: 250, y: 0, w: 405, h: 720 },
        product: { image: 1, x: 420, y: 1180, w: 440 },
        kinetic: ['against', 'a', 'skirting,'],
        noCaptions: true,
      },
      {
        trigger: 'beneath a vanity',
        kind: 'floor',
        subjects: [ROTARY],
        images: [SCENE('rotary-03')],
        crop: { x: 640, y: 0, w: 405, h: 720 },
        noCaptions: true,
      },
      {
        trigger: 'The XPOWER',
        kind: 'floor',
        subjects: ['carpet-cleaning/carpet-cleaning-result', XLOW],
        images: [SCENE('result-01'), img(XLOW, '7796774961211')],
        crop: JAMB,
        product: { image: 1, x: 260, y: 160, w: 500 },
        floorLines: ['XPOWER', 'PL-700A'],
        floorSize: 150,
        noCaptions: true,
      },
      {
        trigger: 'twenty-one',
        kind: 'floor',
        subjects: ['carpet-cleaning/carpet-cleaning-grooming', XLOW],
        images: [SCENE('grooming-01'), img(XLOW, '20570371195033')],
        crop: { x: 500, y: 0, w: 405, h: 720 },
        product: { image: 1, x: 220, y: 300, w: 640 },
        floorLines: ['21 CM', 'HIGH'],
        noCaptions: true,
      },
      {
        // Back to the hook's cabinet, tight on the toe-kick gap.
        trigger: 'It fits under',
        kind: 'floor',
        subjects: [EXTRACTION, XLOW],
        images: [SCENE('extraction-01'), img(XLOW, '20570371195033')],
        crop: { x: 330, y: 120, w: 337, h: 600 },
        place: [{ img: 1, x: 560, y: 660, w: 440, silhouette: true }],
        floorLines: ['UNDER', 'TOE-KICKS'],
        floorSize: 150,
        noCaptions: true,
      },
      {
        trigger: 'beds and furniture',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [SCENE('extraction-03')],
        crop: { x: 560, y: 0, w: 405, h: 720 },
        noCaptions: true,
      },
      {
        trigger: 'The Dri-Eaz Velo',
        kind: 'floor',
        subjects: [ROTARY, VELO],
        images: [SCENE('rotary-04'), img(VELO, '50827539546325')],
        crop: { x: 470, y: 0, w: 405, h: 720 },
        product: { image: 1, x: 640, y: 430, w: 360 },
        floorLines: ['HALF THE', 'HEIGHT'],
        floorSize: 160,
        sourceSlip: 'Dri-Eaz: half the height of snail-shell dryers',
        noCaptions: true,
      },
      {
        trigger: 'low-profile units',
        kind: 'end',
        subjects: ['carpet-cleaning/carpet-cleaning-result'],
        images: [SCENE('result-01')],
        crop: JAMB,
      },
    ],
  },
  {
    // Concept A "The twin" (blind pick 39/60, 08/11/2026). CTA matches the
    // landing link (/collections/airmovers), orchestrator note 08/11/2026.
    videoId: 'ccw-w1-d3-am',
    cta: 'See the air mover range',
    url: 'ccwonline.com.au',
    shots: [
      {
        // Hook: the red unit on the carpet; its twin (the same owned photo,
        // mirrored and graded cool, labelled as an illustration) cuts in
        // beside it with a camera jolt at 0.3 s.
        trigger: 'Two machines',
        kind: 'floor',
        subjects: [ROTARY, MAXF],
        images: [`${ROTARY}-04.webp`, img(MAXF, '24131841654937')],
        crop: ROOM,
        place: [
          { img: 1, x: 290, y: 1240, w: 520 },
          {
            img: 1,
            x: 740,
            y: 1200,
            w: 480,
            at: 0.3,
            flip: true,
            twin: true,
            silhouette: true,
            slip: 'Illustration: US 115 V model',
            decal: [[0, 0.22, 0.3, 0.46]],
          },
        ],
        kinetic: ['Two', 'machines', 'can', 'look', 'the', 'same'],
        slam: true,
        noCaptions: true,
      },
      {
        // Same room, the camera swings in on the twin; the real unit stays
        // in frame.
        trigger: 'and still not',
        kind: 'floor',
        subjects: [ROTARY, MAXF],
        images: [`${ROTARY}-04.webp`, img(MAXF, '24131841654937')],
        crop: { x: 760, y: 200, w: 326, h: 580 },
        place: [
          { img: 1, x: 170, y: 700, w: 480 },
          {
            img: 1,
            x: 660,
            y: 690,
            w: 500,
            flip: true,
            twin: true,
            silhouette: true,
            slip: 'Illustration: US 115 V model',
            decal: [[0, 0.22, 0.3, 0.46]],
          },
        ],
        floorLines: ['NOT THE SAME', 'MACHINE'],
        floorSize: 130,
        noCaptions: true,
      },
      {
        // The turn: the twin is Dry Air's US listing, labelled on the floor;
        // the real unit stands behind it, so the source slip sits with it.
        trigger: 'Dry Air Technology',
        kind: 'floor',
        subjects: [RESULT, MAXF],
        images: [`${RESULT}-01.webp`, img(MAXF, '51412332478677')],
        crop: { x: 200, y: 0, w: 405, h: 720 },
        place: [
          { img: 1, x: 250, y: 600, w: 300 },
          {
            img: 1,
            x: 600,
            y: 760,
            w: 560,
            flip: true,
            twin: true,
            silhouette: true,
            slip: 'Illustration: US 115 V model',
            decal: [
              [0.49, 0.27, 0.9, 0.49],
              [0.59, 0.68, 0.79, 0.89],
            ],
          },
        ],
        floorLines: ["DRY AIR'S", 'US LISTING'],
        floorSize: 130,
        sourceSlip: "Source: CCW's Max Force page",
        noCaptions: true,
      },
      {
        // A new room at floor height: the twin and the real unit side by
        // side, the US label lying in front of the twin.
        trigger: 'Max Force at',
        kind: 'floor',
        subjects: [EXTRACTION, MAXF],
        images: [`${EXTRACTION}-02.webp`, img(MAXF, '51412332478677')],
        crop: { x: 150, y: 0, w: 405, h: 720 },
        place: [
          {
            img: 1,
            x: 340,
            y: 720,
            w: 460,
            flip: true,
            twin: true,
            silhouette: true,
            slip: 'Illustration: US 115 V model',
            decal: [
              [0.49, 0.27, 0.9, 0.49],
              [0.59, 0.68, 0.79, 0.89],
            ],
          },
          { img: 1, x: 800, y: 700, w: 420 },
        ],
        floorLines: ['US MODEL:', '115 V'],
        floorSize: 150,
        noCaptions: true,
      },
      {
        // The real one, from behind; the type sits on the carpet, clear of
        // the maker's plate.
        trigger: 'This is the 220',
        kind: 'floor',
        subjects: [ROTARY, MAXF],
        images: [`${ROTARY}-03.webp`, img(MAXF, '51412332904661')],
        crop: { x: 640, y: 0, w: 405, h: 720 },
        place: [{ img: 1, x: 560, y: 710, w: 620 }],
        floorLines: ['THE 220 V / 50 HZ', 'VERSION'],
        floorSize: 112,
        sourceSlip: "From CCW's Max Force listing",
        noCaptions: true,
      },
      {
        // Same unit, the camera tracks round to its right side.
        trigger: 'with an Australian',
        kind: 'floor',
        subjects: [ROTARY, MAXF],
        images: [`${ROTARY}-03.webp`, img(MAXF, '51412332904661')],
        crop: { x: 380, y: 100, w: 349, h: 620 },
        place: [{ img: 1, x: 700, y: 740, w: 600 }],
        floorLines: ['WITH AN', 'AUSTRALIAN PLUG'],
        floorSize: 96,
        noCaptions: true,
      },
      {
        trigger: 'BD2500 is',
        kind: 'floor',
        subjects: [EXTRACTION, BD2500],
        images: [`${EXTRACTION}-04.webp`, img(BD2500, '40568829935829')],
        crop: { x: 450, y: 0, w: 405, h: 720 },
        // Grounded on its footprint from the first frame.
        place: [
          {
            img: 1,
            x: 540,
            y: 720,
            w: 620,
            footprint: [
              [0.093, 0.59],
              [0.444, 0.989],
              [0.819, 0.877],
              [0.468, 0.478],
            ],
          },
        ],
        floorLines: ['BD2500: THE', '230 V VERSION'],
        floorSize: 120,
        sourceSlip: "From CCW's BD2500 listing",
        noCaptions: true,
      },
      {
        trigger: 'Check the plug',
        kind: 'floor',
        // The dehumidifier again, closer, in a new room (each
        // Max Force photo is already in two shots).
        subjects: [EXTRACTION, BD2500],
        images: [`${EXTRACTION}-03.webp`, img(BD2500, '40568829935829')],
        crop: { x: 0, y: 0, w: 405, h: 720 },
        place: [
          {
            img: 1,
            x: 560,
            y: 710,
            w: 600,
            footprint: [
              [0.093, 0.59],
              [0.444, 0.989],
              [0.819, 0.877],
              [0.468, 0.478],
            ],
          },
        ],
        floorLines: ['CHECK THE PLUG', 'AND THE FREQUENCY'],
        floorSize: 88,
        noCaptions: true,
      },
      {
        trigger: 'See the air mover range',
        kind: 'end',
        subjects: [RESULT],
        images: [`${RESULT}-02.webp`],
        crop: { x: 250, y: 0, w: 405, h: 720 },
      },
    ],
  },
  {
    // Concept A "Wet tiles, then the kit" (blind pick 42/60, 08/11/2026).
    // Every line quotes SafeWork NSW or CCW's product pages; the S500 line
    // was cut (founder signs off IICRC citations, ruling 08/11/2026). CTA
    // matches the landing link (/collections/airmovers).
    videoId: 'ccw-w1-d3-pm',
    cta: 'See the air mover range',
    url: 'ccwonline.com.au',
    shots: [
      {
        // Hook: the real wet job, low over the tiles; the line slams onto
        // the wet floor.
        trigger: 'Clean up water',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [`${EXTRACTION}-01.webp`],
        crop: { x: 760, y: 60, w: 371, h: 660 },
        floorLines: ['24 TO 48', 'HOURS'],
        floorSize: 210,
        slam: true,
        noCaptions: true,
      },
      {
        trigger: 'within 24',
        kind: 'floor',
        subjects: [EXTRACTION],
        images: [`${EXTRACTION}-02.webp`],
        crop: { x: 300, y: 0, w: 405, h: 720 },
        floorLines: ['CLEAN UP', 'PROMPTLY'],
        floorSize: 170,
        sourceSlip: 'Source: SafeWork NSW, Mould at work',
        noCaptions: true,
      },
      {
        // The turn: the operator stands on the Water Claw on dry carpet.
        trigger: 'The Water Claw',
        kind: 'floor',
        subjects: [ROTARY, CLAW],
        images: [`${ROTARY}-04.webp`, img(CLAW, '51733981921493')],
        crop: ROOM,
        place: [{ img: 1, x: 560, y: 840, w: 900, silhouette: true }],
        floorLines: ['WATER CLAW:', 'STAND ON IT'],
        floorSize: 136,
        noCaptions: true,
      },
      {
        trigger: 'without removing',
        kind: 'floor',
        subjects: [EXTRACTION, CLAW],
        images: [`${EXTRACTION}-04.webp`, img(CLAW, '51733981888725')],
        crop: { x: 300, y: 0, w: 405, h: 720 },
        place: [{ img: 1, x: 620, y: 760, w: 700, silhouette: true }],
        floorLines: ['WITHOUT LIFTING', 'THE PAD'],
        floorSize: 116,
        noCaptions: true,
      },
      {
        trigger: 'The SOS',
        kind: 'floor',
        subjects: [RESULT, SOSPRO],
        images: [`${RESULT}-01.webp`, img(SOSPRO, '51412401029333')],
        crop: { x: 300, y: 0, w: 405, h: 720 },
        place: [{ img: 1, x: 560, y: 760, w: 640, silhouette: true }],
        floorLines: ['SOS PRO:', 'CLEAR TOP'],
        floorSize: 150,
        noCaptions: true,
      },
      {
        trigger: 'shows what',
        kind: 'floor',
        subjects: [GROOM, SOSPRO],
        images: [`${GROOM}-01.webp`, img(SOSPRO, '51412400832725')],
        crop: { x: 600, y: 0, w: 405, h: 720 },
        place: [{ img: 1, x: 560, y: 760, w: 720, silhouette: true }],
        floorLines: ['SEE WHAT IS', 'COMING OUT'],
        floorSize: 136,
        noCaptions: true,
      },
      {
        trigger: 'The X-800',
        kind: 'floor',
        subjects: [ROTARY, X800],
        images: [`${ROTARY}-02.webp`, img(X800, '20568160796825')],
        crop: { x: 700, y: 0, w: 405, h: 720 },
        place: [{ img: 1, x: 560, y: 760, w: 560, silhouette: true }],
        floorLines: ['XPOWER', 'X-800'],
        floorSize: 160,
        noCaptions: true,
      },
      {
        trigger: 'dry your floors',
        kind: 'floor',
        subjects: [ROTARY, X800],
        images: [`${ROTARY}-03.webp`, img(X800, '20568158994585')],
        crop: { x: 640, y: 0, w: 405, h: 720 },
        place: [{ img: 1, x: 580, y: 740, w: 600, silhouette: true }],
        floorLines: ['DESIGNED TO DRY', 'YOUR FLOORS'],
        floorSize: 104,
        noCaptions: true,
      },
      {
        trigger: 'air mover range',
        kind: 'end',
        subjects: [RESULT],
        images: [`${RESULT}-02.webp`],
        crop: { x: 250, y: 0, w: 405, h: 720 },
      },
    ],
  },
  {
    // Concept A "The stack" (blind pick 40/60 against 36 and 30, 08/11/2026),
    // set in owned job rooms: every office photo has a red wand in frame. CTA
    // matches the landing link (/collections/razorback).
    videoId: 'ccw-w1-d4-pm',
    cta: 'See Razorback filters and spares',
    url: 'ccwonline.com.au',
    shots: [
      {
        // Hook: the unit in an empty room; the line slams onto the carpet.
        trigger: 'The pre-filter protects',
        kind: 'floor',
        sceneBlur: 1.2,
        subjects: [ROTARY, MAXX],
        images: [`${ROTARY}-04.webp`, MAXX_A],
        crop: { x: 722, y: 40, w: 360, h: 640 },
        place: [
          { img: 1, x: 620, y: 830, w: 580, footprint: FOOT_A, matte: MATTE_A },
        ],
        floorLines: ['THE PRE-FILTER', 'PROTECTS THE HEPA'],
        floorSize: 98,
        slam: true,
        noCaptions: true,
      },
      {
        trigger: 'It takes the coarse',
        kind: 'floor',
        sceneBlur: 1.2,
        subjects: [EXTRACTION, MAXX],
        images: [`${EXTRACTION}-02.webp`, MAXX_C],
        crop: { x: 882, y: 40, w: 360, h: 640 },
        place: [
          { img: 1, x: 560, y: 760, w: 600, silhouette: true, matte: MATTE_C },
        ],
        floorLines: ['FIRST STAGE:', 'THE PRE-FILTER'],
        floorSize: 118,
        noCaptions: true,
      },
      {
        trigger: 'behind it does',
        kind: 'floor',
        sceneBlur: 1.2,
        subjects: [RESULT, MAXX],
        images: [`${RESULT}-01.webp`, MAXX_B],
        crop: { x: 322, y: 40, w: 360, h: 640 },
        place: [
          { img: 1, x: 560, y: 760, w: 620, footprint: FOOT_B, matte: MATTE_B },
        ],
        floorLines: ['HEPA / ACTIVATED', 'CARBON FILTER'],
        floorSize: 100,
        noCaptions: true,
      },
      {
        // The turn: the type alone on an empty floor, and it breaks up.
        trigger: 'Running without it',
        kind: 'floor',
        sceneBlur: 1.2,
        subjects: [RESULT],
        images: [`${RESULT}-01.webp`],
        crop: { x: 860, y: 40, w: 360, h: 640 },
        floorLines: ['RUNNING', 'WITHOUT IT'],
        floorSize: 156,
        rippleTo: 1,
        rippleFrom: 0.25,
        noCaptions: true,
      },
      {
        trigger: 'turns a cheap',
        kind: 'floor',
        sceneBlur: 1.2,
        subjects: [ROTARY, MAXX],
        images: [`${ROTARY}-02.webp`, MAXX_A],
        crop: { x: 722, y: 40, w: 360, h: 640 },
        place: [
          {
            img: 1,
            x: 560,
            y: 760,
            w: 580,
            footprint: FOOT_A,
            matte: MATTE_A,
          },
        ],
        floorLines: ['A CHEAP', 'FILTER CHANGE'],
        floorSize: 126,
        noCaptions: true,
      },
      {
        trigger: 'into an expensive',
        kind: 'floor',
        sceneBlur: 1.2,
        subjects: [RESULT, MAXX],
        images: [`${RESULT}-02.webp`, MAXX_C],
        crop: { x: 760, y: 40, w: 360, h: 640 },
        place: [
          { img: 1, x: 580, y: 740, w: 640, silhouette: true, matte: MATTE_C },
        ],
        floorLines: ['INTO AN', 'EXPENSIVE ONE'],
        floorSize: 122,
        noCaptions: true,
      },
      {
        trigger: 'CCW recommends',
        kind: 'floor',
        sceneBlur: 1.2,
        subjects: [GROOM, MAXX],
        images: [`${GROOM}-01.webp`, MAXX_B],
        crop: { x: 622, y: 40, w: 360, h: 640 },
        place: [
          {
            img: 1,
            x: 560,
            y: 760,
            w: 600,
            footprint: FOOT_B,
            matte: MATTE_B,
          },
        ],
        floorLines: ['MAXXGUARD 550', 'PRE-FILTER'],
        floorSize: 116,
        noCaptions: true,
      },
      {
        trigger: 'every two to three',
        kind: 'floor',
        sceneBlur: 1.2,
        subjects: [EXTRACTION],
        images: [`${EXTRACTION}-04.webp`],
        crop: { x: 322, y: 40, w: 360, h: 640 },
        floorLines: ['EVERY 2 TO', '3 MONTHS'],
        floorSize: 156,
        sourceSlip: 'Source: CCW pre-filter listing',
        noCaptions: true,
      },
      {
        trigger: 'filters and spares',
        kind: 'end',
        subjects: [RESULT],
        images: [`${RESULT}-02.webp`],
        crop: { x: 272, y: 40, w: 360, h: 640 },
      },
    ],
  },
];
