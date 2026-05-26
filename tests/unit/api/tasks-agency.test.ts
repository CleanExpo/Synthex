/**
 * /api/tasks agencyTaskId validation — SYN-972 Phase 128
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private _body: string;
    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
    }
    json() {
      return Promise.resolve(JSON.parse(this._body));
    }
    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }
  return {
    NextResponse: MockNextResponse,
    NextRequest: class extends Request {},
  };
});

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

const mockGetEffectiveQueryFilter = jest.fn();
const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveQueryFilter: (...args: unknown[]) =>
    mockGetEffectiveQueryFilter(...args),
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

const mockTaskCreate = jest.fn();
const mockTaskAggregate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    task: {
      create: (...args: unknown[]) => mockTaskCreate(...args),
      aggregate: (...args: unknown[]) => mockTaskAggregate(...args),
    },
  },
}));

jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_req: unknown, handler: () => Promise<unknown>) => handler(),
}));

import { POST } from '@/app/api/tasks/route';
import { createMockNextRequest } from '../../helpers/mock-request';

describe('POST /api/tasks agencyTaskId', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
    mockGetEffectiveQueryFilter.mockResolvedValue({ organizationId: 'org-1' });
    mockTaskAggregate.mockResolvedValue({ _max: { order: 0 } });
    mockTaskCreate.mockResolvedValue({
      id: 'task-1',
      title: 'Test',
      agencyTaskId: 'AT-002',
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const req = createMockNextRequest({
      method: 'POST',
      body: { title: 'T', agencyTaskId: 'AT-002' },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid agencyTaskId', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      body: { title: 'Test task', agencyTaskId: 'AT-999' },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('creates task with valid AT-002', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      body: { title: 'Copy draft', agencyTaskId: 'AT-002' },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(201);
    expect(mockTaskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agencyTaskId: 'AT-002',
          category: 'content',
        }),
      })
    );
  });
});
