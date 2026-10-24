/**
 * POST /api/approvals — steps go to named operators, never '*'.
 *
 * The approvals routes treat an assignedTo entry of '*' as "any
 * authenticated user": canAccessApproval / canApproveStep in
 * app/api/approvals/[id]/route.ts let anyone, in any organisation, open and
 * approve a '*' step. New requests must be assigned to the organisation's
 * operators (active business owners and owner team members), or to the
 * submitter when no operator is on record.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_req: unknown, fn: () => Promise<unknown>) => fn(),
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

const mockGetEffectiveOrg = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...a: unknown[]) => mockGetEffectiveOrg(...a),
}));

const mockUserFindUnique = jest.fn();
const mockOwnershipFindMany = jest.fn();
const mockTeamMemberFindMany = jest.fn();
const mockTemplateFindUnique = jest.fn();
const mockApprovalCreate = jest.fn();
const mockPostFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => {
  const instance = {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    businessOwnership: {
      findMany: (...a: unknown[]) => mockOwnershipFindMany(...a),
    },
    post: { findFirst: (...a: unknown[]) => mockPostFindFirst(...a) },
    teamMember: { findMany: (...a: unknown[]) => mockTeamMemberFindMany(...a) },
    workflowTemplate: {
      findUnique: (...a: unknown[]) => mockTemplateFindUnique(...a),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        approvalRequest: {
          create: (...a: unknown[]) => mockApprovalCreate(...a),
        },
        auditLog: { create: async () => ({}) },
      }),
  };
  return { __esModule: true, prisma: instance, default: instance };
});

import { POST } from '@/app/api/approvals/route';

type CreatedStep = { assignedTo: string[] };

function createdSteps(): CreatedStep[] {
  const call = mockApprovalCreate.mock.calls[0]?.[0] as {
    data: { steps: CreatedStep[] };
  };
  return call.data.steps;
}

function createApproval(body: Record<string, unknown> = {}) {
  return POST(
    createMockNextRequest({
      method: 'POST',
      body: {
        contentId: 'post-1',
        contentType: 'post',
        title: 'Approve the CARSI launch post',
        ...body,
      },
    }) as unknown as Parameters<typeof POST>[0]
  );
}

beforeEach(() => {
  mockPostFindFirst.mockResolvedValue({
    content: 'Launch post',
    platform: 'linkedin',
    metadata: {},
  });
  mockGetUserId.mockResolvedValue('user-submitter');
  mockUserFindUnique.mockResolvedValue({
    isMultiBusinessOwner: false,
    activeOrganizationId: null,
    organizationId: 'org-1',
    name: 'Submitter',
  });
  mockGetEffectiveOrg.mockResolvedValue('org-1');
  mockOwnershipFindMany.mockResolvedValue([{ ownerId: 'user-phill' }]);
  mockTeamMemberFindMany.mockResolvedValue([
    { userId: 'user-rana' },
    { userId: 'user-phill' },
  ]);
  mockTemplateFindUnique.mockResolvedValue(null);
  mockApprovalCreate.mockImplementation(async ({ data }) => ({
    id: 'approval-1',
    workflowId: null,
    description: null,
    dueDate: null,
    metadata: null,
    status: 'pending',
    priority: 'normal',
    currentStep: 0,
    createdAt: new Date('2026-10-20T00:00:00Z'),
    updatedAt: new Date('2026-10-20T00:00:00Z'),
    ...data,
  }));
});

describe('POST /api/approvals — step assignees', () => {
  it('assigns default steps to the organisation operators, not the wildcard', async () => {
    const res = await createApproval();

    expect(res.status).toBe(200);
    const steps = createdSteps();
    expect(steps).toHaveLength(2);
    for (const step of steps) {
      expect(step.assignedTo).not.toContain('*');
      expect([...step.assignedTo].sort()).toEqual(['user-phill', 'user-rana']);
    }
    expect(mockOwnershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', isActive: true },
      })
    );
    expect(mockTeamMemberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }),
      })
    );
  });

  it('assigns workflow-template steps to the operators too', async () => {
    mockTemplateFindUnique.mockResolvedValue({
      id: 'tmpl-1',
      steps: [
        {
          order: 0,
          type: 'review',
          name: 'Brand check',
          assigneeRole: 'editor',
        },
        { order: 1, type: 'final_approval', name: 'Sign-off' },
      ],
    });

    const res = await createApproval({ workflowId: 'tmpl-1' });

    expect(res.status).toBe(200);
    const steps = createdSteps();
    expect(steps).toHaveLength(2);
    for (const step of steps) {
      expect(step.assignedTo).not.toContain('*');
      expect([...step.assignedTo].sort()).toEqual(['user-phill', 'user-rana']);
    }
  });

  it('falls back to the submitter when the organisation has no operator on record', async () => {
    mockOwnershipFindMany.mockResolvedValue([]);
    mockTeamMemberFindMany.mockResolvedValue([]);

    const res = await createApproval();

    expect(res.status).toBe(200);
    for (const step of createdSteps()) {
      expect(step.assignedTo).toEqual(['user-submitter']);
    }
  });

  it('does not assign a removed owner or an owner who never accepted: only accepted members still in the organisation', async () => {
    mockOwnershipFindMany.mockResolvedValue([]);
    type Row = {
      userId: string;
      role: string;
      acceptedAt: Date | null;
      user: { organizationId: string | null };
    };
    const rows: Row[] = [
      {
        userId: 'owner-active',
        role: 'Owner',
        acceptedAt: new Date('2026-10-01'),
        user: { organizationId: 'org-1' },
      },
      {
        // Removed: the removal route only clears User.organizationId.
        userId: 'owner-removed',
        role: 'owner',
        acceptedAt: new Date('2026-09-01'),
        user: { organizationId: null },
      },
      {
        userId: 'owner-pending',
        role: 'owner',
        acceptedAt: null,
        user: { organizationId: 'org-1' },
      },
      {
        userId: 'owner-elsewhere',
        role: 'owner',
        acceptedAt: new Date('2026-09-01'),
        user: { organizationId: 'org-2' },
      },
    ];
    // A fake table that honours the parts of `where` the route relies on.
    mockTeamMemberFindMany.mockImplementation(
      async ({
        where,
      }: {
        where: {
          role: { equals: string };
          acceptedAt?: { not: null };
          user?: { organizationId: string };
        };
      }) =>
        rows
          .filter(r => r.role.toLowerCase() === where.role.equals)
          .filter(r => !where.acceptedAt || r.acceptedAt !== null)
          .filter(
            r =>
              !where.user || r.user.organizationId === where.user.organizationId
          )
          .map(r => ({ userId: r.userId }))
    );

    const res = await createApproval();

    expect(res.status).toBe(200);
    for (const step of createdSteps()) {
      expect(step.assignedTo).toEqual(['owner-active']);
    }
  });

  it('assigns the submitter when the user has no organisation', async () => {
    mockGetEffectiveOrg.mockResolvedValue(null);

    const res = await createApproval();

    expect(res.status).toBe(200);
    for (const step of createdSteps()) {
      expect(step.assignedTo).toEqual(['user-submitter']);
    }
    expect(mockOwnershipFindMany).not.toHaveBeenCalled();
  });
});
