// Which review lanes and model routes the fleet may use (founder 19/10/2026: subscription only —
// Claude Max and Codex on the ChatGPT plan; no API billing, no paid fallback).
// A lane is allowed only by name in SUBSCRIPTION_LANES; an unknown lane is refused, so a new paid
// lane cannot slip in under a new name. A ':free' model suffix is not proof of zero cost.

export const SUBSCRIPTION_LANES = Object.freeze(['codex']);

// Provider keys whose presence lets a call bill per use instead of running on a plan.
export const METERED_KEY_NAMES = Object.freeze([
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'OPENROUTER_API_KEY',
  'MINIMAX_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
]);

/** Review lanes to try, in policy order, keeping only subscription lanes. */
export function reviewLanes(pol) {
  const never = pol?.review?.never || [];
  return (pol?.review?.lanes_in_order || []).filter(
    lane => SUBSCRIPTION_LANES.includes(lane) && !never.includes(lane)
  );
}

/** Every way the policy file itself permits a non-subscription route. Empty = compliant. */
export function policyViolations(pol) {
  const out = [];
  const review = pol?.review || {};
  for (const lane of review.lanes_in_order || []) {
    if (!SUBSCRIPTION_LANES.includes(lane))
      out.push(`review lane "${lane}" is not a subscription lane`);
  }
  if (review.openrouter_paid_ok === true)
    out.push('review.openrouter_paid_ok is true');
  if ((review.openrouter_models || []).length > 0)
    out.push(
      `review.openrouter_models lists ${review.openrouter_models.length} model(s)`
    );
  const judge = pol?.models?.judge_non_anthropic_lane;
  if (judge && !SUBSCRIPTION_LANES.includes(judge))
    out.push(
      `models.judge_non_anthropic_lane "${judge}" is not a subscription lane`
    );
  return out;
}

/** Names (never values) of metered provider keys present in env. */
export function meteredKeysPresent(env = process.env) {
  return METERED_KEY_NAMES.filter(k => String(env[k] || '').trim() !== '');
}
