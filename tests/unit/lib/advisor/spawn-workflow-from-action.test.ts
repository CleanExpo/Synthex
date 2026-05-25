/**
 * Unit tests — spawnAdvisorActionWorkflow (SYN-972)
 */

const mockWorkflowExecutionCreate = jest.fn();
const mockWorkflowExecutionUpdate = jest.fn();
const mockEnqueueWorkflowStep = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    workflowExecution: {
      create: (...args: unknown[]) => mockWorkflowExecutionCreate(...args),
      update: (...args: unknown[]) => mockWorkflowExecutionUpdate(...args),
    },
  },
}));

jest.mock('@/lib/queue/bull-queue', () => ({
  enqueueWorkflowStep: (...args: unknown[]) => mockEnqueueWorkflowStep(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  spawnAdvisorActionWorkflow,
  AdvisorWorkflowSpawnError,
} from '@/lib/advisor/spawn-workflow-from-action';

const ACTION = {
  rank: 1,
  title: 'Reply to unanswered reviews',
  rationale: 'You have 3 reviews waiting.',
  effort: 'low',
  expectedImpact: '+12% response rate',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWorkflowExecutionCreate.mockResolvedValue({ id: 'exec-001' });
  mockEnqueueWorkflowStep.mockResolvedValue(undefined);
});

describe('spawnAdvisorActionWorkflow', () => {
  it('creates execution and enqueues step 0', async () => {
    const result = await spawnAdvisorActionWorkflow({
      organizationId: 'org-1',
      userId: 'user-1',
      briefId: 'brief-1',
      action: ACTION,
    });

    expect(result.executionId).toBe('exec-001');
    expect(mockWorkflowExecutionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          triggeredBy: 'user-1',
          triggerType: 'manual',
          inputData: expect.objectContaining({
            sourceType: 'advisor',
            advisorBriefId: 'brief-1',
          }),
        }),
      })
    );
    expect(mockEnqueueWorkflowStep).toHaveBeenCalledWith('exec-001', 0, 0);
  });

  it('throws QUEUE_UNAVAILABLE when enqueue fails', async () => {
    mockEnqueueWorkflowStep.mockRejectedValue(new Error('redis down'));

    await expect(
      spawnAdvisorActionWorkflow({
        organizationId: 'org-1',
        userId: 'user-1',
        briefId: 'brief-1',
        action: ACTION,
      })
    ).rejects.toMatchObject({ code: 'QUEUE_UNAVAILABLE' });

    expect(mockWorkflowExecutionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exec-001' },
        data: expect.objectContaining({ status: 'failed' }),
      })
    );
  });

  it('throws CREATE_FAILED when prisma create fails', async () => {
    mockWorkflowExecutionCreate.mockRejectedValue(new Error('db error'));

    await expect(
      spawnAdvisorActionWorkflow({
        organizationId: 'org-1',
        userId: 'user-1',
        briefId: 'brief-1',
        action: ACTION,
      })
    ).rejects.toBeInstanceOf(AdvisorWorkflowSpawnError);
  });
});
