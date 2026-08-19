/**
 * Remotion Composition Registry
 *
 * Pure-data registry of all available compositions. Has zero remotion imports
 * so it is safe to import in server-side API routes without pulling the
 * remotion bundle into serverless functions.
 *
 * The Remotion Player / Root component imports this and adds React component
 * bindings on top.
 */

import type {
  CompositionMeta,
  SocialReelProps,
  ExplainerVideoProps,
  BrandShowcaseProps,
  BrandReelProps,
  BrandSquareProps,
  HowToVideoProps,
  SchematicExplainerProps,
  GitCommitTimelineProps,
  BoardDecisionCardProps,
  InvisibleLineOutroProps,
  TipCardProps,
  StatRevealProps,
  ComparisonSlideProps,
  ListicleVideoProps,
  CaseStudyVideoProps,
  QuoteCardProps,
  CountdownCTAProps,
  DefinitionCardProps,
} from './types';
import type { InvisibleLineAnthemProps } from './compositions/InvisibleLineAnthem';

// ── Default Props ─────────────────────────────────────────────────────────────

const DEFAULT_SOCIAL_REEL_PROPS: SocialReelProps = {
  title: 'Your Brand Story',
  scenes: [
    {
      text: 'Engage your audience',
      subtitle: 'With powerful visuals',
      duration: 60,
    },
    { text: 'Tell your story', subtitle: 'In seconds', duration: 60 },
    { text: 'Drive action', subtitle: 'With every post', duration: 60 },
  ],
  brandColour: '#f59e0b',
  showProgress: true,
};

const DEFAULT_EXPLAINER_PROPS: ExplainerVideoProps = {
  title: 'How It Works',
  scenes: [
    {
      text: 'Step 1: Create your content',
      subtitle: 'AI generates platform-optimised posts',
      duration: 90,
    },
    {
      text: 'Step 2: Schedule & publish',
      subtitle: 'Automated cross-platform distribution',
      duration: 90,
    },
    {
      text: 'Step 3: Analyse results',
      subtitle: 'Real-time engagement analytics',
      duration: 90,
    },
  ],
  brandColour: '#f59e0b',
  transition: 'fade',
};

const DEFAULT_BRAND_SHOWCASE_PROPS: BrandShowcaseProps = {
  title: 'Your Brand',
  tagline: 'Your tagline goes here',
  valueProps: [
    'Value proposition 1',
    'Value proposition 2',
    'Value proposition 3',
  ],
  scenes: [],
  brandColour: '#f59e0b',
  websiteUrl: 'yourbrand.com',
  industry: 'Your Industry',
};

const DEFAULT_BRAND_REEL_PROPS: BrandReelProps = {
  title: 'Your Brand',
  hookText: 'Did you know?',
  benefit: 'We solve your biggest challenge',
  scenes: [],
  brandColour: '#f59e0b',
  ctaText: 'Learn More',
};

const DEFAULT_BRAND_SQUARE_PROPS: BrandSquareProps = {
  title: 'Your Brand',
  problem: 'The challenge your audience faces',
  solution: 'How your brand solves it',
  scenes: [],
  brandColour: '#f59e0b',
  ctaText: 'Get Started',
};

const DEFAULT_HOW_TO_PROPS: HowToVideoProps = {
  title: 'How To Get Started',
  scenes: [],
  steps: [
    { step: 'Visit synthex.social', detail: 'Click Get Started Free' },
    {
      step: 'Create your account',
      detail: 'Enter your business name and email',
    },
    {
      step: 'Verify your email',
      detail: 'Check your inbox and click the link',
    },
    { step: 'Complete activation', detail: 'Follow the 5-step checklist' },
    {
      step: 'Generate your first post',
      detail: 'AI creates content in seconds',
    },
  ],
  brandColour: '#f59e0b',
};

const DEFAULT_SCHEMATIC_EXPLAINER_PROPS: SchematicExplainerProps = {
  title: 'How Synthex Publishes',
  scenes: [],
  steps: [
    { label: 'Ingest', detail: 'Pull your brand voice and campaign brief' },
    { label: 'Generate', detail: 'AI drafts platform-optimised posts' },
    { label: 'Schedule', detail: 'Queue across every connected channel' },
    { label: 'Analyse', detail: 'Track engagement and refine automatically' },
  ],
  accentColour: '#38BDF8',
};

