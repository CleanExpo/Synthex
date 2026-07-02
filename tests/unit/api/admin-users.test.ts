/**
 * Behavioral coverage for /api/admin/users (SYN-1000).
 * The admin routes had ZERO behavioral coverage — this proves the verifyAdmin gate
 * actually blocks non-admins (403) and that the privileged query only runs for admins.
 * Contract: non-admin → 403 → (admin) 400 on bad query → 200 happy path.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
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

jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), info: jest.fn() } }));

import { GET, POST } from '@/app/api/admin/users/route';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.count.mockResolvedValue(0);
  mockPrisma.user.findMany.mockResolvedValue([]);
});

describe('GET /api/admin/users — admin gate (SYN-1000)', () => {
  it('returns 403 for a non-admin and never queries users', async () => {
    mockVerifyAdmin.mockResolvedValue({ isAdmin: false, error: 'Admin access required' });
    const res = await GET(createMockNextRequest({ url: 'http://localhost/api/admin/users' }));
    expect(res.status).toBe(403);
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('returns 400 for an admin sending an invalid query param', async () => {
    mockVerifyAdmin.mockResolvedValue({ isAdmin: true, userId: 'admin-1' });
    const res = await GET(
      createMockNextRequest({ url: 'http://localhost/api/admin/users?limit=not-a-number' })
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('returns 200 with the user list for an admin', async () => {
    mockVerifyAdmin.mockResolvedValue({ isAdmin: true, userId: 'admin-1' });
    const res = await GET(createMockNextRequest({ url: 'http://localhost/api/admin/users' }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/admin/users — admin gate (SYN-1000)', () => {
  it('returns 403 for a non-admin', async () => {
    mockVerifyAdmin.mockResolvedValue({ isAdmin: false, error: 'Admin access required' });
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/users',
        body: { userId: 'u1', role: 'admin' },
      })
    );
    expect(res.status).toBe(403);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
