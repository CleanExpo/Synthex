/**
 * Behavioral coverage for /api/admin/audit-log (SYN-1000).
 * The audit-log route exposes every privileged action in the system — it must
 * never run a single query for a non-admin. Contract (same as admin-users):
 * non-admin → 403 → (admin) 400 on bad query → 200 happy path.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  auditLog: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockVerifyAdmin = jest.fn();
jest.mock('@/lib/admin/verify-admin', () => ({
  verifyAdmin: (...args: unknown[]) => mockVerifyAdmin(...args),
}));

// Rate-limit wrapper just runs the handler in tests.
jest.mock('@/lib/middleware/api-rate-limit', () => ({
  admin: (_req: unknown, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

import { GET } from '@/app/api/admin/audit-log/route';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.auditLog.count.mockResolvedValue(0);
  mockPrisma.auditLog.findMany.mockResolvedValue([]);
  mockPrisma.auditLog.groupBy.mockResolvedValue([]);
});

describe('GET /api/admin/audit-log — admin gate (SYN-1000)', () => {
  it('returns 403 for a non-admin and never reads the audit log', async () => {
    mockVerifyAdmin.mockResolvedValue({ isAdmin: false, error: 'Admin access required' });
    const res = await GET(createMockNextRequest({ url: 'http://localhost/api/admin/audit-log' }));
    expect(res.status).toBe(403);
    expect(mockPrisma.auditLog.count).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.groupBy).not.toHaveBeenCalled();
  });

  it('returns 400 for an admin sending an invalid query param', async () => {
    mockVerifyAdmin.mockResolvedValue({ isAdmin: true, userId: 'admin-1' });
    const res = await GET(
      createMockNextRequest({ url: 'http://localhost/api/admin/audit-log?severity=not-valid' })
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('returns 200 with the audit log for an admin', async () => {
    mockVerifyAdmin.mockResolvedValue({ isAdmin: true, userId: 'admin-1' });
    const res = await GET(createMockNextRequest({ url: 'http://localhost/api/admin/audit-log' }));
    expect(res.status).toBe(200);
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledTimes(1);
  });
});
