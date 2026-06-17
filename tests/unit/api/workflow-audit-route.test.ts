/**
 * Route test for GET /api/workflows/executions/[id]/audit (SYN-972 Audit leg).
 * Verifies auth (401), org context (403), org-ownership (404), and the 200
 * trail built from the execution's steps.
 */
const securityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: (...a: unknown[]) => securityCheck(...a) },
  DEFAULT_POLICIES: { AUTHENTICATED_READ: {} },
}));

const userFindUnique = jest.fn();
const execFindFirst = jest.fn();
const stepFindMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    workflowExecution: { findFirst: (...a: unknown[]) => execFindFirst(...a) },
    stepExecution: { findMany: (...a: unknown[]) => stepFindMany(...a) },
  },
}));

import { GET } from '@/app/api/workflows/executions/[id]/audit/route';

const req = {} as unknown as Parameters<typeof GET>[0];
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  securityCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
  userFindUnique.mockResolvedValue({ organizationId: 'org-1' });
  execFindFirst.mockResolvedValue({ id: 'exec-1', title: 'Advisor: X', status: 'completed' });
  stepFindMany.mockResolvedValue([
    { stepIndex: 0, stepName: 'Generate', stepType: 'ai', status: 'completed', autoApproved: true, completedAt: new Date('2026-06-17T00:00:00Z') },
    { stepIndex: 1, stepName: 'Human review', stepType: 'approval', status: 'completed', autoApproved: false, approvedBy: 'ceo-1', approvedAt: new Date('2026-06-17T01:00:00Z') },
  ]);
});

describe('GET /api/workflows/executions/[id]/audit', () => {
  it('401 when unauthenticated', async () => {
    securityCheck.mockResolvedValue({ allowed: false, context: {} });
    const res = await GET(req, ctx('exec-1'));
    expect(res.status).toBe(401);
  });

  it('403 when the user has no organisation', async () => {
    userFindUnique.mockResolvedValue({ organizationId: null });
    const res = await GET(req, ctx('exec-1'));
    expect(res.status).toBe(403);
  });

  it('404 when the execution is not in the caller org', async () => {
    execFindFirst.mockResolvedValue(null);
    const res = await GET(req, ctx('exec-other'));
    expect(res.status).toBe(404);
  });

  it('200 returns the decision trail for an owned execution', async () => {
    const res = await GET(req, ctx('exec-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.execution.id).toBe('exec-1');
    expect(body.trail.map((e: { outcome: string }) => e.outcome)).toEqual([
      'auto_approved',
      'approved',
    ]);
    expect(body.trail[1].actor).toBe('ceo-1');
    // org-ownership was enforced
    expect(execFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'exec-1', organizationId: 'org-1' } }),
    );
  });
});
