/**
 * Unit tests — lib/interventions/email-renderer.ts
 *
 * Tests:
 * - sendValueProofEmail: template lookup, merge field substitution, Resend dispatch
 * - getOrgContactEmail: billingEmail fallback → user email fallback → null
 * - Graceful no-op when no active template exists for the dimension
 *
 * SYN-616
 */

// ── Resend mock ───────────────────────────────────────────────────────────────

const mockEmailsSend = jest.fn().mockResolvedValue({ error: null });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend },
  })),
}));

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockTemplateFindFirst = jest.fn();
const mockPostCount = jest.fn().mockResolvedValue(5);
const mockGBPReviewCount = jest.fn().mockResolvedValue(3);
const mockRecommendedActionFindFirst = jest.fn().mockResolvedValue(null);
const mockOrgFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    interventionTemplate: { findFirst: (...a: unknown[]) => mockTemplateFindFirst(...a) },
    post: { count: (...a: unknown[]) => mockPostCount(...a) },
    gBPReview: { count: (...a: unknown[]) => mockGBPReviewCount(...a) },
    recommendedAction: { findFirst: (...a: unknown[]) => mockRecommendedActionFindFirst(...a) },
    organization: { findUnique: (...a: unknown[]) => mockOrgFindUnique(...a) },
  },
  default: {
    interventionTemplate: { findFirst: (...a: unknown[]) => mockTemplateFindFirst(...a) },
    post: { count: (...a: unknown[]) => mockPostCount(...a) },
    gBPReview: { count: (...a: unknown[]) => mockGBPReviewCount(...a) },
    recommendedAction: { findFirst: (...a: unknown[]) => mockRecommendedActionFindFirst(...a) },
    organization: { findUnique: (...a: unknown[]) => mockOrgFindUnique(...a) },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { sendValueProofEmail, getOrgContactEmail } from '@/lib/interventions/email-renderer';
import { Resend } from 'resend'; // mocked by jest.mock above — gives us access to the constructor mock

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_PARAMS = {
  to: 'client@example.com',
  clientName: 'Acme Plumbing',
  dimension: 'content_consistency',
  currentScore: 65,
  baselineScore: 80,
  declineMagnitude: -15, // negative = decline
  organizationId: 'org_001',
};

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    tier: 2,
    dimension: 'content_consistency',
    channel: 'email',
    subjectTemplate: 'Update for {{clientName}} — {{dimension}} score',
    bodyTemplate:
      'Hi {{clientName}},\n\nYour {{dimension}} score is down {{declineAmount}} points.\n\nROI: {{heroMetric}}\n\n→ [View dashboard]',
    heroMetricSource: 'reach',
    active: true,
    ...overrides,
  };
}

// ── sendValueProofEmail ───────────────────────────────────────────────────────

