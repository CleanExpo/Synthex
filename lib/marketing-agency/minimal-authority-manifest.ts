/**
 * Minimal campaign authority manifest auto-generation.
 *
 * BACKGROUND
 * ----------
 * `assertCampaignPublishable` (see `campaign-authority-manifest.ts`) is a real
 * approval control for CCW-style campaigns: any campaign that makes verifiable
 * claims, uses third-party assets, or needs human sign-off must ship a rich
 * evidence manifest before it can publish externally.
 *
 * The problem (P0): the *ordinary* scheduler / campaign-create paths never
 * attached ANY manifest. With no manifest, the gate returns
 * `campaign_authority_manifest_missing` and the cron silently routes the post
 * to `pending_approval` — so ordinary scheduled posts never publish.
 *
 * THE FIX (decision: auto-generate a minimal manifest)
 * ----------------------------------------------------
 * Keep the gate. When a campaign/post is scheduled or created via the normal
 * flow and has NO manifest, auto-attach a *minimal valid* evidence manifest so
 * ordinary posts pass the gate and publish. A campaign that already carries a
 * richer manifest (e.g. the CCW EOFY manifest, or anything still under human
 * review) is left untouched — `extractCampaignAuthorityManifest` finds the
 * existing manifest first and `ensureCampaignAuthorityManifest` never overwrites
 * it. CCW-style campaigns therefore still require their real manifest and human
 * approval.
 *
 * The minimal manifest deliberately contains NO claims that require evidence and
 * NO third-party assets. It represents an ordinary self-authored post: the
 * business is publishing its own content to its own connected account.
 *
 * APPROVAL: THE CLAIM IS SPLIT (SYN-1157, founder ruling 2026-08-16)
 * -----------------------------------------------------------------
 * This manifest used to emit `humanApproved: true, approvedBy: 'self-publish'`
 * plus nine invented evaluation scores. The rationale was that scheduling via
 * the normal UI IS the human act. That holds for authorship. It broke in three
 * places, and all three are now fixed here:
 *
 *  1. On the cron publish path there is no human at all. The old code stamped
 *     `approvedAt: now` at publish time — a timestamp recording a moment when
 *     nobody did anything. We now carry the REAL scheduling time, supplied by
 *     the caller, and refuse to invent one.
 *  2. The nine scores were constants in this file presented downstream as an
 *     assessment. No evaluation ever ran. They are gone. Absent is honest.
 *  3. `humanApproved` is what the gate blocks on, so the gate was satisfied by
 *     a value this system wrote about itself.
 *
 * So the two claims are now separate. "A human authored and scheduled this" is
 * true and worth recording: `status: 'self_authored'` with the real scheduler
 * and the real scheduling time. "A human reviewed this against evidence" did
 * not happen, so it is no longer asserted. The gate accepts self_authored only
 * while nothing in the manifest needs evidence — see `evaluateSelfAuthored`.
 */

import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  extractCampaignAuthorityManifest,
  type CampaignEvidenceManifest,
  type CampaignManifestPlatformOutput,
} from './campaign-authority-manifest';

export interface MinimalAuthorityManifestInput {
  /** Owning campaign id, when known. */
  campaignId?: string;
  /** Target platforms for this post/campaign (used to populate platformOutputs). */
  platforms?: string[];
  /** Short topic/title for the post. Falls back to a generic label. */
  topic?: string;
  /** Stable id seed so the same post produces a stable manifestId. */
  idSeed?: string;
  /**
   * The user who authored and scheduled the post. REQUIRED in practice: without
   * it the manifest cannot make a checkable self-authorship claim, so the gate
   * refuses it with `campaign_self_authored_scheduler_missing`. Optional in the
   * type only so a caller that genuinely has no user is forced through the gate
   * rather than silently defaulted to a constant.
   */
  scheduledBy?: string;
  /**
   * ISO timestamp of when the human scheduled it. NOT publish time. Deliberately
   * never defaulted to `now`: inventing this value is the SYN-1157 defect.
   */
  scheduledAt?: string;
}

