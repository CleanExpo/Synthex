/**
 * SYN-1404: CCW review drafts on the studio board are sign-off only. Approve
 * runs approveAndScheduleStudioDraft, which schedules one Post per platform, so
 * a CCW draft must carry no platforms. The approval-side proof (a sign-off on a
 * shadow-mode org commits and schedules nothing) is in
 * tests/unit/marketing-agency/studio-approve-schedules.test.ts.
 */
import { ccwVideoSlots } from '@/lib/marketing-agency/ccw-video-campaign-2026-11';
import {
  CCW_REVIEW_LINK_TTL_SECONDS,
  CCW_STUDIO_CLIENT_SLUG,
  buildCcwStudioDraft,
  ccwPostAtIso,
  ccwReviewStoragePath,
} from '@/lib/marketing-agency/ccw-video-campaign-2026-11-studio';

const week1 = ccwVideoSlots.filter(slot => slot.week === 1);
const video = (id: string) => ({
  videoUrl: `https://example.test/${id}.mp4`,
  voiceover: `The final spoken words of ${id}.`,
  storagePath: `ccw/${id}.mp4`,
  sha256: 'b'.repeat(64),
  bytes: 7_000_000,
});

describe('CCW studio review drafts', () => {
  it('week 1 is ten videos', () => {
    expect(week1).toHaveLength(10);
  });

  it.each(week1.map(slot => [slot.id, slot] as const))(
    '%s is sign-off only: no platforms, so Approve can never schedule a post',
    (_id, slot) => {
      const draft = buildCcwStudioDraft(slot, 'org-ccw', video(slot.id));
      expect(draft.platforms).toEqual([]);
      expect(draft.clientSlug).toBe(CCW_STUDIO_CLIENT_SLUG);
      expect(draft.organizationId).toBe('org-ccw');
      expect(draft.dedupeKey).toBe(slot.id);
      expect(draft.videoUrl).toBe(`https://example.test/${slot.id}.mp4`);
      const meta = draft.metadata as Record<string, unknown>;
      expect(meta.review).toBe('client_sign_off');
      expect(meta.plannedChannels).toEqual(slot.channels);
      expect(meta.postAt).toBe(ccwPostAtIso(slot));
      // The card shows the finalised words, not the first-draft calendar copy.
      expect(draft.script).toContain(`The final spoken words of ${slot.id}.`);
      expect(draft.script).not.toContain(slot.message);
      expect(draft.script).toContain(slot.landingBase);
      // Each planned channel gets its own tracked link.
      const links = meta.links as Record<string, string>;
      for (const channel of slot.channels) {
        expect(links[channel]).toContain(`utm_source=${channel}`);
      }
    }
  );

  it('refuses to build a card with no finalised words', () => {
    const { voiceover: _dropped, ...noWords } = video(week1[0].id);
    expect(() =>
      buildCcwStudioDraft(
        week1[0],
        'org-ccw',
        noWords as ReturnType<typeof video>
      )
    ).toThrow(/no finalised voiceover/);
  });

  it('posting times are Queensland time, from the DD/MM/YYYY calendar', () => {
    expect(ccwPostAtIso({ date: '09/11/2026', slotAest: '07:00' })).toBe(
      '2026-11-09T07:00:00+10:00'
    );
    expect(ccwPostAtIso({ date: '13/11/2026', slotAest: '17:30' })).toBe(
      '2026-11-13T17:30:00+10:00'
    );
  });

  it('each video has its own storage path, and review links last past 04/12/2026', () => {
    const paths = new Set(week1.map(ccwReviewStoragePath));
    expect(paths.size).toBe(10);
    const lastPost = new Date(ccwPostAtIso(ccwVideoSlots[39])).getTime();
    const firstLoad = new Date('2026-11-09T00:00:00+10:00').getTime();
    expect(firstLoad + CCW_REVIEW_LINK_TTL_SECONDS * 1000).toBeGreaterThan(
      lastPost
    );
  });
});