// ── Educational Default Props (SYN-429 compositions, registered in SYN-1113) ──
//
// Dimensions and durations below match the canonical values documented on each
// prop type and declared by all 80 EDUCATIONAL_VIDEOS entries that use them.
// `renderMedia` takes its metadata from this registry, so a composition absent
// here could not be rendered at all.

const DEFAULT_TIP_CARD_PROPS: TipCardProps = {
  title: 'Marketing Tip',
  scenes: [],
  brandColour: '#FF6B35',
  tipNumber: 1,
  tip: 'Post when your audience is awake',
  explanation:
    'Check your analytics for peak activity hours, then schedule to match.',
};

const DEFAULT_STAT_REVEAL_PROPS: StatRevealProps = {
  title: 'By the Numbers',
  scenes: [],
  brandColour: '#FF6B35',
  stat: '10 hours',
  statLabel: 'saved every week',
  context: 'Reported by early Synthex adopters automating content creation.',
};

const DEFAULT_COMPARISON_SLIDE_PROPS: ComparisonSlideProps = {
  title: 'A Better Way to Publish',
  scenes: [],
  brandColour: '#FF6B35',
  oldWay: 'Write every post by hand, then copy it into each platform.',
  newWay: 'Describe the campaign once and publish everywhere from one queue.',
};

const DEFAULT_LISTICLE_PROPS: ListicleVideoProps = {
  title: '5 Ways to Improve Your Social Presence',
  scenes: [],
  brandColour: '#FF6B35',
  items: [
    'Publish on a consistent schedule',
    'Write for one specific reader',
    'Lead with the outcome, not the feature',
    'Reply to every comment in the first hour',
    'Measure what you decide to change',
  ],
};

const DEFAULT_CASE_STUDY_PROPS: CaseStudyVideoProps = {
  title: 'Client Result',
  scenes: [],
  brandColour: '#FF6B35',
  challenge: 'A three-person team could not post consistently across channels.',
  solution:
    'Synthex generated and scheduled a month of content in one sitting.',
  result: 'Publishing became daily and engagement rose across every channel.',
  metric: '+340% reach',
};

const DEFAULT_QUOTE_CARD_PROPS: QuoteCardProps = {
  title: 'What Our Customers Say',
  scenes: [],
  brandColour: '#FF6B35',
  quote: 'We went from posting when we remembered to posting every single day.',
  attribution: 'Small business owner, Brisbane',
};

const DEFAULT_COUNTDOWN_CTA_PROPS: CountdownCTAProps = {
  title: 'Get Started',
  scenes: [],
  brandColour: '#FF6B35',
  headline: 'Your next month of content, planned today',
  cta: 'Start free',
  url: 'synthex.social',
};

const DEFAULT_DEFINITION_CARD_PROPS: DefinitionCardProps = {
  title: 'Marketing Glossary',
  scenes: [],
  brandColour: '#FF6B35',
  term: 'Engagement rate',
  definition:
    'The share of people who saw your post and then interacted with it.',
  example:
    'A post reaching 1,000 people with 50 interactions has a 5% engagement rate.',
};

// ── BTS Series Default Props (SYN-572) ───────────────────────────────────────

const DEFAULT_GIT_COMMIT_TIMELINE_PROPS: GitCommitTimelineProps = {
  title: 'Sprint Delivery — Synthex Platform',
  episodeContext: 'Phase 6 · Autonomous Video Pipeline',
  scenes: [],
  brandColour: '#f59e0b',
  commits: [
    {
      hash: 'abc1234',
      type: 'feat',
      scope: 'video',
      message: 'Add PlaywrightCaptureService replacing broken Puppeteer',
      date: '2026-03-10',
    },
    {
      hash: 'def5678',
      type: 'feat',
      scope: 'video',
      message: 'Build social-derivation waterfall cascade',
      date: '2026-03-11',
    },
    {
      hash: 'ghi9012',
      type: 'test',
      scope: 'video',
      message: 'Add unit tests for schema-injector and episodes API',
      date: '2026-03-11',
    },
  ],
};

