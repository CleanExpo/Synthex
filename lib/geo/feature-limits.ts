/**
 * GEO Feature Limits Configuration
 *
 * Defines per-plan usage limits for GEO, E-E-A-T, Paper Banana, and related features.
 * These limits are enforced at the API route level.
 *
 * PRICING (from CLAUDE.md — DO NOT CHANGE WITHOUT APPROVAL):
 * - Pro: $249/month
 * - Growth: $449/month
 * - Scale: $799/month
 *
 * @module lib/geo/feature-limits
 */

export interface GEOFeatureLimits {
  geoAnalyses: number;           // GEO score analyses per month
  eeatAudits: number;            // E-E-A-T audits per month
  paperBananaVisuals: number;    // Paper Banana visual generations per month
  researchReports: number;       // Research reports per month
  authorProfiles: number;        // Total author profiles
  localCaseStudies: number;      // Local case studies per month
  tacticOptimiserRewrites: number; // AI-powered per-tactic content rewrites (Princeton 9-tactic)
}

/**
 * Feature limits by subscription plan.
 * -1 = unlimited
 */
export const PLAN_LIMITS: Record<string, GEOFeatureLimits> = {
  free: {
    geoAnalyses: 3,
    eeatAudits: 0,
    paperBananaVisuals: 0,
    researchReports: 0,
    authorProfiles: 0,
    localCaseStudies: 0,
    tacticOptimiserRewrites: 0,  // score only, no AI rewrites on free tier
  },
  pro: {
    geoAnalyses: 50,
    eeatAudits: 10,
    paperBananaVisuals: 20,
    researchReports: 2,
    authorProfiles: 3,
    localCaseStudies: 5,
    tacticOptimiserRewrites: 20,
  },
  growth: {
    geoAnalyses: -1,
    eeatAudits: -1,
    paperBananaVisuals: -1,
    researchReports: -1,
    authorProfiles: 10,
    localCaseStudies: -1,
    tacticOptimiserRewrites: -1, // unlimited
  },
  scale: {
    geoAnalyses: -1,
    eeatAudits: -1,
    paperBananaVisuals: -1,
    researchReports: -1,
    authorProfiles: -1,
    localCaseStudies: -1,
    tacticOptimiserRewrites: -1,
  },
  // Backward-compat aliases for existing DB records
  professional: {
    geoAnalyses: 50,
    eeatAudits: 10,
    paperBananaVisuals: 20,
    researchReports: 2,
    authorProfiles: 3,
    localCaseStudies: 5,
    tacticOptimiserRewrites: 20,
  },
  business: {
    geoAnalyses: -1,
    eeatAudits: -1,
    paperBananaVisuals: -1,
    researchReports: -1,
    authorProfiles: 10,
    localCaseStudies: -1,
    tacticOptimiserRewrites: -1,
  },
  custom: {
    geoAnalyses: -1,
    eeatAudits: -1,
    paperBananaVisuals: -1,
    researchReports: -1,
    authorProfiles: -1,
    localCaseStudies: -1,
    tacticOptimiserRewrites: -1,
  },
};

export type GEOFeatureKey = keyof GEOFeatureLimits;

/**
 * Get the limit for a specific feature and plan.
 * Returns -1 for unlimited.
 */
export function getFeatureLimit(plan: string, feature: GEOFeatureKey): number {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  return limits[feature];
}

/**
 * Check if a feature is available for the given plan.
 * A limit of 0 means the feature is not available.
 */
export function isFeatureAvailable(plan: string, feature: GEOFeatureKey): boolean {
  return getFeatureLimit(plan, feature) !== 0;
}

/**
 * Check if usage is within the plan limit.
 * @param plan - Subscription plan
 * @param feature - Feature key
 * @param currentUsage - Current usage count
 * @returns true if within limit or unlimited
 */
export function isWithinLimit(plan: string, feature: GEOFeatureKey, currentUsage: number): boolean {
  const limit = getFeatureLimit(plan, feature);
  if (limit === -1) return true; // Unlimited
  if (limit === 0) return false; // Not available
  return currentUsage < limit;
}

/**
 * Get the minimum plan required for a feature.
 */
export function getMinimumPlan(feature: GEOFeatureKey): string {
  if (PLAN_LIMITS.free[feature] > 0) return 'free';
  if (PLAN_LIMITS.pro[feature] > 0) return 'pro';
  if (PLAN_LIMITS.growth[feature] > 0) return 'growth';
  return 'scale';
}

/**
 * Feature display information for the UI.
 */
export const FEATURE_INFO: Record<GEOFeatureKey, { label: string; description: string }> = {
  geoAnalyses: {
    label: 'GEO Analysis',
    description: 'Score content for AI search engine citability across Google AIO, ChatGPT, Perplexity, and Bing Copilot',
  },
  eeatAudits: {
    label: 'E-E-A-T Audit',
    description: 'Score content against Google\'s Experience, Expertise, Authoritativeness, and Trustworthiness framework',
  },
  paperBananaVisuals: {
    label: 'Paper Banana Visuals',
    description: 'Generate publication-quality diagrams, data plots, and infographics using AI',
  },
  researchReports: {
    label: 'Research Reports',
    description: 'Create original research reports with first-party data that become citation magnets',
  },
  authorProfiles: {
    label: 'Author Profiles',
    description: 'Manage expert author identities with verified credentials for E-E-A-T compliance',
  },
  localCaseStudies: {
    label: 'Local Case Studies',
    description: 'Generate hyper-local case studies with NAP consistency and location schema markup',
  },
  tacticOptimiserRewrites: {
    label: 'GEO Optimiser Rewrites',
    description: 'AI-powered per-tactic content rewrites using the Princeton 9-tactic framework',
  },
};
