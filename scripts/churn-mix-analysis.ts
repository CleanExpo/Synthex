/**
 * scripts/churn-mix-analysis.ts — Synthex Phase 1 Deliverable 2.
 *
 * 30-day involuntary-vs-voluntary churn mix.
 *
 * Pulls all `customer.subscription.deleted` events in the window from Stripe
 * and buckets them by cancellation reason. Also pulls all
 * `customer.subscription.updated` events with `pause_collection != null`
 * as a proxy for stalled-payment-state customers heading toward involuntary
 * churn.
 *
 * Voluntary       = cancellation_details.reason = 'customer_requested'
 *                   OR cancellation_details.feedback != null
 * Involuntary     = cancellation_details.reason IN ('payment_failed','unpaid')
 *                   OR (reason IS NULL AND no feedback)  -- billing-driven
 *
 * Run:
 *   STRIPE_SECRET_KEY=sk_live_... \
 *   npx tsx scripts/churn-mix-analysis.ts --days 30
 *
 * Writes JSON to stdout and a human-readable summary to stderr.
 */

import Stripe from 'stripe';

const argDays = (() => {
  const i = process.argv.indexOf('--days');
  if (i >= 0 && process.argv[i + 1]) return Number(process.argv[i + 1]);
  return 30;
})();

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY required');
  process.exit(1);
}

const stripe = new Stripe(key);
const mode = key.startsWith('sk_live_') ? 'live' : 'test';

interface CancellationDetails {
  comment?: string | null;
  feedback?: string | null;
  reason?: string | null;
}

interface Bucketed {
  voluntary: number;
  involuntary: number;
  paused: number;
  total_cancellations: number;
  feedback_top5: Array<[string, number]>;
  reason_breakdown: Record<string, number>;
}

async function fetchAllEvents(type: string, since: number): Promise<Stripe.Event[]> {
  const out: Stripe.Event[] = [];
  let startingAfter: string | undefined;
  // Stripe events API caps to 30 days of history. Loop on `has_more`.
  // limit=100 is max per page.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await stripe.events.list({
      type,
      created: { gte: since },
      limit: 100,
      starting_after: startingAfter,
    });
    out.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return out;
}

function classify(details: CancellationDetails | null | undefined): 'voluntary' | 'involuntary' {
  if (!details) return 'involuntary'; // no reason recorded — billing-driven default
  const reason = details.reason ?? null;
  const feedback = details.feedback ?? null;
  // Stripe enum: 'cancellation_requested' | 'payment_disputed' | 'payment_failed'
  // Memo wrote 'customer_requested' but the actual API value is 'cancellation_requested'.
  if (reason === 'cancellation_requested' || reason === 'customer_requested') return 'voluntary';
  if (feedback) return 'voluntary'; // customer left feedback => they cancelled deliberately
  if (reason === 'payment_failed' || reason === 'payment_disputed' || reason === 'unpaid') return 'involuntary';
  // null reason + no feedback => Stripe auto-cancelled (involuntary)
  return 'involuntary';
}

async function main(): Promise<void> {
  const since = Math.floor(Date.now() / 1000) - argDays * 86400;
  console.error(`[churn] mode=${mode} window=${argDays}d since=${new Date(since * 1000).toISOString()}`);

  const [deletedEvents, updatedEvents] = await Promise.all([
    fetchAllEvents('customer.subscription.deleted', since),
    fetchAllEvents('customer.subscription.updated', since),
  ]);

  console.error(`[churn] deleted events: ${deletedEvents.length}`);
  console.error(`[churn] updated events: ${updatedEvents.length}`);

  let voluntary = 0;
  let involuntary = 0;
  const feedbackCount: Record<string, number> = {};
  const reasonCount: Record<string, number> = {};

  for (const ev of deletedEvents) {
    const sub = ev.data.object as Stripe.Subscription;
    const details = (sub.cancellation_details ?? null) as CancellationDetails | null;
    const verdict = classify(details);
    if (verdict === 'voluntary') voluntary += 1;
    else involuntary += 1;
    const r = details?.reason ?? 'null';
    reasonCount[r] = (reasonCount[r] ?? 0) + 1;
    if (details?.feedback) {
      feedbackCount[details.feedback] = (feedbackCount[details.feedback] ?? 0) + 1;
    }
  }

  let paused = 0;
  for (const ev of updatedEvents) {
    const sub = ev.data.object as Stripe.Subscription;
    if (sub.pause_collection != null) paused += 1;
  }

  const total = voluntary + involuntary;
  const ratio = voluntary === 0 ? Infinity : involuntary / voluntary;
  const feedback_top5 = Object.entries(feedbackCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const out: Bucketed = {
    voluntary,
    involuntary,
    paused,
    total_cancellations: total,
    feedback_top5,
    reason_breakdown: reasonCount,
  };

  console.error('');
  console.error(`[churn] voluntary   = ${voluntary} (${total ? ((voluntary / total) * 100).toFixed(1) : '0.0'}%)`);
  console.error(`[churn] involuntary = ${involuntary} (${total ? ((involuntary / total) * 100).toFixed(1) : '0.0'}%)`);
  console.error(`[churn] paused (proxy) = ${paused}`);
  console.error(`[churn] I:V ratio   = ${ratio === Infinity ? 'inf (no voluntary)' : ratio.toFixed(2)}`);
  console.error('');
  let recommendation: string;
  if (involuntary > voluntary * 2) {
    recommendation = 'dunning_first';
  } else if (voluntary >= involuntary * 2) {
    recommendation = 'upgrade_flow_first';
  } else {
    recommendation = 'parallel';
  }
  console.error(`[churn] recommendation = ${recommendation}`);

  console.log(JSON.stringify({ ...out, ratio, recommendation, mode, window_days: argDays }, null, 2));
}

main().catch((e) => {
  console.error('[churn] FAIL', e);
  process.exit(1);
});
