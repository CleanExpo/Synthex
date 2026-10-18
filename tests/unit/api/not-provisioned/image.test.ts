/**
 * P2 u05 — /api/media/generate/image without media_assets: saveToLibrary
 * reports `library: { available: false }` instead of a silently dropped save.
 */

/** @jest-environment node */

const mockGenerateImage = jest.fn();
const mockGenerateVariations = jest.fn();
jest.mock('@/lib/services/ai/image-generation', () => {
  const actual = jest.requireActual('@/lib/services/ai/image-generation');
  return {
    __esModule: true,
    ...actual,
    generateImage: (...a: unknown[]) => mockGenerateImage(...a),
    generateVariations: (...a: unknown[]) => mockGenerateVariations(...a),
  };
});

jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));

const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));

jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getOrCreateSubscription: async () => ({ plan: 'professional' }),
  },
}));
jest.mock('@/lib/billing/plan-access', () => ({
  hasProfessionalAccess: () => true,
  entitledPlan: (plan: string) => plan,
}));
jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({ allowed: true }),
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: jest.fn() },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: async () => 'org-1',
}));

jest.mock('@/lib/prisma', () => {
  const client = { imageGeneration: { create: jest.fn(), update: jest.fn() } };
  return { __esModule: true, default: client, prisma: client };
});

import { POST, PUT } from '@/app/api/media/generate/image/route';
import { createMockNextRequest } from '../../../helpers/mock-request';

const URL_BASE = 'https://synthex.example/api/media/generate/image';
const ok = {
  success: true,
  provider: 'stability',
  imageBase64: 'AAAA',
  metadata: {},
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
});

it('single generation reports the library save as unavailable', async () => {
  mockGenerateImage.mockResolvedValue(ok);
  const res = await POST(
    createMockNextRequest({
      method: 'POST',
      url: URL_BASE,
      body: { prompt: 'x' },
    })
  );
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.imageBase64).toBe('AAAA');
  expect(json.mediaAssetId).toBeUndefined();
  expect(json.library.available).toBe(false);
  expect(json.library.reason).toContain('media_assets');
});

it('omits library when saveToLibrary is false', async () => {
  mockGenerateImage.mockResolvedValue(ok);
  const res = await POST(
    createMockNextRequest({
      method: 'POST',
      url: URL_BASE,
      body: { prompt: 'x', saveToLibrary: false },
    })
  );
  expect((await res.json()).library).toBeUndefined();
});

it('variations report the library save as unavailable', async () => {
  mockGenerateVariations.mockResolvedValue([ok, ok]);
  const res = await PUT(
    createMockNextRequest({
      method: 'PUT',
      url: URL_BASE,
      body: { prompt: 'x', count: 2 },
    })
  );
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.variations).toHaveLength(2);
  expect(json.library.available).toBe(false);
});
