/**
 * PATCH /api/webhooks/user — SSRF guard on update.
 *
 * Regression: POST validated the webhook URL but PATCH stored + test-POSTed it
 * with no SSRF check. PATCH now runs the async guard; a private/metadata URL is
 * rejected before any store or outbound request.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

const mockSendTest = jest.fn();
jest.mock('@/lib/webhooks/sender', () => ({
  sendTestWebhook: (...a: unknown[]) => mockSendTest(...a),
  broadcastWebhook: jest.fn(),
}));

const mockPrisma = {
  webhookEndpoint: { findFirst: jest.fn(), update: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { PATCH } from '@/app/api/webhooks/user/route';

function req(body: object) {
  return createMockNextRequest({
    method: 'PATCH',
    url: 'http://localhost/api/webhooks/user',
    body,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-1');
  mockPrisma.webhookEndpoint.findFirst.mockResolvedValue({
    id: 'w-1',
    userId: 'user-1',
    url: 'https://good.example.com/hook',
    secret: 's',
  });
});

describe('PATCH /api/webhooks/user — SSRF', () => {
  it('rejects a cloud-metadata URL and never stores or sends', async () => {
    const res = await PATCH(
      req({ id: 'w-1', url: 'http://169.254.169.254/latest/meta-data/' })
    );

    expect(res.status).toBe(400);
    expect(mockSendTest).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
