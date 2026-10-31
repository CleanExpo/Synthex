/**
 * Write-safety of the portfolio setup itself (not the route):
 *   - preview writes nothing, even when organisations are missing;
 *   - apply never rewrites a slot that already exists;
 *   - an unconfirmed logo never clears a stored one;
 *   - undo carries its guards into every write and never deletes an org.
 */

type Fn = jest.Mock;
const model = (...methods: string[]) =>
  Object.fromEntries(methods.map(m => [m, jest.fn()])) as Record<string, Fn>;

const db = {
  organization: model(
    'findUnique',
    'findMany',
    'create',
    'update',
    'updateMany',
    'count'
  ),
  teamMember: model('findMany', 'findFirst', 'create', 'deleteMany', 'count'),
  businessOwnership: model('findUnique', 'create', 'deleteMany', 'count'),
  brandDNA: model(
    'findUnique',
    'create',
    'upsert',
    'count',
    'deleteMany',
    'updateMany'
  ),
  clientProfile: model(
    'findUnique',
    'create',
    'upsert',
    'count',
    'deleteMany',
    'updateMany'
  ),
  calendarPost: model('findFirst', 'findMany', 'create', 'deleteMany', 'count'),
  $transaction: jest.fn(),
};
jest.mock('@/lib/prisma', () => ({ prisma: db }));

// Models Postgres: $transaction does not serialise anything by itself; the
// advisory lock taken by $executeRaw does, until its transaction ends.
let lockChain: Promise<void> = Promise.resolve();
const lockCalls: string[] = [];
async function fakeTransaction(fn: (tx: unknown) => Promise<unknown>) {
  let release: (() => void) | undefined;
  const tx = {
    ...db,
    $executeRaw: async (sql: TemplateStringsArray) => {
      lockCalls.push(sql.join('?'));
      const prev = lockChain;
      lockChain = new Promise(r => (release = r));
      await prev;
    },
  };
  try {
    return await fn(tx);
  } finally {
    release?.();
  }
}

const mockResolveLogo = jest.fn();
jest.mock('@/lib/marketing-calendar/resolve-logo', () => ({
  resolveLogoUrl: (...a: unknown[]) => mockResolveLogo(...a),
}));

import {
  ORG_PROMPT_FIELDS,
  applyPortfolioSetup,
  undoPortfolioSetup,
  verifyPortfolioSetup,
  PORTFOLIO_SOURCE,
  type PortfolioManifest,
} from '@/lib/marketing-calendar/portfolio-seed';
import {
  PORTFOLIO_CALENDAR_TAG,
  buildPortfolioCalendar,
  slotBrief,
} from '@/lib/marketing-calendar/portfolio-plan';
import {
  PORTFOLIO_BRANDS,
  PORTFOLIO_WEEK_STARTS,
} from '@/lib/marketing-calendar/portfolio-brands';

const WRITE_METHODS = [
  'create',
  'update',
  'upsert',
  'updateMany',
  'deleteMany',
];
function writeCalls(): string[] {
  const out: string[] = [];
  for (const [name, m] of Object.entries(db)) {
    for (const method of WRITE_METHODS) {
      const fn = (m as Record<string, Fn>)[method];
      if (fn?.mock.calls.length) out.push(`${name}.${method}`);
    }
  }
  return out;
}

const orgRow = (slug: string) => ({
  id: `org-${slug}`,
  slug,
  status: 'active',
  parentOrgId: slug === 'unite-group' ? null : 'org-unite-group',
  logo: null,
  primaryColor: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveLogo.mockImplementation(async (url: string | null) => url);
  db.teamMember.findMany.mockResolvedValue([{ userId: 'owner-1' }]);
  db.teamMember.findFirst.mockResolvedValue({ id: 'tm' });
  db.businessOwnership.findUnique.mockResolvedValue({ id: 'bo' });
  db.brandDNA.findUnique.mockResolvedValue(null);
  db.clientProfile.findUnique.mockResolvedValue(null);
  db.calendarPost.findFirst.mockResolvedValue(null);
  db.calendarPost.findMany.mockResolvedValue([]);
  db.$transaction.mockImplementation(fakeTransaction);
  db.organization.updateMany.mockResolvedValue({ count: 0 });
  db.brandDNA.updateMany.mockResolvedValue({ count: 0 });
  lockChain = Promise.resolve();
  lockCalls.length = 0;
  db.clientProfile.create.mockResolvedValue({
    id: 'cp',
    updatedAt: new Date(),
  });
  db.organization.update.mockImplementation(
    async ({ data }: { data: object }) => ({ ...orgRow('x'), ...data })
  );
});

