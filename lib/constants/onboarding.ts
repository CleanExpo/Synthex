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
