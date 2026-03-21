import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import UserManagementService, {
  CreateUserSchema,
  UpdateUserSchema,
  CreateOrganizationSchema,
  UserFiltersSchema
} from '../services/userManagement';
import { apiResponse } from '../utils/apiResponse';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Middleware to check admin permissions
const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: Function) => {
    try {
      const hasPermission = await UserManagementService.hasPermission(req.user!.id, permission);
      
      if (!hasPermission) {
        return apiResponse.error(res, `Insufficient permissions. Required: ${permission}`, 403);
      }
      
      next();
    } catch (error) {
      return apiResponse.error(res, 'Permission check failed', 500);
    }
  };
};

/**
 * @route   GET /api/v1/users
 * @desc    Get users with filtering and pagination
 * @access  Private (users.read permission)
 */
router.get('/', requirePermission('users.read'), async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    
    // Parse query parameters
    if (req.query.role && ['user', 'admin', 'superadmin', 'editor', 'viewer'].includes(req.query.role as string)) {
      filters.role = req.query.role;
    }
    
    if (req.query.isActive === 'true') filters.isActive = true;
    if (req.query.isActive === 'false') filters.isActive = false;
    
    if (req.query.organizationId) filters.organizationId = req.query.organizationId as string;
    if (req.query.search) filters.search = req.query.search as string;
    if (req.query.page) filters.page = parseInt(req.query.page as string);
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
    
    if (req.query.sortBy && ['createdAt', 'name', 'email', 'role'].includes(req.query.sortBy as string)) {
      filters.sortBy = req.query.sortBy;
    }
    
    if (req.query.sortOrder && ['asc', 'desc'].includes(req.query.sortOrder as string)) {
      filters.sortOrder = req.query.sortOrder;
    }
    
    const result = await UserManagementService.getUsers(filters, req.user!.id);
    
    return apiResponse.success(res, result, 'Users retrieved successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    console.error('Error fetching users:', error);
    return apiResponse.error(res, 'Failed to fetch users');
  }
});

/**
 * @route   POST /api/v1/users
 * @desc    Create a new user
 * @access  Private (users.create permission)
 */
router.post('/', requirePermission('users.create'), async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const user = await UserManagementService.createUser(
      req.body,
      req.user!.id,
      ipAddress
    );
    
    return apiResponse.created(res, user, 'User created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'User with this email already exists') {
      return apiResponse.error(res, 'User with this email already exists', 400);
    }
    if ((error as Error).message === 'Organization not found') {
      return apiResponse.notFound(res, 'Organization not found');
    }
    if ((error as Error).message === 'Organization user limit reached') {
      return apiResponse.error(res, 'Organization user limit reached', 400);
    }
    console.error('Error creating user:', error);
    return apiResponse.error(res, 'Failed to create user');
  }
});

/**
 * @route   GET /api/v1/users/stats
 * @desc    Get user statistics
 * @access  Private (users.read permission)
 */
router.get('/stats', requirePermission('users.read'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string;
    const stats = await UserManagementService.getUserStats(organizationId);
    
    return apiResponse.success(res, stats, 'User statistics retrieved successfully');
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return apiResponse.error(res, 'Failed to fetch user statistics');
  }
});

/**
 * @route   GET /api/v1/users/permissions
 * @desc    Get available permissions
 * @access  Private (users.read permission)
 */
router.get('/permissions', requirePermission('users.read'), async (req: Request, res: Response) => {
  try {
    const permissions = UserManagementService.getAvailablePermissions();
    const hierarchy = UserManagementService.getRoleHierarchy();
    
    return apiResponse.success(res, {
      permissions,
      hierarchy,
      rolePermissions: {
        superadmin: UserManagementService.getDefaultPermissionsForRole('superadmin'),
        admin: UserManagementService.getDefaultPermissionsForRole('admin'),
        editor: UserManagementService.getDefaultPermissionsForRole('editor'),
        user: UserManagementService.getDefaultPermissionsForRole('user'),
        viewer: UserManagementService.getDefaultPermissionsForRole('viewer')
      }
    }, 'Permissions retrieved successfully');
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return apiResponse.error(res, 'Failed to fetch permissions');
  }
});

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get a single user by ID
 * @access  Private (users.read permission)
 */
