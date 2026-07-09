/**
 * Quick Wins Sprint — Campaign Auto-Builder core (SYN-20)
 *
 * ONBOARD-P3: auto-create the first campaign ("Quick Wins Sprint") for
 * Growth/Scale clients. This module is the pure, deterministic planning core:
 * given a business profile + effective plan tier, it lays out a 2-week sprint
 * calendar (7-10 posts/week mixing content types) with A/B variations, and
 * applies tier gating (Growth/Scale get the full plan; Pro gets a locked
 * preview + upgrade prompt; lower tiers get nothing).
 *
 * SCOPE / SEAMS (intentionally NOT wired here — gated on upstream systems):
 *  - Persona + Scorecard AI copy generation. This module produces the
 *    STRUCTURE (calendar slots with pillar/type/platform + title stubs).
 *    Actual post copy comes later from the persona/AI layer; `personaHints`
 *    is accepted as an optional input so that seam stays clean.
 *  - Pathway (SYN-23) SEO-fix coordination. Callers may pass
 *    `pathwaySeoTasks`; when present, slots are annotated with the SEO task
 *    they support. When absent, the sprint still builds standalone.
 *  - Persistence (Campaign rows) + ad-platform wiring are out of scope.
 *
 * Pure: no auth, no DB, no network. Fully deterministic given its input.
 */

import { hasPlanAccess, type PlanName } from '@/lib/billing/plan-access';

// ============================================================================
// TYPES
// ============================================================================

/** Content types the sprint mixes across the two weeks. */
export type SprintContentType =
  | 'educational'
  | 'social_proof'
  | 'behind_the_brand'
  | 'engagement'
  | 'promotional';

/** Publishing platforms (aligned with the campaigns API platform enum). */
export type SprintPlatform =
  | 'twitter'
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'threads';

/** Tier gate outcome for the sprint feature. */
export type SprintAccessLevel = 'full' | 'preview' | 'none';

export interface PathwaySeoTask {
  id: string;
  label: string;
  /** 1-based sprint day this task is anchored to, if the Pathway sets one. */
  day?: number;
}

export interface SprintBusinessInput {
  name: string;
  /** Content pillars (from Persona/Brand-DNA). Falls back to sane defaults. */
  pillars?: string[];
  /** Target platforms. Falls back to a default primary set. */
  platforms?: SprintPlatform[];
}

export interface SprintBuilderInput {
  /** Raw effective plan string (e.g. 'growth', 'scale', 'pro'). */
  plan: string | null | undefined;
  business: SprintBusinessInput;
  /**
   * Optional free-text persona hints. Reserved seam for the AI copy layer —
   * recorded on the plan but does not change structural layout.
   */
  personaHints?: string;
  /** Optional Pathway Phase-1 SEO fix tasks to coordinate the sprint with. */
  pathwaySeoTasks?: PathwaySeoTask[];
  /** Posts per week. Clamped to the sprint's supported 7-10 range. */
  postsPerWeek?: number;
}

export interface SprintSlot {
  id: string;
  /** Sprint week: 1 or 2. */
  week: 1 | 2;
  /** 1-based day within the 14-day sprint (1..14). */
  day: number;
  platform: SprintPlatform;
  contentType: SprintContentType;
  pillar: string;
  /** Human-readable title stub (final copy comes from the AI/persona layer). */
  title: string;
  /** A/B variation flag — enabled only for Growth/Scale full plans. */
  hasAbVariation: boolean;
  /** Id of the Pathway SEO task this post supports, when coordinated. */
  seoTaskRef?: string;
  /** True when the slot is redacted in a Pro preview. */
  locked?: boolean;
}

