/**
 * The two marketing-agency server pages that read the database directly identify
 * the caller and check organisation access before any campaign data is read
 * (SYN-1412).
 *
 * How these tests are kept honest:
 *   - The access rule is never stood in for. Users, organisations and ownerships
 *     are rows in the row store (tests/helpers/prisma-row-store.ts), decoys
 *     included, and the real rule reads them.
 *   - Identity is the real cookie check over a mocked cookie jar, with a token
 *     signed at run time from the test secret.
 *   - The campaign-data models answer with a full campaign from ANOTHER
 *     organisation whatever they are asked, so a missing gate shows as data
 *     returned, and a query not bound to the gate's organisation shows as such.
 *   - redirect() and notFound() throw different errors, so one can never pass
 *     for the other.
 *   - Every refused case differs from the permitted case in one thing.
 */

import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPrismaRowStore } from '@/tests/helpers/prisma-row-store';

const mockCampaignData = {
  marketingAgencyCampaign: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  campaign: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  studioContentDraft: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};
const mockStore = createPrismaRowStore(mockCampaignData);

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  get default() {
    return mockStore.client;
  },
  get prisma() {
    return mockStore.client;
  },
}));

jest.mock('server-only', () => ({}));

/** The value of the auth-token cookie on the request, or null for no cookie. */
const mockSession: { token: string | null } = { token: null };
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'auth-token' && mockSession.token !== null
        ? { name, value: mockSession.token }
        : undefined,
  }),
}));

const mockRedirect = jest.fn();
const mockNotFound = jest.fn();
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  redirect: (...args: unknown[]) => mockRedirect(...args),
  notFound: (...args: unknown[]) => mockNotFound(...args),
}));

const mockLog = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
jest.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLog.error(...args),
    warn: (...args: unknown[]) => mockLog.warn(...args),
    info: (...args: unknown[]) => mockLog.info(...args),
    debug: (...args: unknown[]) => mockLog.debug(...args),
  },
}));

import AuthorityPage from '@/app/dashboard/marketing-agency/[client]/authority/page';
import CcwEofyPage from '@/app/dashboard/marketing-agency/ccw-eofy/page';

interface PageCase {
  /** The organisation slug the page is for. */
  slug: string;
  organisationId: string;
  /** Where a caller with no valid session must be sent. */
  signIn: string;
  open: () => Promise<unknown>;
}

const AUTHORITY: PageCase = {
  slug: 'restoreassist',
  organisationId: 'org-ra',
  signIn:
    '/login?redirect=%2Fdashboard%2Fmarketing-agency%2Frestoreassist%2Fauthority',
  open: () =>
    AuthorityPage({ params: Promise.resolve({ client: 'restoreassist' }) }),
};

const CCW_EOFY: PageCase = {
  slug: 'ccw',
  organisationId: 'org-ccw',
  signIn: '/login?redirect=%2Fdashboard%2Fmarketing-agency%2Fccw-eofy',
  open: () => CcwEofyPage(),
};

// A full campaign that belongs to an organisation the caller has nothing to do
// with. The campaign-data mocks hand it back whatever they are asked.
const LEAKED_ORGANISATION_ID = 'org-leak';
const CAMPAIGN_NAME = 'Leaked Campaign Name';

const fullCampaign = {
  id: 'agency-campaign-1',
  name: CAMPAIGN_NAME,
  slug: 'ccw-eofy-sales-2026',
  organizationId: LEAKED_ORGANISATION_ID,
  primaryOffer: 'Leaked primary offer',
  providerMode: 'live',
  status: 'ready',
  updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  metadata: {
    campaignFamily: 'portfolio-authority',
    connectedPlatforms: ['linkedin'],
    missingPlatforms: ['facebook'],
    warnings: ['Leaked warning'],
    publicAssets: [],
  },
  organization: {
    id: LEAKED_ORGANISATION_ID,
    name: 'Leaked Organisation',
    slug: 'leaked-organisation',
  },
  sourceRefs: [
    { id: 'source-1', url: 'https://example.com/source', label: 'Source one' },
  ],
  claims: [
    {
      id: 'claim-1',
      statement: 'Leaked claim statement',
      approvalStatus: 'approved',
      evidenceStatus: 'verified',
    },
  ],
  qaReports: [
    {
      status: 'passed',
      blockedReasons: ['Leaked blocker'],
      checks: [{ name: 'Leaked check', status: 'pass', detail: 'ok' }],
    },
  ],
  exportPackages: [{ handoffNotes: 'Leaked hand-off notes', formats: ['pdf'] }],
  assets: [
    {
      id: 'asset-1',
      title: 'Leaked asset',
      assetType: 'campaign_material_pack',
      licenceStatus: 'owned',
      metadata: { calendarSlots: 3 },
    },
  ],
};

