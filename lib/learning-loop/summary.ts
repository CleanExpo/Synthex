/**
 * Learning loop — outcome summary and recommendation (pure, no I/O).
 *
 * Turns card events into an observed outcome with uncertainty, then applies the
 * experiment's pre-registered rules to produce a recommendation. It never makes
 * a decision: the decision is a separate, human-authored record (store.ts).
 *
 * Rules that matter:
 * - The primary measure is customer benefit: a session that picked a need, was
 *   shown an action and said it was useful. Clicks and shares are diagnostics
 *   and never feed the recommendation.
 * - Synthetic and preview data are counted separately and never reported as
 *   pilot (customer) results.
 * - An observed difference is reported with an interval. It is a causal claim
 *   only when assignment was randomised AND the sample meets the pre-registered
 *   minimum; otherwise it is labelled observational.
 */

export const DATA_CLASSES = ['synthetic', 'preview', 'pilot'] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

export const CARD_EVENT_TYPES = [
  'session_started',
  'need_selected',
  'action_shown',
  'action_rated',
  'contact_saved',
  'brand_link_opened',
  'shared',
  'confusion_reported',
  'accessibility_issue',
  'consent_error',
  'abandoned',
] as const;
export type CardEventType = (typeof CARD_EVENT_TYPES)[number];

export interface CardEvent {
  sessionId: string;
  type: CardEventType;
  variant: string;
  dataClass: DataClass;
  /**
   * 'random' only when the server verified that the variant is the one assignedVariant() derives
   * from the session id; 'forced' for a ?variant= preview link or any mismatch. Absent = unverified.
   */
  assignment?: 'random' | 'forced';
  needId?: string;
  rating?: 'useful' | 'not_useful' | 'confusing';
  createdAt: string;
}

export interface ExperimentSpec {
  id: string;
  variants: string[];
  randomised: boolean;
  /** Minimum sessions per variant before any keep/stop verdict on the primary measure. */
  minSessionsPerVariant: number;
  /** Lower bound of the useful-answer rate interval that earns "keep". */
  keepThreshold: number;
  /** Upper bound below which the useful-answer rate earns "stop". */
  stopThreshold: number;
  /** Stop conditions: any consent error, or these rates per session. */
  maxAccessibilityIssueRate: number;
  maxConfusionRate: number;
  /** Delivery cost per session in AUD cents (static content: 0). */
  deliveryCostCentsPerSession: number;
}

export interface Interval {
  rate: number | null;
  low: number | null;
  high: number | null;
}

export interface VariantOutcome {
  variant: string;
  sessions: number;
  needSelected: number;
  actionShown: number;
  useful: number;
  notUseful: number;
  confusing: number;
  unrated: number;
  abandoned: number;
  confusionReports: number;
  accessibilityIssues: number;
  consentErrors: number;
  qualifiedNextSteps: number;
  usefulRate: Interval;
  diagnostics: {
    contactSaved: number;
    brandLinksOpened: number;
    shared: number;
  };
}

export interface OutcomeSummary {
  experimentId: string;
  dataClass: DataClass;
  excludedByDataClass: Record<DataClass, number>;
  /** Sessions left out of the primary measure because their variant was not randomly assigned. */
  excludedNotRandomised: number;
  sessions: number;
  variants: VariantOutcome[];
  difference: (Interval & { between: [string, string] }) | null;
  claim: 'causal' | 'observational' | 'insufficient_data';
  missingData: string[];
  deliveryCostCents: number;
  costPerUsefulAnswerCents: number | null;
}

export type RecommendationVerdict =
  | 'keep'
  | 'revise'
  | 'stop'
  | 'continue_observing';

export interface Recommendation {
  verdict: RecommendationVerdict;
  reasons: string[];
  stopConditionsHit: string[];
  /** Who must record the next decision. Recommendations never decide. */
  requiredAuthority: string;
}

const Z95 = 1.959964;

