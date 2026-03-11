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
  voiceProfiles: number;           // Saved voice fingerprint profiles
  capsuleFormats: number;          // Content capsule generations per month
  slopScans: number;               // AI slop scans per month
  qualityAudits: number;           // Full quality audits per month (includes DB save)
  // Brand Builder (Phase 91)
  brandIdentities: number;         // Total saved brand identity profiles
  brandMentionPolls: number;       // Mention polling operations per month
  consistencyAudits: number;       // NAP consistency audits per month
  // PR Journalist CRM (Phase 92)
  journalistContacts: number;      // Total journalist contact records
  prPitches: number;               // Total PR pitch records
  pressReleases: number;           // Total press release records
  // Press Release Distribution (Phase 93)
  prDistributions: number;         // Total distribution submissions per press release
  // Award & Directory Orchestrator (Phase 94)
  awardListings: number;           // Total award listing records
  directoryListings: number;       // Total directory listing records
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
    voiceProfiles: 0,
    capsuleFormats: 0,
    slopScans: 3,
    qualityAudits: 3,
    brandIdentities: 1,
    brandMentionPolls: 5,
    consistencyAudits: 3,
    journalistContacts: 5,
    prPitches: 10,
    pressReleases: 3,
    prDistributions: 2,
    awardListings: 5,
    directoryListings: 10,
  },
  pro: {
    geoAnalyses: 50,
    eeatAudits: 10,
    paperBananaVisuals: 20,
    researchReports: 2,
    authorProfiles: 3,
    localCaseStudies: 5,
    tacticOptimiserRewrites: 20,
    voiceProfiles: 3,
    capsuleFormats: 20,
    slopScans: 50,
    qualityAudits: 50,
    brandIdentities: 3,
    brandMentionPolls: 20,
    consistencyAudits: 20,
    journalistContacts: 50,
    prPitches: 100,
    pressReleases: 20,
    prDistributions: 10,
    awardListings: 25,
    directoryListings: 50,
  },
  growth: {
    geoAnalyses: -1,
    eeatAudits: -1,
    paperBananaVisuals: -1,
    researchReports: -1,
    authorProfiles: 10,
    localCaseStudies: -1,
    tacticOptimiserRewrites: -1, // unlimited
    voiceProfiles: 10,
    capsuleFormats: -1,
    slopScans: -1,
    qualityAudits: -1,
    brandIdentities: 10,
    brandMentionPolls: 100,
    consistencyAudits: -1,
    journalistContacts: -1,
    prPitches: -1,
    pressReleases: -1,
    prDistributions: -1,
    awardListings: -1,
    directoryListings: -1,
  },
  scale: {
    geoAnalyses: -1,
    eeatAudits: -1,
    paperBananaVisuals: -1,
    researchReports: -1,
    authorProfiles: -1,
    localCaseStudies: -1,
    tacticOptimiserRewrites: -1,
    voiceProfiles: -1,
    capsuleFormats: -1,
    slopScans: -1,
    qualityAudits: -1,
    brandIdentities: -1,
    brandMentionPolls: -1,
    consistencyAudits: -1,
    journalistContacts: -1,
    prPitches: -1,
    pressReleases: -1,
    prDistributions: -1,
    awardListings: -1,
    directoryListings: -1,
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
    voiceProfiles: 3,
    capsuleFormats: 20,
    slopScans: 50,
    qualityAudits: 50,
    brandIdentities: 10,
    brandMentionPolls: 100,
    consistencyAudits: -1,
    journalistContacts: 50,
    prPitches: 100,
    pressReleases: 20,
    prDistributions: 10,
    awardListings: 25,
    directoryListings: 50,
  },
  business: {
    geoAnalyses: -1,
    eeatAudits: -1,
    paperBananaVisuals: -1,
    researchReports: -1,
    authorProfiles: 10,
    localCaseStudies: -1,
    tacticOptimiserRewrites: -1,
    voiceProfiles: 10,
    capsuleFormats: -1,
    slopScans: -1,
    qualityAudits: -1,
    brandIdentities: -1,
    brandMentionPolls: -1,
    consistencyAudits: -1,
    journalistContacts: -1,
    prPitches: -1,
    pressReleases: -1,
    prDistributions: -1,
    awardListings: -1,
    directoryListings: -1,
  },
  custom: {
    geoAnalyses: -1,
    eeatAudits: -1,
    paperBananaVisuals: -1,
    researchReports: -1,
    authorProfiles: -1,
    localCaseStudies: -1,
    tacticOptimiserRewrites: -1,
    voiceProfiles: -1,
    capsuleFormats: -1,
    slopScans: -1,
    qualityAudits: -1,
    brandIdentities: -1,
    brandMentionPolls: -1,
    consistencyAudits: -1,
    journalistContacts: -1,
    prPitches: -1,
    pressReleases: -1,
    prDistributions: -1,
    awardListings: -1,
    directoryListings: -1,
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
  voiceProfiles: {
    label: 'Voice Profiles',
    description: 'Save writing style fingerprints from your content samples',
  },
  capsuleFormats: {
    label: 'Content Capsules',
    description: 'Reformat content using the Content Capsule Technique for 40% higher AI citation rates',
  },
  slopScans: {
    label: 'Slop Scan',
    description: 'Detect AI tell-phrases and writing patterns that signal machine-generated content',
  },
  qualityAudits: {
    label: 'Content Quality Audits',
    description: 'Full humanness scoring and AI slop detection with saved audit history',
  },
  brandIdentities: {
    label: 'Brand Identity Profiles',
    description: 'Create and manage brand entity profiles with JSON-LD entity graphs and sameAs linkage',
  },
  brandMentionPolls: {
    label: 'Brand Mention Polls',
    description: 'Poll NewsData.io and GDELT for brand mentions across global news sources',
  },
  consistencyAudits: {
    label: 'Consistency Audits',
    description: 'Audit NAP consistency across declared sameAs platforms for Knowledge Panel eligibility',
  },
  journalistContacts: {
    label: 'Journalist Contacts',
    description: 'Store and manage journalist CRM records with beat tags, tier ratings, and Hunter.io email enrichment',
  },
  prPitches: {
    label: 'PR Pitches',
    description: 'Track pitch outreach lifecycle from draft through to editorial coverage attribution',
  },
  pressReleases: {
    label: 'Press Releases',
    description: 'Create AI-indexable press releases with schema.org JSON-LD structured data for newsroom publication',
  },
  prDistributions: {
    label: 'PR Distributions',
    description: 'Track press release distribution across free channels including PR.com, OpenPR, and PRLog',
  },
  awardListings: {
    label: 'Award Listings',
    description: 'Track industry award nominations with AI-generated nomination drafts and deadline reminders',
  },
  directoryListings: {
    label: 'Directory Listings',
    description: 'Track niche directory submissions for backlink building and AI search engine citation',
  },
};
