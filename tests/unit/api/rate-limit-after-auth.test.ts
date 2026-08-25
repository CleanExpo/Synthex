/**
 * Rate limiting must not be spent on unauthenticated callers.
 *
 * Both routes below are authenticated-only. Their limiter buckets are keyed by
 * IP (lib/rate-limit/presets.ts -> createCategoryLimiter -> `${category}:${ip}`),
 * so if the limiter runs BEFORE the auth check an anonymous caller can exhaust
 * the bucket and 429 legitimate authenticated users sharing a NAT — while an
 * unauthenticated request previously cost them nothing.
 *
 * Three independent adversarial reviews (openai/gpt-5.6-terra-pro, x-ai/grok-4.6,
 * google gemini) flagged this ordering on 21/08/2026 after the routes were first
 * wrapped. This test locks the corrected order in.
 *
 * NOTE the shape: it asserts the limiter was NOT CALLED, not merely that the
 * response was 401. A 401 is produced either way — that is exactly why the
 * regression was invisible until someone looked at ordering.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    headers: { get: () => null; set: jest.Mock; has: () => boolean };
    private _body: string;
    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
      this.headers = { get: () => null, set: jest.fn(), has: () => false };
    }
    json() {
      return Promise.resolve(JSON.parse(this._body));
    }
    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }
  return {
    NextResponse: MockNextResponse,
    NextRequest: class extends Request {},
  };
});

const mockGetUserId = jest.fn();
const mockUnauthorized = jest.fn(() => ({ status: 401 }));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
  unauthorizedResponse: (...a: unknown[]) => mockUnauthorized(...a),
  generateToken: jest.fn(),
}));

// The limiters are spies. If either is invoked for an anonymous caller, the
// bucket has been spent and the test fails.
const mockWriteDefault = jest.fn();
const mockAiGeneration = jest.fn();
jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (...a: unknown[]) => mockWriteDefault(...a),
  aiGeneration: (...a: unknown[]) => mockAiGeneration(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/ai/resolve-api-key-status', () => ({
  resolveApiKeyConfigured: jest.fn(),
}));
jest.mock('@/lib/email/billing-emails', () => ({
  sendWelcomeSequenceDay0: jest.fn(),
}));
jest.mock('@/lib/vault/onboarding-seeder', () => ({
  seedVaultFromOnboarding: jest.fn(),
}));
jest.mock('@/lib/autopilot/launch-pipeline', () => ({
  runLaunchPipeline: jest.fn(),
}));
jest.mock('@/lib/onboarding/ensure-org', () => ({
  ensureOnboardingOrganization: jest.fn(),
}));
jest.mock('@/lib/onboarding/persist', () => ({
  migrateOrphanRecordsToOrg: jest.fn(),
}));
jest.mock('@/lib/ai/openrouter-client', () => ({
  OpenRouterClient: jest.fn(),
}));

import { POST as onboardingComplete } from '@/app/api/onboarding/complete/route';
import { POST as generateContent } from '@/app/api/profile-analyser/generate-content/route';
import { createMockNextRequest } from '../../helpers/mock-request';

const anonRequest = (url: string) =>
  createMockNextRequest({ method: 'POST', url, body: {} });

beforeEach(() => {
  jest.clearAllMocks();
  mockUnauthorized.mockReturnValue({ status: 401 } as never);
});

describe('rate limiting runs AFTER authentication', () => {
  it('POST /api/onboarding/complete — anonymous caller does not spend the writeDefault bucket', async () => {
    mockGetUserId.mockResolvedValue(null);

    const res = await onboardingComplete(
      anonRequest('https://synthex.example/api/onboarding/complete') as never
    );

    expect(mockGetUserId).toHaveBeenCalledTimes(1);
    expect(mockUnauthorized).toHaveBeenCalledTimes(1);
    expect((res as unknown as { status: number }).status).toBe(401);
    // The point of the test.
    expect(mockWriteDefault).not.toHaveBeenCalled();
  });

  it('POST /api/profile-analyser/generate-content — anonymous caller does not spend the aiGeneration bucket', async () => {
    mockGetUserId.mockResolvedValue(null);

    const res = await generateContent(
      anonRequest(
        'https://synthex.example/api/profile-analyser/generate-content'
      ) as never
    );

    expect(mockGetUserId).toHaveBeenCalledTimes(1);
    expect(mockUnauthorized).toHaveBeenCalledTimes(1);
    expect((res as unknown as { status: number }).status).toBe(401);
    expect(mockAiGeneration).not.toHaveBeenCalled();
  });

  it('an AUTHENTICATED caller still reaches the limiter on both routes', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockWriteDefault.mockResolvedValue({ status: 200 } as never);
    mockAiGeneration.mockResolvedValue({ status: 200 } as never);

    await onboardingComplete(
      anonRequest('https://synthex.example/api/onboarding/complete') as never
    );
    await generateContent(
      anonRequest(
        'https://synthex.example/api/profile-analyser/generate-content'
      ) as never
    );

    expect(mockWriteDefault).toHaveBeenCalledTimes(1);
    expect(mockAiGeneration).toHaveBeenCalledTimes(1);
    expect(mockUnauthorized).not.toHaveBeenCalled();
  });
});
