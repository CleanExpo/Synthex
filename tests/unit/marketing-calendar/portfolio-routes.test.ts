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
jest.mock('@/lib/prisma', () => ({
  prisma: {
    calendarPost: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
    user: { findUnique: (...a: unknown[]) => mockUserFind(...a) },
  },
}));

const mockIsOwner = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  isOwnerEmail: (...a: unknown[]) => mockIsOwner(...a),
}));

const mockApply = jest.fn();
jest.mock('@/lib/marketing-calendar/portfolio-seed', () => ({
  applyPortfolioSetup: (...a: unknown[]) => mockApply(...a),
  undoPortfolioSetup: jest.fn(),
  verifyPortfolioSetup: jest.fn(),
}));

import { POST as deliver } from '@/app/api/portfolio-calendar/video-delivery/route';
import { POST as adminPost } from '@/app/api/admin/portfolio-calendar/route';

const TOKEN = 'test-delivery-token-0123456789';
const validBody = {
  slotKey: '2026-11-02-business-card-video-1',
  videoUrl: 'https://cdn.example.test/v.mp4',
  sdaPassed: true,
  sdaVerdictId: 'sda-1',
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

  it('returns 404 for an unknown slot', async () => {
    mockFindFirst.mockResolvedValue(null);
    expect((await deliver(deliveryRequest(validBody, TOKEN))).status).toBe(404);
  });

  it('attaches the video and keeps the slot a draft pending approval', async () => {
    mockFindFirst.mockResolvedValue(draftSlot);
    mockUpdate.mockResolvedValue({});
    const res = await deliver(deliveryRequest(validBody, TOKEN));
    expect(res.status).toBe(200);
    const update = mockUpdate.mock.calls[0][0];
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

  it('rejects an unknown action and an undo without confirm with 400', async () => {
    mockUserFind.mockResolvedValue({ email: 'owner@example.test' });
    mockIsOwner.mockReturnValue(true);
    expect((await adminPost(adminRequest({ action: 'publish' }))).status).toBe(
      400
    );
    expect(
      (await adminPost(adminRequest({ action: 'undo', manifest: {} }))).status
    ).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
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
