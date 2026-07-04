/**
 * Unit tests — Onboarding Generate Plan route /api/onboarding/generate-plan (SYN-23)
 *
 * Covers the validation ladder and the AI-failure fallback path:
 *  - 401 when unauthenticated
 *  - 400 when the body fails the Zod enum schema
 *  - 200 with a full MarketingPlan on valid input, persisted org-scoped to
 *    OnboardingProgress.goalsData via upsert
 *  - AI provider failure → FALLBACK_PLAN (provider is mocked; no real LLM call)
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const getAuthUserMock = jest.fn();
jest.mock('@/lib/supabase-server', () => ({
  getAuthUser: (...a: unknown[]) => getAuthUserMock(...a),
}));

// The generate-plan service resolves the provider via this factory. Mocking it
// here controls both the service and (transitively) the route. No real LLM.
const mockComplete = jest.fn();
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => ({
    name: 'OpenAI',
    models: { premium: 'gpt-4o' },
    complete: mockComplete,
  }),
}));

const orgFindFirst = jest.fn();
const progressUpsert = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    organization: {
      findFirst: (...a: unknown[]) => orgFindFirst(...a),
    },
    onboardingProgress: {
      upsert: (...a: unknown[]) => progressUpsert(...a),
    },
  },
}));

import { POST } from '@/app/api/onboarding/generate-plan/route';
import { FALLBACK_PLAN } from '@/lib/onboarding/generate-plan';

// ── Fixtures ────────────────────────────────────────────────────────────────

const VALID_ANSWERS = {
  businessType: 'service',
  primaryGoal: 'leads',
  targetAudience: 'local',
  contentVolume: 'moderate',
  budgetTier: 'starter',
  biggestChallenge: 'time',
};

const AI_PLAN = {
  headline: 'Local Leads Engine for Your Service Business',
  summary: 'A focused 90-day plan. It builds local trust. Success is a steady lead flow.',
  platforms: [
    {
      name: 'Facebook',
      priority: 'primary',
      reason: 'Strong local community reach',
      contentTypes: ['Before/after', 'Reviews', 'Offers'],
      frequency: '3x/week',
    },
    {
      name: 'Instagram',
      priority: 'secondary',
      reason: 'Visual proof of work',
      contentTypes: ['Reels', 'Stories', 'Carousels'],
      frequency: '2x/week',
    },
  ],
  contentPillars: [
    { name: 'Trust', description: 'Show credibility', examples: ['Reviews', 'Certifications', 'Guarantees'] },
    { name: 'Education', description: 'Answer questions', examples: ['FAQs', 'Tips', 'Guides'] },
    { name: 'Proof', description: 'Show results', examples: ['Before/after', 'Case studies', 'Testimonials'] },
  ],
  thirtyDayActions: [
    'Claim and optimise your Google Business Profile',
    'Collect five new customer reviews',
    'Publish two before/after posts per week',
    'Set up a lead capture form',
    'Batch a month of content in one session',
  ],
  metrics: [
    { name: 'New leads', target: '15-25 per month' },
    { name: 'Review count', target: '+10 in 90 days' },
    { name: 'Engagement rate', target: '3-5%' },
  ],
  estimatedTimePerWeek: '3-4 hours',
};

function completionWith(content: string) {
  return { choices: [{ message: { content } }] };
}

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/onboarding/generate-plan', () => {
  beforeEach(() => {
    getAuthUserMock.mockResolvedValue({ id: 'user-1' });
    orgFindFirst.mockResolvedValue(null);
    progressUpsert.mockResolvedValue({});
    mockComplete.mockResolvedValue(completionWith(JSON.stringify(AI_PLAN)));
  });

  it('returns 401 when unauthenticated', async () => {
    getAuthUserMock.mockResolvedValueOnce(null);

    const res = await POST(makeRequest(VALID_ANSWERS));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorised');
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('returns 400 with details when the body fails the enum schema', async () => {
    const res = await POST(makeRequest({ ...VALID_ANSWERS, businessType: 'invalid-type' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid request');
    expect(Array.isArray(json.details)).toBe(true);
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('returns 200 with a full MarketingPlan and persists org-scoped goalsData', async () => {
    orgFindFirst.mockResolvedValueOnce({ id: 'org-1' });

    const res = await POST(makeRequest(VALID_ANSWERS));

    expect(res.status).toBe(200);
    const plan = await res.json();
    expect(plan.headline).toBe(AI_PLAN.headline);
    expect(plan.summary).toBe(AI_PLAN.summary);
    expect(Array.isArray(plan.platforms)).toBe(true);
    expect(plan.platforms).toHaveLength(2);
    expect(plan.contentPillars).toHaveLength(3);
    expect(plan.thirtyDayActions).toHaveLength(5);
    expect(plan.metrics).toHaveLength(3);
    expect(plan.estimatedTimePerWeek).toBe(AI_PLAN.estimatedTimePerWeek);

    // Org-scoped persistence: upsert keyed by this user's org, never a bare id.
    expect(progressUpsert).toHaveBeenCalledTimes(1);
    expect(progressUpsert.mock.calls[0][0].where).toEqual({
      userId_organizationId: { userId: 'user-1', organizationId: 'org-1' },
    });
  });

  it('falls back to FALLBACK_PLAN when the AI provider fails', async () => {
    mockComplete.mockRejectedValueOnce(new Error('provider timeout'));

    const res = await POST(makeRequest(VALID_ANSWERS));

    expect(res.status).toBe(200);
    const plan = await res.json();
    expect(plan.headline).toBe(FALLBACK_PLAN.headline);
    expect(plan.platforms).toHaveLength(FALLBACK_PLAN.platforms.length);
    expect(plan.estimatedTimePerWeek).toBe(FALLBACK_PLAN.estimatedTimePerWeek);
  });
});
