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
import fs from 'node:fs';
import path from 'node:path';
import { CCW_SHOT_PLANS } from '@/lib/remotion/ccw/shot-plans';

/**
 * Orchestrator ruling, 08/11/2026: no IICRC, S500, "standard" (the water
 * damage standard) or category line anywhere in ccw-w1-d4-am's brand copy.
 */
const D4AM_BANNED = /IICRC|S500|\bstandards?\b|\bcategor(y|ies)\b/i;

/** Every piece of ccw-w1-d4-am copy: screen, voiceover, post, calendar. */
function d4amBrandCopy(): string[] {
  const root = path.resolve(__dirname, '../../..');
  const docs = path.join(root, 'docs/campaigns/ccw-2026-11-video');
  const slot = ccwVideoSlots.find(v => v.id === 'ccw-w1-d4-am')!;
  const plan = CCW_SHOT_PLANS.find(p => p.videoId === 'ccw-w1-d4-am')!;
  const calendarRows = fs
    .readFileSync(path.join(docs, '02-calendar.md'), 'utf8')
    .split('\n')
    .filter(l => l.includes('ccw-w1-d4-am'));
  return [
    // The whole script file: voiceover, on-screen text, post caption,
    // claims table and notes.
    ...fs
      .readFileSync(path.join(docs, 'scripts/ccw-w1-d4-am.md'), 'utf8')
      .split('\n'),
    slot.title,
    slot.hook,
    slot.message,
    slot.cta,
    ...slot.products,
    ...calendarRows,
    plan.cta,
    ...plan.shots.flatMap(s => [
      ...(s.floorLines ?? []),
      ...(s.kinetic ?? []),
      s.sourceSlip ?? '',
      s.bigText ?? '',
      s.smallText ?? '',
      s.label ?? '',
      ...(s.place ?? []).map(u => u.slip ?? ''),
    ]),
  ];
}

