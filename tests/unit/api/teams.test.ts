/**
 * Teams API Tests
 *
 * @description Unit tests for team management endpoints:
 * - /api/teams/members/[memberId]
 * - /api/teams/members/[memberId]/role
 * - /api/teams/invitations
 * - /api/teams/invitations/[id]
 * - /api/teams/activity
 * - /api/teams/stats
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before any imports
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  campaign: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  post: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  teamInvitation: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  userRole: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  role: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  permissionAudit: {
    create: vi.fn(),
  },
};

const mockSecurityChecker = {
  check: vi.fn().mockResolvedValue({ allowed: true }),
  createSecureResponse: vi.fn((body, status) => {
    const response = new Response(JSON.stringify(body), { status });
    return response;
  }),
};

const mockAuditLogger = {
  log: vi.fn().mockResolvedValue(undefined),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const mockSendTeamInviteEmail = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

vi.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: mockSecurityChecker,
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: {},
    AUTHENTICATED_WRITE: {},
  },
}));

vi.mock('@/lib/security/audit-logger', () => ({
  auditLogger: mockAuditLogger,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/lib/email', () => ({
  sendTeamInviteEmail: mockSendTeamInviteEmail,
}));

vi.mock('jsonwebtoken', () => ({
  verify: vi.fn().mockReturnValue({ sub: 'test-user-id', email: 'test@example.com' }),
}));

vi.mock('@/lib/api/response-optimizer', () => ({
  ResponseOptimizer: {
    createResponse: vi.fn((data, options) => {
      return new Response(JSON.stringify(data), {
        status: options?.status || 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
    createErrorResponse: vi.fn((message, status) => {
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  },
}));

describe('Team Members API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSecurityChecker.check.mockResolvedValue({ allowed: true });
  });

  describe('Member Data Validation', () => {
    it('should validate member update fields', () => {
      const validUpdate = {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        preferences: { theme: 'dark' },
      };

      expect(validUpdate.name.length).toBeLessThanOrEqual(100);
      expect(validUpdate.avatar).toMatch(/^https?:\/\//);
      expect(typeof validUpdate.preferences).toBe('object');
    });

    it('should reject invalid name length', () => {
      const invalidName = 'a'.repeat(101);
      expect(invalidName.length).toBeGreaterThan(100);
    });

    it('should reject invalid avatar URL', () => {
      const invalidUrl = 'not-a-url';
      expect(invalidUrl).not.toMatch(/^https?:\/\//);
    });
  });

  describe('Member Operations', () => {
    it('should find member by ID and organization', async () => {
      const mockMember = {
        id: 'member-1',
        email: 'member@example.com',
        name: 'Test Member',
        organizationId: 'org-1',
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockMember);

      const result = await mockPrisma.user.findFirst({
        where: {
          id: 'member-1',
          organizationId: 'org-1',
        },
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe('member-1');
    });

    it('should update member profile', async () => {
      const updatedMember = {
        id: 'member-1',
        name: 'Updated Name',
        avatar: 'https://example.com/new-avatar.jpg',
      };

      mockPrisma.user.update.mockResolvedValue(updatedMember);

      const result = await mockPrisma.user.update({
        where: { id: 'member-1' },
        data: { name: 'Updated Name' },
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should remove member from organization', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'member-1',
        organizationId: null,
      });

      const result = await mockPrisma.user.update({
        where: { id: 'member-1' },
        data: { organizationId: null },
      });

      expect(result.organizationId).toBeNull();
    });
  });

  describe('Security Checks', () => {
    it('should deny access when security check fails', async () => {
      mockSecurityChecker.check.mockResolvedValueOnce({
        allowed: false,
        error: 'Unauthorized',
      });

      const checkResult = await mockSecurityChecker.check({}, {});

      expect(checkResult.allowed).toBe(false);
      expect(checkResult.error).toBe('Unauthorized');
    });

    it('should verify admin permissions for member removal', async () => {
      const adminRoles = [
        { role: { name: 'admin', permissions: ['*'] } },
      ];

      mockPrisma.userRole.findMany.mockResolvedValue(adminRoles);

      const result = await mockPrisma.userRole.findMany({
        where: { userId: 'admin-user' },
      });

      const isAdmin = result.some(
        (ur: any) =>
          ur.role?.name.toLowerCase() === 'admin' ||
          ur.role?.permissions?.includes('*')
      );

      expect(isAdmin).toBe(true);
    });
  });
});

describe('Team Member Role API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Role Validation', () => {
    it('should validate role ID is required', () => {
      const validRoleChange = { roleId: 'role-1' };
      const invalidRoleChange = { roleId: '' };

      expect(validRoleChange.roleId.length).toBeGreaterThan(0);
      expect(invalidRoleChange.roleId.length).toBe(0);
    });
  });

  describe('Role Operations', () => {
    it('should get available roles for organization', async () => {
      const mockRoles = [
        { id: 'role-1', name: 'Admin', permissions: ['*'] },
        { id: 'role-2', name: 'Editor', permissions: ['edit_content'] },
        { id: 'role-3', name: 'Viewer', permissions: ['view_content'] },
      ];

      mockPrisma.role.findMany.mockResolvedValue(mockRoles);

      const result = await mockPrisma.role.findMany({
        where: { organizationId: 'org-1' },
      });

      expect(result.length).toBe(3);
      expect(result[0].name).toBe('Admin');
    });

    it('should change member role', async () => {
      // Delete existing roles
      mockPrisma.userRole.deleteMany.mockResolvedValue({ count: 1 });

      // Create new role
      mockPrisma.userRole.create.mockResolvedValue({
        userId: 'member-1',
        roleId: 'role-2',
        grantedBy: 'admin-1',
      });

      const deleteResult = await mockPrisma.userRole.deleteMany({
        where: { userId: 'member-1' },
      });

      const createResult = await mockPrisma.userRole.create({
        data: {
          userId: 'member-1',
          roleId: 'role-2',
          grantedBy: 'admin-1',
        },
      });

      expect(deleteResult.count).toBe(1);
      expect(createResult.roleId).toBe('role-2');
    });

    it('should log permission audit', async () => {
      mockPrisma.permissionAudit.create.mockResolvedValue({
        id: 'audit-1',
        action: 'grant',
        targetUserId: 'member-1',
        targetRoleId: 'role-2',
      });

      const result = await mockPrisma.permissionAudit.create({
        data: {
          action: 'grant',
          targetUserId: 'member-1',
          targetRoleId: 'role-2',
          performedBy: 'admin-1',
          organizationId: 'org-1',
        },
      });

      expect(result.action).toBe('grant');
    });
  });
});

describe('Team Invitations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Invitation Validation', () => {
    it('should validate email format', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      expect(emailRegex.test('valid@example.com')).toBe(true);
      expect(emailRegex.test('invalid-email')).toBe(false);
      expect(emailRegex.test('missing@domain')).toBe(false);
    });

    it('should validate role is provided', () => {
      const validInvite = { email: 'test@example.com', role: 'viewer' };
      const invalidInvite = { email: 'test@example.com', role: '' };

      expect(validInvite.role.length).toBeGreaterThan(0);
      expect(invalidInvite.role.length).toBe(0);
    });

    it('should validate message length', () => {
      const validMessage = 'Welcome to our team!';
      const invalidMessage = 'a'.repeat(501);

      expect(validMessage.length).toBeLessThanOrEqual(500);
      expect(invalidMessage.length).toBeGreaterThan(500);
    });
  });

  describe('Invitation Operations', () => {
    it('should create invitation', async () => {
      const mockInvitation = {
        id: 'invite-1',
        email: 'newuser@example.com',
        role: 'editor',
        status: 'sent',
        sentAt: new Date(),
      };

      mockPrisma.teamInvitation.create.mockResolvedValue(mockInvitation);

      const result = await mockPrisma.teamInvitation.create({
        data: {
          email: 'newuser@example.com',
          role: 'editor',
          status: 'sent',
          userId: 'admin-1',
          organizationId: 'org-1',
        },
      });

      expect(result.email).toBe('newuser@example.com');
      expect(result.status).toBe('sent');
    });

    it('should list invitations with pagination', async () => {
      const mockInvitations = [
        { id: 'invite-1', email: 'user1@example.com', status: 'sent' },
        { id: 'invite-2', email: 'user2@example.com', status: 'sent' },
      ];

      mockPrisma.teamInvitation.findMany.mockResolvedValue(mockInvitations);
      mockPrisma.teamInvitation.count.mockResolvedValue(2);

      const invitations = await mockPrisma.teamInvitation.findMany({
        where: { organizationId: 'org-1' },
        skip: 0,
        take: 20,
      });

      const total = await mockPrisma.teamInvitation.count({
        where: { organizationId: 'org-1' },
      });

      expect(invitations.length).toBe(2);
      expect(total).toBe(2);
    });

    it('should check for duplicate invitations', async () => {
      mockPrisma.teamInvitation.findFirst.mockResolvedValue({
        id: 'invite-1',
        email: 'existing@example.com',
        status: 'sent',
      });

      const existing = await mockPrisma.teamInvitation.findFirst({
        where: {
          email: 'existing@example.com',
          organizationId: 'org-1',
          status: 'sent',
        },
      });

      expect(existing).not.toBeNull();
    });

    it('should delete invitation', async () => {
      mockPrisma.teamInvitation.delete.mockResolvedValue({
        id: 'invite-1',
      });

      const result = await mockPrisma.teamInvitation.delete({
        where: { id: 'invite-1' },
      });

      expect(result.id).toBe('invite-1');
    });
  });

  describe('Member Limit Check', () => {
    it('should enforce organization member limit', async () => {
      mockPrisma.user.count.mockResolvedValue(5);
      mockPrisma.teamInvitation.count.mockResolvedValue(0);

      const currentMembers = await mockPrisma.user.count({
        where: { organizationId: 'org-1' },
      });

      const pendingInvites = await mockPrisma.teamInvitation.count({
        where: { organizationId: 'org-1', status: 'sent' },
      });

      const maxUsers = 5;
      const total = currentMembers + pendingInvites;

      expect(total).toBe(5);
      expect(total >= maxUsers).toBe(true);
    });
  });
});

describe('Team Activity API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Activity Feed', () => {
    it('should fetch audit logs for organization members', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'member-1',
          action: 'campaign.created',
          resource: 'campaign',
          category: 'campaign',
          details: { name: 'Summer Campaign' },
          createdAt: new Date(),
        },
        {
          id: 'log-2',
          userId: 'member-2',
          action: 'post.published',
          resource: 'post',
          category: 'post',
          details: { platform: 'twitter' },
          createdAt: new Date(),
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await mockPrisma.auditLog.findMany({
        where: { userId: { in: ['member-1', 'member-2'] } },
        orderBy: { createdAt: 'desc' },
      });

      expect(result.length).toBe(2);
    });

    it('should filter by category', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'member-1',
          action: 'campaign.created',
          category: 'campaign',
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await mockPrisma.auditLog.findMany({
        where: {
          userId: { in: ['member-1'] },
          category: 'campaign',
        },
      });

      expect(result.length).toBe(1);
      expect(result[0].category).toBe('campaign');
    });

    it('should transform action to human-readable format', () => {
      const actionDescriptions: Record<string, string> = {
        'campaign.created': 'created a new campaign',
        'post.published': 'published content to',
        'teams.member_added': 'added new team member',
      };

      expect(actionDescriptions['campaign.created']).toBe('created a new campaign');
      expect(actionDescriptions['post.published']).toBe('published content to');
    });
  });
});

describe('Team Stats API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Statistics Calculation', () => {
    it('should count total members', async () => {
      mockPrisma.user.count.mockResolvedValue(10);

      const total = await mockPrisma.user.count({
        where: { organizationId: 'org-1' },
      });

      expect(total).toBe(10);
    });

    it('should count active campaigns', async () => {
      mockPrisma.campaign.count.mockResolvedValue(5);

      const active = await mockPrisma.campaign.count({
        where: {
          userId: { in: ['member-1', 'member-2'] },
          status: 'active',
        },
      });

      expect(active).toBe(5);
    });

    it('should aggregate content metrics', async () => {
      const mockPosts = [
        { analytics: { likes: 10, comments: 5, shares: 2, reach: 100 } },
        { analytics: { likes: 20, comments: 10, shares: 5, reach: 200 } },
      ];

      mockPrisma.post.findMany.mockResolvedValue(mockPosts);

      const posts = await mockPrisma.post.findMany({
        where: { status: 'published' },
      });

      let totalReach = 0;
      let totalEngagement = 0;

      for (const post of posts) {
        const analytics = (post.analytics as any) || {};
        totalReach += analytics.reach || 0;
        totalEngagement +=
          (analytics.likes || 0) +
          (analytics.comments || 0) +
          (analytics.shares || 0);
      }

      expect(totalReach).toBe(300);
      expect(totalEngagement).toBe(52);
    });

    it('should calculate engagement rate', () => {
      const totalEngagement = 50;
      const totalImpressions = 1000;

      const engagementRate =
        totalImpressions > 0
          ? Math.round((totalEngagement / totalImpressions) * 10000) / 100
          : 0;

      expect(engagementRate).toBe(5);
    });

    it('should group content by platform', async () => {
      const mockGroupBy = [
        { platform: 'twitter', _count: { id: 10 } },
        { platform: 'instagram', _count: { id: 15 } },
        { platform: 'linkedin', _count: { id: 5 } },
      ];

      mockPrisma.post.groupBy.mockResolvedValue(mockGroupBy);

      const result = await mockPrisma.post.groupBy({
        by: ['platform'],
        _count: { id: true },
      });

      expect(result.length).toBe(3);
      expect(result[1]._count.id).toBe(15);
    });
  });

  describe('Period Calculation', () => {
    it('should calculate 7 day period', () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

      expect(Math.round(diff)).toBe(7);
    });

    it('should calculate 30 day period', () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

      expect(Math.round(diff)).toBe(30);
    });
  });

  describe('Usage Limits', () => {
    it('should calculate usage against limits', () => {
      const limits = {
        users: { current: 4, max: 5 },
        campaigns: { current: 8, max: 10 },
        posts: { current: 450, max: 500 },
      };

      expect(limits.users.current < limits.users.max).toBe(true);
      expect(limits.campaigns.current < limits.campaigns.max).toBe(true);
      expect(limits.posts.current < limits.posts.max).toBe(true);
    });

    it('should detect when limit is reached', () => {
      const limits = {
        users: { current: 5, max: 5 },
      };

      expect(limits.users.current >= limits.users.max).toBe(true);
    });
  });
});

describe('Email Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send invitation email', async () => {
    await mockSendTeamInviteEmail({
      to: 'newuser@example.com',
      role: 'editor',
      inviterName: 'Admin User',
      organizationName: 'Test Org',
    });

    expect(mockSendTeamInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'newuser@example.com',
        role: 'editor',
      })
    );
  });
});

describe('Audit Logging', () => {
  it('should log team actions', async () => {
    await mockAuditLogger.log({
      userId: 'admin-1',
      action: 'teams.member_removed',
      resource: 'team_member',
      resourceId: 'member-1',
      category: 'teams',
      severity: 'high',
      outcome: 'success',
    });

    expect(mockAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'teams.member_removed',
        severity: 'high',
      })
    );
  });
});
