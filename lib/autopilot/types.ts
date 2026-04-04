/**
 * Autopilot Engine — Type Definitions
 *
 * @description Shared types for the autopilot content generation,
 * scoring, and scheduling pipeline.
 *
 * @module lib/autopilot/types
 */

// ============================================================================
// CONTENT THEMES
// ============================================================================

/** Content theme categories for the content mix */
export type ContentTheme =
  | 'educational'
  | 'promotional'
  | 'engagement'
  | 'storytelling'
  | 'behind_the_scenes'
  | 'social_proof'
  | 'trend_reactive';

/** Content mix weights — keys are ContentTheme, values are percentages (sum to 100) */
export type ContentMix = Partial<Record<ContentTheme, number>>;

/** Default content mix for new organisations */
export const DEFAULT_CONTENT_MIX: ContentMix = {
  educational: 30,
  promotional: 20,
  engagement: 25,
  storytelling: 25,
};

// ============================================================================
// AUTOPILOT POST METADATA
// ============================================================================

/** Metadata attached to posts created by the autopilot engine */
export interface AutopilotPostMetadata {
  source: 'autopilot';
  runId: string;
  theme: ContentTheme;
  scoreOverall: number;
  scoreDimensions?: Record<string, number>;
  qualityDecision: 'scheduled' | 'draft' | 'rejected' | 'regenerated';
  generationAttempt: number;
  generatedAt: string;
  hashtags?: string[];
  mediaUrls?: string[];
}

// ============================================================================
// PLANNER OUTPUT
// ============================================================================

/** A single content slot that the daily planner determines needs filling */
export interface ContentSlot {
  platform: string;
  date: Date;
  theme: ContentTheme;
  reason: string; // Why this slot was chosen (e.g., "gap detected", "mix rebalance")
}

/** Output from the daily planner — a list of slots that need content */
export interface PlannerOutput {
  slots: ContentSlot[];
  totalExisting: number;
  totalNeeded: number;
}

// ============================================================================
// QUALITY GATE
// ============================================================================

/** Quality gate decision for a scored piece of content */
export type QualityDecision = 'schedule' | 'draft' | 'reject';

export interface QualityGateResult {
  decision: QualityDecision;
  score: number;
  reason: string;
}

// ============================================================================
// LAUNCH PIPELINE
// ============================================================================

/** Input for the post-onboarding launch pipeline */
export interface LaunchPipelineInput {
  userId: string;
  organizationId: string;
}

/** Result from the launch pipeline */
export interface LaunchPipelineResult {
  success: boolean;
  runId: string;
  postsGenerated: number;
  postsScheduled: number;
  postsDrafted: number;
  postsRejected: number;
  avgScore: number;
  campaignId: string;
  postIds: string[];
  error?: string;
}

// ============================================================================
// PERFORMANCE LEARNER
// ============================================================================

/** Weekly performance summary for the learner feedback loop */
export interface WeeklyPerformanceSummary {
  organizationId: string;
  period: { start: Date; end: Date };
  totalPosts: number;
  avgEngagement: number;
  themePerformance: Record<
    ContentTheme,
    { count: number; avgEngagement: number }
  >;
  topPostIds: string[];
  adjustedMix: ContentMix;
}

// ============================================================================
// PLATFORM SPECS
// ============================================================================

export interface PlatformSpec {
  maxChars: number;
  style: string;
  hashtagCount: number;
}

export const PLATFORM_SPECS: Record<string, PlatformSpec> = {
  instagram: {
    maxChars: 2200,
    style: 'visual, emoji-rich, storytelling',
    hashtagCount: 10,
  },
  twitter: {
    maxChars: 280,
    style: 'concise, punchy, conversational',
    hashtagCount: 2,
  },
  linkedin: {
    maxChars: 1300,
    style: 'professional, insightful, industry-focused',
    hashtagCount: 3,
  },
  facebook: {
    maxChars: 500,
    style: 'engaging, community-focused, conversational',
    hashtagCount: 3,
  },
  tiktok: {
    maxChars: 300,
    style: 'trendy, energetic, hook-driven',
    hashtagCount: 5,
  },
  youtube: {
    maxChars: 400,
    style: 'descriptive, keyword-rich, CTA-driven',
    hashtagCount: 5,
  },
  pinterest: {
    maxChars: 500,
    style: 'inspirational, keyword-rich, descriptive',
    hashtagCount: 5,
  },
  threads: {
    maxChars: 500,
    style: 'casual, conversational, text-based',
    hashtagCount: 2,
  },
  reddit: {
    maxChars: 1000,
    style: 'informative, community-driven, no hard sell',
    hashtagCount: 0,
  },
};

/** Theme descriptions used in AI prompts */
export const THEME_PROMPTS: Record<ContentTheme, string> = {
  educational:
    'Share an educational tip or insight from your expertise — teach something valuable',
  promotional:
    'Highlight your product or service — focus on the benefit, not the feature',
  engagement:
    'Ask a question or start a conversation — maximise comments and interaction',
  storytelling:
    'Tell a story — behind the scenes, customer journey, or personal experience',
  behind_the_scenes:
    'Show the human side of your business — team, process, workspace',
  social_proof: 'Share a win, testimonial concept, or case study highlight',
  trend_reactive:
    'React to a current trend or industry development with your unique perspective',
};
