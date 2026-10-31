import {
  PORTFOLIO_WEEKLY_VIDEO_TARGET,
  assertPortfolioSchedule,
  buildPortfolioCalendar,
  slotBrief,
  type PortfolioBrandSchedule,
} from '@/lib/marketing-calendar/portfolio-plan';
import {
  PORTFOLIO_BRANDS,
  PORTFOLIO_WEEK_STARTS,
  UNITE_GROUP_BANNED,
  forbiddenHits,
} from '@/lib/marketing-calendar/portfolio-brands';

const brand = (
  over: Partial<PortfolioBrandSchedule>
): PortfolioBrandSchedule => ({
  orgSlug: 'x',
  label: 'X',
  videosPerWeek: 0,
  videoPlatforms: ['youtube'],
  channelPosts: [],
  themes: ['t'],
  ...over,
});

describe('portfolio marketing calendar plan', () => {
  const slots = buildPortfolioCalendar(PORTFOLIO_BRANDS, PORTFOLIO_WEEK_STARTS);
  const videos = slots.filter(s => s.kind === 'shortform_video');

  it('plans exactly 10 short-form videos in each of the 4 weeks', () => {
    expect(PORTFOLIO_WEEK_STARTS).toHaveLength(4);
    for (const week of PORTFOLIO_WEEK_STARTS) {
      expect(videos.filter(s => s.weekStart === week)).toHaveLength(
        PORTFOLIO_WEEKLY_VIDEO_TARGET
      );
    }
  });

  it('gives Business Card the largest weekly share', () => {
    const perBrand = new Map<string, number>();
    for (const s of videos.filter(
      v => v.weekStart === PORTFOLIO_WEEK_STARTS[0]
    )) {
      perBrand.set(s.orgSlug, (perBrand.get(s.orgSlug) ?? 0) + 1);
    }
    const card = perBrand.get('business-card') ?? 0;
    for (const [slug, n] of perBrand) {
      if (slug !== 'business-card') expect(card).toBeGreaterThan(n);
    }
  });

  it('schedules no public content for held brands', () => {
    const held = PORTFOLIO_BRANDS.filter(b => b.publicContentHeldReason).map(
      b => b.orgSlug
    );
    expect(held).toEqual(
      expect.arrayContaining(['restoreassist', 'trade-hall'])
    );
    expect(slots.filter(s => held.includes(s.orgSlug))).toHaveLength(0);
  });

  it('uses unique slot keys and places every slot on a Sydney weekday inside its week', () => {
    expect(new Set(slots.map(s => s.slotKey)).size).toBe(slots.length);
    const fmt = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    for (const s of slots) {
      const parts = fmt.formatToParts(s.scheduledFor);
      const weekday = parts.find(p => p.type === 'weekday')?.value;
      expect(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).toContain(weekday);
      const weekStartMs = Date.parse(`${s.weekStart}T00:00:00+11:00`);
      expect(s.scheduledFor.getTime()).toBeGreaterThanOrEqual(weekStartMs);
      expect(s.scheduledFor.getTime()).toBeLessThan(
        weekStartMs + 7 * 86_400_000
      );
    }
  });

  it('puts the first Monday drop at 07:30 Sydney (20:30 UTC Sunday in AEDT)', () => {
    const first = videos[0];
    expect(first.scheduledFor.toISOString()).toBe('2026-11-01T20:30:00.000Z');
    expect(first.localTime).toBe('02/11/2026 07:30 Sydney');
  });

  it('writes briefs that say draft and never claim the post is approved', () => {
    for (const s of slots) {
      const b = PORTFOLIO_BRANDS.find(x => x.orgSlug === s.orgSlug)!;
      const text = slotBrief(s, b);
      expect(text).toMatch(/draft, pending approval/);
      expect(text).not.toMatch(/IICRC accredited/i);
    }
  });

  it('keeps every Unite-Group profile field clear of the founder banned names', () => {
    const ug = PORTFOLIO_BRANDS.find(b => b.orgSlug === 'unite-group')!;
    // Every field a brief, brand DNA or client profile is built from (its
    // rules included, since prompts read them), minus the list itself.
    const { forbiddenWords, ...rest } = ug;
    expect(forbiddenWords).toEqual(expect.arrayContaining(UNITE_GROUP_BANNED));
    expect(forbiddenHits(JSON.stringify(rest), forbiddenWords)).toEqual([]);
  });

  it('matches whole words only, so a short code is not found inside a word', () => {
    const ug = PORTFOLIO_BRANDS.find(b => b.orgSlug === 'unite-group')!;
    expect(
      forbiddenHits(
        'Cecilia plans weekend adventures for her cafe crew',
        ug.forbiddenWords
      )
    ).toEqual([]);
    expect(forbiddenHits('Earn CEC points', ug.forbiddenWords)).toEqual([
      'CEC',
    ]);
  });

  it.each([
    'Book a Restore-Assist demo',
    'Visit the Trade-Hall',
    'Disaster\u2013Recovery crews',
    'Inside Clean Expo',
    'What Unite Group built this week',
    'Built this week: a new booking flow',
    'Two restorations a week',
    'Restore  Assist',
    'Tradehall booths',
    'Two Disaster Recoveries this month',
    'What to do after water damage',
    'Mould after a leak',
    'An insurance claim, start to finish',
    'A carpet cleaning business shares one link',
    'Our sister company',
    'A new venture',
  ])('catches a spelling or punctuation variant: %s', copy => {
    const ug = PORTFOLIO_BRANDS.find(b => b.orgSlug === 'unite-group')!;
    expect(forbiddenHits(copy, ug.forbiddenWords).length).toBeGreaterThan(0);
  });

  it.each([
    'How the Unite Group businesses fit together',
    'Tour Trade Hall and show its supplier booths',
    'Inside Synthex, the agency behind our businesses',
    'CARSI courses for restoration crews',
    'Portfolio command layer for Unite-Group ventures',
    'One week inside Nexus: what got built',
    'A day inside Nexus',
    'A tour of the CleanExpo247 hall',
    'How Restore Assist and Disaster-Recovery share jobs',
  ])('catches Unite-Group copy about the group itself: %s', copy => {
    const ug = PORTFOLIO_BRANDS.find(b => b.orgSlug === 'unite-group')!;
    expect(forbiddenHits(copy, ug.forbiddenWords).length).toBeGreaterThan(0);
  });

  it('holds Business Card, a Unite Group-branded card, to the Unite-Group ban too', () => {
    const card = PORTFOLIO_BRANDS.find(b => b.orgSlug === 'business-card')!;
    expect(
      forbiddenHits('Tap a CARSI course card', card.forbiddenWords).length
    ).toBeGreaterThan(0);
  });

  it("keeps every brief and title clear of that brand's forbidden words", () => {
    for (const s of slots) {
      const b = PORTFOLIO_BRANDS.find(x => x.orgSlug === s.orgSlug)!;
      const text = `${slotBrief(s, b)} ${b.label} ${s.theme}`.toLowerCase();
      for (const word of b.forbiddenWords) {
        expect({
          slot: s.slotKey,
          word,
          hit: text.includes(word.toLowerCase()),
        }).toEqual({
          slot: s.slotKey,
          word,
          hit: false,
        });
      }
    }
  });

  it('rejects a schedule whose weekly total is not 10', () => {
    expect(() =>
      assertPortfolioSchedule([
        brand({ orgSlug: 'business-card', videosPerWeek: 9 }),
      ])
    ).toThrow(/expected 10/);
  });

  it('rejects public slots on a held brand', () => {
    expect(() =>
      assertPortfolioSchedule([
        brand({ orgSlug: 'business-card', videosPerWeek: 9 }),
        brand({
          orgSlug: 'restoreassist',
          videosPerWeek: 1,
          publicContentHeldReason: 'not released',
        }),
      ])
    ).toThrow(/held/);
  });

  it('rejects a schedule where Business Card is not the heaviest', () => {
    expect(() =>
      assertPortfolioSchedule([
        brand({ orgSlug: 'business-card', videosPerWeek: 4 }),
        brand({ orgSlug: 'carsi', videosPerWeek: 6 }),
      ])
    ).toThrow(/Business Card/);
  });

  it('rejects a week start that is not a Monday', () => {
    expect(() =>
      buildPortfolioCalendar(PORTFOLIO_BRANDS, ['2026-11-03'])
    ).toThrow(/Monday/);
  });
});
