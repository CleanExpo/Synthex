/**
 * Campaign-calendar draft engine (SYN-1024, slice 1) — pure + approval-gated.
 *
 * Turns a business profile + per-platform connectivity into a multi-platform
 * calendar DRAFT. It is deliberately a planning surface only:
 *   - Every publishable item is emitted at `approvalState: 'pending_approval'`.
 *   - The engine never schedules or publishes; it produces drafts a human (or a
 *     later approval flow) acts on. No external side effects, no queue logic.
 *   - Platforms without a live OAuth connection produce a `blocked` setup item
 *     linked to credential state (SYN-1023), never a publishable draft.
 *
 * Per-platform copy length / hashtag / peak-time conventions are REUSED from
 * `PLATFORM_BEST_PRACTICES` (content-engine); only the asset spec (image aspect
 * ratio + video duration hint), which content-engine doesn't carry, is added
 * here.
 *
 * Pure function — DB reads, persistence, and queue wiring live in the caller.
 */
import {
  PLATFORM_BEST_PRACTICES,
  type Platform,
} from '@/lib/recommendations/content-engine';
import type { CoverageStatus } from '@/lib/credential-intake/credential-coverage';

/** Connectivity for a platform, sourced from SYN-1023 coverage (or unknown). */
export type PlatformConnectivity = CoverageStatus | 'unknown';

export interface PlatformAssetSpec {
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9';
  /** [min, max] seconds for video formats; null when the platform is image-led. */
  videoDurationHintSec: [number, number] | null;
}

/** Asset specs the per-platform best-practices table does not encode. */
export const PLATFORM_ASSET_SPECS: Record<Platform, PlatformAssetSpec> = {
  instagram: { aspectRatio: '4:5', videoDurationHintSec: [15, 60] },
  facebook: { aspectRatio: '1:1', videoDurationHintSec: [15, 60] },
  twitter: { aspectRatio: '16:9', videoDurationHintSec: [15, 45] },
  linkedin: { aspectRatio: '1:1', videoDurationHintSec: [30, 90] },
  tiktok: { aspectRatio: '9:16', videoDurationHintSec: [21, 34] },
  youtube: { aspectRatio: '16:9', videoDurationHintSec: [60, 180] },
};

export interface CampaignProfile {
  businessName: string;
  /** Platforms the campaign should target. */
  platforms: Platform[];
  /** Optional campaign objective, threaded into copy direction. */
  objective?: string;
  /** Source profile/research references to carry onto each item for provenance. */
  researchRefs?: string[];
}

export interface CopyDirection {
  minChars: number;
  maxChars: number;
  hashtagMin: number;
  hashtagMax: number;
  formats: string[];
  tips: string[];
  objective?: string;
}

export interface ScheduledWindow {
  /** ISO timestamp of the next recommended posting slot. */
  isoTime: string;
  dayOfWeek: number;
  hour: number;
}

export interface CalendarDraftItem {
  platform: Platform;
  status: 'draft' | 'blocked';
  /** 'pending_approval' for drafts; null for blocked items (nothing to approve). */
  approvalState: 'pending_approval' | null;
  assetSpec?: PlatformAssetSpec;
  copyDirection?: CopyDirection;
  scheduledWindow?: ScheduledWindow | null;
  sourceRefs: string[];
  blocker?: {
    connectivity: PlatformConnectivity;
    reason: string;
    action: string;
  };
}

/** Soonest peak-engagement slot at/after `now`, scanning up to 8 days. */
export function nextPeakWindow(
  platform: Platform,
  now: Date,
): ScheduledWindow | null {
  const peaks = PLATFORM_BEST_PRACTICES[platform].peakEngagementTimes;
  if (peaks.length === 0) return null;

  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const candidate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dow = candidate.getDay();
    const slot = peaks.find((p) => p.dayOfWeek === dow);
    if (!slot) continue;
    for (const hour of [...slot.hours].sort((a, b) => a - b)) {
      const when = new Date(candidate);
      when.setHours(hour, 0, 0, 0);
      if (when.getTime() >= now.getTime()) {
        return { isoTime: when.toISOString(), dayOfWeek: dow, hour };
      }
    }
  }
  return null;
}

function blockerReason(connectivity: PlatformConnectivity): string {
  switch (connectivity) {
    case 'reference_only':
      return 'A 1Password reference exists but no live OAuth connection — connect the account before scheduling.';
    case 'missing':
      return 'No stored credential reference and no OAuth connection for this platform.';
    default:
      return 'Platform connection status is unknown — verify the connection before scheduling.';
  }
}

/**
 * Generate approval-gated calendar drafts for a campaign.
 *
 * @param profile      business + target platforms + provenance refs
 * @param connectivity per-platform connection status (from SYN-1023 coverage)
 * @param now          reference time for the next posting window (pure/testable)
 */
export function generateCalendarDrafts(
  profile: CampaignProfile,
  connectivity: Partial<Record<Platform, PlatformConnectivity>>,
  now: Date = new Date(),
): CalendarDraftItem[] {
  const refs = profile.researchRefs ?? [];

  return profile.platforms.map((platform) => {
    const status = connectivity[platform] ?? 'unknown';

    if (status !== 'connected_oauth') {
      return {
        platform,
        status: 'blocked',
        approvalState: null,
        sourceRefs: refs,
        blocker: {
          connectivity: status,
          reason: blockerReason(status),
          action: `Connect ${platform} (OAuth / credential reference) before this item can be scheduled.`,
        },
      };
    }

    const best = PLATFORM_BEST_PRACTICES[platform];
    return {
      platform,
      status: 'draft',
      approvalState: 'pending_approval',
      assetSpec: PLATFORM_ASSET_SPECS[platform],
      copyDirection: {
        minChars: best.optimalPostLength.min,
        maxChars: best.optimalPostLength.max,
        hashtagMin: best.hashtagCount.min,
        hashtagMax: best.hashtagCount.max,
        formats: best.bestFormats,
        tips: best.contentTips,
        ...(profile.objective ? { objective: profile.objective } : {}),
      },
      scheduledWindow: nextPeakWindow(platform, now),
      sourceRefs: refs,
    };
  });
}
