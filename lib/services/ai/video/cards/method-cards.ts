export interface MethodCard {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  promptScaffold: string;
  negativePrompt?: string;
  params: Record<string, string | number | boolean>;
  requiresImage: boolean;
  category: 'product' | 'brand' | 'story' | 'freeform';
  exampleSubjects: [string, string, string];
}

export const METHOD_CARDS: MethodCard[] = [
  {
    id: 'product-reveal',
    name: 'Product Reveal',
    description:
      'A dramatic studio reveal that builds anticipation before the hero shot.',
    thumbnail: '/video-cards/product-reveal.jpg',
    promptScaffold:
      'A dramatic product reveal of {{subject}}, starting in shadow, light sweeping across to reveal it, ending on a crisp hero shot, studio backdrop, shallow depth of field',
    negativePrompt: 'text, watermark, blurry, low quality',
    params: {},
    requiresImage: false,
    category: 'product',
    exampleSubjects: [
      'a cordless moisture meter',
      'a premium espresso machine',
      "a tradesperson's tool kit",
    ],
  },
  {
    id: 'talking-product',
    name: 'Talking Product',
    description:
      'Energetic social-media style presentation with the product as hero.',
    thumbnail: '/video-cards/talking-product.jpg',
    promptScaffold:
      'An energetic social media presentation shot of {{subject}}, held up to camera, bright engaging framing, quick subtle zooms, the product is the hero',
    params: {},
    requiresImage: false,
    category: 'product',
    exampleSubjects: [
      'a waterproofing spray can',
      'a reusable coffee cup',
      'a compact power drill',
    ],
  },
  {
    id: 'before-after',
    name: 'Before / After',
    description:
      'Satisfying transformation from damaged to pristine with a smooth wipe.',
    thumbnail: '/video-cards/before-after.jpg',
    promptScaffold:
      'A satisfying before-and-after transformation of {{subject}}, the scene transitions from damaged/messy state to pristine restored state with a smooth wipe, same camera angle held throughout',
    params: {},
    requiresImage: false,
    category: 'story',
    exampleSubjects: [
      'a flood-damaged hallway',
      'a stained commercial kitchen floor',
      'a mould-affected bathroom',
    ],
  },
  {
    id: 'logo-motion',
    name: 'Logo Motion',
    description:
      'Premium motion graphics assembling the brand mark from particles.',
    thumbnail: '/video-cards/logo-motion.jpg',
    promptScaffold:
      'An elegant motion graphics animation of {{subject}}, particles and light trails assembling into the mark, dark premium background, smooth easing',
    params: {},
    requiresImage: true,
    category: 'brand',
    exampleSubjects: [
      'the RestoreAssist logo',
      'a café loyalty program badge',
      'a construction company emblem',
    ],
  },
  {
    id: 'lifestyle-broll',
    name: 'Lifestyle B-roll',
    description: 'Candid documentary footage in a real-world setting.',
    thumbnail: '/video-cards/lifestyle-broll.jpg',
    promptScaffold:
      'Natural lifestyle b-roll footage of {{subject}}, candid documentary feel, soft natural light, handheld subtle movement, authentic real-world setting',
    params: {},
    requiresImage: false,
    category: 'story',
    exampleSubjects: [
      'a tradie arriving on a job site',
      'baristas preparing morning coffee',
      'a family enjoying a freshly restored deck',
    ],
  },
  {
    id: 'stat-punch',
    name: 'Stat Punch-in',
    description:
      'Bold kinetic scene with a dramatic punch-in move for data emphasis.',
    thumbnail: '/video-cards/stat-punch.jpg',
    promptScaffold:
      'A bold kinetic scene emphasising {{subject}}, dramatic punch-in camera move, high contrast, strong focal emphasis, energetic pacing',
    params: {},
    requiresImage: false,
    category: 'brand',
    exampleSubjects: [
      'a 98% customer satisfaction rating',
      '500 jobs completed this year',
      'same-day response guarantee',
    ],
  },
  {
    id: 'unboxing',
    name: 'Unboxing',
    description: 'First-person unboxing shot with anticipation pacing.',
    thumbnail: '/video-cards/unboxing.jpg',
    promptScaffold:
      'A first-person unboxing shot of {{subject}}, hands opening packaging on a clean desk, anticipation pacing, soft top light, satisfying reveal',
    params: {},
    requiresImage: false,
    category: 'product',
    exampleSubjects: [
      'a professional inspection camera kit',
      'a specialty café subscription box',
      'a branded safety equipment bundle',
    ],
  },
  {
    id: 'seasonal-hook',
    name: 'Seasonal Hook',
    description: 'Seasonal themed scene with warm celebratory motion.',
    thumbnail: '/video-cards/seasonal-hook.jpg',
    promptScaffold:
      'A seasonal themed scene featuring {{subject}}, festive atmosphere appropriate to the season, warm inviting tones, gentle celebratory motion',
    params: {},
    requiresImage: false,
    category: 'story',
    exampleSubjects: [
      'a summer home maintenance offer',
      'a Christmas café specials board',
      'an end-of-financial-year tradie deal',
    ],
  },
  {
    id: 'freeform',
    name: 'Freeform',
    description:
      'Write your own prompt — full creative control with no scaffold.',
    thumbnail: '/video-cards/freeform.jpg',
    promptScaffold: '{{subject}}',
    params: {},
    requiresImage: false,
    category: 'freeform',
    exampleSubjects: [
      'a slow motion pour of coffee into a white cup',
      'storm clouds over a freshly restored roof',
      'a time-lapse of a café opening for the day',
    ],
  },
];

export function getMethodCard(id: string): MethodCard | undefined {
  return METHOD_CARDS.find(c => c.id === id);
}
