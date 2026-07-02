/**
 * /api/content/calendar — org timezone threading
 *
 * PR #416 made CalendarService timezone-aware via its constructor
 * (`new CalendarService(orgId, timezone)`, defaulting to `Australia/Sydney`),
 * but the route still constructed it with the org id only — so the stored
 * `Organization.timezone` (prisma/schema.prisma) was never threaded in and
 * every org's optimal-time suggestions silently fell back to the Sydney
 * default.
 *
 * These tests lock in that the route:
 *  - GET: looks up the org's stored timezone and passes it into CalendarService
 *  - POST: same, so autoOptimize resolves peak hours in the team's zone
 *  - falls back to the constructor default when the org timezone is null
 */

const mockFindFirst = jest.fn(); // user membership check
const mockOrgFindUnique = jest.fn(); // organisation timezone lookup
const mockGetCalendarView = jest.fn();
const mockSchedulePost = jest.fn();
const calendarServiceCtor = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findFirst: mockFindFirst },
    organization: { findUnique: mockOrgFindUnique },
    approvalRequest: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

const mockGetUserId = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  __esModule: true,
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

// The route scopes the approval-status lookup to the caller's effective org.
// Resolve it to the same org under test so the timezone assertions below are
// unaffected by the org-scoping behaviour.
const mockGetEffectiveOrganizationId = jest.fn();

jest.mock('@/lib/multi-business/business-scope', () => ({
  __esModule: true,
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock the service so we can assert exactly what the route passes into the
// constructor. The instance only needs the methods the route calls.
jest.mock('@/lib/content/calendar-service', () => ({
  __esModule: true,
  CalendarService: class {
    constructor(orgId: string, timezone?: string) {
      calendarServiceCtor(orgId, timezone);
    }
    getCalendarView = mockGetCalendarView;
    schedulePost = mockSchedulePost;
  },
}));

import { GET, POST } from '@/app/api/content/calendar/route';
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const ORG = 'org_123';

beforeEach(() => {
  jest.clearAllMocks();
  // Authenticated user.
  mockGetUserId.mockResolvedValue('user-1');
  // User is a member of the org.
  mockFindFirst.mockResolvedValue({ id: 'user-1', organizationId: ORG });
  // Caller's effective org for approval-status scoping.
  mockGetEffectiveOrganizationId.mockResolvedValue(ORG);
  // Empty-but-valid calendar view.
  mockGetCalendarView.mockResolvedValue({
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    endDate: new Date('2026-06-07T00:00:00.000Z'),
    posts: [],
    timeSlots: [],
    conflicts: [],
    suggestions: [],
  });
  mockSchedulePost.mockResolvedValue({ id: 'post_1' });
});

function calendarGetRequest() {
  return createMockNextRequest({
    method: 'GET',
    url:
      `http://localhost/api/content/calendar?organizationId=${ORG}` +
      `&startDate=2026-06-01T00:00:00.000Z&endDate=2026-06-07T00:00:00.000Z`,
  });
}

describe('/api/content/calendar — GET threads org timezone into CalendarService', () => {
  it('passes the org\'s stored (non-Sydney) timezone into the constructor', async () => {
    mockOrgFindUnique.mockResolvedValue({ timezone: 'America/New_York' });

    const response = await GET(calendarGetRequest());
    expect(response.status).toBe(200);

    // The org timezone was looked up by id...
    expect(mockOrgFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORG },
        select: { timezone: true },
      })
    );
    // ...and threaded into CalendarService as the 2nd constructor arg.
    expect(calendarServiceCtor).toHaveBeenCalledWith(ORG, 'America/New_York');
  });

  it('falls back to the constructor default when the org timezone is null', async () => {
    mockOrgFindUnique.mockResolvedValue({ timezone: null });

    const response = await GET(calendarGetRequest());
    expect(response.status).toBe(200);

    // undefined is passed so CalendarService applies its Australia/Sydney default.
    expect(calendarServiceCtor).toHaveBeenCalledWith(ORG, undefined);
  });

  it('falls back to the constructor default when the org row is absent', async () => {
    mockOrgFindUnique.mockResolvedValue(null);

    const response = await GET(calendarGetRequest());
    expect(response.status).toBe(200);
    expect(calendarServiceCtor).toHaveBeenCalledWith(ORG, undefined);
  });
});

describe('/api/content/calendar — POST threads org timezone into CalendarService', () => {
  it('passes the org\'s stored timezone into the constructor', async () => {
    mockOrgFindUnique.mockResolvedValue({ timezone: 'Europe/London' });

    const request = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/content/calendar',
      body: {
        organizationId: ORG,
        content: 'Hello world',
        platforms: ['twitter'],
        scheduledFor: '2026-06-02T09:00:00.000Z',
        autoOptimize: true,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(calendarServiceCtor).toHaveBeenCalledWith(ORG, 'Europe/London');
  });
});
