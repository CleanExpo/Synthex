/**
 * Auth and safety guards for the portfolio calendar routes:
 *   - POST /api/portfolio-calendar/video-delivery (short-form engine hand-off)
 *   - GET/POST /api/admin/portfolio-calendar (owner-only setup)
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  DEFAULT_POLICIES: {
    SERVICE_WRITE: { __policy: 'SERVICE_WRITE' },
    AUTHENTICATED_READ: { __policy: 'AUTHENTICATED_READ' },
    AUTHENTICATED_WRITE: { __policy: 'AUTHENTICATED_WRITE' },
  },
  APISecurityChecker: { check: (...a: unknown[]) => mockCheck(...a) },
}));

const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
const mockUserFind = jest.fn();
const mockOrgFind = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findMany: (...a: unknown[]) => mockOrgFind(...a) },
    calendarPost: {
      // The delivery lookup reads up to two rows; one mocked row is a unique slot.
      findMany: async (...a: unknown[]) => {
        const row = await mockFindFirst(...a);
        return Array.isArray(row) ? row : row ? [row] : [];
      },
      updateMany: (...a: unknown[]) => mockUpdate(...a),
    },
    user: { findUnique: (...a: unknown[]) => mockUserFind(...a) },
  },
}));

const mockIsOwner = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  isOwnerEmail: (...a: unknown[]) => mockIsOwner(...a),
}));

const mockApply = jest.fn();
const mockUndo = jest.fn();
const mockVerify = jest.fn();
jest.mock('@/lib/marketing-calendar/portfolio-seed', () => ({
  applyPortfolioSetup: (...a: unknown[]) => mockApply(...a),
  undoPortfolioSetup: (...a: unknown[]) => mockUndo(...a),
  verifyPortfolioSetup: (...a: unknown[]) => mockVerify(...a),
}));

import { POST as deliver } from '@/app/api/portfolio-calendar/video-delivery/route';
import {
  GET as adminGet,
  POST as adminPost,
} from '@/app/api/admin/portfolio-calendar/route';

const TOKEN = 'test-delivery-token-0123456789';
const validBody = {
  slotKey: '2026-11-02-business-card-video-1',
  videoUrl: 'https://cdn.example.test/v.mp4',
  sdaPassed: true,
  sdaVerdictId: 'sda-1',
};
const root = {
  id: 'org-ug',
  slug: 'unite-group',
  status: 'active',
  parentOrgId: null,
};
const businessCard = {
  id: 'org-bc',
  slug: 'business-card',
  status: 'active',
  parentOrgId: 'org-ug',
};
const draftSlot = {
  id: 'post-1',
  status: 'draft',
  mediaUrls: [] as string[],
  metadata: { slotKey: validBody.slotKey, slotKind: 'shortform_video' },
};

function deliveryRequest(body: unknown, token?: string) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/portfolio-calendar/video-delivery',
    headers: token ? { 'x-delivery-token': token } : {},
    body: body as object,
  }) as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
  process.env.SHORTFORM_DELIVERY_TOKEN = TOKEN;
  mockOrgFind.mockResolvedValue([root, businessCard]);
});

describe('POST /api/portfolio-calendar/video-delivery', () => {
  it('answers 503 not provisioned when the delivery token is not configured', async () => {
    delete process.env.SHORTFORM_DELIVERY_TOKEN;
    const res = await deliver(deliveryRequest(validBody, TOKEN));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('FEATURE_NOT_PROVISIONED');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects a missing or wrong token with 401', async () => {
    expect((await deliver(deliveryRequest(validBody))).status).toBe(401);
    expect(
      (await deliver(deliveryRequest(validBody, `${TOKEN}x`))).status
    ).toBe(401);
    // Same length as the real token, so only the constant-time compare can refuse it.
    const sameLength = `${TOKEN.slice(0, -1)}${TOKEN.endsWith('9') ? '8' : '9'}`;
    expect(sameLength).toHaveLength(TOKEN.length);
    expect((await deliver(deliveryRequest(validBody, sameLength))).status).toBe(
      401
    );
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('refuses a video whose SDA gate did not pass', async () => {
    const res = await deliver(
      deliveryRequest({ ...validBody, sdaPassed: false }, TOKEN)
    );
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('refuses a non-https video URL', async () => {
    const res = await deliver(
      deliveryRequest({ ...validBody, videoUrl: 'http://x.test/v.mp4' }, TOKEN)
    );
    expect(res.status).toBe(400);
  });

  it('refuses a slot that has moved past draft', async () => {
    mockFindFirst.mockResolvedValue({ ...draftSlot, status: 'scheduled' });
    const res = await deliver(deliveryRequest(validBody, TOKEN));
    expect(res.status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('refuses (409) when two rows claim the same slot key, writing nothing', async () => {
    mockFindFirst.mockResolvedValue([
      draftSlot,
      { ...draftSlot, id: 'post-2' },
    ]);
    const res = await deliver(deliveryRequest(validBody, TOKEN));
    expect(res.status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('never touches a slot under an org outside the Unite Group workspace', async () => {
    mockOrgFind.mockResolvedValue([
      root,
      { ...businessCard, parentOrgId: 'outside-parent' },
    ]);
    mockFindFirst.mockResolvedValue(draftSlot);
    const res = await deliver(deliveryRequest(validBody, TOKEN));
    expect(res.status).toBe(404);
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for a slot key that is not in the plan', async () => {
    mockFindFirst.mockResolvedValue(draftSlot);
    const res = await deliver(
      deliveryRequest(
        { ...validBody, slotKey: '2026-11-02-outsider-video-1' },
        TOKEN
      )
    );
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown slot', async () => {
    mockFindFirst.mockResolvedValue(null);
    expect((await deliver(deliveryRequest(validBody, TOKEN))).status).toBe(404);
  });

  it('attaches the video and keeps the slot a draft pending approval', async () => {
    mockFindFirst.mockResolvedValue(draftSlot);
    mockUpdate.mockResolvedValue({ count: 1 });
    const res = await deliver(deliveryRequest(validBody, TOKEN));
    expect(res.status).toBe(200);
    const update = mockUpdate.mock.calls[0][0];
    // The write itself re-checks draft and empty media, so a race cannot slip past.
    expect(mockFindFirst.mock.calls[0][0].where).toMatchObject({
      organizationId: 'org-bc',
    });
    expect(update.where).toMatchObject({
      id: 'post-1',
      organizationId: 'org-bc',
      status: 'draft',
      mediaUrls: { isEmpty: true },
    });
    expect(update.data.mediaUrls).toEqual([validBody.videoUrl]);
    expect(update.data).not.toHaveProperty('status');
    expect(update.data).not.toHaveProperty('scheduledFor');
    expect(update.data.metadata.videoDelivery).toMatchObject({
      status: 'delivered',
      sdaVerdictId: 'sda-1',
    });
    expect(update.data.metadata.approvalState).toBe('pending_approval');
  });

  it('is idempotent for the same video and refuses to overwrite a different one', async () => {
    mockFindFirst.mockResolvedValue({
      ...draftSlot,
      mediaUrls: [validBody.videoUrl],
    });
    expect(
      (await (await deliver(deliveryRequest(validBody, TOKEN))).json()).outcome
    ).toBe('unchanged');
    mockFindFirst.mockResolvedValue({
      ...draftSlot,
      mediaUrls: ['https://cdn.example.test/other.mp4'],
    });
    expect((await deliver(deliveryRequest(validBody, TOKEN))).status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('answers 409 when the slot changes between the read and the write', async () => {
    mockFindFirst.mockResolvedValue(draftSlot);
    mockUpdate.mockResolvedValue({ count: 0 }); // scheduled or filled meanwhile
    const res = await deliver(deliveryRequest(validBody, TOKEN));
    expect(res.status).toBe(409);
  });
});

describe('GET /api/admin/portfolio-calendar', () => {
  it('reads posts only from workspace orgs, never one that shares a brand slug', async () => {
    mockUserFind.mockResolvedValue({ email: 'owner@example.test' });
    mockIsOwner.mockReturnValue(true);
    mockOrgFind.mockResolvedValue([
      root,
      { ...businessCard, id: 'org-outsider', parentOrgId: 'outside-parent' },
    ]);
    mockFindFirst.mockResolvedValue([]);
    mockVerify.mockResolvedValue({
      ok: true,
      checks: [{ label: 'c', pass: true }],
    });
    const res = await adminGet(
      createMockNextRequest({
        method: 'GET',
        url: 'http://localhost/api/admin/portfolio-calendar',
      }) as never
    );
    expect(res.status).toBe(200);
    expect(mockFindFirst.mock.calls[0][0].where.organizationId).toEqual({
      in: ['org-ug'],
    });
    // The page reads data.verify.checks; a GET without it would blank it.
    const body = await res.json();
    expect(body.verify).toEqual({
      ok: true,
      checks: [{ label: 'c', pass: true }],
    });
  });
});

describe('POST /api/admin/portfolio-calendar', () => {
  const adminRequest = (body: unknown) =>
    createMockNextRequest({
      method: 'POST',
      url: 'http://localhost/api/admin/portfolio-calendar',
      body: body as object,
    }) as never;

  it('rejects an unauthenticated caller with 401', async () => {
    mockCheck.mockResolvedValue({ allowed: false });
    expect((await adminPost(adminRequest({ action: 'apply' }))).status).toBe(
      401
    );
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('rejects a signed-in user who is not an owner with 403', async () => {
    mockUserFind.mockResolvedValue({ email: 'someone@example.test' });
    mockIsOwner.mockReturnValue(false);
    expect((await adminPost(adminRequest({ action: 'apply' }))).status).toBe(
      403
    );
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('rejects an unknown action, and refuses undo over the API even when confirmed', async () => {
    mockUserFind.mockResolvedValue({ email: 'owner@example.test' });
    mockIsOwner.mockReturnValue(true);
    expect((await adminPost(adminRequest({ action: 'publish' }))).status).toBe(
      400
    );
    const manifest = {
      planVersion: 'x',
      createdOrganizations: [],
      updatedOrganizations: [],
      teamMembers: [],
      businessOwnerships: [],
      brandDna: [],
      clientProfiles: [
        { id: 'victim-profile', orgSlug: 'carsi', created: true, before: null },
      ],
      calendarPosts: [],
    };
    expect(
      (
        await adminPost(
          adminRequest({ action: 'undo', manifest, confirm: true })
        )
      ).status
    ).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
    expect(mockUndo).not.toHaveBeenCalled();
  });

  it('runs preview as a dry run and apply as a write for an owner', async () => {
    mockUserFind.mockResolvedValue({ email: 'owner@example.test' });
    mockIsOwner.mockReturnValue(true);
    mockApply.mockResolvedValue({
      calendarPosts: [],
      createdOrganizations: [],
      log: [],
    });
    expect((await adminPost(adminRequest({ action: 'preview' }))).status).toBe(
      200
    );
    expect(mockApply).toHaveBeenLastCalledWith({
      write: false,
      ownerUserId: 'u1',
    });
    expect((await adminPost(adminRequest({ action: 'apply' }))).status).toBe(
      200
    );
    expect(mockApply).toHaveBeenLastCalledWith({
      write: true,
      ownerUserId: 'u1',
    });
  });
});
