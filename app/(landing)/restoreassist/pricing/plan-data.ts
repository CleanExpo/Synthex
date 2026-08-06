/**
 * RestoreAssist published pricing — the single source for this page.
 *
 * SOURCE OF TRUTH: crawled from https://restoreassist.app/pricing on 06/08/2026.
 * Every figure below is transcribed from that page. Do not edit these numbers to
 * match a deck, a brief, or a Linear ticket — if the live page changes, re-crawl
 * and update here, because the launch stop-condition is that published pricing
 * must match the site exactly.
 *
 * NOTE FOR THE OWNER — this crawl contradicts two internal records:
 *   1. `.claude/memory/verification-gates.md` VG-52/VG-53 carry a hypothesised
 *      PER-SEAT model ($50-80/seat/month entry, $150-500/month multi-seat), both
 *      tagged [placeholder]. The live model is PER-REPORT, not per-seat. This
 *      crawl is the evidence those gates ask for, but flipping a gate is an
 *      owner action, so they are left untouched here.
 *   2. `docs/marketing-agency/RESTOREASSIST-LAUNCH-STORYBOARD-PLAN.md` records a
 *      yearly plan at $1188/year for 70 reports/month. No yearly plan appears on
 *      the live pricing page as at the crawl date; that record looks stale.
 */

export const CRAWL_DATE = '06/08/2026';
export const PRICING_SOURCE_URL = 'https://restoreassist.app/pricing';

export const MONTHLY_PLAN_PRICE_AUD = 99;
export const INCLUDED_REPORTS_PER_MONTH = 50;
export const FIRST_MONTH_BONUS_REPORTS = 10;
export const TRIAL_DAYS = 15;
export const TRIAL_REPORT_CREDITS = 50;
export const TRIAL_QUICK_FILL_CREDITS = 30;

export interface ReportPack {
  reports: number;
  priceAud: number;
  /** Label the live page prints on the pack, or null where it prints none. */
  badge: string | null;
}

/** Ordered largest-first: the per-report rate improves as the pack grows. */
export const REPORT_PACKS: readonly ReportPack[] = [
  { reports: 60, priceAud: 100, badge: 'Best value' },
  { reports: 25, priceAud: 50, badge: 'Most chosen' },
  { reports: 8, priceAud: 20, badge: null },
] as const;

export interface VolumeRecommendation {
  headline: string;
  detail: string;
  /** Plain-English pack list, or null when no pack is needed. */
  packLabel: string | null;
  packsCostAud: number;
  totalAud: number;
}

/** Largest pack count worth considering for any volume this page accepts. */
const MAX_PACKS_PER_SIZE = 25;

/**
 * Cheapest combination of packs that covers `shortfall` reports.
 *
 * Deliberately an exhaustive search rather than greedy largest-first. Greedy is
 * WRONG here: at a shortfall of 55 it picks 25 + 25 + 8 for $120, when a single
 * 60 pack covers the same month for $100. Buying more reports for less money is
 * exactly the case a buyer would be annoyed to discover afterwards, so the page
 * has to find it. The search space is tiny (three pack sizes, bounded counts),
 * so the cost of being exact is nil.
 *
 * Ties on price are broken towards fewer reports, so the recommendation does not
 * pad the order with headroom nobody asked for.
 */
function cheapestPacks(
  shortfall: number
): { pack: ReportPack; quantity: number }[] {
  const [large, medium, small] = REPORT_PACKS;
  let best: {
    quantities: [number, number, number];
    cost: number;
    reports: number;
  } | null = null;

  for (let a = 0; a <= MAX_PACKS_PER_SIZE; a += 1) {
    for (let b = 0; b <= MAX_PACKS_PER_SIZE; b += 1) {
      for (let c = 0; c <= MAX_PACKS_PER_SIZE; c += 1) {
        const reports =
          a * large.reports + b * medium.reports + c * small.reports;
        if (reports < shortfall) continue;

        const cost =
          a * large.priceAud + b * medium.priceAud + c * small.priceAud;
        if (
          !best ||
          cost < best.cost ||
          (cost === best.cost && reports < best.reports)
        ) {
          best = { quantities: [a, b, c], cost, reports };
        }
      }
    }
  }

  if (!best) return [];
  return REPORT_PACKS.map((pack, index) => ({
    pack,
    quantity: best.quantities[index],
  })).filter(entry => entry.quantity > 0);
}

/** Turn "reports per month" into a recommendation. */
export function recommendFor(reportsPerMonth: number): VolumeRecommendation {
  const shortfall = reportsPerMonth - INCLUDED_REPORTS_PER_MONTH;

  if (shortfall <= 0) {
    const headroom = INCLUDED_REPORTS_PER_MONTH - reportsPerMonth;
    return {
      headline: 'The monthly plan covers that. Add nothing.',
      detail:
        headroom === 0
          ? `That sits exactly on the ${INCLUDED_REPORTS_PER_MONTH} reports the plan already includes.`
          : `The plan includes ${INCLUDED_REPORTS_PER_MONTH} reports a month, so that leaves ${headroom} spare for a busy week.`,
      packLabel: null,
      packsCostAud: 0,
      totalAud: MONTHLY_PLAN_PRICE_AUD,
    };
  }

  const chosen = cheapestPacks(shortfall);

  const packsCostAud = chosen.reduce(
    (total, entry) => total + entry.quantity * entry.pack.priceAud,
    0
  );
  const packLabel = chosen
    .map(entry =>
      entry.quantity === 1
        ? `the ${entry.pack.reports} report pack`
        : `${entry.quantity} × the ${entry.pack.reports} report pack`
    )
    .join(' plus ');

  return {
    headline: `Add ${packLabel}.`,
    detail: `That is ${shortfall} reports past the ${INCLUDED_REPORTS_PER_MONTH} included, so ${packLabel} closes the gap for the month.`,
    packLabel,
    packsCostAud,
    totalAud: MONTHLY_PLAN_PRICE_AUD + packsCostAud,
  };
}
