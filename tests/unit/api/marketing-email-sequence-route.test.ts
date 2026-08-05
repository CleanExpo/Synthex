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

import { POST } from '@/app/api/marketing/email-sequence/route';

const VALID_REQUEST = {
  triggerId: 'T1',
  brandScope: 'RestoreAssist',
  sourceSignal: 'A1 install event',
  audienceId: 'RA-audience-2',
  audienceEvidenceRef: 'Phase 3.2.1.2',
  touchesSoFar7d: 1,
  capWindowResetsAt: '2026-08-12T09:00:00.000Z',
  espSetupState: 'verified',
  espGateId: 'VG-90',
  complianceOverrideActive: false,
  objective: 'Help new customers complete their first claim.',
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
    skill: { slug: 'email-specialist', name: 'Email Specialist' },
    content: 'Structured email sequence draft',
    model: 'mock-balanced',
    foundationIncluded: [{ filename: 'ceo-foundation.md', truncated: false }],
    foundationMissing: [],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  });
  createDraft.mockResolvedValue({
    id: 'draft-1',
    title: 'T1 email sequence — RestoreAssist',
    status: 'review',
    content: 'Structured email sequence draft',
    metadata: { skill: { slug: 'email-specialist' } },
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
  });
});

describe('POST /api/marketing/email-sequence', () => {
  test('401 when unauthenticated', async () => {
    getUserIdMock.mockResolvedValue(null);

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(401);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 for an incomplete email sequence request', async () => {
    const response = await POST(makeRequest({ triggerId: 'T1' }));

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('409 when the frequency cap has been reached', async () => {
    const response = await POST(
      makeRequest({ ...VALID_REQUEST, touchesSoFar7d: 3 })
    );

    expect(response.status).toBe(409);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('409 for a paused trigger during a compliance override', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        triggerId: 'T3',
        complianceOverrideActive: true,
      })
    );

    expect(response.status).toBe(409);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('201 invokes email-specialist and stores an org-scoped review draft', async () => {
    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(201);
    expect(invokeSkillMock).toHaveBeenCalledWith({
      skill: 'email-specialist',
      prompt: expect.stringContaining('Organisation ID: active-org'),
    });
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain(
      'Touches used in trailing 7-day window: 1/3'
    );
    expect(createDraft).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        organizationId: 'active-org',
        platform: 'email',
        status: 'review',
        content: 'Structured email sequence draft',
      }),
    });

    const data = await response.json();
    expect(data.data.reviewState).toBe('pending_review');
    expect(data.data.draft.id).toBe('draft-1');
  });

  test('500 when email-specialist cannot generate a draft', async () => {
    invokeSkillMock.mockRejectedValue(new Error('Provider unavailable'));

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(500);
    expect(createDraft).not.toHaveBeenCalled();
  });
});
