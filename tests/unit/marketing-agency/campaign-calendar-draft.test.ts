/**
 * Unit tests for the campaign-calendar draft engine (SYN-1024, slice 1).
 *
 * Covers the acceptance bullets reachable without a DB:
 *  - platform-aware spec generation (asset spec + copy direction + window),
 *  - missing/reference-only/unknown accounts produce setup BLOCKERS, and
 *  - the approval gate: drafts are always `pending_approval`, never published.
 */
import {
  generateCalendarDrafts,
  nextPeakWindow,
  PLATFORM_ASSET_SPECS,
  type CampaignProfile,
} from '@/lib/marketing-agency/campaign-calendar/calendar-draft';
import { PLATFORM_BEST_PRACTICES } from '@/lib/recommendations/content-engine';

const NOW = new Date('2026-06-15T08:00:00Z'); // fixed reference time

const profile = (platforms: CampaignProfile['platforms']): CampaignProfile => ({
  businessName: 'CARSI',
  platforms,
  objective: 'Build restoration-training authority',
  researchRefs: ['obsidian://carsi-authority'],
});

describe('generateCalendarDrafts', () => {
  it('emits a platform-aware draft for a connected platform', () => {
    const [item] = generateCalendarDrafts(
      profile(['instagram']),
      { instagram: 'connected_oauth' },
      NOW,
    );
    expect(item.status).toBe('draft');
    expect(item.approvalState).toBe('pending_approval');
    expect(item.assetSpec).toEqual(PLATFORM_ASSET_SPECS.instagram);
    expect(item.copyDirection?.minChars).toBe(
      PLATFORM_BEST_PRACTICES.instagram.optimalPostLength.min,
    );
    expect(item.copyDirection?.hashtagMax).toBe(
      PLATFORM_BEST_PRACTICES.instagram.hashtagCount.max,
    );
    expect(item.copyDirection?.objective).toBe('Build restoration-training authority');
    expect(item.sourceRefs).toEqual(['obsidian://carsi-authority']);
  });

  it('schedules into a real platform peak window (no past times)', () => {
    const [item] = generateCalendarDrafts(
      profile(['linkedin']),
      { linkedin: 'connected_oauth' },
      NOW,
    );
    const win = item.scheduledWindow;
    expect(win).not.toBeNull();
    expect(new Date(win!.isoTime).getTime()).toBeGreaterThanOrEqual(NOW.getTime());
    const peakDay = PLATFORM_BEST_PRACTICES.linkedin.peakEngagementTimes.find(
      (p) => p.dayOfWeek === win!.dayOfWeek,
    );
    expect(peakDay?.hours).toContain(win!.hour);
  });

  it('blocks a missing platform instead of drafting it', () => {
    const [item] = generateCalendarDrafts(
      profile(['youtube']),
      { youtube: 'missing' },
      NOW,
    );
    expect(item.status).toBe('blocked');
    expect(item.approvalState).toBeNull();
    expect(item.assetSpec).toBeUndefined();
    expect(item.blocker?.connectivity).toBe('missing');
    expect(item.blocker?.action).toMatch(/connect youtube/i);
  });

  it('blocks reference-only and unknown platforms with distinct reasons', () => {
    const items = generateCalendarDrafts(
      profile(['facebook', 'twitter']),
      { facebook: 'reference_only' }, // twitter absent → unknown
      NOW,
    );
    const fb = items.find((i) => i.platform === 'facebook');
    const tw = items.find((i) => i.platform === 'twitter');
    expect(fb?.status).toBe('blocked');
    expect(fb?.blocker?.reason).toMatch(/reference exists but no live oauth/i);
    expect(tw?.blocker?.connectivity).toBe('unknown');
    expect(tw?.blocker?.reason).toMatch(/unknown/i);
  });

  it('never emits a publishable item without approval (approval gate)', () => {
    const items = generateCalendarDrafts(
      profile(['instagram', 'youtube', 'linkedin']),
      { instagram: 'connected_oauth', linkedin: 'connected_oauth', youtube: 'missing' },
      NOW,
    );
    for (const item of items) {
      if (item.status === 'draft') {
        expect(item.approvalState).toBe('pending_approval');
      } else {
        expect(item.approvalState).toBeNull();
      }
      // No status outside the two gated values exists.
      expect(['draft', 'blocked']).toContain(item.status);
    }
    expect(items.filter((i) => i.status === 'draft')).toHaveLength(2);
    expect(items.filter((i) => i.status === 'blocked')).toHaveLength(1);
  });
});

describe('nextPeakWindow', () => {
  it('returns null guardrail behaviour only for empty peak tables (sanity)', () => {
    // All real platforms have peak times, so each yields a window.
    for (const platform of Object.keys(PLATFORM_ASSET_SPECS) as Array<
      keyof typeof PLATFORM_ASSET_SPECS
    >) {
      expect(nextPeakWindow(platform, NOW)).not.toBeNull();
    }
  });
});
