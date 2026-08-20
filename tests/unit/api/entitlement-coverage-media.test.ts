/**
 * Route-level entitlement coverage for the newly-gated media routes (SYN-1106
 * second pass): voice generation and video publishing. Both are Business-tier
 * and previously had NO subscription gate. Each must now deny through the
 * central `requireEntitlement` chain. Only subscription resolution, auth, and
 * the routes' heavy service imports are mocked; requireEntitlement runs for
 * real.
 */

/** @jest-environment node */

jest.mock('@/lib/prisma', () => {
  const stub = {
    videoGeneration: { findUnique: jest.fn(), update: jest.fn() },
    campaign: { findFirst: jest.fn(), create: jest.fn() },
    post: { create: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  return { __esModule: true, default: stub, prisma: stub };
});

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

const getOrCreateSubscription = jest.fn();
jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getOrCreateSubscription: (...a: unknown[]) => getOrCreateSubscription(...a),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// voice route: the caller is NOT a service request (so the user-tier gate
// applies). The service-token exemption stays untouched by this test.
jest.mock('@/lib/security/service-token-validator', () => ({
  validateServiceToken: () => ({ valid: false }),
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: jest.fn() },
}));

jest.mock('@/lib/services/ai/voice-generation', () => ({
  generateSpeech: jest.fn(),
  generateSpeechStream: jest.fn(),
  cloneVoice: jest.fn(),
  getVoices: jest.fn(),
  getCustomVoices: jest.fn(),
  deleteVoice: jest.fn(),
  getVoiceSettings: jest.fn(),
  getCharacterQuota: jest.fn(),
  DEFAULT_VOICES: {},
}));

jest.mock('@/lib/platform/noop-client', () => ({
  createClient: () => ({ from: () => ({ insert: () => ({}) }) }),
}));

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: jest.fn(),
}));

import { POST as voicePost } from '@/app/api/media/generate/voice/route';
import { POST as videoPublishPost } from '@/app/api/video/[id]/publish/route';
import { createMockNextRequest } from '../../helpers/mock-request';

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
});

describe('SYN-1106 second-pass entitlement gates on newly-gated media routes', () => {
  it('voice — POST denies an under-tier (Professional/active) user, Business required (402)', async () => {
    getOrCreateSubscription.mockResolvedValue({
      plan: 'professional',
      status: 'active',
    });
    const res = await voicePost(
      createMockNextRequest({
        method: 'POST',
        url: 'https://x/api/media/generate/voice',
        body: { text: 'hello world' },
      })
    );
    expect(res.status).toBe(402);
  });

  it('video-publish — POST denies a past_due Business user (402)', async () => {
    getOrCreateSubscription.mockResolvedValue({
      plan: 'business',
      status: 'past_due',
    });
    const res = await videoPublishPost(
      createMockNextRequest({
        method: 'POST',
        url: 'https://x/api/video/v1/publish',
        body: { platforms: ['youtube'] },
      }),
      { params: Promise.resolve({ id: 'v1' }) }
    );
    expect(res.status).toBe(402);
  });
});