export interface QuickWinsSprintPlan {
  name: 'Quick Wins Sprint';
  tier: string;
  /** Access level that produced this plan. */
  access: Extract<SprintAccessLevel, 'full' | 'preview'>;
  /** Fixed 2-week sprint (aligned with Pathway Phase 1). */
  weeks: 2;
  postsPerWeek: number;
  totalPosts: number;
  abTestingEnabled: boolean;
  /** True when Pathway SEO tasks were coordinated into the calendar. */
  seoCoordinated: boolean;
  slots: SprintSlot[];
  /** Present only on Pro previews. */
  previewOnly?: true;
  /** Upgrade CTA — present only on Pro previews. */
  upgradePrompt?: string;
  /** Persona hints echoed for the downstream copy layer, if provided. */
  personaHints?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SPRINT_WEEKS = 2 as const;
export const MIN_POSTS_PER_WEEK = 7;
export const MAX_POSTS_PER_WEEK = 10;
export const DEFAULT_POSTS_PER_WEEK = 8;

/** Number of slots left unlocked in a Pro preview. */
export const PREVIEW_UNLOCKED_SLOTS = 3;

const DEFAULT_PLATFORMS: SprintPlatform[] = [
  'linkedin',
  'instagram',
  'facebook',
];

const DEFAULT_PILLARS = ['Education', 'Social Proof', 'Behind the Brand'];

/** Deterministic rotation of content types (the "mix"). */
const CONTENT_TYPE_CYCLE: SprintContentType[] = [
  'educational',
  'social_proof',
  'engagement',
  'behind_the_brand',
  'promotional',
];

const CONTENT_TYPE_TITLES: Record<SprintContentType, string> = {
  educational: 'How-to / teach the audience something useful',
  social_proof: 'Customer result / testimonial spotlight',
  behind_the_brand: 'Behind-the-scenes / humanise the brand',
  engagement: 'Question / poll to spark conversation',
  promotional: 'Offer / product highlight with a clear CTA',
};

const UPGRADE_PROMPT =
  'Campaign auto-builder is a Growth & Scale feature. Upgrade to unlock the ' +
  'full 2-week Quick Wins Sprint with A/B testing and Pathway-coordinated posts.';

// ============================================================================
// TIER GATING
// ============================================================================

/**
 * Resolve the sprint access level for an effective plan.
 *
 *  - Growth / Scale (and internal full-access which resolves to 'scale') → 'full'
 *  - Pro / Professional → 'preview' (locked preview + upgrade prompt)
 *  - Free / Starter / unknown → 'none'
 *
 * Pass the ALREADY-resolved effective plan (see resolveEffectivePlan) so the
 * owner/admin full-access bypass is honoured upstream.
 */
export function resolveSprintAccess(
  plan: string | null | undefined
): SprintAccessLevel {
  const normalised = (plan ?? '').toLowerCase();
  if (hasPlanAccess(normalised, 'growth')) return 'full';
  if (hasPlanAccess(normalised, 'pro' as PlanName)) return 'preview';
  return 'none';
}

// ============================================================================
// BUILDER
// ============================================================================

function clampPostsPerWeek(n: number | undefined): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return DEFAULT_POSTS_PER_WEEK;
  return Math.min(
    MAX_POSTS_PER_WEEK,
    Math.max(MIN_POSTS_PER_WEEK, Math.round(n))
  );
}

/**
 * Deterministically map a post's position (0-based) within a week onto a day.
 * Spreads posts across the 7-day week as evenly as possible so cadence is
 * front-to-back consistent regardless of postsPerWeek (7..10).
 */
function dayWithinWeek(index: number, postsPerWeek: number): number {
  // Even spread over 7 days: floor(index * 7 / postsPerWeek) gives 0..6.
  return Math.floor((index * 7) / postsPerWeek) + 1; // 1..7
}

/**
 * Build the full Quick Wins Sprint plan (structure only). Deterministic.
 *
 * Content types rotate through CONTENT_TYPE_CYCLE, platforms and pillars
 * round-robin across the business inputs, and — for full (Growth/Scale) plans —
 * every slot carries an A/B variation. When Pathway SEO tasks are supplied they
 * are attached to slots (by anchored day when set, otherwise round-robin) so
 * the sprint is coordinated with Phase-1 fixes.
 */