const fullAppCampaign = {
  id: 'campaign-1',
  name: CAMPAIGN_NAME,
  status: 'draft',
  organizationId: LEAKED_ORGANISATION_ID,
  posts: [
    {
      id: 'post-1',
      platform: 'blog',
      status: 'draft',
      content: 'Leaked blog draft',
      metadata: { title: 'Leaked blog title' },
    },
    {
      id: 'post-2',
      platform: 'linkedin',
      status: 'draft',
      content: 'Leaked social draft',
      metadata: {},
    },
  ],
};

const fullStudioDraft = {
  id: 'studio-draft-1',
  status: 'awaiting_approval',
  approvedAt: null,
  organizationId: LEAKED_ORGANISATION_ID,
};

/**
 * Seed who exists. The caller is user-1. With the defaults user-1 belongs to
 * the page's organisation directly and is permitted. Every case also carries
 * decoys that must not count for user-1: another user who is a member and an
 * active owner of the page's organisation; user-1's own active ownership and
 * owner row in ANOTHER organisation; user-1's ownership of the page's
 * organisation that is no longer active; and user-1's owner row on the team
 * list, which alone gives no membership.
 */
function seedAccess(
  page: PageCase,
  {
    home = page.organisationId,
    organisationExists = true,
  }: { home?: string; organisationExists?: boolean } = {}
) {
  const accepted = new Date('2026-01-01T00:00:00.000Z');
  mockStore.seed({
    organization: [
      {
        id: 'org-parent',
        name: 'Unite Group',
        slug: 'unite',
        parentOrgId: null,
      },
      {
        id: 'org-other',
        name: 'Another Brand',
        slug: 'another-brand',
        parentOrgId: 'org-parent',
      },
      ...(organisationExists
        ? [
            {
              id: page.organisationId,
              name: 'The Page Organisation',
              slug: page.slug,
              parentOrgId: 'org-parent',
            },
          ]
        : []),
    ],
    user: [
      { id: 'user-1', organizationId: home, isMultiBusinessOwner: true },
      {
        id: 'user-2',
        organizationId: page.organisationId,
        isMultiBusinessOwner: true,
      },
    ],
    businessOwnership: [
      {
        ownerId: 'user-2',
        organizationId: page.organisationId,
        isActive: true,
      },
      { ownerId: 'user-1', organizationId: 'org-other', isActive: true },
      {
        ownerId: 'user-1',
        organizationId: page.organisationId,
        isActive: false,
      },
    ],
    teamMember: [
      {
        userId: 'user-1',
        organizationId: page.organisationId,
        role: 'owner',
        acceptedAt: accepted,
      },
      {
        userId: 'user-1',
        organizationId: 'org-other',
        role: 'owner',
        acceptedAt: accepted,
      },
    ],
  });
}

/** A session cookie for user-1, signed now with the test environment's secret. */
function signInAsUser1() {
  mockSession.token = jwt.sign(
    { userId: 'user-1' },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );
}

/**
 * A well-formed token that names user-1 but is signed with a secret made up on
 * the spot, so only verification stands between it and the page.
 */
function presentUnverifiableToken() {
  mockSession.token = jwt.sign(
    { userId: 'user-1' },
    randomBytes(32).toString('hex'),
    { expiresIn: '1h' }
  );
}

type Opened =
  | { rendered: true; element: unknown }
  | { rendered: false; error: unknown };

async function open(page: PageCase): Promise<Opened> {
  try {
    return { rendered: true, element: await page.open() };
  } catch (error) {
    return { rendered: false, error };
  }
}

