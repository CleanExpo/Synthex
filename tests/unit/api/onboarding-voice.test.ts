/**
 * Unit Tests for Onboarding Voice API Route
 * Tests POST /api/onboarding/voice
 *
 * SYN-446 — Add test coverage for recently added API routes
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ---------------------------------------------------------------------------
// Mocks — factories declare shape only; implementations set in beforeEach
// ---------------------------------------------------------------------------

const mockPrisma = {
  onboardingProfile: {
    upsert: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

const mockSecurityCheck = jest.fn();
const mockCreateSecureResponse = jest.fn((body: unknown, status: number) => {
  return new Response(JSON.stringify(body), { status });
});

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (...args: unknown[]) =>
      mockCreateSecureResponse(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: { requireAuth: true, allowWrite: true },
  },
}));

const mockGetEffectiveOrganizationId = jest.fn();

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

// ---------------------------------------------------------------------------
// Import handler AFTER all mocks are declared
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/onboarding/voice/route';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_BODY = {
  industry: 'Trades — Plumbing',
  targetCustomer: 'Homeowners in Melbourne needing urgent repairs',
  differentiator: 'Same-day service, licensed tradespeople',
  tone: 'Reliable and friendly',
  firstPostTopic: 'Before and after bathroom renovation',
};

const MOCK_PROFILE = {
  id: 'profile-abc',
  organizationId: 'org-456',
  userId: 'user-123',
  ...VALID_BODY,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRequest(body?: object) {
  return createMockNextRequest({
    method: 'POST',
    body: body ?? VALID_BODY,
    url: 'http://localhost:3000/api/onboarding/voice',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/onboarding/voice', () => {
  beforeEach(() => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-123' },
    });
    mockGetEffectiveOrganizationId.mockResolvedValue('org-456');
    mockPrisma.onboardingProfile.upsert.mockResolvedValue(MOCK_PROFILE);
  });

  // ── Authentication ────────────────────────────────────────────────────────

  it('returns 401 when not authenticated', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Unauthorized',
      context: {},
    });

    await POST(makeRequest() as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
      401,
      expect.anything()
    );
  });

  it('returns 401 when userId is absent from security context', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: undefined },
    });

    await POST(makeRequest() as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { error: 'Unauthorised' },
      401,
      expect.anything()
    );
  });

  // ── Organisation check ────────────────────────────────────────────────────

  it('returns 403 when user has no organisation context', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);

    await POST(makeRequest() as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('organisation'),
      }),
      403,
      expect.anything()
    );
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it('returns 400 for invalid JSON body', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/onboarding/voice',
    });
    (req as any).json = async () => {
      throw new SyntaxError('Unexpected token');
    };

    await POST(req as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { error: 'Invalid JSON body.' },
      400,
      expect.anything()
    );
  });

  it('returns 400 when industry is missing', async () => {
    const { industry: _industry, ...bodyWithout } = VALID_BODY;
    await POST(makeRequest(bodyWithout) as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
      400,
      expect.anything()
    );
  });

  it('returns 400 when targetCustomer is missing', async () => {
    const { targetCustomer: _tc, ...bodyWithout } = VALID_BODY;
    await POST(makeRequest(bodyWithout) as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
      400,
      expect.anything()
    );
  });

  it('returns 400 when differentiator is missing', async () => {
    const { differentiator: _diff, ...bodyWithout } = VALID_BODY;
    await POST(makeRequest(bodyWithout) as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
      400,
      expect.anything()
    );
  });

  it('returns 400 when tone is missing', async () => {
    const { tone: _tone, ...bodyWithout } = VALID_BODY;
    await POST(makeRequest(bodyWithout) as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
      400,
      expect.anything()
    );
  });

  it('returns 400 when firstPostTopic is missing', async () => {
    const { firstPostTopic: _fpt, ...bodyWithout } = VALID_BODY;
    await POST(makeRequest(bodyWithout) as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
      400,
      expect.anything()
    );
  });

  it('returns 400 when industry is shorter than 2 characters', async () => {
    await POST(makeRequest({ ...VALID_BODY, industry: 'X' }) as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
      400,
      expect.anything()
    );
  });

  it('returns 400 when any field exceeds 500 characters', async () => {
    await POST(makeRequest({ ...VALID_BODY, tone: 'T'.repeat(501) }) as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' }),
      400,
      expect.anything()
    );
  });

  // ── Success path ──────────────────────────────────────────────────────────

  it('returns 200 with profileId on successful upsert', async () => {
    await POST(makeRequest() as any);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { success: true, profileId: 'profile-abc' },
      200,
      expect.anything()
    );
  });

  it('upserts profile scoped to the resolved organisationId', async () => {
    await POST(makeRequest() as any);

    expect(mockPrisma.onboardingProfile.upsert).toHaveBeenCalledWith({
      where: { organizationId: 'org-456' },
      create: {
        organizationId: 'org-456',
        userId: 'user-123',
        ...VALID_BODY,
      },
      update: {
        industry: VALID_BODY.industry,
        targetCustomer: VALID_BODY.targetCustomer,
        differentiator: VALID_BODY.differentiator,
        tone: VALID_BODY.tone,
        firstPostTopic: VALID_BODY.firstPostTopic,
      },
    });
  });

  it('includes all five onboarding fields in the create payload', async () => {
    await POST(makeRequest() as any);

    const upsertArgs = mockPrisma.onboardingProfile.upsert.mock.calls[0][0];
    expect(upsertArgs.create).toMatchObject({
      industry: VALID_BODY.industry,
      targetCustomer: VALID_BODY.targetCustomer,
      differentiator: VALID_BODY.differentiator,
      tone: VALID_BODY.tone,
      firstPostTopic: VALID_BODY.firstPostTopic,
    });
  });

  it('does not include userId in the update payload', async () => {
    await POST(makeRequest() as any);

    const upsertArgs = mockPrisma.onboardingProfile.upsert.mock.calls[0][0];
    expect(upsertArgs.update).not.toHaveProperty('userId');
    expect(upsertArgs.update).not.toHaveProperty('organizationId');
  });
});
