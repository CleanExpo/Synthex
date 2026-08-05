const findUniqueUser = jest.fn();
const createDraft = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...args: unknown[]) => findUniqueUser(...args) },
    contentDraft: { create: (...args: unknown[]) => createDraft(...args) },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => getUserIdMock(...args),
}));

const getEffectiveOrganizationIdMock = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    getEffectiveOrganizationIdMock(...args),
}));

jest.mock('@/lib/rate-limit', () => ({
  mutation: async (
    _req: unknown,
    handler: () => Promise<Response>
  ): Promise<Response> => handler(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { POST } from '@/app/api/marketing/incident/route';

const VALID_REQUEST = {
  type: 'privacy-breach',
  canarySignal: 'RED',
  brand: 'RestoreAssist',
  summary: 'Suspected exposure of claimant contact details in an export job.',
  containmentStatus: 'in-progress',
};

function makeRequest(body: unknown) {
  return {
    json: async () => body,
  } as Parameters<typeof POST>[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue({
    organizationId: 'home-org',
    organization: { status: 'active' },
    teamMemberships: [],
  });
  getEffectiveOrganizationIdMock.mockResolvedValue('active-org');
  createDraft.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'draft-inc-1',
      title: data.title,
      status: data.status,
      content: data.content,
      metadata: data.metadata,
      createdAt: new Date('2026-08-06T00:00:00.000Z'),
    })
  );
});

describe('POST /api/marketing/incident', () => {
  test('401 when unauthenticated', async () => {
    getUserIdMock.mockResolvedValue(null);

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(401);
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 for an incomplete incident request', async () => {
    const response = await POST(makeRequest({ type: 'privacy-breach' }));

    expect(response.status).toBe(400);
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 when canarySignal is GREEN (not AMBER/RED)', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        canarySignal: 'GREEN',
      })
    );

    expect(response.status).toBe(400);
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('201 classifies, org-scopes, and stores pending_review without notify', async () => {
    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(201);
    expect(createDraft).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        organizationId: 'active-org',
        platform: 'governance',
        status: 'review',
        metadata: expect.objectContaining({
          agencyTaskId: 'AT-025',
          classifier: 'deterministic',
          severity: 1,
          notifyExternal: false,
          pageHuman: false,
          storeForReviewOnly: true,
          autoPublish: false,
          reviewState: 'pending_review',
        }),
      }),
    });

    const body = await response.json();
    expect(body.data.reviewState).toBe('pending_review');
    expect(body.data.classification.severity).toBe(1);
    expect(body.data.notification).toEqual({
      external: false,
      humanPaged: false,
      storeForReviewOnly: true,
    });
    expect(body.data.draft.id).toBe('draft-inc-1');
    expect(body.data.incidentId).toMatch(/^INC-\d{4}-\d{2}-\d{2}-[A-F0-9]{8}$/);
  });

  test('201 refuses proposedSeverity downgrade (default-higher)', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        type: 'customer-trust',
        canarySignal: 'AMBER',
        proposedSeverity: 3,
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.classification.severity).toBe(1);
    expect(body.data.classification.defaultedHigher).toBe(true);
    expect(createDraft.mock.calls[0][0].data.metadata.severity).toBe(1);
  });

  test('500 when draft persist fails', async () => {
    createDraft.mockRejectedValue(new Error('db down'));

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(500);
  });
});
