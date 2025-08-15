import { type User } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import AuditService from './audit';
// import NotificationService from './notification'; // Disabled - file not available

// Stub implementation for disabled module
const NotificationService = {
  notify: async (userId: string, type: string, message: string, data?: any) => {
    console.log('Notification would be sent:', { userId, type, message, data });
    return { sent: true };
  },
  create: async (userIdOrData: any, dataOrUndefined?: any) => {
    const actualData = dataOrUndefined || userIdOrData;
    const userId = dataOrUndefined ? userIdOrData : null;
    console.log('Notification would be created:', { userId, data: actualData });
    return { id: 'stub-notification-id', userId, ...actualData };
  },
  createNotification: async (data: any) => {
    console.log('Notification would be created:', data);
    return { created: true };
  },
  createPlatformNotification: async (...args: any[]) => {
    console.log('Platform notification would be created:', args);
    return { created: true };
  }
};

// Organization interface (since it might not be in Prisma schema yet)
export interface Organization {
  id: string;
  name: string;
  domain?: string;
  settings?: any;
  plan: 'free' | 'pro' | 'enterprise';
  maxUsers: number;
  features: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Validation schemas
export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1).max(100),
  role: z.enum(['user', 'admin', 'superadmin', 'editor', 'viewer']).optional().default('user'),
  organizationId: z.string().optional(),
  permissions: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
  sendWelcomeEmail: z.boolean().optional().default(true)
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['user', 'admin', 'superadmin', 'editor', 'viewer']).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  organizationId: z.string().optional()
});

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().min(1).max(100).optional(),
  settings: z.any().optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional().default('free'),
  maxUsers: z.number().min(1).optional().default(10),
  features: z.array(z.string()).optional().default([])
});

