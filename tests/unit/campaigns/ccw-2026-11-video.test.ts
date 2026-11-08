/**
 * SYN-1404: funnel wiring for the CCW 4-week video campaign.
 */

import manifest from '@/public/reference-library/manifest.json';
import {
  CCW_VIDEO_CAMPAIGN_SLUG,
  CCW_VIDEO_UTM_CAMPAIGN,
  buildCcwVideoCalendarDrafts,
  ccwVideoLink,
  ccwVideoPlacementLinks,
  ccwVideoScheduledAt,
  ccwVideoSlots,
} from '@/lib/marketing-agency/ccw-video-campaign-2026-11';

const ctx = {
  organizationId: 'org_ccw',
  userId: 'user_1',
  campaignId: 'camp_1',
};

describe('SYN-1404 CCW video campaign funnel wiring', () => {
  it('has 40 slots, two on each weekday from 09/11/2026 to 04/12/2026', () => {
    expect(ccwVideoSlots).toHaveLength(40);
    const perDay = new Map<string, number>();
    for (const s of ccwVideoSlots)
      perDay.set(s.date, (perDay.get(s.date) ?? 0) + 1);
    expect(perDay.size).toBe(20);
    expect([...perDay.values()].every(n => n === 2)).toBe(true);
    for (const s of ccwVideoSlots) {
      const d = ccwVideoScheduledAt(s);
      expect(d.getUTCDay()).toBeGreaterThanOrEqual(1);
      expect(d.getUTCDay()).toBeLessThanOrEqual(5);
      expect(
        d >= new Date(Date.UTC(2026, 10, 9)) &&
          d < new Date(Date.UTC(2026, 11, 5))
      ).toBe(true);
    }
  });

  it('keeps ids and slot keys unique and the slot key on the same date', () => {
    expect(new Set(ccwVideoSlots.map(s => s.id)).size).toBe(40);
    expect(new Set(ccwVideoSlots.map(s => s.slotKey)).size).toBe(40);
    for (const s of ccwVideoSlots) {
      const iso = ccwVideoScheduledAt(s).toISOString().slice(0, 10);
      expect(s.slotKey.startsWith(`${iso}-ccw-video-`)).toBe(true);
    }
  });

  it('stores AEST wall-clock time, matching the EOFY convention', () => {
    const first = ccwVideoSlots.find(s => s.id === 'ccw-w1-d1-am')!;
    expect(ccwVideoScheduledAt(first).toISOString()).toBe(
      '2026-11-09T07:00:00.000Z'
    );
    const last = ccwVideoSlots.find(s => s.id === 'ccw-w4-d5-pm')!;
    expect(ccwVideoScheduledAt(last).toISOString()).toBe(
      '2026-12-04T17:30:00.000Z'
    );
  });

  it('the landing URL in the plan is exactly what the UTM builder produces', () => {
    for (const s of ccwVideoSlots) {
      expect(s.landingUrl).toBe(ccwVideoLink(s, s.channels[0]));
      const u = new URL(s.landingUrl);
      expect(u.origin).toBe('https://ccwonline.com.au');
      expect(u.searchParams.get('utm_campaign')).toBe(
        'ccw-2026-11-storm-season'
      );
      expect(u.searchParams.get('utm_content')).toBe(s.id.replace('ccw-', ''));
      expect(u.searchParams.get('utm_medium')).toBe('social');
    }
  });

  it('gives each channel its own source tag', () => {
    const s = ccwVideoSlots[0];
    const ig = new URL(ccwVideoLink(s, 'instagram'));
    const li = new URL(ccwVideoLink(s, 'linkedin'));
    expect(ig.searchParams.get('utm_source')).toBe('instagram');
    expect(li.searchParams.get('utm_source')).toBe('linkedin');
  });

  it('gives every post a tappable, tracked link per placement', () => {
    for (const s of ccwVideoSlots) {
      const p = ccwVideoPlacementLinks(s);
      const fb = new URL(p.facebookReelCaption);
      const story = new URL(p.instagramStorySticker);
      const paid = new URL(p.boostedCta);
      for (const u of [fb, story, paid, new URL(p.instagramBio)]) {
        expect(`${u.origin}${u.pathname}`).toBe(s.landingBase);
        expect(u.searchParams.get('utm_campaign')).toBe(CCW_VIDEO_UTM_CAMPAIGN);
      }
      const short = s.id.replace('ccw-', '');
      expect(fb.searchParams.get('utm_source')).toBe('facebook');
      expect(fb.searchParams.get('utm_medium')).toBe('social');
      expect(fb.searchParams.get('utm_content')).toBe(short);
      expect(story.searchParams.get('utm_source')).toBe('instagram');
      expect(story.searchParams.get('utm_content')).toBe(short);
      expect(new URL(p.instagramBio).searchParams.get('utm_content')).toBe(
        `${short}-bio`
      );
      expect(paid.searchParams.get('utm_medium')).toBe('paid_social');
      // Every landing page is a real page, not the bare home page.
      expect(new URL(s.landingBase).pathname).not.toBe('/');
    }
  });

  it('sends the first post (approved v3) to the structural drying page with the exact links Toby has', () => {
    const s = ccwVideoSlots.find(v => v.id === 'ccw-w1-d1-am')!;
    expect(s.date).toBe('09/11/2026');
    expect(s.approvedRender).toContain('0e687840f');
    const p = ccwVideoPlacementLinks(s);
    const base = 'https://ccwonline.com.au/collections/structural-drying';
    const tail = 'utm_campaign=ccw-2026-11-storm-season';
    expect(p.facebookReelCaption).toBe(
      `${base}?utm_source=facebook&utm_medium=social&${tail}&utm_content=w1-d1-am`
    );
    expect(p.instagramBio).toBe(
      `${base}?utm_source=instagram&utm_medium=social&${tail}&utm_content=w1-d1-am-bio`
    );
    expect(p.boostedCta).toBe(
      `${base}?utm_source=facebook&utm_medium=paid_social&${tail}&utm_content=w1-d1-am`
    );
  });

  it('sends w1-d2-am to the air mover range, not a buying guide CCW does not have', () => {
    const s = ccwVideoSlots.find(v => v.id === 'ccw-w1-d2-am')!;
    expect(s.cta).toBe('See the air mover range');
    expect(s.cta).not.toMatch(/buying guide/i);
    const base = 'https://ccwonline.com.au/collections/airmovers';
    const tail = 'utm_campaign=ccw-2026-11-storm-season';
    expect(s.landingUrl).toBe(
      `${base}?utm_source=instagram&utm_medium=social&${tail}&utm_content=w1-d2-am`
    );
    expect(ccwVideoPlacementLinks(s).facebookReelCaption).toBe(
      `${base}?utm_source=facebook&utm_medium=social&${tail}&utm_content=w1-d2-am`
    );
  });

  it('gives w1-d3-am a CTA that matches its air movers landing link', () => {
    const s = ccwVideoSlots.find(v => v.id === 'ccw-w1-d3-am')!;
    expect(s.cta).toBe('See the air mover range');
    expect(s.cta).not.toMatch(/product page/i);
    expect(s.message).not.toMatch(/plate/i);
    expect(s.landingUrl).toBe(
      'https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d3-am'
    );
  });

  it('covers every funnel stage', () => {
    expect(new Set(ccwVideoSlots.map(s => s.funnelStage))).toEqual(
      new Set(['awareness', 'consideration', 'conversion', 'retention'])
    );
  });

  it('grounds every slot on owned reference photos that exist', () => {
    const owned = new Set<string>();
    const industries = (
      manifest as {
        industries: Record<
          string,
          { subjects: Record<string, { rights?: string }> }
        >;
      }
    ).industries;
    for (const [ind, v] of Object.entries(industries)) {
      for (const [key, subj] of Object.entries(v.subjects)) {
        if (subj.rights === 'owned') owned.add(`${ind}/${key}`);
      }
    }
    for (const s of ccwVideoSlots) {
      for (const ref of s.referenceSubjects) expect(owned.has(ref)).toBe(true);
    }
  });

  it('never names a competitor or another Unite Group brand in slot copy', () => {
    const banned =
      /advanced\s*se|advancedse|unite[- ]group|carsi|restoreassist|disaster recovery|nrpg|synthex/i;
    for (const s of ccwVideoSlots) {
      expect(`${s.title} ${s.hook} ${s.message} ${s.cta}`).not.toMatch(banned);
    }
  });

  it('builds 40 drafts that cannot publish and carry no media yet', () => {
    const drafts = buildCcwVideoCalendarDrafts(ctx);
    expect(drafts).toHaveLength(40);
    for (const d of drafts) {
      expect(d.status).toBe('draft');
      expect(d.mediaUrls).toEqual([]);
      expect(d.metadata.externalPublishBlocked).toBe(true);
      expect(d.metadata.approvalState).toBe('awaiting_phill_batch_approval');
      expect(d.metadata.slotKind).toBe('shortform_video');
      expect(d.metadata.toby).toBe('not_sent');
      expect(d.tags).toContain(CCW_VIDEO_CAMPAIGN_SLUG);
      expect(d.organizationId).toBe('org_ccw');
      expect(d.content).toContain('utm_campaign=ccw-2026-11-storm-season');
      expect(Object.keys(d.metadata.links).sort()).toEqual(
        [...d.platforms].sort()
      );
    }
  });
});