describe('applyPortfolioSetup', () => {
  it('preview writes nothing, even when organisations are missing', async () => {
    db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { slug: string } }) =>
        where.slug === 'unite-group' ? orgRow('unite-group') : null
    );
    const manifest = await applyPortfolioSetup({
      write: false,
      ownerUserId: 'owner-1',
    });
    expect(writeCalls()).toEqual([]);
    expect(manifest.log).toContain(
      '+ create org business-card (child of unite-group)'
    );
    expect(manifest.calendarPosts).toEqual([]);
  });

  it('never rewrites a slot that already exists, edited or not', async () => {
    db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { slug: string } }) => orgRow(where.slug)
    );
    db.organization.update.mockImplementation(
      async ({ data }: { data: object }) => ({ ...orgRow('x'), ...data })
    );
    db.brandDNA.create.mockResolvedValue({ id: 'dna', updatedAt: new Date() });
    db.clientProfile.upsert.mockResolvedValue({
      id: 'cp',
      updatedAt: new Date(),
    });
    db.calendarPost.findFirst.mockResolvedValue({
      id: 'existing',
      status: 'draft',
      mediaUrls: [],
      content: 'Human-edited brief',
    });
    const manifest = await applyPortfolioSetup({
      write: true,
      ownerUserId: 'owner-1',
    });
    expect(db.calendarPost.create).not.toHaveBeenCalled();
    expect(writeCalls().filter(c => c.startsWith('calendarPost'))).toEqual([]);
    expect(manifest.skippedSlots).toHaveLength(56);
  });

  it('creates only the missing piece of brand setup and never overwrites the other', async () => {
    db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { slug: string } }) => orgRow(where.slug)
    );
    db.calendarPost.findFirst.mockResolvedValue({ id: 'existing' });
    // Profile in place, DNA missing (e.g. profile made in onboarding).
    db.clientProfile.findUnique.mockResolvedValue({ id: 'cp-human' });
    db.brandDNA.create.mockResolvedValue({ id: 'dna', updatedAt: new Date() });
    await applyPortfolioSetup({ write: true, ownerUserId: 'owner-1' });
    expect(db.brandDNA.create).toHaveBeenCalledTimes(PORTFOLIO_BRANDS.length);
    expect(db.clientProfile.create).not.toHaveBeenCalled();

    jest.clearAllMocks();
    db.$transaction.mockImplementation(fakeTransaction);
    // DNA in place (human-edited), profile missing.
    db.brandDNA.findUnique.mockResolvedValue({ id: 'dna-human' });
    db.clientProfile.findUnique.mockResolvedValue(null);
    db.clientProfile.create.mockResolvedValue({
      id: 'cp',
      updatedAt: new Date(),
    });
    await applyPortfolioSetup({ write: true, ownerUserId: 'owner-1' });
    expect(db.clientProfile.create).toHaveBeenCalledTimes(
      PORTFOLIO_BRANDS.length
    );
    expect(db.brandDNA.create).not.toHaveBeenCalled();

    // Neither run touched an existing record or the org logo and colour.
    expect(db.brandDNA.upsert).not.toHaveBeenCalled();
    // Only the null-only logo repair may touch existing DNA.
    for (const [arg] of db.brandDNA.updateMany.mock.calls) {
      expect(arg.where).toMatchObject({ logoUrl: null });
      expect(Object.keys(arg.data)).toEqual(['logoUrl']);
    }
    expect(db.clientProfile.upsert).not.toHaveBeenCalled();
    expect(db.organization.update).not.toHaveBeenCalled();
  });

  it('leaves complete brand setup untouched on a repeat apply', async () => {
    db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { slug: string } }) => orgRow(where.slug)
    );
    db.brandDNA.findUnique.mockResolvedValue({ id: 'dna-human' });
    db.clientProfile.findUnique.mockResolvedValue({ id: 'cp-human' });
    db.calendarPost.findFirst.mockResolvedValue({ id: 'existing' });
    await applyPortfolioSetup({ write: true, ownerUserId: 'owner-1' });
    // Only the null-only logo repair may run (it matches nothing here: the
    // mocked updateMany returns no count), never a create or full update.
    expect(
      writeCalls().filter(
        c =>
          /brandDNA|clientProfile|organization/.test(c) && !/updateMany/.test(c)
      )
    ).toEqual([]);
    for (const [arg] of db.brandDNA.updateMany.mock.calls) {
      expect(arg.where).toMatchObject({ logoUrl: null });
    }
  });

  it('two applies at once create each slot once (check and create share a lock)', async () => {
    db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { slug: string } }) => orgRow(where.slug)
    );
    db.brandDNA.findUnique.mockResolvedValue({ id: 'dna' });
    db.clientProfile.findUnique.mockResolvedValue({ id: 'cp' });
    const rows = new Map<string, { id: string; status: string }>();
    const keyOf = (where: {
      organizationId: string;
      metadata: { equals: string };
    }) => `${where.organizationId}:${where.metadata.equals}`;
    db.calendarPost.findFirst.mockImplementation(
      async ({ where }: { where: Parameters<typeof keyOf>[0] }) => {
        await new Promise(r => setTimeout(r, 0));
        return rows.get(keyOf(where)) ?? null;
      }
    );
    db.calendarPost.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await new Promise(r => setTimeout(r, 0));
        const key = `${data.organizationId}:${(data.metadata as { slotKey: string }).slotKey}`;
        const row = {
          id: `p${rows.size}`,
          status: 'draft',
          scheduledFor: data.scheduledFor,
          updatedAt: new Date(),
        };
        rows.set(key, row);
        return row;
      }
    );
    const [a, b] = await Promise.all([
      applyPortfolioSetup({ write: true, ownerUserId: 'owner-1' }),
      applyPortfolioSetup({ write: true, ownerUserId: 'owner-1' }),
    ]);
    expect(db.calendarPost.create).toHaveBeenCalledTimes(56);
    expect(a.calendarPosts.length + b.calendarPosts.length).toBe(56);
    expect(a.skippedSlots.length + b.skippedSlots.length).toBe(56);
    expect(lockCalls[0]).toContain('pg_advisory_xact_lock');
  });

  it('skips a brand whose slug belongs to an org outside the workspace, or a deleted one', async () => {
    db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { slug: string } }) =>
        where.slug === 'carsi'
          ? { ...orgRow('carsi'), parentOrgId: 'outside-parent' }
          : where.slug === 'nrpg'
            ? { ...orgRow('nrpg'), status: 'deleted' }
            : orgRow(where.slug)
    );
    db.brandDNA.create.mockResolvedValue({ id: 'dna', updatedAt: new Date() });
    db.clientProfile.create.mockResolvedValue({
      id: 'cp',
      updatedAt: new Date(),
    });
    db.teamMember.findFirst.mockResolvedValue(null);
    db.businessOwnership.findUnique.mockResolvedValue(null);
    db.teamMember.create.mockResolvedValue({ id: 'tm' });
    db.businessOwnership.create.mockResolvedValue({ id: 'bo' });
    db.calendarPost.create.mockImplementation(
      async ({ data }: { data: { scheduledFor: Date } }) => ({
        id: 'p',
        scheduledFor: data.scheduledFor,
        updatedAt: new Date(),
      })
    );
    const manifest = await applyPortfolioSetup({
      write: true,
      ownerUserId: 'owner-1',
    });
    const touched = (m: jest.Mock) =>
      m.mock.calls.map(([a]) => JSON.stringify(a));
    for (const fn of [
      db.brandDNA.create,
      db.clientProfile.create,
      db.teamMember.create,
      db.businessOwnership.create,
      db.organization.update,
      db.calendarPost.create,
    ]) {
      expect(touched(fn).filter(s => /org-carsi|org-nrpg/.test(s))).toEqual([]);
    }
    expect(manifest.log.filter(l => l.includes('brand skipped'))).toHaveLength(
      2
    );
    expect(
      manifest.skippedSlots.filter(s => /-(carsi|nrpg)-/.test(s.slotKey)).length
    ).toBeGreaterThan(0);
  });

  it('refuses to run when the unite-group org is not a workspace root', async () => {
    db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { slug: string } }) =>
        where.slug === 'unite-group'
          ? { ...orgRow('unite-group'), parentOrgId: 'outside-root' }
          : orgRow(where.slug)
    );
    await expect(
      applyPortfolioSetup({ write: true, ownerUserId: 'owner-1' })
    ).rejects.toThrow(/not a workspace root/);
    expect(writeCalls()).toEqual([]);
  });

  it('fills a still-empty logo once the approved logo is served, and only an empty one', async () => {
    db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { slug: string } }) => orgRow(where.slug)
    );
    db.brandDNA.findUnique.mockResolvedValue({ id: 'dna' });
    db.clientProfile.findUnique.mockResolvedValue({ id: 'cp' });
    db.calendarPost.findFirst.mockResolvedValue({ id: 'existing' });
    db.organization.updateMany.mockResolvedValue({ count: 1 });
    db.brandDNA.updateMany.mockResolvedValue({ count: 1 });
    const manifest = await applyPortfolioSetup({
      write: true,
      ownerUserId: 'owner-1',
    });

    expect(db.organization.updateMany).toHaveBeenCalled();
    // Every fill is in the records, so undo lists it for manual review.
    expect(manifest.updatedOrganizations.length).toBeGreaterThan(0);
    for (const row of manifest.updatedOrganizations) {
      expect(row.before).toEqual({ logo: null, primaryColor: null });
    }
    for (const [arg] of db.organization.updateMany.mock.calls) {
      // One field per write, guarded by that same field still being empty.
      const [field] = Object.keys(arg.data);
      expect(Object.keys(arg.data)).toHaveLength(1);
      expect(['logo', 'primaryColor']).toContain(field);
      expect(arg.where).toMatchObject({ [field]: null });
    }
    expect(db.brandDNA.updateMany).toHaveBeenCalled();
    for (const [arg] of db.brandDNA.updateMany.mock.calls) {
      expect(arg.where).toMatchObject({ logoUrl: null });
      expect(Object.keys(arg.data)).toEqual(['logoUrl']);
    }
    expect(db.brandDNA.create).not.toHaveBeenCalled();
    expect(db.organization.update).not.toHaveBeenCalled();
  });

  it('keeps an existing org logo and colour on a fresh brand (fills only empty fields)', async () => {
    db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { slug: string } }) => ({
        ...orgRow(where.slug),
        logo: 'https://someone.example.test/their-logo.png',
        primaryColor: '#123456',
      })
    );
    db.brandDNA.create.mockResolvedValue({ id: 'dna', updatedAt: new Date() });
    db.calendarPost.findFirst.mockResolvedValue({ id: 'existing' });
    await applyPortfolioSetup({ write: true, ownerUserId: 'owner-1' });

    expect(db.brandDNA.create).toHaveBeenCalled();
    expect(db.organization.update).not.toHaveBeenCalled();
    expect(db.organization.updateMany).not.toHaveBeenCalled();
  });

  it('records each created post with the updatedAt undo must match', async () => {
    db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { slug: string } }) => orgRow(where.slug)
    );
    const written = new Date('2026-11-01T01:02:03.000Z');
    db.brandDNA.create.mockResolvedValue({ id: 'dna', updatedAt: written });
    db.calendarPost.create.mockImplementation(
      async ({ data }: { data: { scheduledFor: Date } }) => ({
        id: 'new-post',
        scheduledFor: data.scheduledFor,
        updatedAt: written,
      })
    );
    const manifest = await applyPortfolioSetup({
      write: true,
      ownerUserId: 'owner-1',
    });
    expect(manifest.calendarPosts.length).toBeGreaterThan(0);
    for (const post of manifest.calendarPosts) {
      expect(post.appliedUpdatedAt).toBe(written.toISOString());
    }
  });

  it('never writes an unconfirmed logo, so a stored logo is kept', async () => {
    mockResolveLogo.mockResolvedValue(null);
    db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { slug: string } }) => ({
        ...orgRow(where.slug),
        logo: 'https://stored.example.test/logo.png',
      })
    );
    db.organization.update.mockImplementation(
      async ({ data }: { data: object }) => ({ ...orgRow('x'), ...data })
    );
    db.brandDNA.create.mockResolvedValue({ id: 'dna', updatedAt: new Date() });
    db.clientProfile.create.mockResolvedValue({
      id: 'cp',
      updatedAt: new Date(),
    });
    db.calendarPost.findFirst.mockResolvedValue({ id: 'existing' });
    await applyPortfolioSetup({ write: true, ownerUserId: 'owner-1' });

    expect(db.brandDNA.create).toHaveBeenCalled();
    for (const [arg] of db.brandDNA.create.mock.calls) {
      expect(arg.data).not.toHaveProperty('logoUrl');
    }
    expect(db.organization.update).not.toHaveBeenCalled();
    for (const [arg] of db.organization.updateMany.mock.calls) {
      expect(arg.data).not.toHaveProperty('logo');
    }
  });
});

