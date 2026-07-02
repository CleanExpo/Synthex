/**
 * Reserved ad-data shape — #7 paid-ready architecture (extension point, v2 seam)
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ RESERVED FOR v2 — NOT YET MIGRATED, NOT YET WIRED.                          │
 * │                                                                            │
 * │ These interfaces document the shape native paid-media data WILL take when  │
 * │ paid execution is built in v2. They are TypeScript types ONLY: there is    │
 * │ deliberately no Prisma model, no table, no migration, and no ad-API call   │
 * │ behind them yet (founder decision §14-1 — extension points only in v1).    │
 * │                                                                            │
 * │ When v2 lands, these become the contract for a new, ADDITIVE set of        │
 * │ tables (AdAccount / AdCampaign / AdMetric) plus a touch-level join into     │
 * │ the existing SYN-795 attribution engine — see `toPaidTouchpoint` below.    │
 * │ Nothing in v1 reads or writes them; importing this file has no runtime     │
 * │ effect beyond the type space.                                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Why a documented type file rather than a schema change now:
 *   - v1 ships the EXTENSION POINTS, not the execution. Reserving the shape lets
 *     the channel-agnostic layer (`./channels.ts`) and the empty paid report
 *     slot be built and tested today, with the `paid` channel class structurally
 *     present, while keeping the database untouched until paid is actually built.
 *   - Additivity: every field below is designed so a future migration can add
 *     these as NEW nullable/defaulted columns/tables without altering any
 *     existing model — consistent with the project's backward-compatible
 *     migration rule.
 */

import type { ChannelClass } from './channels';
import type { Touchpoint } from './engine';

// ── Reserved v2 entities ──────────────────────────────────────────────────────

/** Supported paid platforms for v2. Extend, never repurpose existing values. */
export type AdPlatform =
  | 'google_ads'
  | 'meta_ads'
  | 'linkedin_ads'
  | 'tiktok_ads'
  | 'microsoft_ads';

/**
 * A connected paid-advertising account (v2). Mirrors how `PlatformConnection`
 * works for organic platforms today, but for ad accounts. Reserved — not a
 * Prisma model yet.
 */
export interface AdAccount {
  /** Stable id (will be a cuid column in v2). */
  id: string;
  /** Org that owns the account — org-scoped like every other entity. */
  organizationId: string;
  platform: AdPlatform;
  /** The platform's own account identifier (e.g. Google Ads customer id). */
  externalAccountId: string;
  /** Human-readable account name as shown in the ad platform. */
  name: string;
  /** ISO-4217 currency the account bills in. Synthex reporting normalises to AUD. */
  currency: string;
  connectedAt: Date;
}

/** Lifecycle status of a paid campaign as reported by the ad platform (v2). */
export type AdCampaignStatus = 'active' | 'paused' | 'ended' | 'draft';

/**
 * A paid campaign within an `AdAccount` (v2). The `utmCampaign` field is the
 * join key back into the existing engine: a paid touchpoint matches a campaign
 * when the engagement event's `utm_campaign` equals this value. Reserved.
 */
export interface AdCampaign {
  id: string;
  adAccountId: string;
  organizationId: string;
  /** Platform campaign id. */
  externalCampaignId: string;
  name: string;
  status: AdCampaignStatus;
  /**
   * UTM campaign tag this paid campaign stamps on its clicks. This is the seam
   * that lets paid touchpoints flow through the SAME UTM match cascade the
   * organic engine already uses — no new matching logic required.
   */
  utmCampaign: string;
  startedAt: Date;
  endedAt: Date | null;
}

/**
 * A day of spend/performance for an `AdCampaign` (v2). Time-series, one row per
 * campaign per day. `spendAud` is what makes ROI (revenue ÷ spend) computable
 * once paid is live — v1 has no spend, so paid ROI is structurally undefined.
 * Reserved.
 */
export interface AdMetric {
  id: string;
  adCampaignId: string;
  organizationId: string;
  /** The day this metric row covers (UTC date). */
  date: Date;
  spendAud: number;
  impressions: number;
  clicks: number;
  /** Platform-reported conversions, if the pixel/tag is configured. */
  conversions: number;
}

// ── Channel-agnostic join (the actual seam) ───────────────────────────────────

/**
 * A paid touchpoint as it will enter the channel-agnostic attribution layer in
 * v2. It is the existing engine `Touchpoint` PLUS the paid-specific fields the
 * organic path has no use for, with `channel` pinned to `'paid'`.
 *
 * Deliberately a superset of `Touchpoint`: the channel roll-up in
 * `./channels.ts` already treats every touchpoint uniformly, so a `PaidTouchpoint`
 * is bucketed by exactly the same code that buckets organic/owned touchpoints —
 * the "zero rework" guarantee from the acceptance criteria.
 */
export interface PaidTouchpoint extends Touchpoint {
  channel: Extract<ChannelClass, 'paid'>;
  adCampaignId: string;
  adPlatform: AdPlatform;
  /** Spend attributable to this touch (for ROI), in AUD. */
  spendAud: number;
}

/**
 * Documents the v2 shape of mapping a paid metric/campaign into a channel-agnostic
 * touchpoint. RESERVED: a type-level seam only — it deliberately throws if called,
 * because no paid data exists in v1 to map. v2 replaces the body with the real
 * mapping once `AdMetric` rows are persisted.
 *
 * Kept as a typed signature (not just a comment) so the v2 contract is checked by
 * the compiler the day someone implements it.
 */
export function toPaidTouchpoint(
  _base: Touchpoint,
  _campaign: AdCampaign,
  _spendAud: number
): PaidTouchpoint {
  throw new Error(
    'toPaidTouchpoint is a reserved v2 paid seam — paid execution is not built in v1 (#7, founder decision §14-1).'
  );
}