export function buildQuickWinsSprint(
  input: SprintBuilderInput,
  accessOverride?: Extract<SprintAccessLevel, 'full' | 'preview'>
): QuickWinsSprintPlan {
  const tier = (input.plan ?? 'free').toLowerCase();
  const access =
    accessOverride ??
    (resolveSprintAccess(tier) === 'full' ? 'full' : 'preview');

  const postsPerWeek = clampPostsPerWeek(input.postsPerWeek);
  const platforms =
    input.business.platforms && input.business.platforms.length > 0
      ? input.business.platforms
      : DEFAULT_PLATFORMS;
  const pillars =
    input.business.pillars && input.business.pillars.length > 0
      ? input.business.pillars
      : DEFAULT_PILLARS;

  const seoTasks = input.pathwaySeoTasks ?? [];
  const seoByDay = new Map<number, PathwaySeoTask>();
  const seoUnanchored: PathwaySeoTask[] = [];
  for (const task of seoTasks) {
    if (typeof task.day === 'number' && task.day >= 1 && task.day <= 14) {
      if (!seoByDay.has(task.day)) seoByDay.set(task.day, task);
    } else {
      seoUnanchored.push(task);
    }
  }

  const abEnabled = access === 'full';
  const slots: SprintSlot[] = [];
  let globalIndex = 0;
  let unanchoredCursor = 0;

  for (
    let week = 1 as 1 | 2;
    week <= SPRINT_WEEKS;
    week = (week + 1) as 1 | 2
  ) {
    for (let i = 0; i < postsPerWeek; i++) {
      const dayInWeek = dayWithinWeek(i, postsPerWeek); // 1..7
      const day = (week - 1) * 7 + dayInWeek; // 1..14
      const contentType =
        CONTENT_TYPE_CYCLE[globalIndex % CONTENT_TYPE_CYCLE.length];
      const platform = platforms[globalIndex % platforms.length];
      const pillar = pillars[globalIndex % pillars.length];

      // Coordinate with Pathway SEO tasks: prefer a task anchored to this day,
      // otherwise consume unanchored tasks in order.
      let seoTaskRef: string | undefined;
      const anchored = seoByDay.get(day);
      if (anchored) {
        seoTaskRef = anchored.id;
      } else if (unanchoredCursor < seoUnanchored.length) {
        seoTaskRef = seoUnanchored[unanchoredCursor].id;
        unanchoredCursor++;
      }

      slots.push({
        id: `qws-w${week}-d${day}-${platform}-${globalIndex}`,
        week,
        day,
        platform,
        contentType,
        pillar,
        title: `${input.business.name}: ${CONTENT_TYPE_TITLES[contentType]}`,
        hasAbVariation: abEnabled,
        ...(seoTaskRef ? { seoTaskRef } : {}),
      });
      globalIndex++;
    }
  }

  const plan: QuickWinsSprintPlan = {
    name: 'Quick Wins Sprint',
    tier,
    access,
    weeks: SPRINT_WEEKS,
    postsPerWeek,
    totalPosts: slots.length,
    abTestingEnabled: abEnabled,
    seoCoordinated: slots.some(s => Boolean(s.seoTaskRef)),
    slots,
    ...(input.personaHints ? { personaHints: input.personaHints } : {}),
  };
  return plan;
}

/**
 * Redact a full plan into a Pro preview: the first PREVIEW_UNLOCKED_SLOTS
 * slots stay visible, the rest are locked (titles stripped), A/B testing is
 * disabled, and an upgrade prompt is attached.
 */
export function toPreviewPlan(full: QuickWinsSprintPlan): QuickWinsSprintPlan {
  const slots = full.slots.map((slot, idx) => {
    if (idx < PREVIEW_UNLOCKED_SLOTS) {
      return { ...slot, hasAbVariation: false };
    }
    return {
      ...slot,
      title: 'Locked — upgrade to reveal',
      hasAbVariation: false,
      locked: true as const,
    };
  });

  return {
    ...full,
    access: 'preview',
    abTestingEnabled: false,
    slots,
    previewOnly: true,
    upgradePrompt: UPGRADE_PROMPT,
  };
}

export interface GenerateSprintResult {
  access: SprintAccessLevel;
  plan?: QuickWinsSprintPlan;
  upgradePrompt?: string;
}

/**
 * End-to-end entry point: resolve access, then build the appropriate artifact.
 *
 *  - 'full'    → full Quick Wins Sprint plan.
 *  - 'preview' → locked preview + upgrade prompt (Pro clients).
 *  - 'none'    → no plan, just an upgrade prompt (below Pro).
 *
 * `input.plan` MUST be the effective plan (owner/admin bypass already applied).
 */
export function generateSprint(
  input: SprintBuilderInput
): GenerateSprintResult {
  const access = resolveSprintAccess(input.plan);

  if (access === 'none') {
    return { access, upgradePrompt: UPGRADE_PROMPT };
  }

  if (access === 'preview') {
    const full = buildQuickWinsSprint(input, 'full');
    const preview = toPreviewPlan(full);
    return { access, plan: preview, upgradePrompt: UPGRADE_PROMPT };
  }

  return { access, plan: buildQuickWinsSprint(input, 'full') };
}
