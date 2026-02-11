/**
 * User Business Service
 * Implements user-related business logic and operations
 */

import { BaseService } from './base.service';
import {
  BusinessOperation,
  BusinessResult,
  BusinessError,
  BusinessContext,
  ILogger,
  IMonitoringService,
  ICacheService,
  ISecurityService
} from '../../architecture/layer-interfaces';
import { UnitOfWork } from '../../data/unit-of-work';
import { User } from '@prisma/client';

export interface CreateUserOperation {
  email: string;
  name?: string;
  password?: string;
  role?: string;
  googleId?: string;
  avatar?: string;
  preferences?: any;
}

export interface UpdateUserOperation {
  userId: string;
  name?: string;
  avatar?: string;
  preferences?: any;
  role?: string;
}

export interface UserSearchOperation {
  searchTerm?: string;
  filters?: {
    role?: string;
    isEmailVerified?: boolean;
    includeDeleted?: boolean;
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export class UserBusinessService extends BaseService {
  private cacheService: ICacheService;
  private securityService: ISecurityService;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly MAX_SEARCH_LIMIT = 100;

  constructor(
    unitOfWork: UnitOfWork,
    logger: ILogger,
    monitoring: IMonitoringService,
    cacheService: ICacheService,
    securityService: ISecurityService
  ) {
    super(unitOfWork, logger, monitoring, 'UserBusinessService');
    this.cacheService = cacheService;
    this.securityService = securityService;
  }

  /**
   * Execute core business logic based on operation type
   */
  protected async executeCore(operation: BusinessOperation): Promise<BusinessResult> {
    switch (operation.type) {
      case 'createUser':
        return await this.createUser(operation.data as CreateUserOperation, operation.context);
      case 'updateUser':
        return await this.updateUser(operation.data as UpdateUserOperation, operation.context);
      case 'getUserById':
        return await this.getUserById(operation.data.userId, operation.context);
      case 'getUserByEmail':
        return await this.getUserByEmail(operation.data.email, operation.context);
      case 'searchUsers':
        return await this.searchUsers(operation.data as UserSearchOperation, operation.context);
      case 'deleteUser':
        return await this.deleteUser(operation.data.userId, operation.context);
      case 'getUserStats':
        return await this.getUserStats(operation.data.userId, operation.context);
      case 'updatePassword':
        return await this.updatePassword(operation.data.userId, operation.data.newPassword, operation.context);
      case 'createGoogleUser':
        return await this.createGoogleUser(operation.data, operation.context);
      default:
        return this.createErrorResult([{
          code: 'UNSUPPORTED_OPERATION',
          message: `Operation ${operation.type} is not supported`
        }]);
    }
  }

  /**
   * Create new user
   */
  private async createUser(data: CreateUserOperation, context: BusinessContext): Promise<BusinessResult> {
    try {
      // Validate email uniqueness
      const emailExists = await this.unitOfWork.userRepository.findByEmail(data.email);
      if (emailExists) {
        return this.createErrorResult([{
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'A user with this email already exists'
        }]);
      }

      // Hash password if provided
      let passwordHash: string | undefined;
      if (data.password) {
        passwordHash = await this.securityService.hashPassword(data.password);
      }

      // Create user within transaction
      const user = await this.executeInTransaction(async () => {
        return await this.unitOfWork.userRepository.create({
          email: data.email.toLowerCase(),
          name: data.name || 'New User',
          password: passwordHash,
          googleId: data.googleId,
          avatar: data.avatar,
          preferences: data.preferences || {},
          // Database expects DateTime, not boolean
          // Google users are pre-verified (set timestamp), local users need verification (null)
          emailVerified: data.googleId ? new Date() : null,
          authProvider: data.googleId ? 'google' : 'local'
        });
      });

      // Clear cache
      await this.clearUserCache(user.id, user.email);

      // Log business event
      this.logBusinessEvent('USER_CREATED', { type: 'createUser', data, context }, { userId: user.id });

      // Transform for output (remove sensitive data)
      const userOutput = this.transformForOutput(user, context);

      return this.createSuccessResult(userOutput, {
        operation: 'createUser',
        userId: user.id
      });
    } catch (error) {
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user information
   */
  private async updateUser(data: UpdateUserOperation, context: BusinessContext): Promise<BusinessResult> {
    try {
      // Verify user exists and user has permission to update
      const existingUser = await this.unitOfWork.userRepository.findById(data.userId);
      if (!existingUser) {
        return this.createErrorResult([{
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }]);
      }

      // Check if user can update (self or admin)
      if (context.userId !== data.userId && !context.permissions.includes('admin')) {
        return this.createErrorResult([{
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You can only update your own profile unless you are an admin'
        }]);
      }

      // Update user within transaction
      const updatedUser = await this.executeInTransaction(async () => {
        return await this.unitOfWork.userRepository.update(data.userId, {
          name: data.name,
          avatar: data.avatar,
          preferences: data.preferences
        });
      });

      // Clear cache
      await this.clearUserCache(updatedUser.id, updatedUser.email);

      // Log business event
      this.logBusinessEvent('USER_UPDATED', { type: 'updateUser', data, context }, { userId: updatedUser.id });

      // Transform for output
      const userOutput = this.transformForOutput(updatedUser, context);

      return this.createSuccessResult(userOutput, {
        operation: 'updateUser',
        userId: updatedUser.id
      });
    } catch (error) {
      throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user by ID with caching
   */
  private async getUserById(userId: string, context: BusinessContext): Promise<BusinessResult> {
    try {
      // Try cache first
      const cacheKey = `user:${userId}`;
      let user = await this.cacheService.get<User>(cacheKey);

      if (!user) {
        // Fetch from database
        user = await this.unitOfWork.userRepository.findById(userId);
        if (!user) {
          return this.createErrorResult([{
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }]);
        }

        // Cache the result
        await this.cacheService.set(cacheKey, user, this.CACHE_TTL);
      }

      // Transform for output
      const userOutput = this.transformForOutput(user, context);

      return this.createSuccessResult(userOutput, {
        operation: 'getUserById',
        userId: user.id,
        fromCache: !!user
      });
    } catch (error) {
      throw new Error(`Failed to get user by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user by email
   */
  private async getUserByEmail(email: string, context: BusinessContext): Promise<BusinessResult> {
    try {
      const user = await this.unitOfWork.userRepository.findByEmail(email, {
        includeDeleted: false
      });

      if (!user) {
        return this.createErrorResult([{
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }]);
      }

      // Transform for output
      const userOutput = this.transformForOutput(user, context);

      return this.createSuccessResult(userOutput, {
        operation: 'getUserByEmail',
        email: user.email
      });
    } catch (error) {
      throw new Error(`Failed to get user by email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search users with pagination and filtering
   */
  private async searchUsers(data: UserSearchOperation, context: BusinessContext): Promise<BusinessResult> {
    try {
      // Validate search parameters
      const limit = Math.min(data.pagination?.limit || 20, this.MAX_SEARCH_LIMIT);
      const page = Math.max(data.pagination?.page || 1, 1);

      const users = await this.unitOfWork.userRepository.searchUsers(
        data.searchTerm || '',
        {
          ...data.filters,
          limit
        }
      );

      // Transform for output
      const usersOutput = users.map(user => this.transformForOutput(user, context));

      return this.createSuccessResult({
        users: usersOutput,
        pagination: {
          page,
          limit,
          total: users.length,
          hasMore: users.length === limit
        }
      }, {
        operation: 'searchUsers',
        searchTerm: data.searchTerm
      });
    } catch (error) {
      throw new Error(`Failed to search users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Soft delete user
   */
  private async deleteUser(userId: string, context: BusinessContext): Promise<BusinessResult> {
    try {
      // Check if user exists
      const user = await this.unitOfWork.userRepository.findById(userId);
      if (!user) {
        return this.createErrorResult([{
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }]);
      }

      // Check permissions (admin or self-deletion)
      if (context.userId !== userId && !context.permissions.includes('admin')) {
        return this.createErrorResult([{
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You can only delete your own account unless you are an admin'
        }]);
      }

      // Perform soft delete within transaction
      await this.executeInTransaction(async () => {
        await this.unitOfWork.userRepository.softDelete(userId);
      });

      // Clear cache
      await this.clearUserCache(userId, user.email);

      // Log business event
      this.logBusinessEvent('USER_DELETED', { type: 'deleteUser', data: { userId }, context }, { userId });

      return this.createSuccessResult(null, {
        operation: 'deleteUser',
        userId
      });
    } catch (error) {
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user statistics
   */
  private async getUserStats(userId: string, context: BusinessContext): Promise<BusinessResult> {
    try {
      // Check cache first
      const cacheKey = `user-stats:${userId}`;
      let stats = await this.cacheService.get(cacheKey);

      if (!stats) {
        stats = await this.unitOfWork.userRepository.getUserStats(userId);
        // Cache for shorter time since stats change frequently
        await this.cacheService.set(cacheKey, stats, 900); // 15 minutes
      }

      return this.createSuccessResult(stats, {
        operation: 'getUserStats',
        userId,
        fromCache: !!stats
      });
    } catch (error) {
      throw new Error(`Failed to get user stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user password
   */
  private async updatePassword(userId: string, newPassword: string, context: BusinessContext): Promise<BusinessResult> {
    try {
      // Validate password strength
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return this.createErrorResult(passwordValidation.errors);
      }

      // Hash new password
      const passwordHash = await this.securityService.hashPassword(newPassword);

      // Update password within transaction
      await this.executeInTransaction(async () => {
        await this.unitOfWork.userRepository.update(userId, {
          password: passwordHash
        });
      });

      // Clear cache
      const user = await this.unitOfWork.userRepository.findById(userId);
      if (user) {
        await this.clearUserCache(userId, user.email);
      }

      // Log business event (without password details)
      this.logBusinessEvent('USER_PASSWORD_UPDATED', { type: 'updatePassword', data: { userId }, context }, { userId });

      return this.createSuccessResult(null, {
        operation: 'updatePassword',
        userId
      });
    } catch (error) {
      throw new Error(`Failed to update password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create user from Google OAuth
   */
  private async createGoogleUser(data: any, context: BusinessContext): Promise<BusinessResult> {
    try {
      const user = await this.executeInTransaction(async () => {
        return await this.unitOfWork.userRepository.createGoogleUser({
          email: data.email,
          name: data.name,
          googleId: data.googleId,
          avatar: data.avatar
        });
      });

      // Clear cache
      await this.clearUserCache(user.id, user.email);

      // Log business event
      this.logBusinessEvent('GOOGLE_USER_CREATED', { type: 'createGoogleUser', data, context }, { userId: user.id });

      // Transform for output
      const userOutput = this.transformForOutput(user, context);

      return this.createSuccessResult(userOutput, {
        operation: 'createGoogleUser',
        userId: user.id
      });
    } catch (error) {
      throw new Error(`Failed to create Google user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate operation-specific business rules
   */
  protected async validateOperationCustom(operation: BusinessOperation): Promise<BusinessError[]> {
    const errors: BusinessError[] = [];

    switch (operation.type) {
      case 'createUser':
        errors.push(...this.validateCreateUser(operation.data as CreateUserOperation));
        break;
      case 'updateUser':
        errors.push(...this.validateUpdateUser(operation.data as UpdateUserOperation));
        break;
    }

    return errors;
  }

  /**
   * Validate create user operation
   */
  private validateCreateUser(data: CreateUserOperation): BusinessError[] {
    const errors: BusinessError[] = [];

    if (!data.email) {
      errors.push({
        code: 'EMAIL_REQUIRED',
        message: 'Email is required'
      });
    } else if (!this.isValidEmail(data.email)) {
      errors.push({
        code: 'INVALID_EMAIL',
        message: 'Email format is invalid'
      });
    }

    if (data.password) {
      const passwordValidation = this.validatePassword(data.password);
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors);
      }
    }

    return errors;
  }

  /**
   * Validate update user operation
   */
  private validateUpdateUser(data: UpdateUserOperation): BusinessError[] {
    const errors: BusinessError[] = [];

    if (!data.userId) {
      errors.push({
        code: 'USER_ID_REQUIRED',
        message: 'User ID is required'
      });
    }

    return errors;
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): { isValid: boolean; errors: BusinessError[] } {
    const errors: BusinessError[] = [];

    if (!password) {
      errors.push({
        code: 'PASSWORD_REQUIRED',
        message: 'Password is required'
      });
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push({
        code: 'PASSWORD_TOO_SHORT',
        message: 'Password must be at least 8 characters long'
      });
    }

    if (!/[A-Z]/.test(password)) {
      errors.push({
        code: 'PASSWORD_MISSING_UPPERCASE',
        message: 'Password must contain at least one uppercase letter'
      });
    }

    if (!/[a-z]/.test(password)) {
      errors.push({
        code: 'PASSWORD_MISSING_LOWERCASE',
        message: 'Password must contain at least one lowercase letter'
      });
    }

    if (!/\d/.test(password)) {
      errors.push({
        code: 'PASSWORD_MISSING_NUMBER',
        message: 'Password must contain at least one number'
      });
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push({
        code: 'PASSWORD_MISSING_SPECIAL',
        message: 'Password must contain at least one special character'
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Clear user cache
   */
  private async clearUserCache(userId: string, email: string): Promise<void> {
    const cacheKeys = [
      `user:${userId}`,
      `user-email:${email}`,
      `user-stats:${userId}`
    ];

    await Promise.all(cacheKeys.map(key => this.cacheService.delete(key)));
  }

  /**
   * Get required permissions for operations
   */
  protected getRequiredPermissions(operationType: string): string[] {
    const permissionMap: Record<string, string[]> = {
      'createUser': ['user.create'],
      'updateUser': ['user.update'],
      'deleteUser': ['user.delete'],
      'getUserById': ['user.read'],
      'getUserByEmail': ['user.read'],
      'searchUsers': ['user.read'],
      'getUserStats': ['user.read'],
      'updatePassword': ['user.update'],
      'createGoogleUser': ['user.create']
    };

    return permissionMap[operationType] || [];
  }
}
