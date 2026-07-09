// plan-access (imported transitively) pulls in @/lib/prisma + owner-email at
// module load. Mock both so the pure planner tests need no DB/env.
jest.mock('@/lib/auth/owner-email', () => ({
  isOwnerEmail: (email?: string | null) => email === 'owner@synthex.social',
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() } },
  prisma: { user: { findUnique: jest.fn() } },
}));

import {
  buildQuickWinsSprint,
  generateSprint,
  resolveSprintAccess,
  toPreviewPlan,
  DEFAULT_POSTS_PER_WEEK,
  MIN_POSTS_PER_WEEK,
  MAX_POSTS_PER_WEEK,
  PREVIEW_UNLOCKED_SLOTS,
  SPRINT_WEEKS,
  type SprintBuilderInput,
} from '@/lib/campaigns/quick-wins-sprint';

const baseInput: SprintBuilderInput = {
  plan: 'growth',
  business: {
    name: 'Acme Co',
    pillars: ['Education', 'Proof', 'Culture'],
    platforms: ['linkedin', 'instagram'],
  },
};

describe('resolveSprintAccess', () => {
  it('grants full access to Growth and Scale', () => {
    expect(resolveSprintAccess('growth')).toBe('full');
    expect(resolveSprintAccess('scale')).toBe('full');
    expect(resolveSprintAccess('business')).toBe('full'); // rank alias for growth
    expect(resolveSprintAccess('custom')).toBe('full'); // rank alias for scale
  });

  it('grants preview to Pro / Professional', () => {
    expect(resolveSprintAccess('pro')).toBe('preview');
    expect(resolveSprintAccess('professional')).toBe('preview');
  });

  it('denies Free / Starter / unknown', () => {
    expect(resolveSprintAccess('free')).toBe('none');
    expect(resolveSprintAccess('starter')).toBe('none');
    expect(resolveSprintAccess(null)).toBe('none');
    expect(resolveSprintAccess(undefined)).toBe('none');
    expect(resolveSprintAccess('mystery')).toBe('none');
  });

  it('is case-insensitive', () => {
    expect(resolveSprintAccess('GROWTH')).toBe('full');
    expect(resolveSprintAccess('Pro')).toBe('preview');
  });
});