/** Wilson score interval for a proportion; null when there is no denominator. */
export function wilson(successes: number, n: number, z = Z95): Interval {
  if (n <= 0) return { rate: null, low: null, high: null };
  const p = successes / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half =
    (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return {
    rate: p,
    low: Math.max(0, centre - half),
    high: Math.min(1, centre + half),
  };
}

/** Newcombe hybrid interval for the difference of two Wilson proportions (a − b). */
export function differenceInterval(a: Interval, b: Interval): Interval {
  if (a.rate === null || b.rate === null)
    return { rate: null, low: null, high: null };
  const d = a.rate - b.rate;
  const low = d - Math.sqrt((a.rate - a.low!) ** 2 + (b.high! - b.rate) ** 2);
  const high = d + Math.sqrt((a.high! - a.rate) ** 2 + (b.rate - b.low!) ** 2);
  return { rate: d, low, high };
}

function emptyVariant(variant: string): Omit<VariantOutcome, 'usefulRate'> {
  return {
    variant,
    sessions: 0,
    needSelected: 0,
    actionShown: 0,
    useful: 0,
    notUseful: 0,
    confusing: 0,
    unrated: 0,
    abandoned: 0,
    confusionReports: 0,
    accessibilityIssues: 0,
    consentErrors: 0,
    qualifiedNextSteps: 0,
    diagnostics: { contactSaved: 0, brandLinksOpened: 0, shared: 0 },
  };
}

/**
 * Summarise one data class. Events from the other classes are counted in
 * `excludedByDataClass` and otherwise ignored, so a synthetic run can never
 * inflate a pilot result.
 */
/**
 * The variant a session is randomly assigned to, derived from its random UUID so the browser and
 * the server compute the same answer and the server can verify it. A forced ?variant= link or a
 * client that picks its own variant does not match, so it never counts as randomised.
 */
export function assignedVariant(
  sessionId: string,
  variants: readonly string[]
): string | null {
  const m =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-([0-9a-f]{12})$/i.exec(
      sessionId
    );
  if (!m || variants.length === 0) return null;
  return variants[parseInt(m[1].slice(-4), 16) % variants.length];
}

/**
 * A session id for a forced ?variant= visit whose derived assignment is NOT the forced variant,
 * so the server always records it as 'forced' and it never enters the randomised sample, even
 * when the forced choice would have coincided with the random one (Codex review of PR #1016).
 */
export function forcedSessionId(
  forced: string,
  variants: readonly string[],
  newId: () => string
): string {
  for (let i = 0; i < 64; i++) {
    const id = newId();
    const v = assignedVariant(id, variants);
    if (v !== null && v !== forced) return id;
  }
  throw new Error('could not draw a session id outside the forced variant');
}

export function summarise(
  spec: ExperimentSpec,
  events: CardEvent[],
  dataClass: DataClass
): OutcomeSummary {
  const excluded: Record<DataClass, number> = {
    synthetic: 0,
    preview: 0,
    pilot: 0,
  };
  const sessions = new Map<
    string,
    {
      variant: string;
      types: Set<CardEventType>;
      rating?: CardEvent['rating'];
      usefulAt?: number;
      nextAfterUseful: boolean;
    }
  >();

  const ordered = [...events].sort((x, y) =>
    x.createdAt.localeCompare(y.createdAt)
  );
  const notRandomised = new Set<string>();
  for (const e of ordered) {
    if (e.dataClass !== dataClass) {
      excluded[e.dataClass] += 1;
      continue;
    }
    // A randomised experiment's primary measure counts only verified random assignments; forced
    // preview links and unverified events are left out (Codex review of PR #1016).
    if (spec.randomised && e.assignment !== 'random') {
      notRandomised.add(e.sessionId);
      continue;
    }
    let s = sessions.get(e.sessionId);
    if (!s) {
      s = { variant: e.variant, types: new Set(), nextAfterUseful: false };
      sessions.set(e.sessionId, s);
    }
    s.types.add(e.type);
    if (e.type === 'action_rated' && e.rating) {
      s.rating = e.rating; // the latest rating stands
      if (e.rating === 'useful') s.usefulAt = Date.parse(e.createdAt);
    }
    if (
      (e.type === 'contact_saved' || e.type === 'brand_link_opened') &&
      s.usefulAt !== undefined
    ) {
      s.nextAfterUseful = true;
    }
  }

  const byVariant = new Map<string, Omit<VariantOutcome, 'usefulRate'>>(
    spec.variants.map(v => [v, emptyVariant(v)])
  );
  const unknownVariants = new Set<string>();
  for (const s of sessions.values()) {
    const v = byVariant.get(s.variant);
    if (!v) {
      unknownVariants.add(s.variant);
      continue;
    }
    v.sessions += 1;
    if (s.types.has('need_selected')) v.needSelected += 1;
    if (s.types.has('action_shown')) v.actionShown += 1;
    const benefit =
      s.types.has('need_selected') &&
      s.types.has('action_shown') &&
      s.rating === 'useful';
    if (benefit) v.useful += 1;
    else if (s.rating === 'not_useful') v.notUseful += 1;
    else if (s.rating === 'confusing') v.confusing += 1;
    else if (s.types.has('action_shown')) v.unrated += 1;
    if (
      s.types.has('abandoned') ||
      (!s.types.has('action_shown') && !s.types.has('contact_saved'))
    )
      v.abandoned += 1;
    if (s.types.has('confusion_reported')) v.confusionReports += 1;
    if (s.types.has('accessibility_issue')) v.accessibilityIssues += 1;
    if (s.types.has('consent_error')) v.consentErrors += 1;
    if (benefit && s.nextAfterUseful) v.qualifiedNextSteps += 1;
    if (s.types.has('contact_saved')) v.diagnostics.contactSaved += 1;
    if (s.types.has('brand_link_opened')) v.diagnostics.brandLinksOpened += 1;
    if (s.types.has('shared')) v.diagnostics.shared += 1;
  }

  const variants: VariantOutcome[] = [...byVariant.values()].map(v => ({
    ...v,
    usefulRate: wilson(v.useful, v.sessions),
  }));

  const missingData: string[] = [];
  if (unknownVariants.size)
    missingData.push(
      `events for unregistered variants ignored: ${[...unknownVariants].join(', ')}`
    );
  for (const v of variants) {
    if (v.sessions === 0)
      missingData.push(`no ${dataClass} sessions for variant ${v.variant}`);
    else if (v.unrated > 0)
      missingData.push(
        `${v.unrated} ${v.variant} session(s) saw an action but did not rate it`
      );
  }
  if (dataClass !== 'pilot')
    missingData.push(`data class is ${dataClass}: not a customer result`);
  if (notRandomised.size)
    missingData.push(
      `${notRandomised.size} session(s) left out: variant not randomly assigned (forced link or unverified)`
    );

  let difference: OutcomeSummary['difference'] = null;
  if (variants.length === 2) {
    difference = {
      ...differenceInterval(variants[0].usefulRate, variants[1].usefulRate),
      between: [variants[0].variant, variants[1].variant],
    };
  }
  const enough = variants.every(v => v.sessions >= spec.minSessionsPerVariant);
  const claim: OutcomeSummary['claim'] = !enough
    ? 'insufficient_data'
    : spec.randomised && dataClass === 'pilot'
      ? 'causal'
      : 'observational';

  const total = variants.reduce((n, v) => n + v.sessions, 0);
  const useful = variants.reduce((n, v) => n + v.useful, 0);
  const deliveryCostCents = total * spec.deliveryCostCentsPerSession;
  return {
    experimentId: spec.id,
    dataClass,
    excludedByDataClass: excluded,
    excludedNotRandomised: notRandomised.size,
    sessions: total,
    variants,
    difference,
    claim,
    missingData,
    deliveryCostCents,
    costPerUsefulAnswerCents:
      useful > 0 ? Math.round(deliveryCostCents / useful) : null,
  };
}

/** Apply the experiment's pre-registered rules. Deterministic; never a decision. */
export function recommend(
  spec: ExperimentSpec,
  s: OutcomeSummary
): Recommendation {
  const stopConditionsHit: string[] = [];
  const reasons: string[] = [];
  for (const v of s.variants) {
    if (v.consentErrors > 0)
      stopConditionsHit.push(
        `${v.variant}: ${v.consentErrors} consent error(s)`
      );
    if (
      v.sessions > 0 &&
      v.accessibilityIssues / v.sessions > spec.maxAccessibilityIssueRate
    )
      stopConditionsHit.push(
        `${v.variant}: accessibility issue rate above ${spec.maxAccessibilityIssueRate * 100}%`
      );
    if (
      v.sessions > 0 &&
      v.confusionReports / v.sessions > spec.maxConfusionRate
    )
      stopConditionsHit.push(
        `${v.variant}: confusion rate above ${spec.maxConfusionRate * 100}%`
      );
  }
  const authority =
    'organisation owner (Phill); launching or changing the pilot also needs founder approval';
  // Only pilot data can earn keep or stop. A safety signal in preview or synthetic data is a
  // rehearsal finding: fix it before any pilot, but it is not a stop on the experiment (Codex
  // review of PR #1016).
  if (stopConditionsHit.length && s.dataClass !== 'pilot') {
    return {
      verdict: 'revise',
      reasons: [
        `rehearsal finding on ${s.dataClass} data: fix before any pilot (not a stop; only pilot data can earn keep or stop)`,
      ],
      stopConditionsHit,
      requiredAuthority: authority,
    };
  }
  if (stopConditionsHit.length) {
    return {
      verdict: 'stop',
      reasons: ['a pre-registered stop condition was hit'],
      stopConditionsHit,
      requiredAuthority: authority,
    };
  }
  if (s.claim === 'insufficient_data') {
    reasons.push(
      `fewer than ${spec.minSessionsPerVariant} ${s.dataClass} sessions in at least one variant`
    );
    return {
      verdict: 'continue_observing',
      reasons,
      stopConditionsHit,
      requiredAuthority: authority,
    };
  }
  if (s.dataClass !== 'pilot') {
    reasons.push(
      `${s.dataClass} data cannot earn keep or stop; it only checks the loop works`
    );
    return {
      verdict: 'continue_observing',
      reasons,
      stopConditionsHit,
      requiredAuthority: authority,
    };
  }
  const lows = s.variants.map(v => v.usefulRate.low ?? 0);
  const highs = s.variants.map(v => v.usefulRate.high ?? 0);
  if (Math.min(...lows) >= spec.keepThreshold) {
    reasons.push(
      `every variant's useful-answer rate is at least ${spec.keepThreshold * 100}% at the interval's lower bound`
    );
    if (
      s.difference &&
      s.difference.low !== null &&
      (s.difference.low > 0 || s.difference.high! < 0)
    ) {
      reasons.push(
        `the variants differ (${s.claim}); keep the better one and revise the other`
      );
      return {
        verdict: 'revise',
        reasons,
        stopConditionsHit,
        requiredAuthority: authority,
      };
    }
    return {
      verdict: 'keep',
      reasons,
      stopConditionsHit,
      requiredAuthority: authority,
    };
  }
  if (Math.max(...highs) < spec.stopThreshold) {
    reasons.push(
      `no variant can reach ${spec.stopThreshold * 100}% even at the interval's upper bound`
    );
    return {
      verdict: 'stop',
      reasons,
      stopConditionsHit,
      requiredAuthority: authority,
    };
  }
  reasons.push(
    'the useful-answer rate is between the keep and stop thresholds'
  );
  return {
    verdict: 'revise',
    reasons,
    stopConditionsHit,
    requiredAuthority: authority,
  };
}
