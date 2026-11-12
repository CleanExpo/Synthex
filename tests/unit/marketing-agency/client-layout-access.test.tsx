/**
 * The layout of /dashboard/marketing-agency/[client] calls the same gate as the
 * server pages below it (SYN-1412). It is the thinnest caller of the gate, so
 * the gate's five reads are each failed in turn here.
 *
 * How these tests are kept honest:
 *   - Only the layout is imported. The real gate and the real access rule run
 *     above the row store (tests/helpers/prisma-row-store.ts); neither is stood
 *     in for.
 *   - Users, organisations and ownerships are stored rows, decoys included.
 *   - Identity is the real cookie check over a mocked cookie jar, with a token
 *     signed at run time from the test secret.
 *   - redirect() and notFound() throw different errors, so one can never pass
 *     for the other.
 *   - A failed read is planted as one error object, and the layout must reject
 *     with that same object: a check that could not be made is never shown as
 *     sign-in, as not-found, or as a rendered page.
 */

import jwt from 'jsonwebtoken';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createPrismaRowStore,
  type RowStoreTarget,
} from '@/tests/helpers/prisma-row-store';

const mockStore = createPrismaRowStore();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  get default() {
    return mockStore.client;
  },
  get prisma() {
    return mockStore.client;
  },
}));

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

import ClientLayout from '@/app/dashboard/marketing-agency/[client]/layout';

const CLIENT = 'restoreassist';
const ORGANISATION_ID = 'org-ra';
const PARENT_ID = 'org-parent';
/** Where a caller with no valid session must be sent. */
const SIGN_IN =
  '/login?redirect=%2Fdashboard%2Fmarketing-agency%2Frestoreassist';
const CHILD_TEXT = 'The page inside the layout';

/**
 * Seed who exists. The caller is user-1, whose own organisation is `home`.
 * With the default, user-1 belongs to the layout's organisation directly.
 * Every case also carries decoys that must not count for user-1: another user
 * who is a member and an active owner of the layout's organisation; user-1's
 * own active ownership and owner row in ANOTHER organisation; user-1's
 * ownership of the layout's organisation that is no longer active; and user-1's
 * owner row on the team list, which alone gives no membership.
 */
