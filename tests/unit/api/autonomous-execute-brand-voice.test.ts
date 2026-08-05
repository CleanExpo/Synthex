/**
 * Behavioural coverage for POST /api/autonomous/execute — AT-027 brand-voice.
 */

/** @jest-environment node */

const mockWorkflowCreate = jest.fn();
const mockWorkflowUpdate = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => {
  const stub = {
    workflowExecution: {
      create: (...args: unknown[]) => mockWorkflowCreate(...args),
      update: (...args: unknown[]) => mockWorkflowUpdate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  };
  return { __esModule: true, default: stub, prisma: stub };
});

const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
  },
}));

jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({ allowed: true }),
}));

jest.mock('@/lib/agency/foundation-context', () => ({
  getAgencyFoundationContext: async () => ({
    organizationId: 'org-1',
    ceoFoundationExcerpt: 'ceo',
    verificationGatesExcerpt: 'vg',
    loadedAt: '2026-08-06T00:00:00.000Z',
  }),
  mergeFoundationIntoInput: (
    input: Record<string, unknown>,
    foundation: Record<string, unknown>
  ) => ({
    ...input,
    agencyFoundation: foundation ?? { organizationId: 'org-1' },
  }),
}));

const mockEnqueue = jest.fn();
jest.mock('@/lib/queue/bull-queue', () => ({
  enqueueWorkflowStep: (...args: unknown[]) => mockEnqueue(...args),
}));

import { POST } from '@/app/api/autonomous/execute/route';
import { createMockNextRequest } from '../../helpers/mock-request';

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'user-1' } });
  mockUserFindUnique.mockResolvedValue({ organizationId: 'org-1' });
  mockEnqueue.mockResolvedValue(undefined);
  mockWorkflowCreate.mockResolvedValue({
    id: 'exec-1',
    title: 'Campaign',
    status: 'pending',
    totalSteps: 3,
    createdAt: new Date('2026-08-06T00:00:00.000Z'),
  });
});

describe('POST /api/autonomous/execute brand-voice gate (AT-027)', () => {
  it('injects a brand-voice validation step before publish', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/autonomous/execute',
        body: {
          title: 'Campaign',
          steps: [
            { name: 'Draft', type: 'ai', promptTemplate: 'Write a post' },
            { name: 'Publish', type: 'action', actionType: 'publish' },
          ],
        },
      })
    );

    expect(res.status).toBe(201);
    expect(mockWorkflowCreate).toHaveBeenCalledTimes(1);
    const createArg = mockWorkflowCreate.mock.calls[0][0];
    const steps = createArg.data.inputData.steps;
    expect(createArg.data.totalSteps).toBe(3);
    expect(steps).toEqual([
      { name: 'Draft', type: 'ai', promptTemplate: 'Write a post' },
      {
        name: 'Brand voice gate',
        type: 'validation',
        config: { subType: 'brand-voice', passScore: 75 },
      },
      { name: 'Publish', type: 'action', actionType: 'publish' },
    ]);
    expect(createArg.data.inputData.sourceType).toBe('autonomous');
    expect(createArg.data.inputData.agencyFoundation).toEqual(
      expect.objectContaining({ organizationId: 'org-1' })
    );
  });

  it('does not duplicate an existing brand-voice gate', async () => {
    const steps = [
      { name: 'Draft', type: 'ai', promptTemplate: 'Write' },
      {
        name: 'Brand voice gate',
        type: 'validation',
        config: { subType: 'brand-voice', passScore: 75 },
      },
      { name: 'Publish', type: 'action', actionType: 'publish' },
    ];

    mockWorkflowCreate.mockResolvedValue({
      id: 'exec-2',
      title: 'Campaign',
      status: 'pending',
      totalSteps: 3,
      createdAt: new Date('2026-08-06T00:00:00.000Z'),
    });

    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/autonomous/execute',
        body: { title: 'Campaign', steps },
      })
    );

    expect(res.status).toBe(201);
    const created = mockWorkflowCreate.mock.calls[0][0].data.inputData.steps;
    expect(created).toEqual(steps);
    expect(
      created.filter(
        (s: { config?: { subType?: string } }) =>
          s.config?.subType === 'brand-voice'
      )
    ).toHaveLength(1);
  });
});