export const UserFiltersSchema = z.object({
  role: z.enum(['user', 'admin', 'superadmin', 'editor', 'viewer']).optional(),
  isActive: z.boolean().optional(),
  organizationId: z.string().optional(),
  search: z.string().optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
  sortBy: z.enum(['createdAt', 'name', 'email', 'role']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

// Role hierarchy and permissions
export const ROLE_HIERARCHY = {
  superadmin: 100,
  admin: 80,
  editor: 60,
  user: 40,
  viewer: 20
} as const;

export const PERMISSIONS = {
  // User management
  'users.create': 'Create new users',
  'users.read': 'View user information',
  'users.update': 'Update user information',
  'users.delete': 'Delete users',
  'users.manage_roles': 'Manage user roles and permissions',
  
  // Organization management
  'org.manage': 'Manage organization settings',
  'org.billing': 'Manage billing and subscriptions',
  'org.analytics': 'View organization analytics',
  
  // Content management
  'content.create': 'Create content',
  'content.edit': 'Edit content',
  'content.delete': 'Delete content',
  'content.publish': 'Publish content',
  'content.moderate': 'Moderate content',
  
  // Campaign management
  'campaigns.create': 'Create campaigns',
  'campaigns.edit': 'Edit campaigns',
  'campaigns.delete': 'Delete campaigns',
  'campaigns.execute': 'Execute campaigns',
  
  // Analytics and reporting
  'analytics.view': 'View analytics',
  'analytics.export': 'Export analytics data',
  'analytics.advanced': 'Access advanced analytics',
  
  // System administration
  'system.audit': 'View audit logs',
  'system.settings': 'Manage system settings',
  'system.maintenance': 'Perform system maintenance',
  
  // API access
  'api.read': 'Read API access',
  'api.write': 'Write API access',
  'api.admin': 'Administrative API access'
} as const;

export const DEFAULT_ROLE_PERMISSIONS = {
  superadmin: Object.keys(PERMISSIONS),
  admin: [
    'users.create', 'users.read', 'users.update', 'users.manage_roles',
    'org.manage', 'org.analytics',
    'content.create', 'content.edit', 'content.delete', 'content.publish', 'content.moderate',
    'campaigns.create', 'campaigns.edit', 'campaigns.delete', 'campaigns.execute',
    'analytics.view', 'analytics.export', 'analytics.advanced',
    'system.audit', 'system.settings',
    'api.read', 'api.write'
  ],
  editor: [
    'users.read',
    'content.create', 'content.edit', 'content.publish',
    'campaigns.create', 'campaigns.edit', 'campaigns.execute',
    'analytics.view',
    'api.read', 'api.write'
  ],
  user: [
    'content.create', 'content.edit',
    'campaigns.create', 'campaigns.edit',
    'analytics.view',
    'api.read'
  ],
  viewer: [
    'analytics.view',
    'api.read'
  ]
} as const;

export interface UserWithOrganization extends User {
  organization?: Organization;
  permissions?: string[];
}

export interface OrganizationWithUsers extends Organization {
  users?: UserWithOrganization[];
  _count?: {
    users: number;
  };
}

export class UserManagementService {
  /**
   * Create a new user
   */
  static async createUser(
    data: z.infer<typeof CreateUserSchema>,
    createdBy: string,
    ipAddress?: string
  ): Promise<UserWithOrganization> {
    const validated = CreateUserSchema.parse(data);
    
    try {
      // Check if user already exists
      const existingUser = await (prisma as any).user.findUnique({
        where: { email: validated.email }
      });
      
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      
      // If organization is specified, verify it exists
      if (validated.organizationId) {
        const org = await (prisma as any).organization.findUnique({
          where: { id: validated.organizationId }
        });
        
        if (!org) {
          throw new Error('Organization not found');
        }
        
        // Check user limit for organization
        const userCount = await (prisma as any).user.count({
          where: { organizationId: validated.organizationId }
        });
        
        if (userCount >= org.maxUsers) {
          throw new Error('Organization user limit reached');
        }
      }
      
      // Get default permissions for role
      const rolePermissions = [...(DEFAULT_ROLE_PERMISSIONS[validated.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [])];
      const permissions = validated.permissions?.length ? validated.permissions : rolePermissions;
      
      // Create user
      const user = await (prisma as any).user.create({
        data: {
          email: validated.email,
          name: validated.name,
          role: validated.role,
          organizationId: validated.organizationId,
          isActive: validated.isActive,
          permissions,
          emailVerified: false, // Will be verified via welcome email
          lastLoginAt: null,
          createdBy
        },
        include: {
          organization: true
        }
      });
      
      // Log the creation
      await AuditService.log({
        userId: createdBy,
        action: 'user_created',
        resource: 'user',
        resourceId: user.id,
        details: {
          email: validated.email,
          role: validated.role,
          organizationId: validated.organizationId
        },
        ipAddress,
        severity: 'medium',
        category: 'auth',
        outcome: 'success'
      });
      
      // Send welcome email notification
      if (validated.sendWelcomeEmail) {
        await NotificationService.create(user.id, {
          title: 'Welcome to Synthex!',
          message: 'Your account has been created. Please check your email to verify your account.',
          type: 'info',
          priority: 'medium'
        });
      }
      
      return user;
    } catch (error) {
      // Log the failed attempt
      await AuditService.log({
        userId: createdBy,
        action: 'user_creation_failed',
        resource: 'user',
        details: {
          email: validated.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        ipAddress,
        severity: 'medium',
        category: 'auth',
        outcome: 'failure'
      });
      
      throw error;
    }
  }

  /**
   * Get users with filtering and pagination
   */
  static async getUsers(
    filters?: z.infer<typeof UserFiltersSchema>,
    requestedBy?: string
  ): Promise<{ users: UserWithOrganization[]; total: number; stats: any }> {
    const validated = filters ? UserFiltersSchema.parse(filters) : UserFiltersSchema.parse({});
    
    const skip = (validated.page - 1) * validated.limit;
    
    const where: any = {};
    
    if (validated.role) where.role = validated.role;
    if (validated.isActive !== undefined) where.isActive = validated.isActive;
    if (validated.organizationId) where.organizationId = validated.organizationId;
    
    // Search functionality
    if (validated.search) {
      where.OR = [
        { name: { contains: validated.search, mode: 'insensitive' } },
        { email: { contains: validated.search, mode: 'insensitive' } }
      ];
    }
    
    const [users, total, stats] = await Promise.all([
      (prisma as any).user.findMany({
        where,
        skip,
        take: validated.limit,
        orderBy: { [validated.sortBy]: validated.sortOrder },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              domain: true
            }
          }
        }
      }),
      (prisma as any).user.count({ where }),
      this.getUserStats(validated.organizationId)
    ]);
    
    return { users, total, stats };
  }

  /**
   * Get user statistics
   */
  static async getUserStats(organizationId?: string): Promise<any> {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    
    const users = await (prisma as any).user.findMany({
      where,
      select: {
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    const total = users.length;
    const active = users.filter(u => u.isActive).length;
    const inactive = total - active;
    
    const byRole = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
    
    // Recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRegistrations = users.filter(u => u.createdAt > thirtyDaysAgo).length;
    
    // Recent logins (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentLogins = users.filter(u => u.lastLoginAt && u.lastLoginAt > sevenDaysAgo).length;
    
    return {
      total,
      active,
      inactive,
      byRole,
      recentRegistrations,
      recentLogins,
      activePercentage: total > 0 ? Math.round((active / total) * 100) : 0
    };
  }

  /**
   * Update user
   */
  static async updateUser(
    id: string,
    data: z.infer<typeof UpdateUserSchema>,
    updatedBy: string,
    ipAddress?: string
  ): Promise<UserWithOrganization> {
    const validated = UpdateUserSchema.parse(data);
    
    try {
      // Verify user exists
      const existingUser = await (prisma as any).user.findUnique({
        where: { id },
        include: { organization: true }
      });
      
      if (!existingUser) {
        throw new Error('User not found');
      }
      
      // Check if email is being changed and if it already exists
      if (validated.email && validated.email !== existingUser.email) {
        const emailExists = await (prisma as any).user.findFirst({
          where: { 
            email: validated.email,
            id: { not: id }
          }
        });
        
        if (emailExists) {
          throw new Error('Email already exists');
        }
      }
      
      // If role is being changed, update permissions
      let permissions = existingUser.permissions as string[] || [];
      if (validated.role && validated.role !== existingUser.role) {
        permissions = [...(DEFAULT_ROLE_PERMISSIONS[validated.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [])];
      }
      
      // Override with custom permissions if provided  
      if (validated.permissions) {
        permissions = [...validated.permissions];
      }
      
      const updatedUser = await (prisma as any).user.update({
        where: { id },
        data: {
          ...validated,
          permissions,
          updatedAt: new Date()
        },
        include: {
          organization: true
        }
      });
      
      // Log the update
      await AuditService.log({
        userId: updatedBy,
        action: 'user_updated',
        resource: 'user',
        resourceId: id,
        details: {
          changes: validated,
          previousRole: existingUser.role,
          newRole: validated.role
        },
        ipAddress,
        severity: 'medium',
        category: 'auth',
        outcome: 'success'
      });
      
      // Notify user of changes if significant
      if (validated.role && validated.role !== existingUser.role) {
        await NotificationService.create(id, {
          title: 'Account Role Updated',
          message: `Your role has been updated to ${validated.role}`,
          type: 'info',
          priority: 'medium'
        });
      }
      
      return updatedUser;
    } catch (error) {
      await AuditService.log({
        userId: updatedBy,
        action: 'user_update_failed',
        resource: 'user',
        resourceId: id,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        ipAddress,
        severity: 'medium',
        category: 'auth',
        outcome: 'failure'
      });
      
      throw error;
    }
  }

  /**
   * Deactivate user (soft delete)
   */
  static async deactivateUser(
    id: string,
    deactivatedBy: string,
    reason?: string,
    ipAddress?: string
  ): Promise<UserWithOrganization> {
    try {
      const user = await (prisma as any).user.update({
        where: { id },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy,
          updatedAt: new Date()
        },
        include: {
          organization: true
        }
      });
      
      // Log the deactivation
      await AuditService.log({
        userId: deactivatedBy,
        action: 'user_deactivated',
        resource: 'user',
        resourceId: id,
        details: { reason },
        ipAddress,
        severity: 'high',
        category: 'auth',
        outcome: 'success'
      });
      
      // Notify user
      await NotificationService.create(id, {
        title: 'Account Deactivated',
        message: 'Your account has been deactivated. Contact support if you believe this is an error.',
        type: 'warning',
        priority: 'high'
      });
      
      return user;
    } catch (error) {
      await AuditService.log({
        userId: deactivatedBy,
        action: 'user_deactivation_failed',
        resource: 'user',
        resourceId: id,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        ipAddress,
        severity: 'high',
        category: 'auth',
        outcome: 'failure'
      });
      
      throw error;
    }
  }

  /**
   * Reactivate user
   */
  static async reactivateUser(
    id: string,
    reactivatedBy: string,
    ipAddress?: string
  ): Promise<UserWithOrganization> {
    const user = await (prisma as any).user.update({
      where: { id },
      data: {
        isActive: true,
        deactivatedAt: null,
        deactivatedBy: null,
        updatedAt: new Date()
      },
      include: {
        organization: true
      }
    });
    
    await AuditService.log({
      userId: reactivatedBy,
      action: 'user_reactivated',
      resource: 'user',
      resourceId: id,
      ipAddress,
      severity: 'medium',
      category: 'auth',
      outcome: 'success'
    });
    
    await NotificationService.create(id, {
      title: 'Account Reactivated',
      message: 'Your account has been reactivated. Welcome back!',
      type: 'success',
      priority: 'medium'
    });
    
    return user;
  }

  /**
   * Check if user has permission
   */
  static async hasPermission(userId: string, permission: string): Promise<boolean> {
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { permissions: true, role: true }
    });
    
    if (!user) return false;
    
    const userPermissions = user.permissions as string[] || [];
    return userPermissions.includes(permission);
  }

  /**
   * Check if user has higher role than target
   */
  static hasHigherRole(userRole: string, targetRole: string): boolean {
    const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0;
    const targetLevel = ROLE_HIERARCHY[targetRole as keyof typeof ROLE_HIERARCHY] || 0;
    
    return userLevel > targetLevel;
  }

  /**
   * Get user by ID with organization
   */
  static async getUserById(id: string): Promise<UserWithOrganization | null> {
    return await (prisma as any).user.findUnique({
      where: { id },
      include: {
        organization: true
      }
    });
  }

  /**
   * Create organization
   */
  static async createOrganization(
    data: z.infer<typeof CreateOrganizationSchema>,
    createdBy: string,
    ipAddress?: string
  ): Promise<OrganizationWithUsers> {
    const validated = CreateOrganizationSchema.parse(data);
    
    try {
      const organization = await (prisma as any).organization.create({
        data: {
          name: validated.name,
          domain: validated.domain,
          settings: validated.settings || {},
          plan: validated.plan,
          maxUsers: validated.maxUsers,
          features: validated.features,
          createdBy
        },
        include: {
          users: {
            include: {
              organization: true
            }
          },
          _count: {
            select: { users: true }
          }
        }
      });
      
      await AuditService.log({
        userId: createdBy,
        action: 'organization_created',
        resource: 'organization',
        resourceId: organization.id,
        details: { name: validated.name },
        ipAddress,
        severity: 'medium',
        category: 'system',
        outcome: 'success'
      });
      
      return organization;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get available permissions
   */
  static getAvailablePermissions(): typeof PERMISSIONS {
    return PERMISSIONS;
  }

  /**
   * Get role hierarchy
   */
  static getRoleHierarchy(): typeof ROLE_HIERARCHY {
    return ROLE_HIERARCHY;
  }

  /**
   * Get default permissions for role
   */
  static getDefaultPermissionsForRole(role: string): string[] {
    const permissions = DEFAULT_ROLE_PERMISSIONS[role as keyof typeof DEFAULT_ROLE_PERMISSIONS];
    return permissions ? [...permissions] : [];
  }
}

export default UserManagementService;
