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
  organization: model('findUnique', 'create', 'update', 'updateMany', 'count'),
  teamMember: model('findMany', 'findFirst', 'create', 'deleteMany', 'count'),
  businessOwnership: model('findUnique', 'create', 'deleteMany', 'count'),
  brandDNA: model('findUnique', 'upsert', 'count', 'deleteMany', 'updateMany'),
  clientProfile: model(
    'findUnique',
    'upsert',
    'count',
    'deleteMany',
    'updateMany'
  ),
  calendarPost: model('findFirst', 'create', 'deleteMany', 'count'),
};
jest.mock('@/lib/prisma', () => ({ prisma: db }));

const mockResolveLogo = jest.fn();
jest.mock('@/lib/marketing-calendar/resolve-logo', () => ({
  resolveLogoUrl: (...a: unknown[]) => mockResolveLogo(...a),
}));

import {
  applyPortfolioSetup,
  undoPortfolioSetup,
  type PortfolioManifest,
} from '@/lib/marketing-calendar/portfolio-seed';
import { PORTFOLIO_CALENDAR_TAG } from '@/lib/marketing-calendar/portfolio-plan';

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
    db.brandDNA.upsert.mockResolvedValue({ id: 'dna', updatedAt: new Date() });
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

  it('keeps a stored logo when the approved logo cannot be confirmed as served', async () => {
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
    db.brandDNA.findUnique.mockResolvedValue({
      id: 'dna',
      logoUrl: 'https://stored.example.test/logo.png',
    });
    db.brandDNA.upsert.mockResolvedValue({ id: 'dna', updatedAt: new Date() });
    db.clientProfile.upsert.mockResolvedValue({
      id: 'cp',
      updatedAt: new Date(),
    });
    db.calendarPost.findFirst.mockResolvedValue({ id: 'existing' });
    await applyPortfolioSetup({ write: true, ownerUserId: 'owner-1' });

    expect(db.brandDNA.upsert).toHaveBeenCalled();
    for (const [arg] of db.brandDNA.upsert.mock.calls) {
      expect(arg.update).not.toHaveProperty('logoUrl');
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
    businessOwnerships: [],
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
      },
    ],
    skippedSlots: [],
    log: [],
  };

  it('deletes posts only while still draft, empty and portfolio-tagged', async () => {
    db.calendarPost.deleteMany.mockResolvedValue({ count: 1 });
    db.clientProfile.count.mockResolvedValue(1);
    db.clientProfile.deleteMany.mockResolvedValue({ count: 1 });
    db.brandDNA.count.mockResolvedValue(1);
    db.brandDNA.updateMany.mockResolvedValue({ count: 1 });
    db.organization.updateMany.mockResolvedValue({ count: 1 });
    await undoPortfolioSetup(manifest, true);

    expect(db.calendarPost.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: ['p1'] },
        status: 'draft',
        mediaUrls: { isEmpty: true },
        tags: { has: PORTFOLIO_CALENDAR_TAG },
      }),
    });
    expect(db.clientProfile.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'cp-carsi',
        organizationId: 'org-carsi',
        updatedAt: new Date(applied),
      },
    });
    expect(db.organization.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'org-nrpg',
          logo: 'https://l.test/n.svg',
          primaryColor: '#1F5BFF',
        }),
      })
    );
  });

  it('leaves rows changed since apply alone and never deletes an organisation', async () => {
    db.calendarPost.deleteMany.mockResolvedValue({ count: 0 });
    db.clientProfile.count.mockResolvedValue(0);
    db.brandDNA.count.mockResolvedValue(0);
    db.organization.updateMany.mockResolvedValue({ count: 0 });
    const lines = await undoPortfolioSetup(manifest, true);

    expect(db.clientProfile.deleteMany).not.toHaveBeenCalled();
    expect(db.brandDNA.updateMany).not.toHaveBeenCalled();
    expect(db.teamMember.deleteMany).not.toHaveBeenCalled();
    expect(lines).toContain(
      '= brand DNA carsi changed since apply; left alone'
    );
    expect(lines.some(l => l.startsWith('= org business-card kept'))).toBe(
      true
    );
    expect(lines[0]).toMatch(/delete 0\/1 portfolio posts/);
  });

  it('dry run counts and writes nothing', async () => {
    db.calendarPost.count.mockResolvedValue(1);
    db.clientProfile.count.mockResolvedValue(1);
    db.brandDNA.count.mockResolvedValue(1);
    db.organization.count.mockResolvedValue(1);
    await undoPortfolioSetup(manifest, false);
    expect(writeCalls()).toEqual([]);
  });
});
