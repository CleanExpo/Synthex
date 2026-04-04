/**
 * Unit Tests for RBAC (Role-Based Access Control) System
 *
 * Tests three modules:
 * - permission-engine.ts: Permission checking, wildcards, caching
 * - role-manager.ts: Role CRUD, user-role assignment, audit logging
 * - rbac/index.ts: Type guards, convenience functions, parsePermission
 */

// Mock dependencies before imports
jest.mock('@/lib/prisma', () => {
  const mockUserRole = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  };

  const mockRole = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  };

  const mockPermissionAudit = {
    create: jest.fn(),
  };

  const prisma = {
    userRole: mockUserRole,
    role: mockRole,
    permissionAudit: mockPermissionAudit,
  };

  return {
    __esModule: true,
    default: prisma,
    prisma,
  };
});

jest.mock('@/lib/cache/cache-manager', () => {
  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    invalidateByTag: jest.fn(),
  };

  return {
    getCache: jest.fn(() => mockCache),
  };
});

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  PermissionEngine,
  hasPermission,
  requirePermission,
  PermissionDeniedError,
  PERMISSIONS,
  ALL_PERMISSIONS,
  type ResourceType,
  type ActionType,
  type UserPermissions,
} from '@/lib/auth/rbac/permission-engine';
import {
  RoleManager,
  ROLE_TEMPLATES,
} from '@/lib/auth/rbac/role-manager';
import {
  isResourceType,
  isValidAction,
  parsePermission,
} from '@/lib/auth/rbac/index';
import { prisma } from '@/lib/prisma';
import { getCache } from '@/lib/cache/cache-manager';

// Type helpers for mocked prisma models
const mockUserRole = (prisma as any).userRole;
const mockRole = (prisma as any).role;
const mockPermissionAudit = (prisma as any).permissionAudit;
const mockCache = (getCache as jest.Mock)();

// Test fixtures
const TEST_USER_ID = 'user-123';
const TEST_ORG_ID = 'org-456';
const TEST_ROLE_ID = 'role-789';
const TEST_ADMIN_ID = 'admin-001';

const makeUserPermissions = (permissions: string[]): UserPermissions => ({
  userId: TEST_USER_ID,
  organizationId: TEST_ORG_ID,
  permissions,
  roles: [{ id: TEST_ROLE_ID, name: 'TestRole', permissions }],
  cachedAt: new Date(),
});

