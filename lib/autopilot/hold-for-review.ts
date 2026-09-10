/**
 * Phase 7: Autopilot drafts a week. A human still approves.
 * Off (enabled: false) is enforced by the cron query. On never auto-sends.
 */

/**
 * The Phase 7 hold. While this is true, autopilot never marks a post
 * 'scheduled', whatever the quality gate decided.
 *
 * Annotated `boolean` rather than left to infer `true` on purpose. With the
 * literal type, TypeScript narrows the derived post status to `'draft'` and
 * reports the grounded-image branch that handles a scheduled post as dead
 * code (TS2367 at app/api/cron/autopilot/route.ts:781 — SYN-1211). That branch
 * is deliberately retained for the day `auto_approve_threshold` drops below
 * 100, so the fix is to keep it type-checked, not to delete it or to make the
 * status reachable.
 *
 * Flipping this to false is a change to publishing behaviour — it would let
 * autopilot schedule posts to live social accounts, which Phase 7 forbids. It
 * must never be flipped to silence a type error. The invariant is enforced by
 * tests/unit/lib/autopilot/hold-for-review.test.ts.
 */
export const HOLD_FOR_REVIEW: boolean = true;

export function holdAutopilotForReview(
  decision: 'schedule' | 'draft' | 'reject'
): 'draft' | 'reject' {
  if (decision === 'reject') return 'reject';
  return 'draft';
}

/**
 * The post status autopilot writes for a decision that survived the hold.
 *
 * Single source of truth for the derivation, so the route and its test read the
 * same code path rather than the test re-implementing the rule it is checking.
 */
export function autopilotPostStatus(
  decision: 'schedule' | 'draft' | 'reject'
): 'scheduled' | 'draft' {
  if (HOLD_FOR_REVIEW) return 'draft';
  return decision === 'schedule' ? 'scheduled' : 'draft';
}