function bannedInD4Am(lines: string[]): string[] {
  return lines.filter(l => D4AM_BANNED.test(l));
}

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

  it('gives w1-d3-pm a CTA that matches its air movers landing link and a sourced hook', () => {
    const s = ccwVideoSlots.find(v => v.id === 'ccw-w1-d3-pm')!;
    expect(s.cta).toBe('See the air mover range');
    expect(s.cta).not.toMatch(/drying range/i);
    // No source says when the 24 to 48 hours start (SafeWork NSW gives the
    // window only), so the hook quotes the window, not a starting clock.
    expect(s.hook).not.toMatch(/clock starts/i);
    // The S500 line is cut until the founder signs off IICRC citations in
    // brand copy (orchestrator ruling, 08/11/2026).
    expect(`${s.hook} ${s.message}`).not.toMatch(/S500|IICRC|mitigation/i);
    expect(s.landingUrl).toBe(
      'https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d3-pm'
    );
  });

  it('gives w1-d4-pm a CTA that matches its Razorback landing link and only Razorback filters', () => {
    const s = ccwVideoSlots.find(v => v.id === 'ccw-w1-d4-pm')!;
    expect(s.cta).toBe('See Razorback filters and spares');
    expect(s.landingUrl).toBe(
      'https://ccwonline.com.au/collections/razorback?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d4-pm'
    );
    // CCW lists a MERV-10 pre-filter and a HEPA/activated carbon filter for
    // the MaxxGuard 550 (read 08/11/2026). The Dri-Eaz Velo pre-filter does
    // not fit it, so no other brand's filter may be paired with the unit.
    expect(JSON.stringify(s.products)).not.toMatch(/dri-eaz|velo/i);
    expect(s.referenceSubjects.join(' ')).not.toMatch(/dri-eaz|velo/i);
    // The calendar hook ("the cheapest filter ... the most expensive one")
    // has no source in those words, and no IICRC/S500 line is made.
    expect(`${s.hook} ${s.message}`).not.toMatch(
      /cheapest|most expensive|S500|IICRC/i
    );
  });

  it('gives w1-d4-am a CTA that matches its flood extraction landing link and only the Water Claw', () => {
    const s = ccwVideoSlots.find(v => v.id === 'ccw-w1-d4-am')!;
    expect(s.cta).toBe('See the flood extraction tools');
    expect(s.landingUrl).toBe(
      'https://ccwonline.com.au/collections/flood-extraction?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d4-am'
    );
    // /blogs/news (read 08/11/2026) has no post on sewage or flood infection
    // risk, so it may not come back as this video's landing page.
    expect(s.landingBase).not.toMatch(/blogs/);
    // The one product is the Water Claw Large Deluxe, which the flood
    // extraction collection lists. No air scrubber or meter is named next to
    // an infection hazard (that would read as a protection claim).
    expect(s.products).toEqual([
      'Water Claw Large Deluxe Flood Extraction Tool',
    ]);
    expect(`${s.hook} ${s.message}`).not.toMatch(
      /hydro shark|maxxguard|scrubber|prevent|protects? (you|the crew)|safe to/i
    );
  });

  it('gives w1-d5-am a CTA that matches its air movers landing link and the two units it shows', () => {
    const s = ccwVideoSlots.find(v => v.id === 'ccw-w1-d5-am')!;
    expect(s.cta).toBe('See the air movers');
    expect(s.landingBase).toBe(
      'https://ccwonline.com.au/collections/airmovers'
    );
    expect(s.landingUrl).toBe(
      'https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d5-am'
    );
    // The Airmovers collection (read 08/11/2026) lists both units by these
    // names. The X-800 Multi Drying Kit is out: its owned photo is the X-400
    // kit photo, byte for byte.
    expect(s.products).toEqual([
      'XPOWER X-600AC Air Mover 3/4 hp with Carpet Clamp',
      'XPOWER X-800 Air Mover 1 hp with Carpet Clamp',
    ]);
    const plan = CCW_SHOT_PLANS.find(p => p.videoId === 'ccw-w1-d5-am')!;
    expect(plan.cta).toBe(s.cta);
    // The draft hook had no source; no wattage is stated (the collection and
    // product pages disagree on the PL-700A).
    expect(`${s.hook} ${s.message}`).not.toMatch(
      /dries the house|fits in the van|multi drying kit|\d+\s?W\b|watts?\b/i
    );
  });

  it('gives w1-d5-pm a CTA that matches its contact-page link and the three units it shows', () => {
    const s = ccwVideoSlots.find(v => v.id === 'ccw-w1-d5-pm')!;
    expect(s.cta).toBe('Call CCW on 1800 686 869');
    // The contact page (read 08/11/2026) prints "PHONE: 1800 686 869".
    expect(s.landingBase).toBe('https://ccwonline.com.au/pages/contact-us');
    expect(s.landingUrl).toBe(
      'https://ccwonline.com.au/pages/contact-us?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d5-pm'
    );
    // CCW's listing names, read 08/11/2026.
    expect(s.products).toEqual([
      'Razorback MaxxGuard 550UV Air Scrubber with UV-C 50HZ/230V/AU',
      'XPOWER X-800 Air Mover 1 hp with Carpet Clamp',
      'Dri-Eaz BD2500 LGR Dehumidifier 230V',
    ]);
    const plan = CCW_SHOT_PLANS.find(p => p.videoId === 'ccw-w1-d5-pm')!;
    expect(plan.cta).toBe(s.cta);
    // The draft's unsourced or paraphrased lines, and any season or forecast
    // line, stay out of the calendar copy and the screen.
    const copy = [
      s.title,
      s.hook,
      s.message,
      ...plan.shots.flatMap(x => [
        ...(x.floorLines ?? []),
        ...(x.kinetic ?? []),
        x.sourceSlip ?? '',
        ...(x.place ?? []).map(u => u.slip ?? ''),
      ]),
    ].join(' ');
    expect(copy).not.toMatch(
      /most problems|stocked parts|wet morning|storm-ready check|one fewer|April|cyclone|season|quiet|forecast|BOM/i
    );
  });

  it('keeps every water-sorting and standards line out of w1-d4-am (orchestrator ruling, 08/11/2026)', () => {
    const found = bannedInD4Am(d4amBrandCopy());
    expect(found).toEqual([]);
  });

  it('the w1-d4-am ban check catches a planted line (the check can fail)', () => {
    expect(
      bannedInD4Am(['WATER IS SORTED INTO', 'Category 1, 2 and 3'])
    ).toEqual(['Category 1, 2 and 3']);
    expect(bannedInD4Am(['the water damage standard'])).toHaveLength(1);
    expect(bannedInD4Am(['IICRC S500'])).toHaveLength(1);
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
