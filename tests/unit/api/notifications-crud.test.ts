/**
 * Unit Tests for Notifications CRUD API Routes
 * Tests GET/POST /api/notifications and PATCH /api/notifications/[id]/read
 *
 * Tests actual route handlers with mocked Prisma and security dependencies.
 * Uses createMockNextRequest to avoid the jest.setup.js polyfill conflict with NextRequest.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// Mock Prisma
const mockPrisma = {
  notification: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock security checker
const mockSecurityCheck = jest.fn();
const mockCreateSecureResponse = jest.fn((body: unknown, status: number) => {
  return new Response(JSON.stringify(body), { status });
});

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (...args: unknown[]) => mockCreateSecureResponse(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true, allowRead: true },
    AUTHENTICATED_WRITE: { requireAuth: true, allowWrite: true },
  },
}));

// Mock WebSocket notification channel
jest.mock('@/lib/websocket/notification-channel', () => ({
  NotificationChannel: {
    notify: jest.fn().mockResolvedValue(undefined),
  },
}));

import { GET, POST } from '@/app/api/notifications/route';

describe('Notifications API - /api/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(
    method: string = 'GET',
    url: string = 'http://localhost:3000/api/notifications',
    body?: object
  ) {
    return createMockNextRequest({ method, url, body });
  }

  // =========================================================================
  // GET /api/notifications
  // =========================================================================
  describe('GET /api/notifications', () => {
    it('should return 401 when not authenticated', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: false,
        error: 'Unauthorized',
        context: {},
      });

      const req = createRequest('GET');
      await GET(req);

      expect(mockCreateSecureResponse).toHaveBeenCalledWith(
        { error: 'Unauthorized' },
        401,
        {}
      );
    });

    it('should return paginated notifications', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123' },
      });

      const mockNotifications = [
        { id: 'n1', type: 'info', title: 'Welcome', message: 'Hello!', read: false, data: null, createdAt: new Date() },
        { id: 'n2', type: 'success', title: 'Posted', message: 'Content published', read: true, data: null, createdAt: new Date() },
      ];

      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrisma.notification.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5); // unread

      const req = createRequest('GET');
      await GET(req);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
          orderBy: { createdAt: 'desc' },
          take: 50,
          skip: 0,
        })
      );

      expect(mockCreateSecureResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockNotifications,
          pagination: expect.objectContaining({
            total: 10,
            limit: 50,
            offset: 0,
          }),
          unreadCount: 5,
        }),
        200,
        expect.any(Object)
      );
    });

    it('should filter unread only when specified', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123' },
      });

      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      const req = createRequest('GET', 'http://localhost:3000/api/notifications?unreadOnly=true');
      await GET(req);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', read: false },
        })
      );
    });

    it('should respect custom limit and offset', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123' },
      });

      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      const req = createRequest('GET', 'http://localhost:3000/api/notifications?limit=10&offset=20');
      await GET(req);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    it('should cap limit at 100', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123' },
      });

      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      const req = createRequest('GET', 'http://localhost:3000/api/notifications?limit=500');
      await GET(req);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // capped
        })
      );
    });

    it('should return 500 on database error', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123' },
      });

      mockPrisma.notification.findMany.mockRejectedValue(new Error('DB failure'));

      const req = createRequest('GET');
      await GET(req);

      expect(mockCreateSecureResponse).toHaveBeenCalledWith(
        { error: 'Failed to fetch notifications' },
        500,
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // POST /api/notifications
  // =========================================================================
  describe('POST /api/notifications', () => {
    it('should return 401 when not authenticated', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: false,
        error: 'Unauthorized',
        context: {},
      });

      const req = createRequest('POST', 'http://localhost:3000/api/notifications', {
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });
      await POST(req);

      expect(mockCreateSecureResponse).toHaveBeenCalledWith(
        { error: 'Unauthorized' },
        401,
        {}
      );
    });

    it('should create notification for self', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123', userRole: 'user' },
      });

      const mockNotification = {
        id: 'notif-new',
        type: 'info',
        title: 'Test',
        message: 'Test message',
        read: false,
        data: null,
        createdAt: new Date(),
      };
      mockPrisma.notification.create.mockResolvedValue(mockNotification);

      const req = createRequest('POST', 'http://localhost:3000/api/notifications', {
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });
      await POST(req);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'info',
            title: 'Test',
            message: 'Test message',
            userId: 'user-123',
          }),
        })
      );

      expect(mockCreateSecureResponse).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
        201,
        expect.any(Object)
      );
    });

    it('should return 403 when non-admin creates for another user', async () => {
      // userId must be a valid cuid to pass Zod schema validation
      const otherUserCuid = 'clh5ez01x0000jx08a1b2c3d4';

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123', userRole: 'user' },
      });

      const req = createRequest('POST', 'http://localhost:3000/api/notifications', {
        type: 'info',
        title: 'Test',
        message: 'Test',
        userId: otherUserCuid,
      });
      await POST(req);

      expect(mockCreateSecureResponse).toHaveBeenCalledWith(
        { error: 'Cannot create notifications for other users' },
        403,
        expect.any(Object)
      );
    });

    it('should allow admin to create for another user', async () => {
      const otherUserCuid = 'clh5ez01x0000jx08a1b2c3d4';

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'admin-001', userRole: 'admin' },
      });

      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-admin',
        type: 'warning',
        title: 'Admin Notice',
        message: 'System update',
        read: false,
        data: null,
        createdAt: new Date(),
      });

      const req = createRequest('POST', 'http://localhost:3000/api/notifications', {
        type: 'warning',
        title: 'Admin Notice',
        message: 'System update',
        userId: otherUserCuid,
      });
      await POST(req);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: otherUserCuid,
          }),
        })
      );
    });

    it('should return 400 for invalid notification type', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123', userRole: 'user' },
      });

      const req = createRequest('POST', 'http://localhost:3000/api/notifications', {
        type: 'invalid-type',
        title: 'Test',
        message: 'Test',
      });
      await POST(req);

      expect(mockCreateSecureResponse).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid notification data' }),
        400,
        expect.any(Object)
      );
    });

    it('should return 400 for empty title', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123', userRole: 'user' },
      });

      const req = createRequest('POST', 'http://localhost:3000/api/notifications', {
        type: 'info',
        title: '',
        message: 'Test',
      });
      await POST(req);

      expect(mockCreateSecureResponse).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid notification data' }),
        400,
        expect.any(Object)
      );
    });

    it('should return 500 on database create error', async () => {
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123', userRole: 'user' },
      });

      mockPrisma.notification.create.mockRejectedValue(new Error('DB write error'));

      const req = createRequest('POST', 'http://localhost:3000/api/notifications', {
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });
      await POST(req);

      expect(mockCreateSecureResponse).toHaveBeenCalledWith(
        { error: 'Failed to create notification' },
        500,
        expect.any(Object)
      );
    });
  });
});
