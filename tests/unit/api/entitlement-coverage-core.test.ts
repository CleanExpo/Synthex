/**
 * Route-level entitlement coverage (SYN-1106 second pass).
 *
 * One representative gated route per family — chat, PM, workflows, SEO,
 * autonomous — must deny a status-blind / under-tier user through the SAME
 * central `requireEntitlement` chain. Each case uses a paid plan in a
 * non-active billing status (past_due), which `entitledPlan` resolves to
 * 'free', proving the gate is now status-aware. Only subscription resolution
 * and auth are mocked; requireEntitlement → entitledPlan/hasPlanAccess runs
 * for real.
 */

/** @jest-environment node */

// Prisma stub — the gate denies before any query runs, but the route modules
// import prisma at load, so provide the shapes they reference.
jest.mock('@/lib/prisma', () => {
  const stub = {
    aIConversation: { findFirst: jest.fn(), findMany: jest.fn() },
    aIWeeklyDigest: { findFirst: jest.fn() },
    workflowExecution: { findFirst: jest.fn() },
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
    PUBLIC_READ: 'PUBLIC_READ',
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

// autonomous/parse imports parseInstruction at load; the gate denies first.
jest.mock('@/lib/autonomous', () => ({
  parseInstruction: jest.fn(),
}));

import { GET as chatGet } from '@/app/api/ai/chat/conversations/[conversationId]/route';
import { GET as pmDigestGet } from '@/app/api/ai/pm/digest/route';
import { GET as workflowExecGet } from '@/app/api/workflows/executions/[id]/route';
import { POST as seoSchemaPost } from '@/app/api/seo/schema/route';
import { POST as autonomousParsePost } from '@/app/api/autonomous/parse/route';
import { createMockNextRequest } from '../../helpers/mock-request';

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
});

describe('SYN-1106 second-pass entitlement gates deny status-blind / under-tier users', () => {
  it('chat — GET conversation denies a past_due Professional user (402)', async () => {
    getOrCreateSubscription.mockResolvedValue({
      plan: 'professional',
      status: 'past_due',
    });
    const res = await chatGet(
      createMockNextRequest({ url: 'https://x/api/ai/chat/conversations/c1' }),
      { params: Promise.resolve({ conversationId: 'c1' }) }
    );
    expect(res.status).toBe(402);
  });

  it('PM — GET digest denies a past_due Business user (402)', async () => {
    getOrCreateSubscription.mockResolvedValue({
      plan: 'business',
      status: 'past_due',
    });
    const res = await pmDigestGet(
      createMockNextRequest({ url: 'https://x/api/ai/pm/digest' })
    );
    expect(res.status).toBe(402);
  });

  it('workflows — GET execution denies a past_due Professional user (403)', async () => {
    getOrCreateSubscription.mockResolvedValue({
      plan: 'professional',
      status: 'past_due',
    });
    const res = await workflowExecGet(
      createMockNextRequest({ url: 'https://x/api/workflows/executions/e1' }),
      { params: Promise.resolve({ id: 'e1' }) }
    );
    expect(res.status).toBe(403);
  });

  it('SEO — POST schema denies a past_due Professional user (402)', async () => {
    getOrCreateSubscription.mockResolvedValue({
      plan: 'professional',
      status: 'past_due',
    });
    const res = await seoSchemaPost(
      createMockNextRequest({
        method: 'POST',
        url: 'https://x/api/seo/schema',
        body: { type: 'Organization', data: {} },
      })
    );
    expect(res.status).toBe(402);
  });

  it('autonomous — POST parse denies a past_due Professional user (403)', async () => {
    getOrCreateSubscription.mockResolvedValue({
      plan: 'professional',
      status: 'past_due',
    });
    const res = await autonomousParsePost(
      createMockNextRequest({
        method: 'POST',
        url: 'https://x/api/autonomous/parse',
        body: { instruction: 'do the thing please now' },
      })
    );
    expect(res.status).toBe(403);
  });
});
