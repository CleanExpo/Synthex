/**
 * Central feature-entitlement gate (SYN-1106).
 *
 * Before this existed, paid routes gated inconsistently: some resolved
 * entitlements via `entitledPlan(plan, status)` (status-aware), many others
 * trusted `subscription.plan` alone (so a past_due/unpaid paid plan still
 * passed), and a few paid routes had no tier gate at all.
 *
 * `requireEntitlement(userId, feature)` is the single place that:
 *  1. resolves the user's subscription (plan + status) — via
 *     getOrCreateSubscription, which also applies the owner/admin full-access
 *     bypass (owner → 'scale') and, for a user with no subscription row,
 *     creates a 'free' one so the gate always fails CLOSED rather than throwing;
 *  2. computes the EFFECTIVE plan with entitledPlan() — a paid plan only counts
 *     while active/trialing; past_due / unpaid / incomplete / paused / cancelled
 *     all fall back to 'free';
 *  3. maps the feature to its required tier via FEATURE_TIER;
 *  4. returns an allow/deny result (plus the effective plan, required tier, and
 *     the resolved subscription) so each route keeps its own response shape.
 *
 * Routes format their own 402/403 response from the result — the status codes
 * and bodies differ per route and are deliberately left to the call site.
 */

import { subscriptionService } from '@/lib/stripe/subscription-service';
import type { SubscriptionInfo } from '@/lib/stripe/subscription-service';
import { entitledPlan, hasPlanAccess, type PlanName } from '@/lib/billing/plan-access';

/**
 * Paid features gated by this helper. One entry per gated route family; the
 * name maps to the minimum required plan tier in FEATURE_TIER below.
 */
export type EntitlementFeature =
  | 'ai_image' // POST/PUT /api/media/generate/image
  | 'ai_video' // POST/PUT /api/media/generate/video
  | 'video_production' // GET/POST /api/video
  | 'video_script' // POST /api/video/generate
  | 'ai_chat' // /api/ai/chat/conversations
  | 'ai_pm' // /api/ai/pm/conversations
  | 'autonomous' // POST /api/autonomous/execute
  | 'insights' // GET /api/insights
  | 'seo' // /api/seo, /api/seo/audit
  | 'workflows'; // /api/workflows/*

/**
 * Minimum plan tier each feature requires. Tiers are the canonical PlanName
 * ranks in plan-access.ts (professional < business). Each entry preserves the
 * tier the corresponding route already enforced — this change makes those
 * gates status-aware and consistent, it does not re-tier features.
 */
export const FEATURE_TIER: Record<EntitlementFeature, PlanName> = {
  ai_image: 'professional',
  ai_video: 'business',
  video_production: 'business',
  video_script: 'professional',
  ai_chat: 'professional',
  ai_pm: 'business',
  autonomous: 'professional',
  insights: 'professional',
  seo: 'professional',
  workflows: 'professional',
};

export interface EntitlementResult {
  /** True only when the effective (status-resolved) plan clears the required tier. */
  allowed: boolean;
  /** Plan the subscription is entitled to given its billing status ('free' when unpaid/past-due). */
  effectivePlan: string;
  /** Minimum plan tier the feature requires. */
  requiredPlan: PlanName;
  /** The resolved subscription — reuse for limits/usage without a second fetch. */
  subscription: SubscriptionInfo;
}

/**
 * Resolve whether `userId` is entitled to `feature`.
 *
 * Fails closed: a missing subscription resolves to 'free', and any
 * non-active/non-trialing status downgrades a paid plan to 'free' before the
 * tier check runs.
 */
export async function requireEntitlement(
  userId: string,
  feature: EntitlementFeature
): Promise<EntitlementResult> {
  const subscription =
    await subscriptionService.getOrCreateSubscription(userId);
  const effectivePlan = entitledPlan(subscription.plan, subscription.status);
  const requiredPlan = FEATURE_TIER[feature];
  return {
    allowed: hasPlanAccess(effectivePlan, requiredPlan),
    effectivePlan,
    requiredPlan,
    subscription,
  };
}
