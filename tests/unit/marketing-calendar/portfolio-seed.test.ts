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
  applyPortfolioSetup,
  undoPortfolioSetup,
  verifyPortfolioSetup,
  PORTFOLIO_SOURCE,
  type PortfolioManifest,
} from '@/lib/marketing-calendar/portfolio-seed';
import {
  PORTFOLIO_CALENDAR_TAG,
  buildPortfolioCalendar,
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
    expect(db.brandDNA.updateMany).not.toHaveBeenCalled();
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
    expect(
      writeCalls().filter(c => /brandDNA|clientProfile|organization/.test(c))
    ).toEqual([]);
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
    for (const [arg] of db.organization.update.mock.calls) {
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
    calendarMode: 'shadow',
    liveModeT: 0,
    brandDna: { logoUrl: b.logoUrl, primaryColour: b.colours.primary },
    clientProfile: { vocabularyBank: { banned: b.forbiddenWords } },
  }));
  const rows = (orgOf: (slug: string, i: number) => string) =>
    plan.map((s, i) => ({
      status: 'draft',
      publishedAt: null,
      organizationId: `org-${orgOf(s.orgSlug, i)}`,
      metadata: {
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
