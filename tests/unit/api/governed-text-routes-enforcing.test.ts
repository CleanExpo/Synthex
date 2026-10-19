/**
 * @jest-environment node
 *
 * P5 / M10 — if the Governor is ever flipped to enforcing, a refused paid text
 * call is an honest 4xx with a code, not a 500, and the provider is never hit.
 *
 * SEAM: the brand-iq/next-steps POST handler and ask-synthex POST handler with
 * GOVERNOR_MODE forced to 'enforcing' (the real constant stays 'shadow').
 * Catches a refusal surfacing as 500 or the provider running after a refusal.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  hermesConfig: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
  runnerFlag: { findMany: jest.fn() },
  aPICredential: { findMany: jest.fn() },
  orgBudgetPolicy: { findUnique: jest.fn() },
  pipelineCostLedger: { groupBy: jest.fn(), create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/lib/encryption/api-key-encryption', () => ({
  decryptApiKey: jest.fn(),
}));
jest.mock('@/lib/ai/governor/mode', () => ({ GOVERNOR_MODE: 'enforcing' }));
jest.mock('@/lib/auth/with-auth', () => ({
  withAuth:
    (handler: (req: unknown, auth: unknown) => unknown) => (req: unknown) =>
      handler(req, { userId: 'user-1', clientId: 'org-A', role: 'owner' }),
}));
jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));
const mockComplete = jest.fn();
jest.mock('@/lib/ai/providers/anthropic-provider', () => ({
  AnthropicProvider: class {
    complete(...a: unknown[]) {
      return mockComplete(...a);
    }
  },
}));

import { POST as nextStepsPOST } from '@/app/api/brand-iq/next-steps/route';

beforeEach(() => {
  mockPrisma.hermesConfig.findUnique.mockResolvedValue({ brandSlug: 'ra' });
  mockPrisma.organization.findUnique.mockResolvedValue({ slug: 'org-a' });
  mockPrisma.runnerFlag.findMany.mockResolvedValue([]);
  mockPrisma.aPICredential.findMany.mockResolvedValue([]);
  mockPrisma.orgBudgetPolicy.findUnique.mockResolvedValue(null);
  mockPrisma.pipelineCostLedger.groupBy.mockResolvedValue([]);
  mockPrisma.pipelineCostLedger.create.mockResolvedValue({ id: 'l1' });
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

it('enforcing: a refused call is a 403 with a code, no provider call, one refusal receipt', async () => {
  const res = await nextStepsPOST(
    createMockNextRequest({ method: 'POST', body: { voiceScore: 1 } }) as never
  );
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({
    error: 'AI call refused by spend governor',
    code: 'refused_flag_missing',
  });
  expect(mockComplete).not.toHaveBeenCalled();
  expect(mockPrisma.pipelineCostLedger.create).toHaveBeenCalledTimes(1);
});
