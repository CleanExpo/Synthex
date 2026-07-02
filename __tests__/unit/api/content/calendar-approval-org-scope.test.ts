/**
 * Unit tests — content calendar approval-status org scoping
 *
 * Regression coverage for a cross-org approval-status leak in the calendar GET
 * handler. `app/api/content/calendar/route.ts` enhances each calendar post with
 * its ApprovalRequest status. `ApprovalRequest.contentId` is a loose string
 * reference (not a DB foreign key), so the lookup MUST be scoped to the
 * caller's effective organisation — otherwise a foreign-org ApprovalRequest
 * sharing a contentId value could surface its approval status.
 *
 * These tests drive the REAL GET handler and emulate the DB org filter inside
 * the prisma mock (rows are only returned when the queried organizationId
 * matches the row's org), so they verify behaviour, not just the where-clause
 * argument:
 *   1. an approval whose content is in a DIFFERENT org is NOT exposed
 *   2. a same-org approval status still surfaces
 *   3. the no-approval fallback is preserved (no approval rows → undefined)
 */

import { GET } from '@/app/api/content/calendar/route';

// ---- Mocks ----------------------------------------------------------------

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: jest.fn(),
}));

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: jest.fn(),
}));

jest.mock('@/lib/content/calendar-service', () => ({
  CalendarService: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: jest.fn() },
    organization: { findUnique: jest.fn() },
    approvalRequest: { findMany: jest.fn() },
  },
}));

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { CalendarService } from '@/lib/content/calendar-service';
import { prisma } from '@/lib/prisma';

const mockedGetUserId = getUserIdFromRequestOrCookies as jest.Mock;
const mockedGetEffectiveOrg = getEffectiveOrganizationId as jest.Mock;
const mockedCalendarService = CalendarService as unknown as jest.Mock;
const mockedPrisma = prisma as unknown as {
  user: { findFirst: jest.Mock };
  organization: { findUnique: jest.Mock };
  approvalRequest: { findMany: jest.Mock };
};

const USER_ID = 'user_1';
const ORG_ID = 'org_active';
const OTHER_ORG_ID = 'org_other';
const POST_ID = 'post_shared_id';

function buildRequest(orgId: string = ORG_ID) {
  const u = new URL(
    `https://synthex.social/api/content/calendar?organizationId=${orgId}` +
      `&startDate=2026-01-01&endDate=2026-01-07`
  );
  return {
    url: u.toString(),
    nextUrl: u,
  } as unknown as Parameters<typeof GET>[0];
}

/**
 * Stub a calendar view with a single post. The handler reads
 * `view.posts[].{id,status}` and a few `.filter` calls; supply the minimum.
 */
function stubCalendarView(postId: string) {
  mockedCalendarService.mockImplementation(() => ({
    getCalendarView: jest.fn().mockResolvedValue({
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-07'),
      posts: [{ id: postId, status: 'scheduled' }],
      conflicts: [],
      suggestions: [],
    }),
  }));
}

describe('content calendar — approval-status org scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetUserId.mockResolvedValue(USER_ID);
    // isOrgMember → member of the requested org
    mockedPrisma.user.findFirst.mockResolvedValue({ id: USER_ID });
    // getOrgTimezone → no stored timezone (exercises the fallback path)
    mockedPrisma.organization.findUnique.mockResolvedValue(null);
    // effective org = the caller's active brand
    mockedGetEffectiveOrg.mockResolvedValue(ORG_ID);
    stubCalendarView(POST_ID);

    // Emulate the DB org filter: only return the row when the queried
    // organizationId matches the row's org. The "leaky" foreign-org row lives
    // in OTHER_ORG_ID, so a correctly-scoped query (organizationId === ORG_ID)
    // returns nothing for it.
    mockedPrisma.approvalRequest.findMany.mockImplementation(
      async (args: { where?: { organizationId?: string } }) => {
        const queriedOrg = args?.where?.organizationId;
        const allRows = [
          {
            id: 'appr_other',
            contentId: POST_ID,
            status: 'approved',
            organizationId: OTHER_ORG_ID,
          },
        ];
        return allRows.filter(r => r.organizationId === queriedOrg);
      }
    );
  });

  it('does NOT expose an approval whose content belongs to a different org', async () => {
    const res = await GET(buildRequest());
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      calendar: {
        posts: Array<{
          id: string;
          approvalStatus?: string;
          approvalId?: string;
        }>;
        stats: { pendingApprovals: number };
      };
    };

    // The lookup must be scoped to the caller's effective org.
    expect(mockedPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contentId: { in: [POST_ID] },
          contentType: 'post',
          organizationId: ORG_ID,
        }),
      })
    );

    const post = body.calendar.posts.find(p => p.id === POST_ID);
    expect(post).toBeDefined();
    // Foreign-org approval status must NOT leak through.
    expect(post?.approvalStatus).toBeUndefined();
    expect(post?.approvalId).toBeUndefined();
    expect(body.calendar.stats.pendingApprovals).toBe(0);
  });

  it('surfaces approval status for content in the caller’s own org', async () => {
    // Same-org approval row.
    mockedPrisma.approvalRequest.findMany.mockImplementation(
      async (args: { where?: { organizationId?: string } }) => {
        const queriedOrg = args?.where?.organizationId;
        const allRows = [
          {
            id: 'appr_mine',
            contentId: POST_ID,
            status: 'in_review',
            organizationId: ORG_ID,
          },
        ];
        return allRows.filter(r => r.organizationId === queriedOrg);
      }
    );

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      calendar: {
        posts: Array<{
          id: string;
          approvalStatus?: string;
          approvalId?: string;
        }>;
        stats: { pendingApprovals: number };
      };
    };

    const post = body.calendar.posts.find(p => p.id === POST_ID);
    expect(post?.approvalStatus).toBe('in_review');
    expect(post?.approvalId).toBe('appr_mine');
    expect(body.calendar.stats.pendingApprovals).toBe(1);
  });

  it('falls back to the request org when no effective org resolves, and preserves the no-approval fallback', async () => {
    // No effective org context → handler falls back to the membership-verified
    // request organizationId.
    mockedGetEffectiveOrg.mockResolvedValue(null);
    mockedPrisma.approvalRequest.findMany.mockResolvedValue([]);

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);

    expect(mockedPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      })
    );

    const body = (await res.json()) as {
      calendar: {
        posts: Array<{
          id: string;
          approvalStatus?: string;
          approvalId?: string;
        }>;
        stats: { pendingApprovals: number };
      };
    };
    const post = body.calendar.posts.find(p => p.id === POST_ID);
    // No approval rows → approval fields remain undefined (fallback preserved).
    expect(post?.approvalStatus).toBeUndefined();
    expect(post?.approvalId).toBeUndefined();
    expect(body.calendar.stats.pendingApprovals).toBe(0);
  });
});
