/**
 * Unit test for the marketing orchestrator API + review gate (SYN-967).
 *
 * Covers the auth/validation matrix and the pending-review envelope:
 *   401 unauth · 403 non-admin (collaborator) · 400 bad brief ·
 *   200 valid brief → pending_review set (orchestrator mocked — deterministic,
 *   no live provider).
 */

const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueUser(...args),
    },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => getUserIdMock(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const generateMock = jest.fn();
jest.mock('@/lib/marketing-agency/full-campaign-generator', () => ({
  generateFullAuthorityCampaign: (...args: unknown[]) => generateMock(...args),
}));

const invokeSkillMock = jest.fn();
jest.mock('@/lib/ai/skills', () => ({
  invokeSkill: (...args: unknown[]) => invokeSkillMock(...args),
}));

import { POST } from '@/app/api/marketing/orchestrate/route';

const OWNER_USER = { organizationId: 'org-1', teamMemberships: [] };
const COLLABORATOR_USER = {
  organizationId: 'org-1',
  teamMemberships: [{ role: 'collaborator', organizationId: 'org-1' }],
};

function makeRequest(body: unknown) {
  return {
    nextUrl: {
      pathname: '/api/marketing/orchestrate',
      searchParams: new URLSearchParams(),
    },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

const VALID_BRIEF = {
  business: {
    slug: 'ccw',
    name: 'CCW',
    positioning:
      'Evidence-led restoration marketing for Australian professionals.',
    audience: ['Restoration business owners'],
    offers: ['EOFY authority campaign'],
    voiceRules: ['Plain Australian English'],
    forbiddenClaims: ['guaranteed rankings'],
  },
  objective: 'Build organic authority ahead of EOFY.',
  horizonDays: 7,
  sources: [],
};

function fakePack() {
  return {
    campaignId: 'ccw-abc',
    generatedAt: '2026-07-04T00:00:00.000Z',
    drafts: Array.from({ length: 7 }, (_, i) => ({
      slotId: `ccw-abc-0${i + 1}`,
      channel: 'linkedin',
      title: `Draft ${i + 1}`,
      body: 'body',
      cta: 'cta',
      evidenceRefs: [],
      assetBrief: 'brief',
      publishInstruction: 'hold',
    })),
    calendar: [],
    evidenceManifest: { manifestId: 'ccw-abc-evidence' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue(OWNER_USER);
  generateMock.mockReturnValue(fakePack());
  invokeSkillMock.mockResolvedValue({
    skill: { slug: 'senior-strategist', name: 'Senior Strategist' },
    content: 'Prioritise LinkedIn before newsletter.',
    model: 'mock-balanced',
    foundationIncluded: [{ filename: 'ceo-foundation.md', truncated: false }],
    foundationMissing: [],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  });
});

describe('POST /api/marketing/orchestrate', () => {
  test('401 when unauthenticated', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BRIEF));
    expect(res.status).toBe(401);
    expect(generateMock).not.toHaveBeenCalled();
  });

  test('403 when caller is a non-admin collaborator', async () => {
    findUniqueUser.mockResolvedValue(COLLABORATOR_USER);
    const res = await POST(makeRequest(VALID_BRIEF));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Forbidden');
    expect(generateMock).not.toHaveBeenCalled();
  });

  test('400 when the brief is invalid', async () => {
    const res = await POST(makeRequest({ objective: 'no business' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
    expect(data.details).toBeDefined();
    expect(generateMock).not.toHaveBeenCalled();
  });

  test('200 valid brief → 7-asset set in pending_review state', async () => {
    const res = await POST(makeRequest(VALID_BRIEF));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.data.reviewState).toBe('pending_review');
    expect(data.data.assetCount).toBe(7);
    expect(data.data.set.drafts).toHaveLength(7);
    expect(data.data.skillContribution).toBeUndefined();

    // Orchestrator was called with the mapped brief (org-scoped, horizon 7).
    expect(generateMock).toHaveBeenCalledTimes(1);
    const input = generateMock.mock.calls[0][0];
    expect(input.business.slug).toBe('ccw');
    expect(input.objective).toBe('Build organic authority ahead of EOFY.');
    expect(input.horizonDays).toBe(7);
    expect(invokeSkillMock).not.toHaveBeenCalled();
  });

  test('400 when skillContribution is not allowlisted for orchestration', async () => {
    const res = await POST(
      makeRequest({ ...VALID_BRIEF, skillContribution: 'build-orchestrator' })
    );
    expect(res.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
    expect(invokeSkillMock).not.toHaveBeenCalled();
  });

  test('200 with skillContribution invokes senior-strategist with org context', async () => {
    const res = await POST(
      makeRequest({ ...VALID_BRIEF, skillContribution: 'senior-strategist' })
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.data.reviewState).toBe('pending_review');
    expect(data.data.set.drafts).toHaveLength(7);
    expect(data.data.skillContribution).toMatchObject({
      skill: { slug: 'senior-strategist', name: 'Senior Strategist' },
      content: 'Prioritise LinkedIn before newsletter.',
      model: 'mock-balanced',
    });

    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(invokeSkillMock).toHaveBeenCalledTimes(1);
    expect(invokeSkillMock).toHaveBeenCalledWith({
      skill: 'senior-strategist',
      prompt: expect.stringContaining('Organisation ID: org-1'),
    });
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain(
      'Build organic authority ahead of EOFY.'
    );
  });

  test('500 when skillContribution is requested but invokeSkill fails', async () => {
    invokeSkillMock.mockRejectedValue(new Error('Provider unavailable'));
    const res = await POST(
      makeRequest({ ...VALID_BRIEF, skillContribution: 'senior-cmo' })
    );
    expect(res.status).toBe(500);
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(invokeSkillMock).toHaveBeenCalledTimes(1);
  });
});