/** "rendered", or the message of what the page threw. */
function outcomeOf(opened: Opened): string {
  if (opened.rendered) return 'rendered';
  return opened.error instanceof Error
    ? opened.error.message
    : String(opened.error);
}

/** Every query made on the campaign-data models, with the organisation it asked for. */
function campaignDataQueries() {
  const queries: Array<{ model: string; organizationId: unknown }> = [];
  for (const [model, delegate] of Object.entries(mockCampaignData)) {
    for (const method of Object.values(delegate)) {
      for (const [args] of method.mock.calls) {
        const where =
          (args as { where?: Record<string, unknown> } | undefined)?.where ??
          {};
        queries.push({ model, organizationId: where.organizationId });
      }
    }
  }
  return queries;
}

const NO_READS = {
  user: 0,
  organization: 0,
  businessOwnership: 0,
  teamMember: 0,
  userRole: 0,
};

/** The fields a log call carried: every plain-object argument after the message. */
function logFields(call: unknown[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const arg of call.slice(1)) {
    if (arg && typeof arg === 'object' && !(arg instanceof Error)) {
      Object.assign(fields, arg);
    }
  }
  return fields;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.reset();
  mockSession.token = null;
  mockRedirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  mockNotFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  const { marketingAgencyCampaign, campaign, studioContentDraft } =
    mockCampaignData;
  marketingAgencyCampaign.findFirst.mockResolvedValue(fullCampaign);
  marketingAgencyCampaign.findUnique.mockResolvedValue(fullCampaign);
  marketingAgencyCampaign.findMany.mockResolvedValue([fullCampaign]);
  campaign.findFirst.mockResolvedValue(fullAppCampaign);
  campaign.findUnique.mockResolvedValue(fullAppCampaign);
  campaign.findMany.mockResolvedValue([fullAppCampaign]);
  studioContentDraft.findFirst.mockResolvedValue(fullStudioDraft);
  studioContentDraft.findUnique.mockResolvedValue(fullStudioDraft);
  studioContentDraft.findMany.mockResolvedValue([fullStudioDraft]);
});

afterEach(() => {
  // A query the row store does not know is a fault in the test set-up, even
  // when the code under test caught it and answered something plausible.
  expect(mockStore.usageErrors).toEqual([]);
});

// ---- the six cases, run once for each page ---------------------------------

async function redirectsWithNoSession(page: PageCase) {
  seedAccess(page);

  const opened = await open(page);

  expect(outcomeOf(opened)).toBe(`NEXT_REDIRECT:${page.signIn}`);
  expect(mockNotFound).not.toHaveBeenCalled();
  expect(campaignDataQueries()).toEqual([]);
  // An anonymous caller costs no database read at all.
  expect(mockStore.reads).toEqual(NO_READS);
}

async function redirectsWithUnverifiableToken(page: PageCase) {
  seedAccess(page);
  presentUnverifiableToken();

  const opened = await open(page);

  expect(outcomeOf(opened)).toBe(`NEXT_REDIRECT:${page.signIn}`);
  expect(mockNotFound).not.toHaveBeenCalled();
  expect(campaignDataQueries()).toEqual([]);
  expect(mockStore.reads).toEqual(NO_READS);
}

async function notFoundWithNoAccess(page: PageCase) {
  // One thing differs from the permitted case: where user-1 belongs.
  seedAccess(page, { home: 'org-other' });
  signInAsUser1();

  const opened = await open(page);

  expect(outcomeOf(opened)).toBe('NEXT_NOT_FOUND');
  expect(mockRedirect).not.toHaveBeenCalled();
  expect(campaignDataQueries()).toEqual([]);
}

async function notFoundForUnknownOrganisation(page: PageCase) {
  // One thing differs from the permitted case: the organisation row is absent.
  seedAccess(page, { organisationExists: false });
  signInAsUser1();

  const opened = await open(page);

  expect(outcomeOf(opened)).toBe('NEXT_NOT_FOUND');
  expect(mockRedirect).not.toHaveBeenCalled();
  expect(campaignDataQueries()).toEqual([]);
}

