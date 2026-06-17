/**
 * Unit test — POST /api/ugc/promote (backlog #6 close-out).
 *
 * This is the trigger that invokes the promoteApprovedSubmission worker, closing
 * the UGC loop (approved submission → ContentCalendar slot). Rather than mock the
 * worker, we mock prisma and let the real worker + persistPublishSlot run, so the
 * test exercises the whole route→worker→persist path.
 *
 * Covers the auth ladder (401 → 403 → 400) and the worker's typed-error mapping:
 *   submission not found / calendar not found → 404 (also the cross-org guard)
 *   submission not approved                   → 409
 *   no resolvable platform                    → 400
 *   happy path                                → 201 + appended slot persisted
 */

const findFirstUgc = jest.fn();
const findFirstCalendar = jest.fn();
const updateCalendar = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    ugcSubmission: {
      findFirst: (...a: unknown[]) => findFirstUgc(...a),
    },
    contentCalendar: {
      findFirst: (...a: unknown[]) => findFirstCalendar(...a),
      update: (...a: unknown[]) => updateCalendar(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => findUniqueUser(...a),
    },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { POST } from '@/app/api/ugc/promote/route';

const SCHEDULED = '2026-06-20T09:00:00.000Z';

function emptyCalendar() {
  return {
    id: 'cal-1',
    organizationId: 'org-1',
    slots: {
      weekStart: '2026-06-15',
      weekEnd: '2026-06-21',
      signalsVersion: '1.0',
      digestCount: 3,
      slots: [],
    },
  };
}

function makeRequest(body?: unknown) {
  return {
    nextUrl: {
      pathname: '/api/ugc/promote',
      searchParams: new URLSearchParams(''),
    },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    submissionId: 'ugc-1',
    calendarId: 'cal-1',
    scheduledAt: SCHEDULED,
    platform: 'instagram',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Authenticated owner of org-1.
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue({
    organizationId: 'org-1',
    teamMemberships: [],
  });
  // Default: an approved submission with a linked creator platform.
  findFirstUgc.mockResolvedValue({
    id: 'ugc-1',
    organizationId: 'org-1',
    status: 'approved',
    caption: 'Loved this! #ugc #review',
    creator: { platform: 'instagram' },
  });
  findFirstCalendar.mockResolvedValue(emptyCalendar());
  updateCalendar.mockResolvedValue({ id: 'cal-1' });
});

describe('POST /api/ugc/promote — auth ladder', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(401);
    expect(findFirstUgc).not.toHaveBeenCalled();
  });

  test('no organisation → 403', async () => {
    findUniqueUser.mockResolvedValue({ organizationId: null });
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(403);
    expect(findFirstUgc).not.toHaveBeenCalled();
  });

  test('bad body (missing calendarId) → 400', async () => {
    const res = await POST(
      makeRequest({ submissionId: 'ugc-1', scheduledAt: SCHEDULED })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(findFirstUgc).not.toHaveBeenCalled();
  });

  test('bad body (non-ISO scheduledAt) → 400', async () => {
    const res = await POST(makeRequest(validBody({ scheduledAt: 'tomorrow' })));
    expect(res.status).toBe(400);
    expect(findFirstUgc).not.toHaveBeenCalled();
  });

  test('unsupported platform → 400 (rejected by schema, worker not reached)', async () => {
    const res = await POST(makeRequest(validBody({ platform: 'myspace' })));
    expect(res.status).toBe(400);
    expect(findFirstUgc).not.toHaveBeenCalled();
  });
});

describe('POST /api/ugc/promote — worker error mapping', () => {
  test('submission not in caller org → 404 (cross-org guard)', async () => {
    findFirstUgc.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(404);
    // org-scope enforced on the submission read
    expect(findFirstUgc).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ugc-1', organizationId: 'org-1' },
      })
    );
    expect(updateCalendar).not.toHaveBeenCalled();
  });

  test('submission not approved → 409', async () => {
    findFirstUgc.mockResolvedValue({
      id: 'ugc-1',
      organizationId: 'org-1',
      status: 'pending',
      caption: 'x',
      creator: { platform: 'instagram' },
    });
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(409);
    expect(updateCalendar).not.toHaveBeenCalled();
  });

  test('no resolvable platform → 400', async () => {
    findFirstUgc.mockResolvedValue({
      id: 'ugc-1',
      organizationId: 'org-1',
      status: 'approved',
      caption: 'x',
      creator: null,
    });
    // omit platform from the body too → worker has nothing to fall back to
    const res = await POST(
      makeRequest({
        submissionId: 'ugc-1',
        calendarId: 'cal-1',
        scheduledAt: SCHEDULED,
      })
    );
    expect(res.status).toBe(400);
    expect(updateCalendar).not.toHaveBeenCalled();
  });

  test('calendar not in caller org → 404', async () => {
    findFirstCalendar.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(404);
    expect(updateCalendar).not.toHaveBeenCalled();
  });
});

describe('POST /api/ugc/promote — success', () => {
  test('approved submission → 201, appends a slot to the calendar', async () => {
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.promoted.submissionId).toBe('ugc-1');
    expect(body.promoted.calendarId).toBe('cal-1');
    expect(typeof body.promoted.slotId).toBe('string');

    // the worker persisted a new slot carrying the submission caption + platform
    const updateArg = updateCalendar.mock.calls[0][0];
    const persistedSlots = updateArg.data.slots.slots;
    expect(persistedSlots).toHaveLength(1);
    expect(persistedSlots[0].platform).toBe('instagram');
    expect(persistedSlots[0].captions[0]).toBe('Loved this! #ugc #review');
    expect(persistedSlots[0].hashtags).toEqual(['#ugc', '#review']);
  });

  test('falls back to the linked creator platform when body omits one', async () => {
    const res = await POST(
      makeRequest({
        submissionId: 'ugc-1',
        calendarId: 'cal-1',
        scheduledAt: SCHEDULED,
      })
    );
    expect(res.status).toBe(201);
    const updateArg = updateCalendar.mock.calls[0][0];
    expect(updateArg.data.slots.slots[0].platform).toBe('instagram');
  });
});