describe('buildQuickWinsSprint', () => {
  it('builds a fixed 2-week sprint with default cadence', () => {
    const plan = buildQuickWinsSprint(baseInput);
    expect(plan.name).toBe('Quick Wins Sprint');
    expect(plan.weeks).toBe(SPRINT_WEEKS);
    expect(plan.postsPerWeek).toBe(DEFAULT_POSTS_PER_WEEK);
    expect(plan.totalPosts).toBe(DEFAULT_POSTS_PER_WEEK * SPRINT_WEEKS);
    expect(plan.slots).toHaveLength(plan.totalPosts);
  });

  it('clamps postsPerWeek into the supported 7-10 range', () => {
    expect(
      buildQuickWinsSprint({ ...baseInput, postsPerWeek: 3 }).postsPerWeek
    ).toBe(MIN_POSTS_PER_WEEK);
    expect(
      buildQuickWinsSprint({ ...baseInput, postsPerWeek: 25 }).postsPerWeek
    ).toBe(MAX_POSTS_PER_WEEK);
    expect(
      buildQuickWinsSprint({ ...baseInput, postsPerWeek: 9 }).postsPerWeek
    ).toBe(9);
  });

  it('keeps every slot inside the 14-day window and correct week', () => {
    const plan = buildQuickWinsSprint({ ...baseInput, postsPerWeek: 10 });
    for (const slot of plan.slots) {
      expect(slot.day).toBeGreaterThanOrEqual(1);
      expect(slot.day).toBeLessThanOrEqual(14);
      const expectedWeek = slot.day <= 7 ? 1 : 2;
      expect(slot.week).toBe(expectedWeek);
    }
  });

  it('mixes multiple content types across the sprint', () => {
    const plan = buildQuickWinsSprint({ ...baseInput, postsPerWeek: 10 });
    const types = new Set(plan.slots.map(s => s.contentType));
    expect(types.size).toBeGreaterThanOrEqual(3);
  });

  it('rotates through the supplied platforms and pillars', () => {
    const plan = buildQuickWinsSprint(baseInput);
    const platforms = new Set(plan.slots.map(s => s.platform));
    expect(platforms).toEqual(new Set(['linkedin', 'instagram']));
    const pillars = new Set(plan.slots.map(s => s.pillar));
    expect(pillars).toEqual(new Set(['Education', 'Proof', 'Culture']));
  });

  it('falls back to default platforms/pillars when none supplied', () => {
    const plan = buildQuickWinsSprint({
      plan: 'scale',
      business: { name: 'X' },
    });
    expect(plan.slots.every(s => Boolean(s.platform))).toBe(true);
    expect(plan.slots.every(s => Boolean(s.pillar))).toBe(true);
  });

  it('enables A/B variations for full (Growth/Scale) plans only', () => {
    const full = buildQuickWinsSprint(baseInput, 'full');
    expect(full.abTestingEnabled).toBe(true);
    expect(full.slots.every(s => s.hasAbVariation)).toBe(true);

    const preview = buildQuickWinsSprint(baseInput, 'preview');
    expect(preview.abTestingEnabled).toBe(false);
    expect(preview.slots.every(s => !s.hasAbVariation)).toBe(true);
  });

  it('is deterministic for identical input', () => {
    const a = buildQuickWinsSprint(baseInput);
    const b = buildQuickWinsSprint(baseInput);
    expect(a).toEqual(b);
  });

  it('coordinates Pathway SEO tasks — anchored by day and round-robin', () => {
    const plan = buildQuickWinsSprint({
      ...baseInput,
      postsPerWeek: 7,
      pathwaySeoTasks: [
        { id: 'seo-anchored', label: 'Fix title tags', day: 3 },
        { id: 'seo-a', label: 'Add alt text' },
        { id: 'seo-b', label: 'Fix headings' },
      ],
    });
    expect(plan.seoCoordinated).toBe(true);
    const day3 = plan.slots.find(s => s.day === 3);
    expect(day3?.seoTaskRef).toBe('seo-anchored');
    const refs = plan.slots.map(s => s.seoTaskRef).filter(Boolean);
    expect(refs).toContain('seo-a');
    expect(refs).toContain('seo-b');
  });

  it('reports seoCoordinated=false when no SEO tasks are supplied', () => {
    const plan = buildQuickWinsSprint(baseInput);
    expect(plan.seoCoordinated).toBe(false);
    expect(plan.slots.every(s => s.seoTaskRef === undefined)).toBe(true);
  });

  it('echoes persona hints for the downstream copy layer', () => {
    const plan = buildQuickWinsSprint({
      ...baseInput,
      personaHints: 'Witty, concise',
    });
    expect(plan.personaHints).toBe('Witty, concise');
  });
});

describe('toPreviewPlan', () => {
  it('unlocks the first N slots and locks the rest', () => {
    const full = buildQuickWinsSprint(baseInput, 'full');
    const preview = toPreviewPlan(full);
    expect(preview.previewOnly).toBe(true);
    expect(preview.access).toBe('preview');
    expect(preview.abTestingEnabled).toBe(false);
    expect(preview.upgradePrompt).toBeTruthy();

    const unlocked = preview.slots.filter(s => !s.locked);
    const locked = preview.slots.filter(s => s.locked);
    expect(unlocked).toHaveLength(PREVIEW_UNLOCKED_SLOTS);
    expect(locked).toHaveLength(full.slots.length - PREVIEW_UNLOCKED_SLOTS);
    expect(locked.every(s => s.title === 'Locked — upgrade to reveal')).toBe(
      true
    );
    expect(preview.slots.every(s => !s.hasAbVariation)).toBe(true);
  });
});

describe('generateSprint', () => {
  it('returns a full plan for Growth/Scale', () => {
    const res = generateSprint({ ...baseInput, plan: 'scale' });
    expect(res.access).toBe('full');
    expect(res.plan?.abTestingEnabled).toBe(true);
    expect(res.upgradePrompt).toBeUndefined();
  });

  it('returns a locked preview + upgrade prompt for Pro', () => {
    const res = generateSprint({ ...baseInput, plan: 'pro' });
    expect(res.access).toBe('preview');
    expect(res.plan?.previewOnly).toBe(true);
    expect(res.upgradePrompt).toBeTruthy();
    expect(res.plan?.slots.some(s => s.locked)).toBe(true);
  });

  it('returns no plan (upgrade prompt only) below Pro', () => {
    const res = generateSprint({ ...baseInput, plan: 'free' });
    expect(res.access).toBe('none');
    expect(res.plan).toBeUndefined();
    expect(res.upgradePrompt).toBeTruthy();
  });
});
