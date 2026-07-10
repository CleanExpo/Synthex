/**
 * BUDGET-ENFORCER — admin read endpoint GET /api/admin/org-spend.
 *
 * Pins the verifyAdmin + adminRateLimit + 403 gate pattern
 * (per app/api/admin/platform-stats) and the snapshot envelope.
 */

const mockVerifyAdmin = jest.fn();
const mockGetSnapshot = jest.fn();

jest.mock('@/lib/admin/verify-admin', () => ({
  verifyAdmin: (...a: unknown[]) => mockVerifyAdmin(...a),
}));

jest.mock('@/lib/middleware/api-rate-limit', () => ({
  admin: (_req: unknown, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/ai/budget-enforcer', () => ({
  getOrgSpendSnapshot: (...a: unknown[]) => mockGetSnapshot(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { GET } from '@/app/api/admin/org-spend/route';

function makeRequest(query: string): any {
  return {
    url: `http://localhost/api/admin/org-spend${query}`,
    headers: { get: () => null },
    cookies: { get: () => undefined },
  };
}

describe('GET /api/admin/org-spend', () => {
  beforeEach(() => {
    mockVerifyAdmin.mockResolvedValue({ isAdmin: true });
    mockGetSnapshot.mockResolvedValue({
      organizationId: 'org-1',
      dailySpendUsd: 1.5,
      monthlySpendUsd: 20,
      inFlightReservedUsd: { daily: 0.1, monthly: 0.1 },
      dailyCeilingUsd: 10,
      monthlyCeilingUsd: 200,
      enforcementMode: 'enforce',
      policySource: 'policy_row',
    });
  });

  it('403s non-admin callers without touching the snapshot', async () => {
    mockVerifyAdmin.mockResolvedValue({ isAdmin: false, error: 'nope' });
    const res = await GET(makeRequest('?organizationId=org-1'));
    expect(res.status).toBe(403);
    expect(mockGetSnapshot).not.toHaveBeenCalled();
  });

  it('400s when organizationId is missing', async () => {
    const res = await GET(makeRequest(''));
    expect(res.status).toBe(400);
    expect(mockGetSnapshot).not.toHaveBeenCalled();
  });

  it('returns the spend-vs-ceiling snapshot for admins', async () => {
    const res = await GET(makeRequest('?organizationId=org-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(mockGetSnapshot).toHaveBeenCalledWith('org-1');
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({
      organizationId: 'org-1',
      dailySpendUsd: 1.5,
      dailyCeilingUsd: 10,
      enforcementMode: 'enforce',
    });
  });

  it('500s (sanitised) when the snapshot read fails', async () => {
    mockGetSnapshot.mockRejectedValue(new Error('db down'));
    const res = await GET(makeRequest('?organizationId=org-1'));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Internal Server Error');
  });
});
