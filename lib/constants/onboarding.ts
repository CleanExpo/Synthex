/**
 * Onboarding constants — SYN-502 (Board Session 3: Client Journey Optimisation)
 *
 * Confidence threshold: pipeline confidence is 0–100. Below BRAND_CONFIDENCE_THRESHOLD,
 * the Brand Mirror shows a fallback message instead of potentially low-quality output.
 *
 * Cookie name: set when user views the Brand Mirror step, used by the routing gate
 * (SYN-504) to allow access to /onboarding/connect.
 */

/** Minimum pipeline confidence (0–100) required to display brand voice output. */
export const BRAND_CONFIDENCE_THRESHOLD = 60;

/**
 * Cookie set when the Brand Mirror step has been viewed.
 * Read by middleware to gate access to /onboarding/connect.
 * Short-lived (1 hour) — re-prompts on next login if skipped.
 */
export const BRAND_MIRROR_COOKIE = 'synthex_brand_mirror_viewed';

/**
 * Feature flag — SYN-548 Season Brief onboarding screen.
 * Set NEXT_PUBLIC_SEASONAL_BRIEF_ONBOARDING=false in Vercel to disable.
 * Default: true (screen is shown between Brand Mirror and Connect Accounts).
 */
export const SEASONAL_BRIEF_ENABLED =
  process.env.NEXT_PUBLIC_SEASONAL_BRIEF_ONBOARDING !== 'false';

/**
 * Feature flag — SYN-595 AI Advisor dashboard card + weekly email.
 * Set NEXT_PUBLIC_ADVISOR_ENABLED=false in Vercel to disable.
 * Default: true.
 */
export const ADVISOR_ENABLED =
  process.env.NEXT_PUBLIC_ADVISOR_ENABLED !== 'false';

/**
 * Maps onboarding industry values to seasonal_signals industrySlug values.
 * Falls back to 'general' for unmapped industries (returns public holiday signals).
 */
export const ONBOARDING_INDUSTRY_TO_SLUG: Record<string, string> = {
  retail: 'retail-general',
  'e-commerce': 'retail-general',
  hospitality: 'cafe-coffee',
  food: 'cafe-coffee',
  'health-wellness': 'allied-health',
  health: 'allied-health',
  trades: 'plumbing-hvac',
  construction: 'plumbing-hvac',
  fitness: 'personal-fitness',
  'personal-fitness': 'personal-fitness',
  beauty: 'general',
  'professional-services': 'general',
  'real-estate': 'general',
  education: 'general',
  technology: 'general',
  other: 'general',
};
