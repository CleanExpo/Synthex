/**
 * Proves the publish-pipeline failure point reports to Sentry (P1 observability).
 *
 * Before this change, an unexpected error while publishing a scheduled post was
 * only console-logged — the team flew blind on silent publish failures. This
 * test mocks the Sentry client (lib/observability/sentry-server) and drives the
 * publish cron into its per-post catch block, then asserts that
 * captureServerException() was invoked with the publish-pipeline context — and
 * that no secret/token leaked into the capture call.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';

const mockPrisma = {
  post: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  platformConnection: { findFirst: jest.fn() },
  notification: { create: jest.fn() },
  platformPost: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

jest.mock('@/lib/social', () => ({
  isPlatformSupported: () => true,
  createPlatformService: jest.fn(),
}));
jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (v: string) => v,
  encryptField: (v: string) => v,
}));
jest.mock('@/lib/unite-hub-connector', () => ({ pushUniteHubEvent: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock the Sentry client — this is the assertion target.
const mockCapture = jest.fn();
jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: (...args: unknown[]) => mockCapture(...args),
  captureServerMessage: jest.fn(),
  isSentryServerEnabled: () => true,
}));

import { GET } from '@/app/api/cron/publish-scheduled/route';

function req() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/publish-scheduled',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.post.update.mockResolvedValue({});
  mockPrisma.notification.create.mockResolvedValue({});
});

describe('publish-scheduled → Sentry capture on failure', () => {
  it('invokes captureServerException with publish context when a post throws', async () => {
    const manifest = buildApprovedCampaignAuthorityManifest({
      platformOutputs: [
        { platform: 'facebook', status: 'approved', contentRef: 'post-fb' },
      ],
    });
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: 'p-boom',
        content: 'hello world',
        platform: 'facebook',
        metadata: { campaignAuthorityManifest: manifest },
        campaign: {
          userId: 'u1',
          platform: 'facebook',
          organizationId: 'org-1',
          settings: {},
          content: {},
        },
      },
    ]);
    // Force the per-post catch: the idempotency re-check throws.
    mockPrisma.post.findUnique.mockRejectedValue(
      new Error('DB connection lost mid-publish')
    );

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200); // cron never crashes
    expect(body.failed).toBe(1);

    // Sentry was told about the publish failure.
    expect(mockCapture).toHaveBeenCalledTimes(1);
    const [error, context] = mockCapture.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('DB connection lost mid-publish');
    expect(context.operation).toBe('cron/publish-scheduled');
    expect(context.tags.cron).toBe('publish-scheduled');
    expect(context.tags.platform).toBe('facebook');
    expect(context.extra.postId).toBe('p-boom');

    // No token/secret/content was put into the capture context.
    const serialised = JSON.stringify(context);
    expect(serialised).not.toContain('hello world'); // post content not leaked
    expect(serialised.toLowerCase()).not.toContain('token');
    expect(serialised.toLowerCase()).not.toContain('secret');
  });

  it('does not call Sentry on a clean run', async () => {
    mockPrisma.post.findMany.mockResolvedValue([]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
