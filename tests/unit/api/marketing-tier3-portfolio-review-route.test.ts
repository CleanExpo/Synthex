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

import { POST } from '@/app/api/marketing/tier3-portfolio-review/route';

const VALID_REQUEST = {
  cadence: 'tier-3-quarterly',
  quarterLabel: 'Q2 2026',
  windowStart: '2026-04-01',
  windowEnd: '2026-06-30',
  brandScopeInReview: ['DR', 'NRPG', 'RestoreAssist', 'CARSI'],
  crossClientBoundaryCheck: 'nexus-only',
  upstreamInputSummary:
    '13 weeks AnalyticsLeadOutput + Tier-1 weekly canaries + Q1 Tier-3 baseline from performance-attribution-lead.',
  objective:
    'Produce the Q2 Tier-3 portfolio P&L narrative with reallocation criterion and kill thresholds.',
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
    skill: { slug: 'senior-cmo', name: 'Senior CMO' },
    content: 'Structured SeniorCMODecision draft',
    model: 'mock-balanced',
    foundationIncluded: [
      { filename: 'ceo-foundation.md', truncated: false },
      { filename: 'verification-gates.md', truncated: false },
    ],
    foundationMissing: [],
    usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
  });
  createDraft.mockResolvedValue({
    id: 'draft-tier3-1',
    title: 'Tier-3 portfolio review — Q2 2026',
    status: 'review',
    content: 'Structured SeniorCMODecision draft',
    metadata: { skill: { slug: 'senior-cmo' }, autoPublish: false },
    createdAt: new Date('2026-08-06T00:00:00.000Z'),
  });
});

describe('POST /api/marketing/tier3-portfolio-review', () => {
  test('401 when unauthenticated', async () => {
    getUserIdMock.mockResolvedValue(null);

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(401);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 for an incomplete Tier-3 request', async () => {
    const response = await POST(makeRequest({ cadence: 'tier-3-quarterly' }));

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 when cadence is not tier-3-quarterly', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        cadence: 'p-and-l-narrative',
      })
    );

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
  });

  test('409 when Nexus brands are mixed with CCW', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        brandScopeInReview: ['DR', 'CCW'],
        crossClientBoundaryCheck: 'nexus-only',
      })
    );

    expect(response.status).toBe(409);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('201 invokes senior-cmo and stores an org-scoped review draft', async () => {
    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(201);
    expect(invokeSkillMock).toHaveBeenCalledWith({
      skill: 'senior-cmo',
      prompt: expect.stringContaining('Organisation ID: active-org'),
    });
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain(
      'Cadence: tier-3-quarterly'
    );
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain('Q2 2026');
    expect(createDraft).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        organizationId: 'active-org',
        platform: 'cmo',
        status: 'review',
        content: 'Structured SeniorCMODecision draft',
        metadata: expect.objectContaining({
          agencyTaskId: 'AT-008',
          relatedTaskIds: ['AT-022'],
          autoPublish: false,
          reallocatesCapital: false,
          crossClientBoundaryCheck: 'nexus-only',
        }),
      }),
    });

    const data = await response.json();
    expect(data.data.reviewState).toBe('pending_review');
    expect(data.data.draft.id).toBe('draft-tier3-1');
  });

  test('500 when senior-cmo cannot generate a draft', async () => {
    invokeSkillMock.mockRejectedValue(new Error('Provider unavailable'));

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(500);
    expect(createDraft).not.toHaveBeenCalled();
  });
});