function slugifySeed(seed: string | undefined): string {
  if (!seed) {
    return Math.random().toString(36).slice(2, 10);
  }
  return (
    seed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'post'
  );
}

function normalisePlatforms(platforms?: string[]): string[] {
  const cleaned = (platforms ?? [])
    .map(p => p?.trim().toLowerCase())
    .filter((p): p is string => Boolean(p));
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : ['default'];
}

/**
 * Build a minimal, self-AUTHORED evidence manifest that passes
 * `assertCampaignPublishable` for an ordinary self-authored scheduled post.
 * It is not self-APPROVED: it asserts who wrote and scheduled the post, and
 * asserts nothing about review. See the APPROVAL note at the top of this file.
 *
 * It contains:
 *  - no evidence-requiring claims (a single self-authored claim with
 *    requiresEvidence: false),
 *  - no third-party assets (assets omitted — only a warning, never a blocker),
 *  - all requested platforms marked `approved`,
 *  - a `self_authored` approval carrying the caller's real scheduler and
 *    scheduling time, and NO assertion of human review,
 *  - no evaluation scores, because no evaluation ran.
 */
export function buildMinimalCampaignAuthorityManifest(
  input: MinimalAuthorityManifestInput = {}
): CampaignEvidenceManifest {
  const platforms = normalisePlatforms(input.platforms);
  const now = new Date().toISOString();
  const slug = slugifySeed(input.idSeed ?? input.campaignId ?? input.topic);
  const topic = input.topic?.trim() || 'Self-authored scheduled post';

  const platformOutputs: CampaignManifestPlatformOutput[] = platforms.map(
    platform => ({
      platform,
      status: 'approved',
      contentRef: `${slug}-${platform}`,
      notes: 'Ordinary self-authored post scheduled via the standard flow.',
    })
  );

  return {
    manifestId: `minimal-${slug}`,
    campaignId: input.campaignId,
    topic,
    audience: 'Owned-account followers',
    businessGoal:
      'Publish ordinary self-authored content to the business-owned connected account.',
    sources: [
      {
        id: 'self-authored',
        label: 'Self-authored content by the account owner',
        sourceType: 'first_party',
        role: 'supporting',
        checkedAt: now,
      },
    ],
    expertNotes: [
      'Auto-generated minimal manifest for an ordinary self-authored post.',
    ],
    consumerObjections: [],
    claims: [
      {
        id: 'self-authored-content',
        statement:
          'This post is self-authored content published by the account owner to their own connected account.',
        status: 'allowed',
        // No external evidence is required for ordinary self-authored content.
        requiresEvidence: false,
        humanApprovalRequired: false,
      },
    ],
    seoAeoGeoTargets: [],
    requiredVisuals: [],
    // Assets intentionally omitted — a missing asset list is a warning, not a
    // blocker. A minimal post claims no third-party asset rights.
    platformOutputs,
    // Authorship, not review. No humanApproved, no approvedBy, no approvedAt:
    // asserting any of them here is the SYN-1157 defect, and the gate now
    // refuses a self_authored manifest that carries them.
    approval: {
      status: 'self_authored',
      scheduledBy: input.scheduledBy,
      scheduledAt: input.scheduledAt,
    },
    // No `evaluation` key. No evaluation ran, so there are no scores to report.
    publishLinks: [],
    lessons: [],
  };
}

/**
 * Return an existing campaign authority manifest if one is present in any of the
 * provided metadata containers; otherwise build and return a minimal one.
 *
 * This NEVER overrides an existing (e.g. CCW) manifest — it only fills the gap
 * for ordinary posts that carry no manifest at all. Use at schedule/create time
 * or just-before-publish.
 */
export function ensureCampaignAuthorityManifest(
  input: MinimalAuthorityManifestInput,
  ...metadataSources: unknown[]
): CampaignEvidenceManifest {
  const existing = extractCampaignAuthorityManifest(...metadataSources);
  if (existing) return existing;
  return buildMinimalCampaignAuthorityManifest(input);
}

export { CAMPAIGN_AUTHORITY_MANIFEST_KEY };
