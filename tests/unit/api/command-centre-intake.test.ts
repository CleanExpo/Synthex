import { createMockNextRequest } from '../../helpers/mock-request';

const mockSecurityCheck = jest.fn();
const mockGetEffectiveOrganizationId = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: { requireAuth: true, allowWrite: true },
  },
}));

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

import { POST } from '@/app/api/command-centre/intake/route';

describe('POST /api/command-centre/intake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-1' },
    });
    mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
  });

  it('rejects unauthenticated requests', async () => {
    mockSecurityCheck.mockResolvedValueOnce({
      allowed: false,
      error: 'Unauthorized',
      context: {},
    });

    const response = await POST(
      createMockNextRequest({
        method: 'POST',
        body: { source: 'manual', speaker: 'Phill', rawText: 'Draft this.' },
      }) as never
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('rejects requests without an organisation scope', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValueOnce(null);

    const response = await POST(
      createMockNextRequest({
        method: 'POST',
        body: { source: 'manual', speaker: 'Phill', rawText: 'Draft this.' },
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'No organisation found',
    });
  });

  it('validates the intake payload', async () => {
    const response = await POST(
      createMockNextRequest({
        method: 'POST',
        body: { source: 'sms', speaker: '', rawText: '' },
      }) as never
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Validation failed');
    expect(body.details.fieldErrors.source).toBeDefined();
  });

  it('rejects malformed JSON before payload validation', async () => {
    const response = await POST(
      createMockNextRequest({
        method: 'POST',
        body: '{bad-json',
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Malformed JSON',
    });
  });

  it('returns a draft-only command packet for valid input', async () => {
    const response = await POST(
      createMockNextRequest({
        method: 'POST',
        body: {
          source: 'telegram',
          speaker: 'Toby',
          rawText:
            'Create a Facebook campaign and storyboard video for APT meters.',
          evidenceRefs: ['wiki:synthex'],
        },
      }) as never
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      mode: 'draft',
      persisted: false,
      executionBlocked: true,
      boardInput: {
        organizationId: 'org-1',
        source: 'telegram',
        speaker: 'Toby',
      },
      commandPacket: {
        scenarioState: 'ready_for_review',
        approvalGate: 'client_review',
      },
    });
    expect(body.commandPacket.teamRoute).toEqual(
      expect.arrayContaining(['ceo-board', 'margot', 'marketing-strategy'])
    );
  });
});
