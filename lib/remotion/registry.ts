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
  GitCommitTimelineProps,
  BoardDecisionCardProps,
} from './types';

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
    description: 'Public landing-page buyer video for the Synthex command center',
    defaultProps: {
      title: 'Synthex Landing Video',
      scenes: [],
      brandColour: '#f97316',
    },
    width: 1280,
    height: 720,
    fps: 30,
    durationInFrames: 360,
  },
];
