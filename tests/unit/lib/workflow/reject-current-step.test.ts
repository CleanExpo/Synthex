/**
 * Unit tests for rejectCurrentStep — the reject / request-revision Gate
 * decision in the agency loop (SYN-972).
 *
 * A CEO reviewing a `waiting_approval` workflow could approve or cancel; this
 * adds the third decision: send it back for revision without publishing. The
 * workflow goes to `revision_requested` (non-terminal) and the reason is
 * recorded — no migration (reuses status + errorMessage + outputData).
 */
const mockPrisma = {
  workflowExecution: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  stepExecution: {
    updateMany: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import { rejectCurrentStep } from '@/lib/workflow/orchestrator';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.stepExecution.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.workflowExecution.update.mockResolvedValue({});
});

describe('rejectCurrentStep', () => {
  it('holds the workflow as revision_requested and records the reason', async () => {
    mockPrisma.workflowExecution.findUniqueOrThrow.mockResolvedValue({
      currentStepIndex: 4,
      status: 'waiting_approval',
    });

    await rejectCurrentStep('exec-1', 'ceo-1', 'Tone too salesy — soften the CTA');

    // Step marked rejected with the reason captured (reused columns).
    const stepArgs = mockPrisma.stepExecution.updateMany.mock.calls[0][0];
    expect(stepArgs.where).toMatchObject({
      workflowExecutionId: 'exec-1',
      stepIndex: 4,
      status: 'waiting_approval',
    });
    expect(stepArgs.data.status).toBe('rejected');
    expect(stepArgs.data.errorMessage).toBe('Tone too salesy — soften the CTA');
    expect(stepArgs.data.outputData).toMatchObject({
      rejectedBy: 'ceo-1',
      reason: 'Tone too salesy — soften the CTA',
    });

    // Workflow held for revision — NOT terminal, NOT advanced/published.
    expect(mockPrisma.workflowExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: { status: 'revision_requested', errorMessage: 'Tone too salesy — soften the CTA' },
    });
  });

  it('throws and writes nothing when the execution is not waiting for approval', async () => {
    mockPrisma.workflowExecution.findUniqueOrThrow.mockResolvedValue({
      currentStepIndex: 2,
      status: 'running',
    });

    await expect(
      rejectCurrentStep('exec-2', 'ceo-1', 'reason'),
    ).rejects.toThrow(/not waiting for approval/i);

    expect(mockPrisma.stepExecution.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.workflowExecution.update).not.toHaveBeenCalled();
  });
});