const DEFAULT_BOARD_DECISION_CARD_PROPS: BoardDecisionCardProps = {
  title: 'Switch from Puppeteer to Playwright for Screen Capture',
  decisionContext: 'Phase 6 Architecture Review',
  decision:
    'Replace the broken puppeteer-screen-recorder dependency with Playwright native recordVideo. This keeps the WorkflowStep interface identical while eliminating the removed package.',
  rationale:
    'puppeteer-screen-recorder was removed from the dependency tree, causing unconditional throws in the capture service. Playwright provides an equivalent WebM recording API natively.',
  outcome: 'Capture service restored. 10 workflows now operational.',
  actionItems: [
    'Deploy PlaywrightCaptureService to staging',
    'Validate all 10 workflow recordings at 1920×1080',
    'Update video-orchestrator DI to use new service',
  ],
  phase: 'Phase 6',
  decisionDate: '10 March 2026',
  scenes: [],
  brandColour: '#f59e0b',
};

// ── The Invisible Line Campaign Default Props (SYN-971) ───────────────────────

const DEFAULT_INVISIBLE_LINE_OUTRO_PROPS: InvisibleLineOutroProps = {
  headline: 'DisasterRecovery.com.au',
  leftMark: 'NRPG',
  leftSub: 'THE STANDARD',
  rightMark: 'ReStoreAssist',
  rightSub: 'THE PROOF',
  ctaLine1: 'Demand the science.',
  ctaLine2: 'Find your professional today at DisasterRecovery.com.au',
  accentColour: '#2E9BD6',
  voiceoverSrc: undefined,
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const COMPOSITION_REGISTRY: CompositionMeta[] = [
  {
    id: 'SocialReel',
    name: 'Social Reel',
    description:
      'Portrait reel for Instagram, TikTok, and YouTube Shorts (9:16)',
    defaultProps: DEFAULT_SOCIAL_REEL_PROPS,
    width: 720,
    height: 1280,
    fps: 30,
    durationInFrames: 210, // 7 seconds
  },
  {
    id: 'ExplainerVideo',
    name: 'Explainer Video',
    description: 'Landscape explainer with scene transitions (16:9)',
    defaultProps: DEFAULT_EXPLAINER_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 330, // 11 seconds
  },
  {
    id: 'BrandShowcase',
    name: 'Brand Showcase',
    description: 'Landscape brand introduction for YouTube (16:9)',
    defaultProps: DEFAULT_BRAND_SHOWCASE_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 1350, // 45 seconds
  },
  {
    id: 'BrandReel',
    name: 'Brand Reel',
    description: 'Portrait brand reel for YouTube Shorts, X, Instagram (9:16)',
    defaultProps: DEFAULT_BRAND_REEL_PROPS,
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 450, // 15 seconds
  },
  {
    id: 'BrandSquare',
    name: 'Brand Square',
    description: 'Square brand video for LinkedIn, Facebook (1:1)',
    defaultProps: DEFAULT_BRAND_SQUARE_PROPS,
    width: 1080,
    height: 1080,
    fps: 30,
    durationInFrames: 600, // 20 seconds
  },
  {
    id: 'HowToVideo',
    name: 'How-To Guide',
    description: 'Step-by-step tutorial video with animated steps (16:9)',
    defaultProps: DEFAULT_HOW_TO_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 1200, // 40 seconds
  },
  {
    id: 'SchematicExplainer',
    name: 'Schematic Explainer',
    description:
      'Blueprint how-it-works diagram: technical grid, animated connector, sequential step pins (16:9, 10s)',
    defaultProps:
      DEFAULT_SCHEMATIC_EXPLAINER_PROPS as unknown as import('./types').BaseCompositionProps,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300, // 10 seconds
  },

  // ── Educational Compositions (SYN-429, registered in SYN-1113) ──────────────
  {
    id: 'TipCard',
    name: 'Tip Card',
    description: 'Educational: numbered single-tip card for Shorts (9:16, 15s)',
    defaultProps: DEFAULT_TIP_CARD_PROPS,
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 450, // 15 seconds
  },
  {
    id: 'StatReveal',
    name: 'Stat Reveal',
    description: 'Educational: animated single-statistic reveal (16:9, 20s)',
    defaultProps: DEFAULT_STAT_REVEAL_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 600, // 20 seconds
  },
  {
    id: 'ComparisonSlide',
    name: 'Comparison Slide',
    description: 'Educational: old-way / new-way split comparison (16:9, 25s)',
    defaultProps: DEFAULT_COMPARISON_SLIDE_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 750, // 25 seconds
  },
  {
    id: 'ListicleVideo',
    name: 'Listicle Video',
    description: 'Educational: sequential reveal of up to 5 items (16:9, 30s)',
    defaultProps: DEFAULT_LISTICLE_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 900, // 30 seconds
  },
  {
    id: 'CaseStudyVideo',
    name: 'Case Study Video',
    description:
      'Educational: challenge → solution → result walkthrough (16:9, 40s)',
    defaultProps: DEFAULT_CASE_STUDY_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 1200, // 40 seconds
  },
  {
    id: 'QuoteCard',
    name: 'Quote Card',
    description:
      'Educational: square testimonial card for LinkedIn, Facebook (1:1, 20s)',
    defaultProps: DEFAULT_QUOTE_CARD_PROPS,
    width: 1080,
    height: 1080,
    fps: 30,
    durationInFrames: 600, // 20 seconds
  },
  {
    id: 'CountdownCTA',
    name: 'Countdown CTA',
    description:
      'Educational: urgency-driven closing call to action (16:9, 15s)',
    defaultProps: DEFAULT_COUNTDOWN_CTA_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 450, // 15 seconds
  },
  {
    id: 'DefinitionCard',
    name: 'Definition Card',
    description:
      'Educational: glossary term, definition and example (16:9, 20s)',
    defaultProps: DEFAULT_DEFINITION_CARD_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 600, // 20 seconds
  },

  // ── BTS Series Compositions (SYN-572) ───────────────────────────────────────
  {
    id: 'GitCommitTimeline',
    name: 'Git Commit Timeline',
    description:
      'BTS: animated timeline of git commits — product evolution (16:9, 30s)',
    defaultProps: DEFAULT_GIT_COMMIT_TIMELINE_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 900, // 30 seconds
  },
  {
    id: 'BoardDecisionCard',
    name: 'Board Decision Card',
    description:
      'BTS: styled board/phase decision memo with rationale + outcome (16:9, 25s)',
    defaultProps: DEFAULT_BOARD_DECISION_CARD_PROPS,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 750, // 25 seconds
  },
  {
    id: 'SynthexLandingVideo',
    name: 'Synthex Landing Video',
    description:
      'Public landing-page buyer video for the Synthex command center',
    defaultProps: {
      title: 'Synthex Landing Video',
      scenes: [],
      brandColour: '#FF6B35',
    },
    width: 1280,
    height: 720,
    fps: 30,
    durationInFrames: 360,
  },
  {
    id: 'MarketingExtenderIntro',
    name: 'Marketing Extender — Introduction',
    description: 'Complete client-facing Marketing Extender journey (16:9)',
    defaultProps: {
      mode: 'intro',
    } as unknown as import('./types').BaseCompositionProps,
    width: 1280,
    height: 720,
    fps: 30,
    durationInFrames: 750,
  },
  ...(
    [
      ['MarketingExtenderContext', 'Context', 'context'],
      ['MarketingExtenderExpand', 'Expansion', 'expand'],
      ['MarketingExtenderDecision', 'Human Decision', 'decision'],
      ['MarketingExtenderHandoff', 'Nexus Handoff', 'handoff'],
    ] as const
  ).map(([id, label, mode]) => ({
    id,
    name: `Marketing Extender — ${label}`,
    description: `Contextual Marketing Extender ${label.toLowerCase()} explainer (16:9)`,
    defaultProps: { mode } as unknown as import('./types').BaseCompositionProps,
    width: 1280,
    height: 720,
    fps: 30,
    durationInFrames: 360,
  })),

  // ── The Invisible Line campaign (RestoreAssist anthem, SYN-971) ──────────────
  {
    id: 'InvisibleLineOutro',
    name: 'The Invisible Line — Outro',
    description:
      'Act VI / Outro: three-logo illumination, kinetic VO typography, The Invisible Line accent (16:9, 6s)',
    defaultProps:
      DEFAULT_INVISIBLE_LINE_OUTRO_PROPS as unknown as import('./types').BaseCompositionProps,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 180, // 6 seconds
  },
  {
    id: 'InvisibleLineAnthem',
    name: 'The Invisible Line — Full Anthem',
    description:
      'Master ~68s cinematic motion-graphics anthem: 6 acts + outro sequenced to VO (16:9, 2030 frames)',
    defaultProps:
      {} as InvisibleLineAnthemProps as unknown as import('./types').BaseCompositionProps,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 2030, // ~67.7 seconds
  },
];
