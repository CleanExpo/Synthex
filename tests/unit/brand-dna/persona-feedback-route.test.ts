/**
 * Unit test — Brand persona training loop (#8):
 *   POST /api/brand-dna/persona/feedback
 *
 * Proves the loop end-to-end with mocked prisma + getAIProvider:
 *   401 (no session) → 400 (bad body) → 404 (no BrandDNA) → 200 (refined +
 *   persisted to the SAME JSON columns + scored against the refined voice).
 * Also proves AI is reached ONLY via getAIProvider() and the route degrades
 * gracefully when the provider throws (voice samples still saved).
 */

const findUniqueBrandDna = jest.fn();
const updateBrandDna = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    brandDNA: {
      findUnique: (...a: unknown[]) => findUniqueBrandDna(...a),
      update: (...a: unknown[]) => updateBrandDna(...a),
    },
    user: { findUnique: (...a: unknown[]) => findUniqueUser(...a) },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));

const completeMock = jest.fn();
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => ({
    name: 'mock',
    models: { fast: 'fast', balanced: 'balanced', creative: 'c', premium: 'p', code: 'co', free: 'f' },
    complete: (...a: unknown[]) => completeMock(...a),
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue({ organizationId: 'org-1', teamMemberships: [] });
  updateBrandDna.mockResolvedValue({});
});

import { POST } from '@/app/api/brand-dna/persona/feedback/route';

function makeRequest(body: unknown) {
  return {
    nextUrl: {
      pathname: '/api/brand-dna/persona/feedback',
      searchParams: new URLSearchParams(),
    },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

const REFINED_JSON = JSON.stringify({
  brandVoice: { formality: 4, boldness: 5, tone: 'bold and authoritative' },
  persona: {
    ageRange: '30-50',
    values: ['quality'],
    painPoints: ['no time'],
    description: 'Busy owners',
  },
  rationale: 'Made the voice bolder per feedback.',
});

const SCORE_JSON = JSON.stringify({
  brandAlignment: 0.9,
  clarity: 0.9,
  engagement: 0.8,
  appropriateness: 0.9,
  flags: [],
  reasoning: 'On brand',
});

describe('POST /api/brand-dna/persona/feedback', () => {
  test('no session → 401 (before any DB/AI work)', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await POST(makeRequest({ feedback: 'be bolder please' }));
    expect(res.status).toBe(401);
    expect(findUniqueBrandDna).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  test('invalid body → 400 with { error, details } shape', async () => {
    const res = await POST(makeRequest({ feedback: 'x' })); // < min(3)
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
    expect(json.details).toHaveProperty('feedback');
    expect(findUniqueBrandDna).not.toHaveBeenCalled();
  });

  test('no BrandDNA for org → 404', async () => {
    findUniqueBrandDna.mockResolvedValue(null);
    const res = await POST(makeRequest({ feedback: 'be bolder please' }));
    expect(res.status).toBe(404);
    expect(updateBrandDna).not.toHaveBeenCalled();
  });

  test('valid feedback → 200: refines, persists to the SAME JSON columns, folds samples, scores', async () => {
    findUniqueBrandDna.mockResolvedValue({
      businessName: 'Acme',
      brandVoice: { formality: 2, boldness: 3, tone: 'friendly', samplePhrases: ['Hello there'] },
      persona: { ageRange: '', values: [], painPoints: [], description: '' },
    });
    completeMock
      .mockResolvedValueOnce({ choices: [{ message: { content: REFINED_JSON } }] }) // refiner
      .mockResolvedValueOnce({ choices: [{ message: { content: SCORE_JSON } }] }); // scorer

    const res = await POST(
      makeRequest({ feedback: 'be bolder and more authoritative', voiceSamples: ['We get it done.'] }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();

    // Refined voice applied
    expect(json.brandVoice.formality).toBe(4);
    expect(json.brandVoice.boldness).toBe(5);
    expect(json.brandVoice.tone).toBe('bold and authoritative');
    // Existing + new sample folded in (deduped, existing first)
    expect(json.brandVoice.samplePhrases).toEqual(['Hello there', 'We get it done.']);
    expect(json.rationale).toContain('bolder');

    // Persisted back to the SAME brandVoice/persona JSON columns, scoped to org
    const updateArg = updateBrandDna.mock.calls[0][0];
    expect(updateArg.where).toEqual({ organizationId: 'org-1' });
    expect(updateArg.data.brandVoice.formality).toBe(4);
    expect(updateArg.data.persona.description).toBe('Busy owners');
    expect(updateArg.data).toHaveProperty('lastRefreshedAt');

    // Loop closed: a refined sample was scored via the quality-scorer
    expect(json.scoredSample).toBe('Hello there');
    expect(json.score.overall).toBeGreaterThan(0.8);
    expect(completeMock).toHaveBeenCalledTimes(2);
  });

  test('AI provider throws → graceful degrade: samples saved, 200, profile unchanged, no score', async () => {
    findUniqueBrandDna.mockResolvedValue({
      businessName: 'Acme',
      brandVoice: { formality: 2, boldness: 3, tone: 'friendly', samplePhrases: [] },
      persona: { ageRange: '25-40', values: ['care'], painPoints: [], description: 'Locals' },
    });
    completeMock.mockRejectedValue(new Error('no provider key'));

    const res = await POST(
      makeRequest({ feedback: 'lean warmer', voiceSamples: ['Warm welcome, always.'] }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();

    // Profile preserved, sample still adopted
    expect(json.brandVoice.tone).toBe('friendly');
    expect(json.brandVoice.samplePhrases).toEqual(['Warm welcome, always.']);
    expect(json.persona.description).toBe('Locals');
    // Scorer also fails to produce a real score on the same dead provider →
    // conservative fallback (manual review), not a thrown 500.
    expect(json.score.autoApprove).toBe(false);
    expect(updateBrandDna).toHaveBeenCalledTimes(1);
  });
});
