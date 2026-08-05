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

import { POST } from '@/app/api/marketing/cro-proposal/route';

const VALID_REQUEST = {
  brandScope: 'DR',
  funnelStep: 'D3→D4',
  frictionId: 'F-DR-D34-trust-block',
  gapAuditId: 'Gap-3',
  verificationState: 'verified-via-Gap-audit',
  metric: 'D3→D4 step-conversion',
  observedValue: 0.41,
  baselineValue: 1.8,
  baselineSource: 'CCW Hub→Cart 1.8% (Q3.4.4 reference)',
  metricSource: 'GA4 G-DR-PROD',
  window: '2026-03-28/2026-04-25',
  sampleSize: 4217,
  audienceEvidenceRef: 'Phase 3.2.1.2 audience #1',
  objective:
    'Design a single-variable trust-block re-order test with kill threshold.',
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
    skill: { slug: 'cro-specialist', name: 'CRO Specialist' },
    content: 'Structured CroProposalOutput draft',
    model: 'mock-balanced',
    foundationIncluded: [{ filename: 'ceo-foundation.md', truncated: false }],
    foundationMissing: [],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  });
  createDraft.mockResolvedValue({
    id: 'draft-cro-1',
    title: 'F-DR-D34-trust-block CRO proposal — DR',
    status: 'review',
    content: 'Structured CroProposalOutput draft',
    metadata: { skill: { slug: 'cro-specialist' }, autoPublish: false },
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
  });
});

describe('POST /api/marketing/cro-proposal', () => {
  test('401 when unauthenticated', async () => {
    getUserIdMock.mockResolvedValue(null);

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(401);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 for an incomplete CRO proposal request', async () => {
    const response = await POST(makeRequest({ brandScope: 'DR' }));

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 when verification state is hypothesis', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        verificationState: 'hypothesis',
      })
    );

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('201 invokes cro-specialist and stores an org-scoped review draft', async () => {
    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(201);
    expect(invokeSkillMock).toHaveBeenCalledWith({
      skill: 'cro-specialist',
      prompt: expect.stringContaining('Organisation ID: active-org'),
    });
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain(
      'Friction ID: F-DR-D34-trust-block'
    );
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain('Gap-3');
    expect(createDraft).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        organizationId: 'active-org',
        platform: 'cro',
        status: 'review',
        content: 'Structured CroProposalOutput draft',
        metadata: expect.objectContaining({
          agencyTaskId: 'AT-011',
          autoPublish: false,
          frictionId: 'F-DR-D34-trust-block',
          verificationState: 'verified-via-Gap-audit',
        }),
      }),
    });

    const data = await response.json();
    expect(data.data.reviewState).toBe('pending_review');
    expect(data.data.draft.id).toBe('draft-cro-1');
  });

  test('500 when cro-specialist cannot generate a draft', async () => {
    invokeSkillMock.mockRejectedValue(new Error('Provider unavailable'));

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(500);
    expect(createDraft).not.toHaveBeenCalled();
  });
});