describe('RBAC System', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Restore cache mock implementations (resetMocks clears them)
    (getCache as jest.Mock).mockReturnValue(mockCache);
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockCache.delete.mockResolvedValue(undefined);
    mockCache.invalidateByTag.mockResolvedValue(undefined);
    mockPermissionAudit.create.mockResolvedValue({});
  });

  // ==========================================
  // Permission Engine - Permission Checking
  // ==========================================

  describe('PermissionEngine', () => {
    describe('check', () => {
      it('should allow exact permission match', async () => {
        const perms = makeUserPermissions(['posts:create', 'posts:read']);
        mockCache.get.mockResolvedValue(perms);

        const result = await PermissionEngine.check(TEST_USER_ID, TEST_ORG_ID, {
          resource: 'posts',
          action: 'create',
        });

        expect(result.allowed).toBe(true);
        expect(result.matchedPermission).toBe('posts:create');
      });

      it('should deny when permission is missing', async () => {
        const perms = makeUserPermissions(['posts:read']);
        mockCache.get.mockResolvedValue(perms);

        const result = await PermissionEngine.check(TEST_USER_ID, TEST_ORG_ID, {
          resource: 'posts',
          action: 'delete',
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Missing permission: posts:delete');
      });

      it('should allow wildcard (*) super admin permission', async () => {
        const perms = makeUserPermissions(['*']);
        mockCache.get.mockResolvedValue(perms);

        const result = await PermissionEngine.check(TEST_USER_ID, TEST_ORG_ID, {
          resource: 'billing',
          action: 'manage',
        });

        expect(result.allowed).toBe(true);
        expect(result.matchedPermission).toBe('*');
      });

      it('should allow resource wildcard (e.g., posts:*)', async () => {
        const perms = makeUserPermissions(['posts:*']);
        mockCache.get.mockResolvedValue(perms);

        const result = await PermissionEngine.check(TEST_USER_ID, TEST_ORG_ID, {
          resource: 'posts',
          action: 'delete',
        });

        expect(result.allowed).toBe(true);
        expect(result.matchedPermission).toBe('posts:*');
      });

      it('should allow action wildcard (e.g., *:read)', async () => {
        const perms = makeUserPermissions(['*:read']);
        mockCache.get.mockResolvedValue(perms);

        const result = await PermissionEngine.check(TEST_USER_ID, TEST_ORG_ID, {
          resource: 'analytics',
          action: 'read',
        });

        expect(result.allowed).toBe(true);
        expect(result.matchedPermission).toBe('*:read');
      });

      it('should allow via manage permission (manage implies all actions)', async () => {
        const perms = makeUserPermissions(['posts:manage']);
        mockCache.get.mockResolvedValue(perms);

        const result = await PermissionEngine.check(TEST_USER_ID, TEST_ORG_ID, {
          resource: 'posts',
          action: 'create',
        });

        expect(result.allowed).toBe(true);
        expect(result.matchedPermission).toBe('posts:manage');
      });

      it('should deny when user has no permissions in organization', async () => {
        // No cached permissions, no roles in database
        mockCache.get.mockResolvedValue(null);
        mockUserRole.findMany.mockResolvedValue([]);

        const result = await PermissionEngine.check(TEST_USER_ID, TEST_ORG_ID, {
          resource: 'posts',
          action: 'read',
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('no permissions');
      });

      it('should return fail-secure on errors', async () => {
        mockCache.get.mockRejectedValue(new Error('Cache connection failed'));

        const result = await PermissionEngine.check(TEST_USER_ID, TEST_ORG_ID, {
          resource: 'posts',
          action: 'read',
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Permission check failed');
      });
    });

    describe('checkAll', () => {
      it('should return true when all permissions are met', async () => {
        const perms = makeUserPermissions(['posts:read', 'posts:create']);
        mockCache.get.mockResolvedValue(perms);

        const result = await PermissionEngine.checkAll(TEST_USER_ID, TEST_ORG_ID, [
          { resource: 'posts', action: 'read' },
          { resource: 'posts', action: 'create' },
        ]);

        expect(result).toBe(true);
      });

      it('should return false when any permission is missing', async () => {
        const perms = makeUserPermissions(['posts:read']);
        mockCache.get.mockResolvedValue(perms);

        const result = await PermissionEngine.checkAll(TEST_USER_ID, TEST_ORG_ID, [
          { resource: 'posts', action: 'read' },
          { resource: 'posts', action: 'delete' },
        ]);

        expect(result).toBe(false);
      });
    });

    describe('checkAny', () => {
      it('should return true when at least one permission matches', async () => {
        const perms = makeUserPermissions(['posts:read']);
        mockCache.get.mockResolvedValue(perms);

        const result = await PermissionEngine.checkAny(TEST_USER_ID, TEST_ORG_ID, [
          { resource: 'posts', action: 'delete' },
          { resource: 'posts', action: 'read' },
        ]);

        expect(result).toBe(true);
      });

      it('should return false when no permissions match', async () => {
        const perms = makeUserPermissions(['analytics:read']);
        mockCache.get.mockResolvedValue(perms);

        const result = await PermissionEngine.checkAny(TEST_USER_ID, TEST_ORG_ID, [
          { resource: 'posts', action: 'create' },
          { resource: 'posts', action: 'delete' },
        ]);

        expect(result).toBe(false);
      });
    });

    // ==========================================
    // Permission Engine - getUserPermissions
    // ==========================================

    describe('getUserPermissions', () => {
      it('should return aggregated permissions from all roles', async () => {
        mockCache.get.mockResolvedValue(null);
        mockUserRole.findMany.mockResolvedValue([
          {
            role: {
              id: 'role-1',
              name: 'Editor',
              permissions: ['posts:create', 'posts:read'],
            },
          },
          {
            role: {
              id: 'role-2',
              name: 'Analyst',
              permissions: ['analytics:read', 'analytics:export'],
            },
          },
        ]);

        const perms = await PermissionEngine.getUserPermissions(
          TEST_USER_ID,
          TEST_ORG_ID
        );

        expect(perms).not.toBeNull();
        expect(perms!.permissions).toContain('posts:create');
        expect(perms!.permissions).toContain('posts:read');
        expect(perms!.permissions).toContain('analytics:read');
        expect(perms!.permissions).toContain('analytics:export');
        expect(perms!.roles).toHaveLength(2);
      });

      it('should deduplicate permissions across roles', async () => {
        mockCache.get.mockResolvedValue(null);
        mockUserRole.findMany.mockResolvedValue([
          {
            role: {
              id: 'role-1',
              name: 'Editor',
              permissions: ['posts:read', 'posts:create'],
            },
          },
          {
            role: {
              id: 'role-2',
              name: 'Viewer',
              permissions: ['posts:read', 'campaigns:read'],
            },
          },
        ]);

        const perms = await PermissionEngine.getUserPermissions(
          TEST_USER_ID,
          TEST_ORG_ID
        );

        expect(perms).not.toBeNull();
        // posts:read should appear only once
        const readCount = perms!.permissions.filter(p => p === 'posts:read').length;
        expect(readCount).toBe(1);
      });

      it('should use cache on second call', async () => {
        const cached = makeUserPermissions(['posts:read']);
        mockCache.get.mockResolvedValue(cached);

        const perms = await PermissionEngine.getUserPermissions(
          TEST_USER_ID,
          TEST_ORG_ID
        );

        expect(perms).toBe(cached);
        expect(mockUserRole.findMany).not.toHaveBeenCalled();
      });

      it('should cache results after database fetch', async () => {
        mockCache.get.mockResolvedValue(null);
        mockUserRole.findMany.mockResolvedValue([
          {
            role: {
              id: 'role-1',
              name: 'Editor',
              permissions: ['posts:read'],
            },
          },
        ]);

        await PermissionEngine.getUserPermissions(TEST_USER_ID, TEST_ORG_ID);

        expect(mockCache.set).toHaveBeenCalledWith(
          `perms:${TEST_USER_ID}:${TEST_ORG_ID}`,
          expect.objectContaining({
            userId: TEST_USER_ID,
            organizationId: TEST_ORG_ID,
            permissions: ['posts:read'],
          }),
          expect.objectContaining({
            ttl: 300,
            tags: expect.arrayContaining([
              `user:${TEST_USER_ID}:perms`,
              `org:${TEST_ORG_ID}:perms`,
            ]),
          })
        );
      });

      it('should return null when user has no roles', async () => {
        mockCache.get.mockResolvedValue(null);
        mockUserRole.findMany.mockResolvedValue([]);

        const perms = await PermissionEngine.getUserPermissions(
          TEST_USER_ID,
          TEST_ORG_ID
        );

        expect(perms).toBeNull();
      });
    });

    // ==========================================
    // Permission Engine - Cache Invalidation
    // ==========================================

    describe('invalidateUserPermissions', () => {
      it('should delete specific org cache when orgId provided', async () => {
        await PermissionEngine.invalidateUserPermissions(TEST_USER_ID, TEST_ORG_ID);

        expect(mockCache.delete).toHaveBeenCalledWith(
          `perms:${TEST_USER_ID}:${TEST_ORG_ID}`
        );
      });

      it('should invalidate by tag when no orgId provided', async () => {
        await PermissionEngine.invalidateUserPermissions(TEST_USER_ID);

        expect(mockCache.invalidateByTag).toHaveBeenCalledWith(
          `user:${TEST_USER_ID}:perms`
        );
      });
    });

    describe('invalidateOrganizationPermissions', () => {
      it('should invalidate all permissions for an organization', async () => {
        await PermissionEngine.invalidateOrganizationPermissions(TEST_ORG_ID);

        expect(mockCache.invalidateByTag).toHaveBeenCalledWith(
          `org:${TEST_ORG_ID}:perms`
        );
      });
    });

    // ==========================================
    // Permission Engine - expandPermission
    // ==========================================

    describe('expandPermission', () => {
      it('should expand * to all permissions', () => {
        const expanded = PermissionEngine.expandPermission('*');
        expect(expanded).toEqual(ALL_PERMISSIONS);
        expect(expanded.length).toBeGreaterThan(0);
      });

      it('should expand resource wildcard to all actions for that resource', () => {
        const expanded = PermissionEngine.expandPermission('posts:*');
        expect(expanded).toContain('posts:create');
        expect(expanded).toContain('posts:read');
        expect(expanded).toContain('posts:update');
        expect(expanded).toContain('posts:delete');
        expect(expanded.every(p => p.startsWith('posts:'))).toBe(true);
      });

      it('should expand action wildcard to all resources with that action', () => {
        const expanded = PermissionEngine.expandPermission('*:read');
        expect(expanded).toContain('posts:read');
        expect(expanded).toContain('campaigns:read');
        expect(expanded).toContain('analytics:read');
        expect(expanded.every(p => p.endsWith(':read'))).toBe(true);
      });

      it('should return single permission for exact match', () => {
        const expanded = PermissionEngine.expandPermission('posts:create');
        expect(expanded).toEqual(['posts:create']);
      });
    });

    // ==========================================
    // Permission Engine - isValidPermission
    // ==========================================

    describe('isValidPermission', () => {
      it('should accept valid wildcard *', () => {
        expect(PermissionEngine.isValidPermission('*')).toBe(true);
      });

      it('should accept valid resource:action', () => {
        expect(PermissionEngine.isValidPermission('posts:create')).toBe(true);
        expect(PermissionEngine.isValidPermission('analytics:read')).toBe(true);
      });

      it('should accept resource wildcard', () => {
        expect(PermissionEngine.isValidPermission('posts:*')).toBe(true);
      });

      it('should accept action wildcard', () => {
        expect(PermissionEngine.isValidPermission('*:read')).toBe(true);
      });

      it('should reject invalid resource', () => {
        expect(PermissionEngine.isValidPermission('nonexistent:read')).toBe(false);
      });

      it('should reject invalid action for valid resource', () => {
        expect(PermissionEngine.isValidPermission('posts:fly')).toBe(false);
      });
    });
  });

  // ==========================================
  // Convenience Functions
  // ==========================================

  describe('hasPermission (convenience)', () => {
    it('should return true when user has the permission', async () => {
      const perms = makeUserPermissions(['posts:create']);
      mockCache.get.mockResolvedValue(perms);

      const result = await hasPermission(TEST_USER_ID, TEST_ORG_ID, 'posts', 'create');

      expect(result).toBe(true);
    });

    it('should return false when user lacks the permission', async () => {
      const perms = makeUserPermissions(['posts:read']);
      mockCache.get.mockResolvedValue(perms);

      const result = await hasPermission(TEST_USER_ID, TEST_ORG_ID, 'posts', 'delete');

      expect(result).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should not throw when user has permission', async () => {
      const perms = makeUserPermissions(['posts:create']);
      mockCache.get.mockResolvedValue(perms);

      await expect(
        requirePermission(TEST_USER_ID, TEST_ORG_ID, 'posts', 'create')
      ).resolves.toBeUndefined();
    });

    it('should throw PermissionDeniedError when user lacks permission', async () => {
      const perms = makeUserPermissions(['posts:read']);
      mockCache.get.mockResolvedValue(perms);

      await expect(
        requirePermission(TEST_USER_ID, TEST_ORG_ID, 'posts', 'delete')
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe('PermissionDeniedError', () => {
    it('should have correct properties', () => {
      const error = new PermissionDeniedError('posts', 'delete', 'Access denied');
      expect(error.name).toBe('PermissionDeniedError');
      expect(error.resource).toBe('posts');
      expect(error.action).toBe('delete');
      expect(error.message).toBe('Access denied');
    });

    it('should use default message when reason not provided', () => {
      const error = new PermissionDeniedError('posts', 'delete');
      expect(error.message).toBe('Permission denied: posts:delete');
    });
  });

  // ==========================================
  // Role Manager
  // ==========================================

  describe('RoleManager', () => {
    describe('createRole', () => {
      it('should create a role with valid permissions', async () => {
        mockRole.findUnique.mockResolvedValue(null); // no duplicate
        mockRole.create.mockResolvedValue({
          id: 'new-role-id',
          name: 'ContentEditor',
          description: 'Can edit content',
          permissions: ['posts:create', 'posts:read'],
          isDefault: false,
          isSystem: false,
          organizationId: TEST_ORG_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const role = await RoleManager.createRole(
          TEST_ORG_ID,
          {
            name: 'ContentEditor',
            description: 'Can edit content',
            permissions: ['posts:create', 'posts:read'],
          },
          TEST_ADMIN_ID
        );

        expect(role.name).toBe('ContentEditor');
        expect(role.permissions).toEqual(['posts:create', 'posts:read']);
        expect(mockPermissionAudit.create).toHaveBeenCalled();
      });

      it('should reject invalid permissions', async () => {
        await expect(
          RoleManager.createRole(
            TEST_ORG_ID,
            {
              name: 'BadRole',
              permissions: ['invalid:permission'],
            },
            TEST_ADMIN_ID
          )
        ).rejects.toThrow('Invalid permissions');
      });

      it('should reject duplicate role names', async () => {
        mockRole.findUnique.mockResolvedValue({
          id: 'existing-role',
          name: 'Editor',
        });

        await expect(
          RoleManager.createRole(
            TEST_ORG_ID,
            { name: 'Editor', permissions: ['posts:read'] },
            TEST_ADMIN_ID
          )
        ).rejects.toThrow('already exists');
      });

      it('should unset other defaults when creating a default role', async () => {
        mockRole.findUnique.mockResolvedValue(null);
        mockRole.updateMany.mockResolvedValue({ count: 1 });
        mockRole.create.mockResolvedValue({
          id: 'new-default',
          name: 'NewDefault',
          permissions: ['posts:read'],
          isDefault: true,
          isSystem: false,
          organizationId: TEST_ORG_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await RoleManager.createRole(
          TEST_ORG_ID,
          { name: 'NewDefault', permissions: ['posts:read'], isDefault: true },
          TEST_ADMIN_ID
        );

        expect(mockRole.updateMany).toHaveBeenCalledWith({
          where: { organizationId: TEST_ORG_ID, isDefault: true },
          data: { isDefault: false },
        });
      });
    });

    describe('updateRole', () => {
      it('should update role properties', async () => {
        mockRole.findUnique
          .mockResolvedValueOnce({
            id: TEST_ROLE_ID,
            name: 'OldName',
            isSystem: false,
            organizationId: TEST_ORG_ID,
            isDefault: false,
          })
          .mockResolvedValueOnce(null); // no duplicate name

        mockRole.update.mockResolvedValue({
          id: TEST_ROLE_ID,
          name: 'NewName',
          permissions: ['posts:read', 'posts:create'],
          isDefault: false,
          isSystem: false,
          organizationId: TEST_ORG_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const role = await RoleManager.updateRole(
          TEST_ROLE_ID,
          { name: 'NewName', permissions: ['posts:read', 'posts:create'] },
          TEST_ADMIN_ID
        );

        expect(role.name).toBe('NewName');
      });

      it('should prevent modifying system role name or permissions', async () => {
        mockRole.findUnique.mockResolvedValue({
          id: TEST_ROLE_ID,
          name: 'Admin',
          isSystem: true,
          organizationId: TEST_ORG_ID,
        });

        await expect(
          RoleManager.updateRole(
            TEST_ROLE_ID,
            { name: 'NotAdmin' },
            TEST_ADMIN_ID
          )
        ).rejects.toThrow('Cannot modify name or permissions of system roles');
      });

      it('should throw when role not found', async () => {
        mockRole.findUnique.mockResolvedValue(null);

        await expect(
          RoleManager.updateRole(TEST_ROLE_ID, { name: 'X' }, TEST_ADMIN_ID)
        ).rejects.toThrow('Role not found');
      });

      it('should invalidate org permissions cache after update', async () => {
        mockRole.findUnique
          .mockResolvedValueOnce({
            id: TEST_ROLE_ID,
            name: 'Editor',
            isSystem: false,
            organizationId: TEST_ORG_ID,
            isDefault: false,
          });

        mockRole.update.mockResolvedValue({
          id: TEST_ROLE_ID,
          name: 'Editor',
          permissions: ['posts:read'],
          isDefault: false,
          isSystem: false,
          organizationId: TEST_ORG_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await RoleManager.updateRole(
          TEST_ROLE_ID,
          { description: 'Updated desc' },
          TEST_ADMIN_ID
        );

        expect(mockCache.invalidateByTag).toHaveBeenCalledWith(
          `org:${TEST_ORG_ID}:perms`
        );
      });
    });

    describe('deleteRole', () => {
      it('should delete a role with no assigned users', async () => {
        mockRole.findUnique.mockResolvedValue({
          id: TEST_ROLE_ID,
          name: 'OldRole',
          isSystem: false,
          organizationId: TEST_ORG_ID,
          _count: { userRoles: 0 },
        });
        mockRole.delete.mockResolvedValue({});

        await expect(
          RoleManager.deleteRole(TEST_ROLE_ID, TEST_ADMIN_ID)
        ).resolves.toBeUndefined();

        expect(mockRole.delete).toHaveBeenCalledWith({
          where: { id: TEST_ROLE_ID },
        });
      });

      it('should prevent deleting system roles', async () => {
        mockRole.findUnique.mockResolvedValue({
          id: TEST_ROLE_ID,
          name: 'Admin',
          isSystem: true,
          organizationId: TEST_ORG_ID,
          _count: { userRoles: 0 },
        });

        await expect(
          RoleManager.deleteRole(TEST_ROLE_ID, TEST_ADMIN_ID)
        ).rejects.toThrow('Cannot delete system roles');
      });

      it('should prevent deleting roles with assigned users', async () => {
        mockRole.findUnique.mockResolvedValue({
          id: TEST_ROLE_ID,
          name: 'Editor',
          isSystem: false,
          organizationId: TEST_ORG_ID,
          _count: { userRoles: 5 },
        });

        await expect(
          RoleManager.deleteRole(TEST_ROLE_ID, TEST_ADMIN_ID)
        ).rejects.toThrow('Cannot delete role with 5 assigned users');
      });
    });

    describe('grantRole', () => {
      it('should grant a role to a user', async () => {
        mockRole.findUnique.mockResolvedValue({
          id: TEST_ROLE_ID,
          name: 'Editor',
          organizationId: TEST_ORG_ID,
        });
        mockUserRole.findUnique.mockResolvedValue(null); // not already assigned
        mockUserRole.create.mockResolvedValue({});

        await expect(
          RoleManager.grantRole(
            { userId: TEST_USER_ID, roleId: TEST_ROLE_ID },
            TEST_ADMIN_ID
          )
        ).resolves.toBeUndefined();

        expect(mockUserRole.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: TEST_USER_ID,
            roleId: TEST_ROLE_ID,
            grantedBy: TEST_ADMIN_ID,
          }),
        });
      });

      it('should update expiration if role already assigned', async () => {
        const existingExpiry = new Date('2025-12-31');
        const newExpiry = new Date('2026-06-30');

        mockRole.findUnique.mockResolvedValue({
          id: TEST_ROLE_ID,
          name: 'Editor',
          organizationId: TEST_ORG_ID,
        });
        mockUserRole.findUnique.mockResolvedValue({
          id: 'ur-1',
          userId: TEST_USER_ID,
          roleId: TEST_ROLE_ID,
          expiresAt: existingExpiry,
        });
        mockUserRole.update.mockResolvedValue({});

        await RoleManager.grantRole(
          { userId: TEST_USER_ID, roleId: TEST_ROLE_ID, expiresAt: newExpiry },
          TEST_ADMIN_ID
        );

        expect(mockUserRole.update).toHaveBeenCalledWith({
          where: { id: 'ur-1' },
          data: { expiresAt: newExpiry },
        });
      });

      it('should throw when role not found', async () => {
        mockRole.findUnique.mockResolvedValue(null);

        await expect(
          RoleManager.grantRole(
            { userId: TEST_USER_ID, roleId: 'nonexistent' },
            TEST_ADMIN_ID
          )
        ).rejects.toThrow('Role not found');
      });

      it('should invalidate user permission cache after grant', async () => {
        mockRole.findUnique.mockResolvedValue({
          id: TEST_ROLE_ID,
          name: 'Editor',
          organizationId: TEST_ORG_ID,
        });
        mockUserRole.findUnique.mockResolvedValue(null);
        mockUserRole.create.mockResolvedValue({});

        await RoleManager.grantRole(
          { userId: TEST_USER_ID, roleId: TEST_ROLE_ID },
          TEST_ADMIN_ID
        );

        expect(mockCache.delete).toHaveBeenCalledWith(
          `perms:${TEST_USER_ID}:${TEST_ORG_ID}`
        );
      });
    });

    describe('revokeRole', () => {
      it('should revoke a role from a user', async () => {
        mockRole.findUnique.mockResolvedValue({
          id: TEST_ROLE_ID,
          name: 'Editor',
          organizationId: TEST_ORG_ID,
        });
        mockUserRole.deleteMany.mockResolvedValue({ count: 1 });

        await expect(
          RoleManager.revokeRole(TEST_USER_ID, TEST_ROLE_ID, TEST_ADMIN_ID)
        ).resolves.toBeUndefined();

        expect(mockUserRole.deleteMany).toHaveBeenCalledWith({
          where: { userId: TEST_USER_ID, roleId: TEST_ROLE_ID },
        });
      });

      it('should invalidate user permission cache after revoke', async () => {
        mockRole.findUnique.mockResolvedValue({
          id: TEST_ROLE_ID,
          name: 'Editor',
          organizationId: TEST_ORG_ID,
        });
        mockUserRole.deleteMany.mockResolvedValue({ count: 1 });

        await RoleManager.revokeRole(TEST_USER_ID, TEST_ROLE_ID, TEST_ADMIN_ID);

        expect(mockCache.delete).toHaveBeenCalledWith(
          `perms:${TEST_USER_ID}:${TEST_ORG_ID}`
        );
      });
    });

    describe('getRoles', () => {
      it('should return all roles for an organization', async () => {
        mockRole.findMany.mockResolvedValue([
          { id: '1', name: 'Admin', isSystem: true },
          { id: '2', name: 'Editor', isSystem: false },
        ]);

        const roles = await RoleManager.getRoles(TEST_ORG_ID);

        expect(roles).toHaveLength(2);
        expect(mockRole.findMany).toHaveBeenCalledWith({
          where: { organizationId: TEST_ORG_ID },
          orderBy: expect.any(Array),
        });
      });
    });

    describe('getUserRoles', () => {
      it('should return roles for a user in an organization', async () => {
        mockUserRole.findMany.mockResolvedValue([
          { role: { id: '1', name: 'Editor', permissions: ['posts:read'] } },
        ]);

        const roles = await RoleManager.getUserRoles(TEST_USER_ID, TEST_ORG_ID);

        expect(roles).toHaveLength(1);
        expect(roles[0].name).toBe('Editor');
      });
    });

    describe('assignDefaultRole', () => {
      it('should assign the default role when one exists', async () => {
        mockRole.findFirst.mockResolvedValue({
          id: 'default-role-id',
          name: 'Member',
          isDefault: true,
          organizationId: TEST_ORG_ID,
        });
        mockRole.findUnique.mockResolvedValue({
          id: 'default-role-id',
          name: 'Member',
          organizationId: TEST_ORG_ID,
        });
        mockUserRole.findUnique.mockResolvedValue(null);
        mockUserRole.create.mockResolvedValue({});

        await RoleManager.assignDefaultRole(TEST_USER_ID, TEST_ORG_ID);

        expect(mockUserRole.create).toHaveBeenCalled();
      });

      it('should do nothing when no default role exists', async () => {
        mockRole.findFirst.mockResolvedValue(null);

        await RoleManager.assignDefaultRole(TEST_USER_ID, TEST_ORG_ID);

        expect(mockUserRole.create).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================
  // RBAC Index - Type Guards & Utilities
  // ==========================================

  describe('RBAC Type Guards', () => {
    describe('isResourceType', () => {
      it('should return true for valid resource types', () => {
        expect(isResourceType('posts')).toBe(true);
        expect(isResourceType('campaigns')).toBe(true);
        expect(isResourceType('analytics')).toBe(true);
        expect(isResourceType('billing')).toBe(true);
      });

      it('should return false for invalid resource types', () => {
        expect(isResourceType('nonexistent')).toBe(false);
        expect(isResourceType('')).toBe(false);
      });
    });

    describe('isValidAction', () => {
      it('should return true for valid actions on a resource', () => {
        expect(isValidAction('posts', 'create')).toBe(true);
        expect(isValidAction('analytics', 'read')).toBe(true);
        expect(isValidAction('analytics', 'export')).toBe(true);
      });

      it('should return false for invalid actions on a resource', () => {
        expect(isValidAction('posts', 'export')).toBe(false);
        expect(isValidAction('analytics', 'delete')).toBe(false);
      });
    });

    describe('parsePermission', () => {
      it('should parse valid permission string', () => {
        const result = parsePermission('posts:create');
        expect(result).toEqual({ resource: 'posts', action: 'create' });
      });

      it('should return null for invalid permission', () => {
        expect(parsePermission('invalid:action')).toBeNull();
        expect(parsePermission('posts')).toBeNull();
        expect(parsePermission('')).toBeNull();
      });
    });
  });

  // ==========================================
  // PERMISSIONS constant & ROLE_TEMPLATES
  // ==========================================

  describe('PERMISSIONS constant', () => {
    it('should define permissions for all resource types', () => {
      const resources: ResourceType[] = [
        'posts', 'campaigns', 'analytics', 'personas',
        'settings', 'users', 'roles', 'integrations',
        'billing', 'organization',
      ];

      for (const resource of resources) {
        expect(PERMISSIONS[resource]).toBeDefined();
        expect(PERMISSIONS[resource].length).toBeGreaterThan(0);
      }
    });

    it('should have ALL_PERMISSIONS as a flattened list', () => {
      expect(ALL_PERMISSIONS.length).toBeGreaterThan(0);
      expect(ALL_PERMISSIONS.every(p => p.includes(':'))).toBe(true);
    });
  });

  describe('ROLE_TEMPLATES', () => {
    it('should define admin with wildcard permission', () => {
      expect(ROLE_TEMPLATES.admin.permissions).toContain('*');
    });

    it('should define editor with content creation permissions', () => {
      expect(ROLE_TEMPLATES.editor.permissions).toContain('posts:create');
      expect(ROLE_TEMPLATES.editor.permissions).toContain('campaigns:create');
    });

    it('should define viewer as read-only', () => {
      const viewerPerms = ROLE_TEMPLATES.viewer.permissions;
      expect(viewerPerms.every(p => p.endsWith(':read'))).toBe(true);
    });
  });
});