describe('sendValueProofEmail', () => {
  beforeEach(() => {
    // jest.config has resetMocks:true which calls mockReset() on ALL mocks before each test.
    // That clears the Resend constructor's mockImplementation. Re-add it here so the lazy
    // singleton in email-renderer.ts is properly seeded on first use in each test.
    (Resend as any).mockImplementation(() => ({ emails: { send: mockEmailsSend } }));
    mockEmailsSend.mockResolvedValue({ error: null });
    mockPostCount.mockResolvedValue(12);
  });

  it('returns silently when no active template exists for the dimension', async () => {
    mockTemplateFindFirst.mockResolvedValue(null);

    await expect(sendValueProofEmail(BASE_PARAMS)).resolves.toBeUndefined();
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it('sends an email via Resend when a template is found', async () => {
    mockTemplateFindFirst.mockResolvedValue(makeTemplate());

    await sendValueProofEmail(BASE_PARAMS);

    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    const call = mockEmailsSend.mock.calls[0][0];
    expect(call.to).toBe('client@example.com');
    expect(call.html).toBeDefined();
    expect(call.text).toBeDefined();
  });

  it('applies {{clientName}} merge field in subject and body', async () => {
    mockTemplateFindFirst.mockResolvedValue(makeTemplate());

    await sendValueProofEmail(BASE_PARAMS);

    const call = mockEmailsSend.mock.calls[0][0];
    expect(call.subject).toContain('Acme Plumbing');
    expect(call.text).toContain('Acme Plumbing');
  });

  it('applies {{declineAmount}} as the absolute value of declineMagnitude', async () => {
    mockTemplateFindFirst.mockResolvedValue(makeTemplate());

    await sendValueProofEmail({ ...BASE_PARAMS, declineMagnitude: -15 });

    const call = mockEmailsSend.mock.calls[0][0];
    expect(call.text).toContain('15');   // abs(−15)
    expect(call.text).not.toContain('-15'); // should not appear negative
  });

  it('applies {{dimension}} with underscores replaced by spaces', async () => {
    mockTemplateFindFirst.mockResolvedValue(makeTemplate());

    await sendValueProofEmail({ ...BASE_PARAMS, dimension: 'content_consistency' });

    const call = mockEmailsSend.mock.calls[0][0];
    expect(call.subject).toContain('content consistency');
  });

  it('resolves hero metric for heroMetricSource = "reach"', async () => {
    mockTemplateFindFirst.mockResolvedValue(makeTemplate({ heroMetricSource: 'reach' }));
    mockPostCount.mockResolvedValue(7);

    await sendValueProofEmail(BASE_PARAMS);

    const call = mockEmailsSend.mock.calls[0][0];
    expect(call.text).toContain('7');
  });

  it('resolves hero metric for heroMetricSource = "reviews_handled"', async () => {
    mockTemplateFindFirst.mockResolvedValue(
      makeTemplate({ heroMetricSource: 'reviews_handled' })
    );
    mockGBPReviewCount.mockResolvedValue(4);

    await sendValueProofEmail(BASE_PARAMS);

    const call = mockEmailsSend.mock.calls[0][0];
    expect(call.text).toContain('4');
  });

  it('resolves hero metric for heroMetricSource = "dollar_attribution"', async () => {
    mockTemplateFindFirst.mockResolvedValue(
      makeTemplate({ heroMetricSource: 'dollar_attribution' })
    );
    mockRecommendedActionFindFirst.mockResolvedValue({
      dollarAttribution: 'contributed to ~$8,400 in potential revenue',
    });

    await sendValueProofEmail(BASE_PARAMS);

    const call = mockEmailsSend.mock.calls[0][0];
    expect(call.text).toContain('$8,400');
  });

  it('uses "—" as hero metric when heroMetricSource is null', async () => {
    mockTemplateFindFirst.mockResolvedValue(makeTemplate({ heroMetricSource: null }));

    await sendValueProofEmail(BASE_PARAMS);

    const call = mockEmailsSend.mock.calls[0][0];
    expect(call.text).toContain('—');
  });

  it('throws when Resend returns an error', async () => {
    mockTemplateFindFirst.mockResolvedValue(makeTemplate());
    mockEmailsSend.mockResolvedValue({ error: { message: 'rate limit exceeded' } });

    await expect(sendValueProofEmail(BASE_PARAMS)).rejects.toThrow('rate limit exceeded');
  });

  it('queries intervention_templates with tier=2, correct dimension, channel=email', async () => {
    mockTemplateFindFirst.mockResolvedValue(null);

    await sendValueProofEmail({ ...BASE_PARAMS, dimension: 'review_responsiveness' });

    expect(mockTemplateFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tier: 2,
          dimension: 'review_responsiveness',
          channel: 'email',
          active: true,
        }),
      })
    );
  });

  it('generates HTML output containing the rendered body', async () => {
    mockTemplateFindFirst.mockResolvedValue(makeTemplate());

    await sendValueProofEmail(BASE_PARAMS);

    const call = mockEmailsSend.mock.calls[0][0];
    expect(call.html).toContain('<!DOCTYPE html>');
    expect(call.html).toContain('Acme Plumbing');
  });
});

// ── getOrgContactEmail ────────────────────────────────────────────────────────

describe('getOrgContactEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns billingEmail when set', async () => {
    mockOrgFindUnique.mockResolvedValue({
      billingEmail: 'billing@acme.com',
      users: [{ email: 'user@acme.com' }],
    });

    const result = await getOrgContactEmail('org_001');

    expect(result).toBe('billing@acme.com');
  });

  it('falls back to the oldest user email when billingEmail is null', async () => {
    mockOrgFindUnique.mockResolvedValue({
      billingEmail: null,
      users: [{ email: 'owner@acme.com' }],
    });

    const result = await getOrgContactEmail('org_001');

    expect(result).toBe('owner@acme.com');
  });

  it('returns null when org has no billingEmail and no users', async () => {
    mockOrgFindUnique.mockResolvedValue({
      billingEmail: null,
      users: [],
    });

    const result = await getOrgContactEmail('org_001');

    expect(result).toBeNull();
  });

  it('returns null when org is not found', async () => {
    mockOrgFindUnique.mockResolvedValue(null);

    const result = await getOrgContactEmail('org_unknown');

    expect(result).toBeNull();
  });

  it('queries org with billingEmail and first user ordered by createdAt', async () => {
    mockOrgFindUnique.mockResolvedValue({ billingEmail: 'b@x.com', users: [] });

    await getOrgContactEmail('org_001');

    expect(mockOrgFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org_001' },
        select: expect.objectContaining({
          billingEmail: true,
          users: expect.objectContaining({
            orderBy: { createdAt: 'asc' },
            take: 1,
          }),
        }),
      })
    );
  });
});
