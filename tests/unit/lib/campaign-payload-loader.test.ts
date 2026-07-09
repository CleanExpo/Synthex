/**
 * Campaign scheduler payload loader tests (E4 — carsi-linkedin-golive spec).
 *
 * Pins the pack→scheduler mapping: platform filter, hold skip, the UNIFORM
 * whole-day re-anchor for past dates (cadence preserved, refuses to schedule
 * in the past), UTC `scheduledAt` output (the route's Zod rejects offsets),
 * and `mediaUrls` → `metadata.images`.
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildSchedulerLoadPlan,
  toSchedulerPostBody,
  MIN_LEAD_MS,
  type CampaignPayloadPost,
} from '@/lib/scheduling/campaign-payload-loader';

const NOW = new Date('2026-07-09T03:30:00.000Z'); // 13:30 AEST

function post(overrides: Partial<CampaignPayloadPost>): CampaignPayloadPost {
  return {
    id: 'LI-01',
    platform: 'linkedin',
    content: 'post content',
    suggestedScheduleAt: '2026-07-20T09:00:00+10:00',
    ...overrides,
  };
}

describe('buildSchedulerLoadPlan', () => {
  it('filters by platform and skips holds', () => {
    const plan = buildSchedulerLoadPlan({
      posts: [
        post({ id: 'LI-01' }),
        post({ id: 'FB-01', platform: 'facebook' }),
        post({ id: 'LI-02', status: 'hold' }),
      ],
      platform: 'linkedin',
      now: NOW,
    });
    expect(plan.entries.map(e => e.id)).toEqual(['LI-01']);
    expect(plan.skipped).toEqual([{ id: 'LI-02', reason: 'status=hold' }]);
  });

  it('leaves an all-future schedule untouched and emits UTC ISO', () => {
    const plan = buildSchedulerLoadPlan({
      posts: [post({ suggestedScheduleAt: '2026-07-20T09:00:00+10:00' })],
      platform: 'linkedin',
      now: NOW,
    });
    expect(plan.shiftDays).toBe(0);
    // +10:00 offset converted to UTC (Zod z.string().datetime() rejects offsets).
    expect(plan.entries[0].scheduledAt).toBe('2026-07-19T23:00:00.000Z');
  });

  it('re-anchors a past first slot with a uniform shift that preserves cadence', () => {
    const plan = buildSchedulerLoadPlan({
      posts: [
        post({ id: 'LI-01', suggestedScheduleAt: '2026-07-09T09:00:00+10:00' }), // past
        post({ id: 'LI-02', suggestedScheduleAt: '2026-07-14T09:00:00+10:00' }),
      ],
      platform: 'linkedin',
      now: NOW,
    });
    expect(plan.shiftDays).toBe(1);
    expect(plan.entries[0].scheduledAt).toBe('2026-07-09T23:00:00.000Z');
    expect(plan.entries[1].scheduledAt).toBe('2026-07-14T23:00:00.000Z');
    // Cadence: the 5-day gap between LI-01 and LI-02 is preserved exactly.
    const gap =
      new Date(plan.entries[1].scheduledAt).getTime() -
      new Date(plan.entries[0].scheduledAt).getTime();
    expect(gap).toBe(5 * 24 * 60 * 60 * 1000);
    // The re-anchored first slot honours the minimum lead time.
    expect(
      new Date(plan.entries[0].scheduledAt).getTime()
    ).toBeGreaterThanOrEqual(NOW.getTime() + MIN_LEAD_MS);
  });

  it('sorts entries chronologically', () => {
    const plan = buildSchedulerLoadPlan({
      posts: [
        post({ id: 'LI-02', suggestedScheduleAt: '2026-07-22T09:00:00+10:00' }),
        post({ id: 'LI-01', suggestedScheduleAt: '2026-07-20T09:00:00+10:00' }),
      ],
      platform: 'linkedin',
      now: NOW,
    });
    expect(plan.entries.map(e => e.id)).toEqual(['LI-01', 'LI-02']);
  });

  it('throws (fail loud) on an unparseable date', () => {
    expect(() =>
      buildSchedulerLoadPlan({
        posts: [post({ suggestedScheduleAt: 'next Tuesday-ish' })],
        platform: 'linkedin',
        now: NOW,
      })
    ).toThrow(/Unparseable/);
  });

  it('returns an empty plan when no posts match the platform', () => {
    const plan = buildSchedulerLoadPlan({
      posts: [post({ platform: 'facebook' })],
      platform: 'linkedin',
      now: NOW,
    });
    expect(plan.entries).toEqual([]);
    expect(plan.shiftDays).toBe(0);
  });
});

describe('toSchedulerPostBody', () => {
  it('maps media to metadata.images and carries the batch id', () => {
    const plan = buildSchedulerLoadPlan({
      posts: [
        post({
          mediaUrls: ['https://res.cloudinary.com/demo/a.png'],
        }),
      ],
      platform: 'linkedin',
      now: NOW,
    });
    const body = toSchedulerPostBody(plan.entries[0], {
      batchId: 'carsi-h5-launch-2026-07-08',
    });
    expect(body).toEqual({
      content: 'post content',
      platform: 'linkedin',
      scheduledAt: '2026-07-19T23:00:00.000Z',
      metadata: {
        images: ['https://res.cloudinary.com/demo/a.png'],
        batchId: 'carsi-h5-launch-2026-07-08',
      },
    });
  });

  it('omits empty images and batchId', () => {
    const plan = buildSchedulerLoadPlan({
      posts: [post({})],
      platform: 'linkedin',
      now: NOW,
    });
    expect(toSchedulerPostBody(plan.entries[0])).toEqual({
      content: 'post content',
      platform: 'linkedin',
      scheduledAt: '2026-07-19T23:00:00.000Z',
      metadata: {},
    });
  });
});
