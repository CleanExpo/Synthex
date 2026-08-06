/**
 * AT-028 — POST /api/workflows/executions with template: content-campaign
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    workflowExecution: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    workflowTemplate: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: jest.fn() },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: 'read',
    AUTHENTICATED_WRITE: 'write',
  },
}));

jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({
    allowed: true,
    effectivePlan: 'professional',
    requiredPlan: 'professional',
    subscription: { plan: 'professional', status: 'active' },
  }),
}));

jest.mock('@/lib/queue/bull-queue', () => ({
  enqueueWorkflowStep: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { APISecurityChecker } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { enqueueWorkflowStep } from '@/lib/queue/bull-queue';
import { contentCampaignWorkflow } from '@/lib/workflow/workflow-templates';
import { POST } from '@/app/api/workflows/executions/route';

function createMockRequest(body: object) {
  return {
    url: 'http://localhost/api/workflows/executions',
    method: 'POST',
    headers: {
      get: (name: string) =>
        name === 'content-type' ? 'application/json' : null,
      has: () => false,
    },
    json: async () => body,
  } as never;
}

describe('POST /api/workflows/executions — content-campaign (AT-028)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (APISecurityChecker.check as jest.Mock).mockResolvedValue({
      allowed: true,
      context: { userId: 'user-1' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      organizationId: 'org-1',
    });
    (prisma.workflowExecution.create as jest.Mock).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'exec-ccw-1',
        ...data,
      })
    );
  });

  it('expands contentCampaignWorkflow and enqueues step 0', async () => {
    const def = contentCampaignWorkflow({ autoPublish: false });
    const res = await POST(
      createMockRequest({
        title: 'Q3 LinkedIn campaign',
        template: 'content-campaign',
        inputData: { goal: 'Announce CARSI course intake' },
      })
    );

    expect(res.status).toBe(201);
    expect(prisma.workflowExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          title: 'Q3 LinkedIn campaign',
          totalSteps: def.steps.length,
          triggerType: 'manual',
          inputData: expect.objectContaining({
            agencyTaskId: 'AT-028',
            sourceType: 'content-campaign',
            steps: expect.arrayContaining([
              expect.objectContaining({
                name: 'Generate content',
                config: { skill: 'senior-copywriter' },
              }),
              expect.objectContaining({
                name: 'Strategist final gate',
                config: { subType: 'strategist' },
              }),
            ]),
          }),
        }),
      })
    );
    expect(enqueueWorkflowStep).toHaveBeenCalledWith('exec-ccw-1', 0, 0);
  });

  it('returns 400 when neither steps nor template nor templateId given', async () => {
    const res = await POST(createMockRequest({ title: 'Missing steps' }));
    expect(res.status).toBe(400);
    expect(prisma.workflowExecution.create).not.toHaveBeenCalled();
  });

  it('loads org-scoped DB template by templateId', async () => {
    (prisma.workflowTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'tpl-1',
      steps: [{ name: 'Draft', type: 'ai', promptTemplate: 'Write' }],
    });

    const res = await POST(
      createMockRequest({
        title: 'From DB template',
        templateId: 'tpl-1',
      })
    );

    expect(res.status).toBe(201);
    expect(prisma.workflowTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'tpl-1',
        organizationId: 'org-1',
        isActive: true,
      },
    });
    expect(prisma.workflowExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowId: 'tpl-1',
          totalSteps: 1,
        }),
      })
    );
  });
});