router.get('/:id', requirePermission('users.read'), async (req: Request, res: Response) => {
  try {
    const user = await UserManagementService.getUserById(req.params.id as string);
    
    if (!user) {
      return apiResponse.notFound(res, 'User not found');
    }
    
    return apiResponse.success(res, user, 'User retrieved successfully');
  } catch (error) {
    console.error('Error fetching user:', error);
    return apiResponse.error(res, 'Failed to fetch user');
  }
});

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update a user
 * @access  Private (users.update permission)
 */
router.put('/:id', requirePermission('users.update'), async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const user = await UserManagementService.updateUser(
      req.params.id as string,
      req.body,
      req.user!.id,
      ipAddress
    );
    
    return apiResponse.success(res, user, 'User updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'User not found') {
      return apiResponse.notFound(res, 'User not found');
    }
    if ((error as Error).message === 'Email already exists') {
      return apiResponse.error(res, 'Email already exists', 400);
    }
    console.error('Error updating user:', error);
    return apiResponse.error(res, 'Failed to update user');
  }
});

/**
 * @route   POST /api/v1/users/:id/deactivate
 * @desc    Deactivate a user
 * @access  Private (users.delete permission)
 */
router.post('/:id/deactivate', requirePermission('users.delete'), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const user = await UserManagementService.deactivateUser(
      req.params.id as string,
      req.user!.id,
      reason,
      ipAddress
    );
    
    return apiResponse.success(res, user, 'User deactivated successfully');
  } catch (error) {
    console.error('Error deactivating user:', error);
    return apiResponse.error(res, 'Failed to deactivate user');
  }
});

/**
 * @route   POST /api/v1/users/:id/reactivate
 * @desc    Reactivate a user
 * @access  Private (users.update permission)
 */
router.post('/:id/reactivate', requirePermission('users.update'), async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const user = await UserManagementService.reactivateUser(
      req.params.id as string,
      req.user!.id,
      ipAddress
    );
    
    return apiResponse.success(res, user, 'User reactivated successfully');
  } catch (error) {
    console.error('Error reactivating user:', error);
    return apiResponse.error(res, 'Failed to reactivate user');
  }
});

/**
 * @route   POST /api/v1/users/check-permission
 * @desc    Check if current user has specific permission
 * @access  Private
 */
router.post('/check-permission', async (req: Request, res: Response) => {
  try {
    const { permission } = req.body;
    
    if (!permission) {
      return apiResponse.error(res, 'Permission parameter is required', 400);
    }
    
    const hasPermission = await UserManagementService.hasPermission(req.user!.id, permission);
    
    return apiResponse.success(res, { hasPermission }, 'Permission check completed');
  } catch (error) {
    console.error('Error checking permission:', error);
    return apiResponse.error(res, 'Failed to check permission');
  }
});

/**
 * @route   POST /api/v1/organizations
 * @desc    Create a new organization
 * @access  Private (org.manage permission)
 */
router.post('/organizations', requirePermission('org.manage'), async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const organization = await UserManagementService.createOrganization(
      req.body,
      req.user!.id,
      ipAddress
    );
    
    return apiResponse.created(res, organization, 'Organization created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    console.error('Error creating organization:', error);
    return apiResponse.error(res, 'Failed to create organization');
  }
});

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const user = await UserManagementService.getUserById(req.user!.id);
    
    if (!user) {
      return apiResponse.notFound(res, 'User not found');
    }
    
    // Don't expose sensitive information
    const sanitizedUser = {
      ...user,
      password: undefined,
      twoFactorSecret: undefined,
      twoFactorBackupCodes: undefined
    };
    
    return apiResponse.success(res, sanitizedUser, 'User profile retrieved successfully');
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return apiResponse.error(res, 'Failed to fetch user profile');
  }
});

/**
 * @route   PUT /api/v1/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me', async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    // Users can only update their own name and email, not role or permissions
    const allowedUpdates = {
      name: req.body.name,
      email: req.body.email
    };
    
    const user = await UserManagementService.updateUser(
      req.user!.id,
      allowedUpdates,
      req.user!.id,
      ipAddress
    );
    
    return apiResponse.success(res, user, 'Profile updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.validationError(res, error.errors);
    }
    if ((error as Error).message === 'Email already exists') {
      return apiResponse.error(res, 'Email already exists', 400);
    }
    console.error('Error updating profile:', error);
    return apiResponse.error(res, 'Failed to update profile');
  }
});

export default router;