describe('undoPortfolioSetup', () => {
  const applied = '2026-11-01T00:00:00.000Z';
  const manifest: PortfolioManifest = {
    planVersion: 'v',
    ranAt: applied,
    write: true,
    createdOrganizations: [{ id: 'org-new', slug: 'business-card' }],
    updatedOrganizations: [
      {
        id: 'org-nrpg',
        slug: 'nrpg',
        before: { logo: null, primaryColor: '#000000' },
        after: { logo: 'https://l.test/n.svg', primaryColor: '#1F5BFF' },
      },
    ],
    teamMembers: [
      {
        id: 'tm-new',
        orgSlug: 'business-card',
        organizationId: 'org-new',
        userId: 'owner-1',
      },
    ],
    businessOwnerships: [
      {
        id: 'bo-carsi',
        orgSlug: 'carsi',
        organizationId: 'org-carsi',
        userId: 'owner-1',
      },
    ],
    brandDna: [
      {
        id: 'dna-carsi',
        orgSlug: 'carsi',
        organizationId: 'org-carsi',
        created: false,
        before: { id: 'dna-carsi', businessName: 'Old' },
        appliedUpdatedAt: applied,
      },
    ],
    clientProfiles: [
      {
        id: 'cp-carsi',
        orgSlug: 'carsi',
        organizationId: 'org-carsi',
        created: true,
        before: null,
        appliedUpdatedAt: applied,
      },
    ],
    calendarPosts: [
      {
        id: 'p1',
        orgSlug: 'carsi',
        slotKey: 'k',
        kind: 'shortform_video',
        scheduledFor: applied,
        appliedUpdatedAt: applied,
      },
      {
        // An older manifest without the timestamp cannot prove the post is untouched.
        id: 'p-legacy',
        orgSlug: 'carsi',
        slotKey: 'k2',
        kind: 'shortform_video',
        scheduledFor: applied,
      } as PortfolioManifest['calendarPosts'][number],
    ],
    skippedSlots: [],
    log: [],
  };

  it('deletes a post only while draft, empty, portfolio-tagged and unchanged since apply', async () => {
    db.calendarPost.deleteMany.mockResolvedValue({ count: 1 });
    const lines = await undoPortfolioSetup(manifest, true);

    expect(db.calendarPost.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.calendarPost.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'p1',
        status: 'draft',
        mediaUrls: { isEmpty: true },
        tags: { has: PORTFOLIO_CALENDAR_TAG },
        metadata: { path: ['source'], equals: PORTFOLIO_SOURCE },
        updatedAt: new Date(applied),
      },
    });
    expect(lines[0]).toMatch(/delete 1\/2 portfolio posts/);
  });

  it('keeps an edited or rescheduled draft (no row matches the applied timestamp)', async () => {
    db.calendarPost.deleteMany.mockResolvedValue({ count: 0 });
    const lines = await undoPortfolioSetup(manifest, true);
    expect(lines[0]).toMatch(/delete 0\/2 portfolio posts/);
  });

  it('never deletes or restores brand setup, access or organisations', async () => {
    db.calendarPost.deleteMany.mockResolvedValue({ count: 1 });
    const lines = await undoPortfolioSetup(manifest, true);

    expect(writeCalls()).toEqual(['calendarPost.deleteMany']);
    expect(lines).toContain(
      '= brand DNA carsi kept (undo never removes brand setup; edit it in Brand if unwanted)'
    );
    expect(lines.some(l => l.startsWith('= client profile carsi kept'))).toBe(
      true
    );
    expect(
      lines.some(l => l.startsWith('= org nrpg logo and colour kept'))
    ).toBe(true);
    expect(lines.some(l => l.startsWith('= owner access bo-carsi'))).toBe(true);
    expect(lines.some(l => l.startsWith('= org business-card kept'))).toBe(
      true
    );
  });

  it('dry run counts and writes nothing', async () => {
    db.calendarPost.count.mockResolvedValue(1);
    await undoPortfolioSetup(manifest, false);
    expect(writeCalls()).toEqual([]);
    expect(db.calendarPost.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'p1',
        updatedAt: new Date(applied),
      }),
    });
  });
});