function seedAccess({ home = ORGANISATION_ID }: { home?: string } = {}) {
  const accepted = new Date('2026-01-01T00:00:00.000Z');
  mockStore.seed({
    organization: [
      { id: PARENT_ID, name: 'Unite Group', slug: 'unite', parentOrgId: null },
      {
        id: 'org-other',
        name: 'Another Brand',
        slug: 'another-brand',
        parentOrgId: PARENT_ID,
      },
      {
        id: ORGANISATION_ID,
        name: 'The Layout Organisation',
        slug: CLIENT,
        parentOrgId: PARENT_ID,
      },
    ],
    user: [
      { id: 'user-1', organizationId: home, isMultiBusinessOwner: true },
      {
        id: 'user-2',
        organizationId: ORGANISATION_ID,
        isMultiBusinessOwner: true,
      },
    ],
    businessOwnership: [
      { ownerId: 'user-2', organizationId: ORGANISATION_ID, isActive: true },
      { ownerId: 'user-1', organizationId: 'org-other', isActive: true },
      { ownerId: 'user-1', organizationId: ORGANISATION_ID, isActive: false },
    ],
    teamMember: [
      {
        userId: 'user-1',
        organizationId: ORGANISATION_ID,
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

type Opened =
  | { rendered: true; element: unknown }
  | { rendered: false; error: unknown };

async function openLayout(): Promise<Opened> {
  try {
    const element = await ClientLayout({
      children: <p>{CHILD_TEXT}</p>,
      params: Promise.resolve({ client: CLIENT }),
    });
    return { rendered: true, element };
  } catch (error) {
    return { rendered: false, error };
  }
}

/** "rendered", or the message of what the layout threw. */
function outcomeOf(opened: Opened): string {
  if (opened.rendered) return 'rendered';
  return opened.error instanceof Error
    ? opened.error.message
    : String(opened.error);
}

const NO_READS = {
  user: 0,
  organization: 0,
  businessOwnership: 0,
  teamMember: 0,
  userRole: 0,
};

/**
 * The gate's five reads, each named by the question it asks and not by the
 * method that asks it. `organization` is read three times: by slug (the
 * lookup), by the layout organisation's id (its membership) and by the parent's
 * id (the parent workspace).
 */
const LOOKUP: RowStoreTarget = {
  model: 'organization',
  where: where => 'slug' in where,
};
const USER: RowStoreTarget = { model: 'user' };
const OWNERSHIP: RowStoreTarget = { model: 'businessOwnership' };
const MEMBERSHIP: RowStoreTarget = {
  model: 'organization',
  where: where => where.id === ORGANISATION_ID,
};
const PARENT: RowStoreTarget = {
  model: 'organization',
  where: where => where.id === PARENT_ID,
};

/**
 * The caller here is a member of the parent workspace only. The access rule
 * reaches all four of its reads for that caller and then permits, which the
 * first half of each case shows. One thing then differs: one read fails. Had
 * the failure been taken for "no access", the layout would show not-found.
 */
async function throwsWhenReadFails(target: RowStoreTarget) {
  seedAccess({ home: PARENT_ID });
  signInAsUser1();
  expect(outcomeOf(await openLayout())).toBe('rendered');

  const planted = new Error('planted: this read failed');
  mockStore.fail(target, planted);

  const opened = await openLayout();

  expect(opened.rendered ? 'rendered' : opened.error).toBe(planted);
  expect(mockRedirect).not.toHaveBeenCalled();
  expect(mockNotFound).not.toHaveBeenCalled();
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
});

afterEach(() => {
  // A query the row store does not know is a fault in the test set-up, even
  // when the code under test caught it and answered something plausible.
  expect(mockStore.usageErrors).toEqual([]);
});

describe('client layout (/dashboard/marketing-agency/[client])', () => {
  it('client layout redirects to sign-in when there is no session', async () => {
    // One thing differs from the permitted case: there is no session cookie.
    seedAccess();

    const opened = await openLayout();

    expect(outcomeOf(opened)).toBe(`NEXT_REDIRECT:${SIGN_IN}`);
    expect(mockNotFound).not.toHaveBeenCalled();
    // An anonymous caller costs no database read at all.
    expect(mockStore.reads).toEqual(NO_READS);
  });

  it('client layout gives not-found to a signed-in user with no access', async () => {
    // One thing differs from the permitted case: where user-1 belongs.
    seedAccess({ home: 'org-other' });
    signInAsUser1();

    const opened = await openLayout();

    expect(outcomeOf(opened)).toBe('NEXT_NOT_FOUND');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('client layout renders its children for a permitted user', async () => {
    seedAccess();
    signInAsUser1();

    const opened = await openLayout();

    expect(outcomeOf(opened)).toBe('rendered');
    const markup = opened.rendered
      ? renderToStaticMarkup(opened.element as ReactElement)
      : '';
    expect(markup).toContain(CHILD_TEXT);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockLog.warn).not.toHaveBeenCalled();
  });
});

describe('client layout when a read of the gate fails', () => {
  it('client layout throws the planted error when the organisation lookup fails', () =>
    throwsWhenReadFails(LOOKUP));

  it('client layout throws the planted error when the user read fails', () =>
    throwsWhenReadFails(USER));

  it('client layout throws the planted error when the ownership read fails', () =>
    throwsWhenReadFails(OWNERSHIP));

  it('client layout throws the planted error when the organisation membership read fails', () =>
    throwsWhenReadFails(MEMBERSHIP));

  it('client layout throws the planted error when the parent organisation read fails', () =>
    throwsWhenReadFails(PARENT));
});