async function rendersForPermittedUser(page: PageCase) {
  seedAccess(page);
  signInAsUser1();

  const opened = await open(page);

  expect(outcomeOf(opened)).toBe('rendered');
  const markup = opened.rendered
    ? renderToStaticMarkup(opened.element as ReactElement)
    : '';
  expect(markup).toContain(CAMPAIGN_NAME);
  expect(mockRedirect).not.toHaveBeenCalled();
  expect(mockNotFound).not.toHaveBeenCalled();

  // Every campaign-data query asks for the organisation the gate returned. The
  // campaign that comes back belongs to another organisation, so a later query
  // keyed on the campaign's own organisation, or on a slug join, shows up here.
  const queries = campaignDataQueries();
  expect(new Set(queries.map(query => query.model))).toEqual(
    new Set(['marketingAgencyCampaign', 'campaign', 'studioContentDraft'])
  );
  expect(
    queries.filter(query => query.organizationId !== page.organisationId)
  ).toEqual([]);
}

async function throwsWhenAccessReadFails(page: PageCase) {
  // The permitted case, with the access rule's read of the user failing.
  seedAccess(page);
  signInAsUser1();
  const planted = new Error('planted: the access read failed');
  mockStore.fail({ model: 'user' }, planted);

  const opened = await open(page);

  // The page rejects with the planted error itself: a failed check is never
  // shown as sign-in, as not-found, or as a rendered page.
  expect(opened.rendered ? 'rendered' : opened.error).toBe(planted);
  expect(mockRedirect).not.toHaveBeenCalled();
  expect(mockNotFound).not.toHaveBeenCalled();
  expect(campaignDataQueries()).toEqual([]);
}

describe('authority page (/dashboard/marketing-agency/[client]/authority)', () => {
  it('authority page redirects to sign-in when there is no session', () =>
    redirectsWithNoSession(AUTHORITY));

  it('authority page redirects to sign-in when the token cannot be verified', () =>
    redirectsWithUnverifiableToken(AUTHORITY));

  it('authority page gives not-found to a signed-in user with no access and reads no campaign data', () =>
    notFoundWithNoAccess(AUTHORITY));

  it('authority page gives not-found for an unknown organisation and reads no campaign data', () =>
    notFoundForUnknownOrganisation(AUTHORITY));

  it('authority page renders for a permitted user and filters every query by the organisation id', () =>
    rendersForPermittedUser(AUTHORITY));

  it('authority page throws when the access read fails', () =>
    throwsWhenAccessReadFails(AUTHORITY));
});

describe('ccw-eofy page (/dashboard/marketing-agency/ccw-eofy)', () => {
  it('ccw-eofy page redirects to sign-in when there is no session', () =>
    redirectsWithNoSession(CCW_EOFY));

  it('ccw-eofy page redirects to sign-in when the token cannot be verified', () =>
    redirectsWithUnverifiableToken(CCW_EOFY));

  it('ccw-eofy page gives not-found to a signed-in user with no access and reads no campaign data', () =>
    notFoundWithNoAccess(CCW_EOFY));

  it('ccw-eofy page gives not-found for an unknown organisation and reads no campaign data', () =>
    notFoundForUnknownOrganisation(CCW_EOFY));

  it('ccw-eofy page renders for a permitted user and filters every query by the organisation id', () =>
    rendersForPermittedUser(CCW_EOFY));

  it('ccw-eofy page throws when the access read fails', () =>
    throwsWhenAccessReadFails(CCW_EOFY));
});

describe('what a refused page request leaves behind', () => {
  it('writes exactly one warn line for a forbidden page request', async () => {
    seedAccess(AUTHORITY, { home: 'org-other' });
    signInAsUser1();

    const refused = await open(AUTHORITY);

    expect(mockLog.warn).toHaveBeenCalledTimes(1);
    expect(outcomeOf(refused)).toBe('NEXT_NOT_FOUND');
    // The line names who was refused, for which organisation, and why.
    expect(Object.values(logFields(mockLog.warn.mock.calls[0]))).toEqual(
      expect.arrayContaining(['user-1', 'restoreassist', 'access_check_false'])
    );

    // The paired permitted request writes no such line.
    mockLog.warn.mockClear();
    seedAccess(AUTHORITY);
    const permitted = await open(AUTHORITY);
    expect(outcomeOf(permitted)).toBe('rendered');
    expect(mockLog.warn).not.toHaveBeenCalled();
  });
});
