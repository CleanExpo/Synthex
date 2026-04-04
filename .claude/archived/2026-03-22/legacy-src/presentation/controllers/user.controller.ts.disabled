/**
 * User Controller Implementation
 * Handles HTTP requests for user operations with full 3-tier integration
 */

import { Response, NextFunction } from 'express';
import { UserBusinessService } from '../../business/services/user.business-service';
import { BaseController, AuthenticatedRequest, ApiResponse } from './base.controller';
import {
  ILogger,
  IMonitoringService,
  IValidator,
  DomainError,
  CreateUserOperation,
  UpdateUserOperation,
  SearchCriteria
} from '../../architecture/layer-interfaces';

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  permissions?: string[];
  tenantId?: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export class UserController extends BaseController {
  private userBusinessService: UserBusinessService;
  private userValidator: IValidator;

  constructor(
    userBusinessService: UserBusinessService,
    userValidator: IValidator,
    logger: ILogger,
    monitoring: IMonitoringService
  ) {
    super(logger, monitoring, 'UserController');
    this.userBusinessService = userBusinessService;
    this.userValidator = userValidator;
  }

  /**
   * Main request handler - routes to specific methods
   */
  async handle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    return this.executeAction(req, res, next, async (req, res) => {
      const method = req.method.toLowerCase();
      const path = req.route.path;

      switch (method) {
        case 'post':
          if (path === '/users') {
            return this.createUser(req, res);
          } else if (path === '/users/:id/authenticate') {
            return this.authenticateUser(req, res);
          }
          break;
        
        case 'get':
          if (path === '/users/:id') {
            return this.getUserById(req, res);
          } else if (path === '/users') {
            return this.searchUsers(req, res);
          } else if (path === '/users/statistics') {
            return this.getUserStatistics(req, res);
          }
          break;
        
        case 'put':
          if (path === '/users/:id') {
            return this.updateUser(req, res);
          }
          break;
        
        case 'patch':
          if (path === '/users/:id/activate') {
            return this.activateUser(req, res);
          } else if (path === '/users/:id/deactivate') {
            return this.deactivateUser(req, res);
          }
          break;
        
        case 'delete':
          if (path === '/users/:id') {
            return this.deleteUser(req, res);
          }
          break;
      }

      throw new DomainError(
        `Unsupported operation: ${method} ${path}`,
        'UNSUPPORTED_OPERATION',
        404
      );
    });
  }

  /**
   * Create new user
   */
  private async createUser(req: AuthenticatedRequest, res: Response): Promise<ApiResponse<UserResponse>> {
    this.requirePermission(req, 'user:create');
    
    const requestData = this.parseRequestBody<CreateUserRequest>(req);
    await this.validateRequest(this.userValidator, requestData, req);

    const context = this.createBusinessContext(req);
    const operation: CreateUserOperation = {
      type: 'create',
      data: {
        email: requestData.email,
        password: requestData.password,
        firstName: requestData.firstName,
        lastName: requestData.lastName,
        role: requestData.role || 'user',
        permissions: requestData.permissions || [],
        tenantId: requestData.tenantId || context.tenantId
      },
      context
    };

    const result = await this.userBusinessService.executeOperation(operation);

    this.logger.info('User created successfully', {
      userId: result.id,
      email: result.email,
      createdBy: context.userId
    });

    return this.createSuccessResponse(
      this.mapToUserResponse(result),
      'User created successfully'
    );
  }

  /**
   * Get user by ID
   */
  private async getUserById(req: AuthenticatedRequest, res: Response): Promise<ApiResponse<UserResponse>> {
    this.requireAuth(req);
    
    const userId = this.parsePathParam(req, 'id');
    const context = this.createBusinessContext(req);

    // Check if user can access this user (themselves or has permission)
    if (userId !== context.userId && !this.hasPermission(req, 'user:read')) {
      throw new DomainError(
        'Insufficient permissions to access user',
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }

    const user = await this.userBusinessService.findById(userId, context);

    if (!user) {
      throw new DomainError(
        'User not found',
        'USER_NOT_FOUND',
        404
      );
    }

    return this.createSuccessResponse(
      this.mapToUserResponse(user),
      'User retrieved successfully'
    );
  }

  /**
   * Update user
   */
  private async updateUser(req: AuthenticatedRequest, res: Response): Promise<ApiResponse<UserResponse>> {
    this.requireAuth(req);
    
    const userId = this.parsePathParam(req, 'id');
    const requestData = this.parseRequestBody<UpdateUserRequest>(req);
    const context = this.createBusinessContext(req);

    // Check permissions - user can update themselves or admin can update anyone
    if (userId !== context.userId && !this.hasPermission(req, 'user:update')) {
      throw new DomainError(
        'Insufficient permissions to update user',
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }

    // Validate role/permission changes require admin access
    if ((requestData.role || requestData.permissions) && !this.hasPermission(req, 'user:admin')) {
      throw new DomainError(
        'Admin permissions required to modify roles or permissions',
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }

    await this.validateRequest(this.userValidator, requestData, req);

    const operation: UpdateUserOperation = {
      type: 'update',
      data: {
        id: userId,
        ...requestData
      },
      context
    };

    const result = await this.userBusinessService.executeOperation(operation);

    this.logger.info('User updated successfully', {
      userId: result.id,
      updatedBy: context.userId,
      updatedFields: Object.keys(requestData)
    });

    return this.createSuccessResponse(
      this.mapToUserResponse(result),
      'User updated successfully'
    );
  }

  /**
   * Search users with filters and pagination
   */
  private async searchUsers(req: AuthenticatedRequest, res: Response): Promise<ApiResponse<UserResponse[]>> {
    this.requirePermission(req, 'user:list');

    const context = this.createBusinessContext(req);
    const pagination = this.extractPagination(req);
    const searchParams = this.extractSearchParams(req);

    const criteria: SearchCriteria = {
      page: pagination.page,
      limit: pagination.limit,
      search: searchParams.search,
      filters: {
        ...searchParams.filters,
        // Add tenant isolation if applicable
        ...(context.tenantId ? { tenantId: context.tenantId } : {})
      },
      sort: searchParams.sort ? {
        field: searchParams.sort.field,
        direction: searchParams.sort.direction
      } : {
        field: 'createdAt',
        direction: 'desc'
      }
    };

    const result = await this.userBusinessService.search(criteria, context);

    const userResponses = result.data.map(user => this.mapToUserResponse(user));

    return this.createPaginatedResponse(
      userResponses,
      {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
        hasMore: result.pagination.hasMore
      },
      `Retrieved ${result.data.length} users`
    );
  }

  /**
   * Authenticate user (login)
   */
  private async authenticateUser(req: AuthenticatedRequest, res: Response): Promise<ApiResponse<{
    user: UserResponse;
    token: string;
    refreshToken: string;
    expiresIn: number;
  }>> {
    const { email, password } = this.parseRequestBody<{ email: string; password: string }>(req);
    
    if (!email || !password) {
      throw new DomainError(
        'Email and password are required',
        'MISSING_CREDENTIALS',
        400
      );
    }

    const context = this.createBusinessContext(req);
    const authResult = await this.userBusinessService.authenticate(email, password, context);

    this.logger.info('User authenticated successfully', {
      userId: authResult.user.id,
      email: authResult.user.email,
      ip: req.ip
    });

    return this.createSuccessResponse({
      user: this.mapToUserResponse(authResult.user),
      token: authResult.token,
      refreshToken: authResult.refreshToken,
      expiresIn: authResult.expiresIn
    }, 'Authentication successful');
  }

  /**
   * Activate user
   */
  private async activateUser(req: AuthenticatedRequest, res: Response): Promise<ApiResponse<UserResponse>> {
    this.requirePermission(req, 'user:admin');
    
    const userId = this.parsePathParam(req, 'id');
    const context = this.createBusinessContext(req);

    const operation: UpdateUserOperation = {
      type: 'update',
      data: {
        id: userId,
        isActive: true
      },
      context
    };

    const result = await this.userBusinessService.executeOperation(operation);

    this.logger.info('User activated', {
      userId: result.id,
      activatedBy: context.userId
    });

    return this.createSuccessResponse(
      this.mapToUserResponse(result),
      'User activated successfully'
    );
  }

  /**
   * Deactivate user
   */
  private async deactivateUser(req: AuthenticatedRequest, res: Response): Promise<ApiResponse<UserResponse>> {
    this.requirePermission(req, 'user:admin');
    
    const userId = this.parsePathParam(req, 'id');
    const context = this.createBusinessContext(req);

    // Prevent self-deactivation
    if (userId === context.userId) {
      throw new DomainError(
        'Cannot deactivate your own account',
        'SELF_DEACTIVATION_FORBIDDEN',
        400
      );
    }

    const operation: UpdateUserOperation = {
      type: 'update',
      data: {
        id: userId,
        isActive: false
      },
      context
    };

    const result = await this.userBusinessService.executeOperation(operation);

    this.logger.info('User deactivated', {
      userId: result.id,
      deactivatedBy: context.userId
    });

    return this.createSuccessResponse(
      this.mapToUserResponse(result),
      'User deactivated successfully'
    );
  }

  /**
   * Delete user (soft delete)
   */
  private async deleteUser(req: AuthenticatedRequest, res: Response): Promise<ApiResponse<void>> {
    this.requirePermission(req, 'user:delete');
    
    const userId = this.parsePathParam(req, 'id');
    const context = this.createBusinessContext(req);

    // Prevent self-deletion
    if (userId === context.userId) {
      throw new DomainError(
        'Cannot delete your own account',
        'SELF_DELETION_FORBIDDEN',
        400
      );
    }

    await this.userBusinessService.delete(userId, context);

    this.logger.info('User deleted', {
      userId,
      deletedBy: context.userId
    });

    return this.createSuccessResponse(
      undefined,
      'User deleted successfully'
    );
  }

  /**
   * Get user statistics
   */
  private async getUserStatistics(req: AuthenticatedRequest, res: Response): Promise<ApiResponse<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    usersByRole: Record<string, number>;
    recentlyActiveUsers: number;
  }>> {
    this.requirePermission(req, 'user:statistics');

    const context = this.createBusinessContext(req);
    const stats = await this.userBusinessService.getStatistics(context);

    return this.createSuccessResponse(
      stats,
      'User statistics retrieved successfully'
    );
  }

  /**
   * Map domain user to API response
   */
  private mapToUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions || [],
      isActive: user.isActive,
      tenantId: user.tenantId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt
    };
  }
}