describe('verifyPortfolioSetup', () => {
  const plan = buildPortfolioCalendar(PORTFOLIO_BRANDS, PORTFOLIO_WEEK_STARTS);
  const orgs = PORTFOLIO_BRANDS.map(b => ({
    id: `org-${b.orgSlug}`,
    slug: b.orgSlug,
    status: 'active',
    parentOrgId: b.orgSlug === 'unite-group' ? null : 'org-unite-group',
    name: b.name,
    description: b.description,
    industry: b.industry,
    calendarMode: 'shadow',
    liveModeT: 0,
    brandOperatingSystem: null as null | Record<string, unknown>,
    // As brandDnaData and clientProfileData store them, so the passing case
    // is what the seed really writes.
    brandDna: {
      businessName: b.name,
      vertical: b.vertical,
      industry: b.industry,
      logoUrl: b.logoUrl,
      primaryColour: b.colours.primary,
      brandVoice: b.voice,
      persona: b.audience,
      offerings: b.offerings,
      socialProfiles: b.socialProfiles,
      sourceUrl: b.website,
    },
    clientProfile: {
      intakeStatus: 'complete',
      intakeSource: PORTFOLIO_SOURCE,
      icp: b.audience,
      offers: b.offerings,
      toneKeywords: b.voice.tone,
      antiPatterns: b.antiPatterns,
      vocabularyBank: { preferred: b.preferredWords, banned: b.forbiddenWords },
      channels: b.socialProfiles.map(p => p.platform),
      constraints: {
        brandRules: b.brandRules,
        liveStatus: b.liveStatus,
        publicContentHeldReason: b.publicContentHeldReason ?? null,
        logoNote: b.logoNote,
      },
    },
  }));
  const rows = (orgOf: (slug: string, i: number) => string) =>
    plan.map((s, i) => ({
      status: 'draft',
      publishedAt: null,
      organizationId: `org-${orgOf(s.orgSlug, i)}`,
      scheduledFor: new Date(s.scheduledFor),
      platforms: [...s.platforms],
      title: `Short-form video: ${s.orgSlug}, ${s.theme}`,
      content: slotBrief(
        s,
        PORTFOLIO_BRANDS.find(b => b.orgSlug === s.orgSlug)!
      ),
      metadata: {
        source: PORTFOLIO_SOURCE,
        theme: s.theme,
        brandRules: PORTFOLIO_BRANDS.find(b => b.orgSlug === s.orgSlug)!
          .brandRules,
        slotKey: s.slotKey,
        weekStart: s.weekStart,
        slotKind: s.kind,
      },
    }));

  beforeEach(() => {
    db.organization.findMany.mockResolvedValue(orgs);
  });

  it('passes when every slot sits under its own brand', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
    const result = await verifyPortfolioSetup();
    expect(result.checks.filter(c => !c.pass)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('ignores a portfolio-tagged row planted in an org outside the workspace', async () => {
    const foreign = {
      ...rows(slug => slug)[0],
      organizationId: 'org-outsider',
    };
    // Honours the WHERE like Postgres would: only listed orgs come back.
    db.calendarPost.findMany.mockImplementation(
      async ({ where }: { where: { organizationId?: { in: string[] } } }) =>
        [...rows(slug => slug), foreign].filter(
          r =>
            !where.organizationId ||
            where.organizationId.in.includes(r.organizationId)
        )
    );
    const result = await verifyPortfolioSetup();
    expect(result.checks.filter(c => !c.pass)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('fails when a brand org has left the workspace', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
    db.organization.findMany.mockResolvedValue(
      orgs.map(o =>
        o.slug === 'carsi' ? { ...o, parentOrgId: 'outside-parent' } : o
      )
    );
    const result = await verifyPortfolioSetup();
    expect(result.ok).toBe(false);
    const failed = result.checks.filter(c => !c.pass).map(c => c.label);
    expect(failed).toContain('carsi: active and in the unite-group workspace');
    // Nothing else about the outside org reaches the (public) result.
    expect(
      result.checks.filter(
        c =>
          c.label.startsWith('carsi:') &&
          !c.label.includes('workspace') &&
          !c.label.includes('organisation exists')
      )
    ).toEqual([]);
    // Its slots no longer count either: they sit under a non-member org.
    expect(failed.some(l => l.includes('missing, misplaced or moved'))).toBe(
      true
    );
  });

  it('never puts a slot key in the (public) result', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug).slice(1));
    const result = await verifyPortfolioSetup();
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(
      /\d{4}-\d{2}-\d{2}-[a-z-]+-(video|post)/
    );
  });

  it('fails a kept Unite-Group draft whose delivered caption names an owned business', async () => {
    const victim = plan.findIndex(s => s.orgSlug === 'unite-group');
    db.calendarPost.findMany.mockResolvedValue(
      rows(slug => slug).map((r, i) =>
        i === victim
          ? {
              ...r,
              metadata: {
                ...r.metadata,
                videoDelivery: {
                  status: 'delivered',
                  captionDraft: 'Promote CARSI courses',
                },
              },
            }
          : r
      )
    );
    expect(await failedLabels()).toEqual([
      'unite-group: calendar drafts carry no forbidden words',
    ]);
  });

  it('fails a Unite-Group Brand OS whose prompt override names an owned business', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
    db.organization.findMany.mockResolvedValue(
      orgs.map(o =>
        o.slug === 'unite-group'
          ? {
              ...o,
              brandOperatingSystem: {
                id: 'bos-1',
                organizationId: o.id,
                systemPromptOverride: 'Promote CARSI courses',
              },
            }
          : o
      )
    );
    expect(await failedLabels()).toEqual([
      'unite-group: organisation, brand DNA, Brand OS and client profile carry no forbidden words',
    ]);
  });

  it.each([
    ['hashtag', { hashtags: ['#CARSI'] }],
    ['mention', { mentions: ['@Disaster_Recovery'] }],
  ])(
    'fails a kept Unite-Group draft whose %s names an owned business',
    async (_, edit) => {
      const victim = plan.findIndex(s => s.orgSlug === 'unite-group');
      db.calendarPost.findMany.mockResolvedValue(
        rows(slug => slug).map((r, i) => (i === victim ? { ...r, ...edit } : r))
      );
      expect(await failedLabels()).toEqual([
        'unite-group: calendar drafts carry no forbidden words',
      ]);
    }
  );

  it('scans a field named banned anywhere but the approved banned list', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
    db.organization.findMany.mockResolvedValue(
      withUgProfile({
        constraints: { banned: 'Feature a CARSI course monthly' },
      })
    );
    expect(await failedLabels()).toEqual([
      'unite-group: organisation, brand DNA, Brand OS and client profile carry no forbidden words',
    ]);
  });

  it('ignores org billing data no prompt reads', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
    db.organization.findMany.mockResolvedValue(
      orgs.map(o =>
        o.slug === 'unite-group'
          ? { ...o, billingEmail: 'accounts@carsi.com.au' }
          : o
      )
    );
    const result = await verifyPortfolioSetup();
    expect(result.checks.filter(c => !c.pass)).toEqual([]);
  });

  it('scans every organisation column a prompt builder reads', () => {
    const fs = jest.requireActual<typeof import('fs')>('fs');
    const readers = [
      'lib/ai/content-generator.ts',
      'lib/ai/prompt-layer-builder.ts',
      'lib/services/ai/studio-tools/context-tools.ts',
    ].map(f => fs.readFileSync(f, 'utf8'));
    const read = new Set<string>();
    for (const src of readers) {
      for (const m of src.matchAll(
        /organization\.find\w*\(\s*\{[\s\S]*?select:\s*\{([^}]*)\}/g
      )) {
        for (const k of m[1].matchAll(/(\w+):\s*true/g)) read.add(k[1]);
      }
      for (const m of src.matchAll(/\borg\.(\w+)/g)) read.add(m[1]);
    }
    // Not text: ids and colours.
    const notText = new Set(['id', 'slug', 'primaryColor', 'logo']);
    expect(read.size).toBeGreaterThan(0);
    expect(
      [...read].filter(
        k =>
          !notText.has(k) &&
          !(ORG_PROMPT_FIELDS as readonly string[]).includes(k)
      )
    ).toEqual([]);
  });

  it.each([
    [
      'moved to another date',
      { scheduledFor: new Date('2027-01-01T00:00:00Z') },
    ],
    ['moved to another channel', { platforms: ['twitter'] }],
  ])('fails a planned draft %s', async (_, edit) => {
    db.calendarPost.findMany.mockResolvedValue(
      rows(slug => slug).map((r, i) => (i === 0 ? { ...r, ...edit } : r))
    );
    expect(await failedLabels()).toEqual([
      `all ${plan.length} planned slots exist once, each under its own brand at its planned time and channels (1 missing, misplaced or moved)`,
    ]);
  });

  it.each([
    [
      'client profile intake source',
      (o: (typeof orgs)[number]) => ({
        ...o,
        clientProfile: { ...o.clientProfile, intakeSource: 'CARSI' },
      }),
    ],
    [
      'brand DNA source URL',
      (o: (typeof orgs)[number]) => ({
        ...o,
        brandDna: { ...o.brandDna, sourceUrl: 'https://carsi.example' },
      }),
    ],
    [
      'organisation AI context',
      (o: (typeof orgs)[number]) => ({
        ...o,
        aiGeneratedData: { brandVoice: 'Feature CARSI courses' },
      }),
    ],
    [
      'organisation website',
      (o: (typeof orgs)[number]) => ({
        ...o,
        website: 'https://restore-assist.example',
      }),
    ],
  ])(
    'fails a kept Unite-Group row whose %s names an owned business',
    async (_, edit) => {
      db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
      db.organization.findMany.mockResolvedValue(
        orgs.map(o => (o.slug === 'unite-group' ? edit(o) : o))
      );
      expect(await failedLabels()).toEqual([
        'unite-group: organisation, brand DNA, Brand OS and client profile carry no forbidden words',
      ]);
    }
  );

  const withUgProfile = (over: Record<string, unknown>) =>
    orgs.map(o =>
      o.slug === 'unite-group'
        ? { ...o, clientProfile: { ...o.clientProfile, ...over } }
        : o
    );
  const failedLabels = async () =>
    (await verifyPortfolioSetup()).checks
      .filter(c => !c.pass)
      .map(c => c.label);

  it('fails a kept profile whose banned list has the right count but wrong words', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
    const ug = PORTFOLIO_BRANDS.find(b => b.orgSlug === 'unite-group')!;
    db.organization.findMany.mockResolvedValue(
      withUgProfile({
        vocabularyBank: {
          preferred: [],
          banned: ug.forbiddenWords.map((_, i) => `word-${i}`),
        },
      })
    );
    expect(await failedLabels()).toEqual([
      `unite-group: client profile holds all ${ug.forbiddenWords.length} forbidden words`,
    ]);
  });

  it('fails a kept profile whose audience or offers name the group businesses', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
    db.organization.findMany.mockResolvedValue(
      withUgProfile({
        icp: {
          description:
            'Owners curious how the Unite Group businesses fit together',
        },
        offers: ['CARSI courses', 'Trade Hall booths'],
      })
    );
    expect(await failedLabels()).toEqual([
      'unite-group: organisation, brand DNA, Brand OS and client profile carry no forbidden words',
    ]);
  });

  it('fails a kept brand DNA persona that names the group businesses', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
    db.organization.findMany.mockResolvedValue(
      orgs.map(o =>
        o.slug === 'unite-group'
          ? {
              ...o,
              brandDna: {
                ...o.brandDna,
                persona: {
                  description:
                    'Owners seeking CARSI courses and Trade Hall booths',
                },
              },
            }
          : o
      )
    );
    expect(await failedLabels()).toEqual([
      'unite-group: organisation, brand DNA, Brand OS and client profile carry no forbidden words',
    ]);
  });

  it('fails a kept profile whose rules were edited to cover the group businesses', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
    const ug = PORTFOLIO_BRANDS.find(b => b.orgSlug === 'unite-group')!;
    db.organization.findMany.mockResolvedValue(
      withUgProfile({
        constraints: {
          brandRules: [...ug.brandRules, 'Feature a Trade Hall tour monthly.'],
        },
      })
    );
    expect(await failedLabels()).toEqual([
      'unite-group: organisation, brand DNA, Brand OS and client profile carry no forbidden words',
    ]);
  });

  it('fails a kept organisation description that names the group businesses', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
    db.organization.findMany.mockResolvedValue(
      orgs.map(o =>
        o.slug === 'unite-group'
          ? { ...o, description: 'Home of the Unite Group businesses' }
          : o
      )
    );
    expect(await failedLabels()).toEqual([
      'unite-group: organisation, brand DNA, Brand OS and client profile carry no forbidden words',
    ]);
  });

  it.each([
    [
      'title',
      {
        title:
          'Short-form video: Unite-Group, CARSI courses for restoration crews',
      },
    ],
    ['rules', { brandRulesExtra: 'Feature a Trade Hall tour monthly.' }],
  ])(
    'fails a kept Unite-Group draft whose %s was edited to a banned word',
    async (_, edit) => {
      const victim = plan.findIndex(s => s.orgSlug === 'unite-group');
      db.calendarPost.findMany.mockResolvedValue(
        rows(slug => slug).map((r, i) => {
          if (i !== victim) return r;
          if ('title' in edit) return { ...r, title: edit.title };
          return {
            ...r,
            metadata: {
              ...r.metadata,
              brandRules: [...r.metadata.brandRules, edit.brandRulesExtra],
            },
          };
        })
      );
      expect(await failedLabels()).toEqual([
        'unite-group: calendar drafts carry no forbidden words',
      ]);
    }
  );

  it('fails a kept Unite-Group draft made from the old unsafe theme', async () => {
    const victim = plan.findIndex(s => s.orgSlug === 'unite-group');
    db.calendarPost.findMany.mockResolvedValue(
      rows(slug => slug).map((r, i) =>
        i === victim
          ? {
              ...r,
              content: 'Brief: How the Unite Group businesses fit together',
            }
          : r
      )
    );
    expect(await failedLabels()).toEqual([
      'unite-group: calendar drafts carry no forbidden words',
    ]);
  });

  it('fails a brand with no client profile at all', async () => {
    db.calendarPost.findMany.mockResolvedValue(rows(slug => slug));
    db.organization.findMany.mockResolvedValue(
      orgs.map(o => (o.slug === 'carsi' ? { ...o, clientProfile: null } : o))
    );
    const failed = await failedLabels();
    expect(failed).toEqual([
      'carsi: client profile holds all 22 forbidden words',
      'carsi: organisation, brand DNA, Brand OS and client profile carry no forbidden words',
    ]);
  });

  it('fails when a slot is filed under the wrong brand', async () => {
    const victim = plan.findIndex(s => s.orgSlug === 'carsi');
    db.calendarPost.findMany.mockResolvedValue(
      rows((slug, i) => (i === victim ? 'business-card' : slug))
    );
    const result = await verifyPortfolioSetup();
    expect(result.ok).toBe(false);
    expect(
      result.checks.find(c => c.label.startsWith('all 56 planned slots'))?.pass
    ).toBe(false);
  });
});
