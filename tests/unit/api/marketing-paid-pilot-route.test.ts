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

import { POST } from '@/app/api/marketing/paid-pilot/route';

const VALID_REQUEST = {
  brandScope: 'RestoreAssist',
  channel: 'google-search',
  adAccountId: '123-456-7890',
  flywheelPosition: 'F-3 RA-secondary install acquisition',
  proposedSpendAud: 500,
  pilotCeilingAud: 500,
  singleVariable: 'ad creative angle',
  attState: 'verification-needed',
  privacyNutritionState: 'verification-needed',
  sourceOfTruthJobId: 'ra_install_job_v1',
  reallocationOnKill:
    'Revert capital to NRPG N4→N5 friction-test design (cro-specialist)',
  capitalAuthorisationRef: 'senior-cmo Q2 2026 R-C',
  objective:
    'Design a $500 RA cold-search pilot with kill threshold and no live spend.',
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
    skill: {
      slug: 'paid-performance-marketer',
      name: 'Paid Performance Marketer',
    },
    content: 'Structured PaidPerformanceMarketerProposal draft',
    model: 'mock-balanced',
    foundationIncluded: [{ filename: 'ceo-foundation.md', truncated: false }],
    foundationMissing: [],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  });
  createDraft.mockResolvedValue({
    id: 'draft-paid-1',
    title: 'google-search paid pilot — RestoreAssist',
    status: 'review',
    content: 'Structured PaidPerformanceMarketerProposal draft',
    metadata: {
      skill: { slug: 'paid-performance-marketer' },
      placesSpend: false,
    },
    createdAt: new Date('2026-08-06T00:00:00.000Z'),
  });
});

describe('POST /api/marketing/paid-pilot', () => {
  test('401 when unauthenticated', async () => {
    getUserIdMock.mockResolvedValue(null);

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(401);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 for an incomplete paid pilot request', async () => {
    const response = await POST(makeRequest({ brandScope: 'DR' }));

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('409 when brand has no paid-media ceiling (CARSI feed-only)', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        brandScope: 'CARSI',
        proposedSpendAud: 100,
        pilotCeilingAud: 100,
      })
    );

    expect(response.status).toBe(409);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('409 when proposed spend exceeds pilot ceiling', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        proposedSpendAud: 600,
        pilotCeilingAud: 500,
      })
    );

    expect(response.status).toBe(409);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('409 when requested ceiling exceeds Phase 1.2 brand max', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        brandScope: 'NRPG',
        proposedSpendAud: 500,
        pilotCeilingAud: 1_500,
      })
    );

    expect(response.status).toBe(409);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('201 invokes paid-performance-marketer and stores an org-scoped review draft', async () => {
    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(201);
    expect(invokeSkillMock).toHaveBeenCalledWith({
      skill: 'paid-performance-marketer',
      prompt: expect.stringContaining('Organisation ID: active-org'),
    });
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain(
      'Channel: google-search'
    );
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain(
      'Do not place spend'
    );
    expect(createDraft).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        organizationId: 'active-org',
        platform: 'paid',
        status: 'review',
        content: 'Structured PaidPerformanceMarketerProposal draft',
        metadata: expect.objectContaining({
          agencyTaskId: 'AT-016',
          autoPublish: false,
          placesSpend: false,
          brandScope: 'RestoreAssist',
          channel: 'google-search',
          proposedSpendAud: 500,
        }),
      }),
    });

    const data = await response.json();
    expect(data.data.reviewState).toBe('pending_review');
    expect(data.data.draft.id).toBe('draft-paid-1');
  });

  test('500 when paid-performance-marketer cannot generate a draft', async () => {
    invokeSkillMock.mockRejectedValue(new Error('Provider unavailable'));

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(500);
    expect(createDraft).not.toHaveBeenCalled();
  });
});
