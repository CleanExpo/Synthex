/** @jest-environment node */

/**
 * p2-u14: approval-workflow is ported off the noop-client to Prisma. Reads are
 * scoped to the caller's organisation or their own submissions; client-scoped
 * calls and post-approval scheduling are honestly NOT_PROVISIONED.
 */

const mockPrisma = {
  user: { findUnique: jest.fn() },
  approvalRequest: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  workflowTemplate: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  approvalWorkflow,
  ApprovalWorkflowNotProvisionedError,
} from '@/lib/services/approval-workflow';

const now = new Date('2026-10-18T00:00:00Z');

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'apr_1',
    contentId: 'post_1',
    contentType: 'post',
    workflowId: null,
    submittedBy: 'user_1',
    status: 'pending',
    priority: 'normal',
    currentStep: 0,
    totalSteps: 1,
    steps: [
      {
        id: 's0',
        order: 0,
        type: 'final_approval',
        name: 'Final',
        status: 'pending',
        assignedTo: ['*'],
        comments: [],
        requiredApprovals: 1,
        currentApprovals: 0,
        isOptional: false,
        createdAt: now.toISOString(),
      },
    ],
    title: 'Launch post',
    description: null,
    dueDate: null,
    metadata: { title: 'Launch post' },
    slaReminderSentAt: null,
    organizationId: 'org_1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    organizationId: 'org_1',
    name: 'Ada',
    email: 'ada@example.test',
  });
});

describe('approval-workflow (Prisma port)', () => {
  it('reads a request scoped to the caller organisation or own submission', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue(row());

    const req = await approvalWorkflow.getApprovalRequest('apr_1', 'user_1');

    expect(req?.id).toBe('apr_1');
    expect(mockPrisma.approvalRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'apr_1',
        AND: [{ OR: [{ organizationId: 'org_1' }, { submittedBy: 'user_1' }] }],
      },
    });
  });

  it('scopes to own submissions when the caller has no organisation', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });
    mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);

    expect(
      await approvalWorkflow.getApprovalRequest('apr_x', 'user_2')
    ).toBeNull();
    expect(mockPrisma.approvalRequest.findFirst).toHaveBeenCalledWith({
      where: { id: 'apr_x', AND: [{ submittedBy: 'user_2' }] },
    });
  });

  it('creates a request in the caller organisation', async () => {
    mockPrisma.approvalRequest.create.mockImplementation(async ({ data }) =>
      row({ ...data, id: 'apr_new' })
    );

    const req = await approvalWorkflow.createApprovalRequest('user_1', {
      contentId: 'post_1',
      contentType: 'post',
      metadata: { title: 'Launch post' },
    });

    expect(req.id).toBe('apr_new');
    const { data } = mockPrisma.approvalRequest.create.mock.calls[0][0];
    expect(data).toMatchObject({
      submittedBy: 'user_1',
      organizationId: 'org_1',
      title: 'Launch post',
      totalSteps: 2,
    });
  });

  it('lists workflow templates for the given organisation only', async () => {
    mockPrisma.workflowTemplate.findMany.mockResolvedValue([]);

    await approvalWorkflow.getWorkflowTemplates('org_1');

    expect(mockPrisma.workflowTemplate.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org_1' },
      orderBy: { name: 'asc' },
    });
  });

  it('NOT_PROVISIONED: client-scoped requests throw a named error', async () => {
    const err = await approvalWorkflow
      .createApprovalRequest('user_1', {
        contentId: 'post_1',
        contentType: 'post',
        clientId: 'client_1',
        metadata: { title: 'x' },
      })
      .catch(e => e);

    expect(err).toBeInstanceOf(ApprovalWorkflowNotProvisionedError);
    expect(err.code).toBe('FEATURE_NOT_PROVISIONED');
    expect(err.table).toBe('clients');
    expect(mockPrisma.approvalRequest.create).not.toHaveBeenCalled();

    await expect(
      approvalWorkflow.getApprovalRequests('user_1', { clientId: 'client_1' })
    ).rejects.toBeInstanceOf(ApprovalWorkflowNotProvisionedError);
  });

  it('NOT_PROVISIONED: final approval of a post records the unavailable scheduling step', async () => {
    mockPrisma.approvalRequest.findFirst.mockResolvedValue(row());
    mockPrisma.approvalRequest.update.mockImplementation(async ({ data }) =>
      row(data)
    );

    const req = await approvalWorkflow.approveStep('apr_1', 'user_1');

    expect(req.status).toBe('approved');
    expect(req.metadata.postApprovalAction).toEqual({
      available: false,
      reason: expect.stringContaining('scheduled_posts'),
    });
    expect(mockPrisma.approvalRequest.update.mock.calls[0][0].where).toEqual({
      id: 'apr_1',
    });
  });
});
