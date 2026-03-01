/**
 * Approvals & Roles API Contract Tests
 *
 * Validates that approval workflow and RBAC role endpoints conform to their
 * expected schemas. Tests auth enforcement, input validation, ownership checks,
 * and response shapes for:
 * - GET    /api/approvals/[id]  — fetch single approval request
 * - PATCH  /api/approvals/[id]  — approve/reject/delegate workflow action
 * - DELETE /api/approvals/[id]  — submitter deletes own request
 * - GET    /api/roles           — list organization roles
 * - POST   /api/roles           — create a new role
 *
 * @module tests/contract/approvals-roles.contract.test
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { z } from 'zod';
import { NextResponse } from 'next/server';

// =============================================================================
// Mock factory — all jest.mock calls must be at the top level
// =============================================================================

jest.mock('@/lib/prisma', () => {
  const instance = {
    approvalRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    teamNotification: {
      create: jest.fn(),
    },
    userRole: {
      count: jest.fn(),
    },
    organization: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    role: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return {
    __esModule: true,
    // named export used by roles/route.ts: import { prisma } from '@/lib/prisma'
    prisma: instance,
    // default export used by approvals/[id]/route.ts: import prisma from '@/lib/prisma'
    default: instance,
  };
});

jest.mock('@/lib/auth/jwt-utils', () => ({
  __esModule: true,
  getUserIdFromCookies: jest.fn(),
  getUserIdFromRequestOrCookies: jest.fn(),
  unauthorizedResponse: () =>
    NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 }),
  forbiddenResponse: (msg?: string) =>
    NextResponse.json({ error: 'Forbidden', message: msg ?? 'Access denied' }, { status: 403 }),
}));

jest.mock('@/lib/utils/error-utils', () => ({
  __esModule: true,
  sanitizeErrorForResponse: (_err: unknown, fallback: string) => fallback,
}));

jest.mock('@/lib/auth/rbac/role-manager', () => ({
  __esModule: true,
  RoleManager: {
    getRoles: jest.fn(),
    createRole: jest.fn(),
  },
}));

jest.mock('@/lib/auth/rbac/permission-engine', () => ({
  __esModule: true,
  PermissionEngine: {
    check: jest.fn(),
  },
  ALL_PERMISSIONS: ['roles:manage', 'posts:read', 'posts:create', 'campaigns:read'],
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// =============================================================================
// Get mocked module references via jest.requireMock
// =============================================================================

// Use jest.requireMock to access the mocked instances directly
// This avoids the issue of static import references becoming stale after clearAllMocks
function getMockedPrisma() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = jest.requireMock('@/lib/prisma') as any;
  return mod.default || mod.prisma;
}

function getMockedJwt() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jest.requireMock('@/lib/auth/jwt-utils') as any;
}

function getMockedRoleManager() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (jest.requireMock('@/lib/auth/rbac/role-manager') as any).RoleManager;
}

function getMockedPermEngine() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (jest.requireMock('@/lib/auth/rbac/permission-engine') as any).PermissionEngine;
}

// =============================================================================
// Response shape schemas (mirrors actual route responses)
// =============================================================================

const approvalGetResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    contentId: z.string(),
    contentType: z.string(),
    submittedBy: z.string(),
    status: z.string(),
    title: z.string(),
    currentStep: z.number(),
    totalSteps: z.number(),
  }),
});

const approvalPatchResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    id: z.string(),
    status: z.string(),
  }),
});

const approvalDeleteResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

const roleListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      permissions: z.array(z.string()),
    })
  ),
  availablePermissions: z.array(z.string()),
});

const roleCreateResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    permissions: z.array(z.string()),
    userCount: z.number(),
  }),
});

// =============================================================================
// Test helpers
// =============================================================================

function createMockRequest(opts: {
  method?: string;
  body?: object;
  url?: string;
} = {}) {
  const { method = 'GET', body, url = 'http://localhost:3000/api/test' } = opts;
  const parsedUrl = new URL(url);
  const bodyString = body ? JSON.stringify(body) : undefined;
  return {
    url,
    method,
    headers: {
      get: (name: string) => name === 'content-type' ? 'application/json' : null,
      has: () => false,
    },
    nextUrl: parsedUrl,
    json: async () => (bodyString ? JSON.parse(bodyString) : {}),
    text: async () => bodyString ?? '',
    ip: '127.0.0.1',
    geo: {},
    cookies: { get: () => undefined, getAll: () => [], has: () => false },
  } as any;
}

function makeMockApproval(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'approval-001',
    contentId: 'post-123',
    contentType: 'post',
    workflowId: 'workflow-abc',
    submittedBy: 'user-submitter',
    status: 'pending',
    priority: 'normal',
    currentStep: 0,
    totalSteps: 2,
    steps: [
      {
        id: 'step-1',
        order: 0,
        type: 'review',
        name: 'Initial Review',
        status: 'pending',
        assignedTo: ['user-reviewer'],
        comments: [],
        requiredApprovals: 1,
        currentApprovals: 0,
        isOptional: false,
        createdAt: new Date().toISOString(),
      },
    ],
    title: 'My Content For Approval',
    description: 'Please review this post',
    dueDate: null,
    metadata: {},
    organizationId: 'org-123',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    submitter: { name: 'Test User', email: 'test@example.com' },
    ...overrides,
  };
}

function makeMockRole(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'role-001',
    name: 'Editor',
    description: 'Can edit content',
    permissions: ['posts:create', 'posts:read', 'posts:update'],
    isDefault: true,
    isSystem: false,
    organizationId: 'org-123',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

// =============================================================================
// Approvals Tests — GET /api/approvals/[id]
// =============================================================================

describe('Approvals API Contract Tests (/api/approvals/[id])', () => {
  const mockParams = { params: Promise.resolve({ id: 'approval-001' }) };

  // Import route handlers once; mocks are in place before this module loads
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const approvalRoute = require('@/app/api/approvals/[id]/route');

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset userRole count to 0 after clearAllMocks removes implementations
    getMockedPrisma().userRole.count.mockResolvedValue(0);
  });

  // ---------------------------------------------------------------------------
  // GET - fetch single approval
  // ---------------------------------------------------------------------------

  describe('GET - fetch single approval', () => {
    it('should return 401 when unauthenticated', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue(null);

      const req = createMockRequest({ method: 'GET' });
      const response = await approvalRoute.GET(req, mockParams);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return 404 when approval request not found', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('user-456');
      getMockedPrisma().user.findUnique.mockResolvedValue({ organizationId: 'org-123' });
      getMockedPrisma().approvalRequest.findUnique.mockResolvedValue(null);

      const req = createMockRequest({ method: 'GET' });
      const response = await approvalRoute.GET(req, mockParams);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Not Found');
    });

    it('should return 403 when user cannot access another user approval', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('other-user-789');
      getMockedPrisma().user.findUnique.mockResolvedValue({ organizationId: 'different-org' });
      getMockedPrisma().approvalRequest.findUnique.mockResolvedValue(
        makeMockApproval({
          submittedBy: 'user-submitter',
          organizationId: 'org-123',
          steps: [
            {
              id: 'step-1', order: 0, type: 'review', name: 'Review',
              status: 'pending', assignedTo: ['user-reviewer'], comments: [],
              requiredApprovals: 1, currentApprovals: 0, isOptional: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })
      );

      const req = createMockRequest({ method: 'GET' });
      const response = await approvalRoute.GET(req, mockParams);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
    });

    it('should return 200 with correct approval shape when user is submitter', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('user-submitter');
      getMockedPrisma().user.findUnique.mockResolvedValue({ organizationId: 'org-123' });
      getMockedPrisma().approvalRequest.findUnique.mockResolvedValue(makeMockApproval());

      const req = createMockRequest({ method: 'GET' });
      const response = await approvalRoute.GET(req, mockParams);

      expect(response.status).toBe(200);
      const body = await response.json();

      const parsed = approvalGetResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.data.id).toBe('approval-001');
        expect(parsed.data.data.submittedBy).toBe('user-submitter');
        expect(parsed.data.data.title).toBe('My Content For Approval');
        expect(parsed.data.data.currentStep).toBe(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH - workflow actions
  // ---------------------------------------------------------------------------

  describe('PATCH - workflow actions', () => {
    it('should return 401 when unauthenticated', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue(null);

      const req = createMockRequest({ method: 'PATCH', body: { action: 'approve' } });
      const response = await approvalRoute.PATCH(req, mockParams);

      expect(response.status).toBe(401);
    });

    it('should return 400 when action is invalid (Zod validation)', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('user-reviewer');

      const req = createMockRequest({ method: 'PATCH', body: { action: 'invalid_action' } });
      const response = await approvalRoute.PATCH(req, mockParams);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation Error');
    });

    it('should return 400 when reject action has no comment (business logic)', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('user-reviewer');
      getMockedPrisma().user.findUnique.mockResolvedValue({
        organizationId: 'org-123',
        name: 'Reviewer',
        email: 'reviewer@test.com',
      });
      getMockedPrisma().approvalRequest.findUnique.mockResolvedValue(
        makeMockApproval({
          steps: [
            {
              id: 'step-1', order: 0, type: 'review', name: 'Review',
              status: 'pending', assignedTo: ['user-reviewer', '*'], comments: [],
              requiredApprovals: 1, currentApprovals: 0, isOptional: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })
      );

      const req = createMockRequest({ method: 'PATCH', body: { action: 'reject' } }); // no comment
      const response = await approvalRoute.PATCH(req, mockParams);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation Error');
    });

    it('should return 200 with updated approval shape when approve succeeds', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('user-reviewer');
      getMockedPrisma().user.findUnique.mockResolvedValue({
        organizationId: 'org-123',
        name: 'Test Reviewer',
        email: 'reviewer@test.com',
      });

      const approval = makeMockApproval({
        steps: [
          {
            id: 'step-1', order: 0, type: 'review', name: 'Review',
            status: 'pending', assignedTo: ['user-reviewer'], comments: [],
            requiredApprovals: 1, currentApprovals: 0, isOptional: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });
      getMockedPrisma().approvalRequest.findUnique.mockResolvedValue(approval);
      getMockedPrisma().teamNotification.create.mockResolvedValue({});

      const updatedApproval = makeMockApproval({ status: 'approved' });
      getMockedPrisma().$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          approvalRequest: {
            update: jest.fn().mockResolvedValue({
              ...updatedApproval,
              submitter: { name: 'Test User', email: 'test@example.com' },
            }),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const req = createMockRequest({
        method: 'PATCH',
        body: { action: 'approve', comment: 'Looks good!' },
      });
      const response = await approvalRoute.PATCH(req, mockParams);

      expect(response.status).toBe(200);
      const body = await response.json();

      const parsed = approvalPatchResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.success).toBe(true);
        expect(parsed.data.message).toContain('approved');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE - delete approval request
  // ---------------------------------------------------------------------------

  describe('DELETE - delete approval request', () => {
    it('should return 401 when unauthenticated', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue(null);

      const req = createMockRequest({ method: 'DELETE' });
      const response = await approvalRoute.DELETE(req, mockParams);

      expect(response.status).toBe(401);
    });

    it('should return 403 when non-submitter tries to delete', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('other-user-789');
      getMockedPrisma().approvalRequest.findUnique.mockResolvedValue(
        makeMockApproval({ submittedBy: 'user-submitter' })
      );

      const req = createMockRequest({ method: 'DELETE' });
      const response = await approvalRoute.DELETE(req, mockParams);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toContain('submitter');
    });

    it('should return 200 with success message when submitter deletes own request', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('user-submitter');
      getMockedPrisma().approvalRequest.findUnique.mockResolvedValue(
        makeMockApproval({ submittedBy: 'user-submitter' })
      );

      getMockedPrisma().$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          approvalRequest: { delete: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const req = createMockRequest({ method: 'DELETE' });
      const response = await approvalRoute.DELETE(req, mockParams);

      expect(response.status).toBe(200);
      const body = await response.json();

      const parsed = approvalDeleteResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.success).toBe(true);
        expect(parsed.data.message).toContain('deleted');
      }
    });
  });
});

// =============================================================================
// Roles Tests — GET/POST /api/roles
// =============================================================================

describe('Roles API Contract Tests (/api/roles)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rolesRoute = require('@/app/api/roles/route');

  beforeEach(() => {
    jest.clearAllMocks();
    getMockedPrisma().userRole.count.mockResolvedValue(0);
  });

  // ---------------------------------------------------------------------------
  // POST - createRoleSchema Zod validation
  // ---------------------------------------------------------------------------

  describe('POST - input schema validation (Zod)', () => {
    it('should reject missing name via createRoleSchema', () => {
      const createRoleSchema = z.object({
        name: z.string().min(1, 'Name is required').max(100),
        permissions: z.array(z.string()).min(1, 'At least one permission required'),
        description: z.string().max(500).optional(),
        isDefault: z.boolean().optional(),
      });
      const result = createRoleSchema.safeParse({ permissions: ['posts:read'] });
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find(i => i.path[0] === 'name');
        expect(nameError).toBeDefined();
      }
    });

    it('should reject empty permissions array via createRoleSchema', () => {
      const createRoleSchema = z.object({
        name: z.string().min(1, 'Name is required').max(100),
        permissions: z.array(z.string()).min(1, 'At least one permission required'),
        description: z.string().max(500).optional(),
        isDefault: z.boolean().optional(),
      });
      const result = createRoleSchema.safeParse({ name: 'My Role', permissions: [] });
      expect(result.success).toBe(false);
      if (!result.success) {
        const permError = result.error.issues.find(i => i.path[0] === 'permissions');
        expect(permError).toBeDefined();
      }
    });

    it('should return 401 when unauthenticated', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue(null);
      const req = createMockRequest({ method: 'POST', body: { name: 'Editor', permissions: ['posts:read'] } });
      const response = await rolesRoute.POST(req);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return 400 when Zod validation fails via route handler', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('user-456');
      getMockedPrisma().user.findUnique.mockResolvedValue({ id: 'user-456', organizationId: 'org-123' });
      getMockedPermEngine().check.mockResolvedValue({ allowed: true });

      const req = createMockRequest({ method: 'POST', body: { permissions: ['posts:read'] } });
      const response = await rolesRoute.POST(req);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation Error');
    });

    it('should return 200 with created role shape on success', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('user-456');
      getMockedPrisma().user.findUnique.mockResolvedValue({ id: 'user-456', organizationId: 'org-123' });
      getMockedPermEngine().check.mockResolvedValue({ allowed: true });
      getMockedRoleManager().createRole.mockResolvedValue(
        makeMockRole({ name: 'Custom Role', permissions: ['posts:read'] })
      );

      const req = createMockRequest({
        method: 'POST',
        body: { name: 'Custom Role', permissions: ['posts:read'], description: 'A custom role' },
      });
      const response = await rolesRoute.POST(req);

      expect([200, 201]).toContain(response.status);
      const body = await response.json();

      const parsed = roleCreateResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.data.name).toBe('Custom Role');
        expect(parsed.data.data.permissions).toContain('posts:read');
        expect(parsed.data.data.userCount).toBe(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // GET - list roles
  // ---------------------------------------------------------------------------

  describe('GET - list roles', () => {
    it('should return 401 when unauthenticated', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue(null);
      const response = await rolesRoute.GET();
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks roles:manage permission', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('user-456');
      getMockedPrisma().user.findUnique.mockResolvedValue({ id: 'user-456', organizationId: 'org-123' });
      getMockedPermEngine().check.mockResolvedValue({ allowed: false });
      const response = await rolesRoute.GET();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
    });

    it('should return 200 with roles list and availablePermissions', async () => {
      getMockedJwt().getUserIdFromCookies.mockResolvedValue('user-456');
      getMockedPrisma().user.findUnique.mockResolvedValue({ id: 'user-456', organizationId: 'org-123' });
      getMockedPermEngine().check.mockResolvedValue({ allowed: true });
      getMockedPrisma().userRole.count.mockResolvedValue(2);

      const roles = [
        makeMockRole({ id: 'role-001', name: 'Admin', permissions: ['*'] }),
        makeMockRole({ id: 'role-002', name: 'Editor', permissions: ['posts:create', 'posts:read'] }),
        makeMockRole({ id: 'role-003', name: 'Viewer', permissions: ['posts:read'] }),
      ];
      getMockedRoleManager().getRoles.mockResolvedValue(roles);

      const response = await rolesRoute.GET();
      expect(response.status).toBe(200);
      const body = await response.json();

      const parsed = roleListResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.data).toHaveLength(3);
        expect(Array.isArray(parsed.data.availablePermissions)).toBe(true);
        expect(parsed.data.data[0].name).toBe('Admin');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // createRoleSchema contract validation
  // ---------------------------------------------------------------------------

  describe('createRoleSchema — Zod contract', () => {
    const createRoleSchema = z.object({
      name: z.string().min(1, 'Name is required').max(100),
      permissions: z.array(z.string()).min(1, 'At least one permission required'),
      description: z.string().max(500).optional(),
      isDefault: z.boolean().optional(),
    });

    it('should accept valid role with name and permissions', () => {
      const result = createRoleSchema.safeParse({
        name: 'Content Manager',
        permissions: ['posts:create', 'posts:read', 'campaigns:read'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept role with all optional fields', () => {
      const result = createRoleSchema.safeParse({
        name: 'Content Manager',
        permissions: ['posts:read'],
        description: 'Manages content',
        isDefault: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject name exceeding max length (101 chars)', () => {
      const result = createRoleSchema.safeParse({ name: 'A'.repeat(101), permissions: ['posts:read'] });
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // patchApprovalSchema contract validation
  // ---------------------------------------------------------------------------

  describe('patchApprovalSchema — Zod contract', () => {
    const patchApprovalSchema = z.object({
      action: z.enum(['approve', 'reject', 'request_revision', 'resubmit', 'add_comment']),
      comment: z.string().max(2000).optional(),
      attachments: z.array(z.string()).optional(),
    });

    it('should accept all 5 valid action values', () => {
      const actions = ['approve', 'reject', 'request_revision', 'resubmit', 'add_comment'];
      actions.forEach(action => {
        const result = patchApprovalSchema.safeParse({ action });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid action value', () => {
      const result = patchApprovalSchema.safeParse({ action: 'delegate' });
      expect(result.success).toBe(false);
    });

    it('should reject comment exceeding 2000 chars', () => {
      const result = patchApprovalSchema.safeParse({ action: 'approve', comment: 'X'.repeat(2001) });
      expect(result.success).toBe(false);
    });

    it('should accept approve with comment and attachments', () => {
      const result = patchApprovalSchema.safeParse({
        action: 'approve',
        comment: 'Looks great!',
        attachments: ['file://example.png'],
      });
      expect(result.success).toBe(true);
    });
  });
});
