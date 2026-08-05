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

const invokeSkillMock = jest.fn();
jest.mock('@/lib/ai/skills', () => ({
  invokeSkill: (...args: unknown[]) => invokeSkillMock(...args),
}));

jest.mock('@/lib/rate-limit', () => ({
  aiGeneration: async (
    _req: unknown,
    handler: () => Promise<Response>
  ): Promise<Response> => handler(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { POST } from '@/app/api/marketing/ccw-boundary/route';

const VALID_REQUEST = {
  nexusBrand: 'DR',
  ccwBrand: 'CCW',
  promoType: 'T4-cross-promotion',
  vg71State: 'verified',
  l9CarveOutApplies: false,
  proposedAction:
    'Draft a T4 win-back that mentions CCW consumables to a DR audience.',
  objective:
    'Produce an H-4 boundary decision before any cross-portfolio promo runs.',
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
  invokeSkillMock.mockResolvedValue({
    skill: { slug: 'senior-strategist', name: 'Senior Strategist' },
    content: 'Structured SeniorStrategistDecision draft',
    model: 'mock-balanced',
    foundationIncluded: [{ filename: 'ceo-foundation.md', truncated: false }],
    foundationMissing: [],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  });
  createDraft.mockResolvedValue({
    id: 'draft-ccw-1',
    title: 'H-4 CCW boundary — DR ↔ CCW',
    status: 'review',
    content: 'Structured SeniorStrategistDecision draft',
    metadata: {
      skill: { slug: 'senior-strategist' },
      autoPublish: false,
      executesCrossPromo: false,
    },
    createdAt: new Date('2026-08-06T00:00:00.000Z'),
  });
});

describe('POST /api/marketing/ccw-boundary', () => {
  test('401 when unauthenticated', async () => {
    getUserIdMock.mockResolvedValue(null);

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(401);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 for an incomplete boundary request', async () => {
    const response = await POST(makeRequest({ nexusBrand: 'DR' }));

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 when ccwBrand is not CCW', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        ccwBrand: 'DR',
      })
    );

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
  });

  test('409 BLOCKs when VG-71 is verification-needed (no skill spend)', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        vg71State: 'verification-needed',
      })
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.gate).toMatchObject({
      id: 'VG-71',
      state: 'verification-needed',
      protocol: 'H-4',
      decision: 'BLOCKED',
    });
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('409 BLOCKs when VG-71 is hypothesis', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        vg71State: 'hypothesis',
      })
    );

    expect(response.status).toBe(409);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('201 invokes senior-strategist and stores an org-scoped review draft', async () => {
    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(201);
    expect(invokeSkillMock).toHaveBeenCalledWith({
      skill: 'senior-strategist',
      prompt: expect.stringContaining('Organisation ID: active-org'),
    });
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain('H-4');
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain('VG-71');
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain(
      'Nexus brand: DR'
    );
    expect(createDraft).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        organizationId: 'active-org',
        platform: 'governance',
        status: 'review',
        content: 'Structured SeniorStrategistDecision draft',
        metadata: expect.objectContaining({
          agencyTaskId: 'AT-024',
          protocol: 'H-4',
          vg71State: 'verified',
          autoPublish: false,
          executesCrossPromo: false,
        }),
      }),
    });

    const data = await response.json();
    expect(data.data.reviewState).toBe('pending_review');
    expect(data.data.gate.decision).toBe('pending_strategist_review');
    expect(data.data.draft.id).toBe('draft-ccw-1');
  });

  test('500 when senior-strategist cannot generate a decision', async () => {
    invokeSkillMock.mockRejectedValue(new Error('Provider unavailable'));

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(500);
    expect(createDraft).not.toHaveBeenCalled();
  });
});
