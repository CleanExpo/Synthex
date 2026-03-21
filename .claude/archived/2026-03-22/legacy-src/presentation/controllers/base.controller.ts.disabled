/**
 * Base Controller Implementation
 * Provides common patterns for request handling, validation, and response formatting
 */

import { Request, Response, NextFunction } from 'express';
import {
  IController,
  IValidator,
  ValidationResult,
  BusinessOperation,
  BusinessContext,
  ILogger,
  IMonitoringService,
  ApplicationError,
  DomainError
} from '../../architecture/layer-interfaces';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    tenantId?: string;
  };
  correlationId?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  metadata?: {
    timestamp: string;
    correlationId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

export abstract class BaseController implements IController {
  protected logger: ILogger;
  protected monitoring: IMonitoringService;
  protected controllerName: string;

  constructor(
    logger: ILogger,
    monitoring: IMonitoringService,
    controllerName: string
  ) {
    this.logger = logger;
    this.monitoring = monitoring;
    this.controllerName = controllerName;
  }

  /**
   * Handle HTTP request - main entry point
   */
  abstract handle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> | void;

  /**
   * Execute controller action with comprehensive error handling and monitoring
   */
  protected async executeAction(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
    action: (req: AuthenticatedRequest, res: Response) => Promise<ApiResponse>
  ): Promise<void> {
    const timer = this.monitoring.startTimer(`${this.controllerName}.request`);
    const correlationId = req.correlationId || this.generateCorrelationId();
    
    try {
      this.logger.info(`${this.controllerName} - ${req.method} ${req.path}`, {
        controller: this.controllerName,
        method: req.method,
        path: req.path,
        userId: req.user?.id,
        correlationId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Execute the action
      const result = await action(req, res);

      // Add correlation ID to response
      if (result.metadata) {
        result.metadata.correlationId = correlationId;
      }

      // Set response headers
      res.setHeader('X-Correlation-ID', correlationId);
      res.setHeader('X-Request-ID', correlationId);

      // Send response
      const statusCode = this.getStatusCode(result);
      res.status(statusCode).json(result);

      // Log successful completion
      this.logger.info(`${this.controllerName} - Request completed`, {
        controller: this.controllerName,
        method: req.method,
        path: req.path,
        statusCode,
        success: result.success,
        correlationId
      });

      // Record metrics
      this.monitoring.incrementCounter(`${this.controllerName}.request.success`, {
        method: req.method,
        status: statusCode.toString()
      });

    } catch (error) {
      this.logger.error(`${this.controllerName} - Request failed`, error as Error, {
        controller: this.controllerName,
        method: req.method,
        path: req.path,
        userId: req.user?.id,
        correlationId
      });

      // Record error metrics
      this.monitoring.incrementCounter(`${this.controllerName}.request.error`, {
        method: req.method,
        errorType: (error as Error).constructor.name
      });

      // Handle error response
      const errorResponse = this.handleError(error as Error, correlationId);
      const statusCode = this.getStatusCode(errorResponse);
      
      res.status(statusCode).json(errorResponse);

    } finally {
      timer.end({ method: req.method, controller: this.controllerName });
    }
  }

  /**
   * Validate request data using validator
   */
  protected async validateRequest<T>(
    validator: IValidator,
    data: any,
    req: AuthenticatedRequest
  ): Promise<T> {
    const validationResult = await validator.validate(data);
    
    if (!validationResult.isValid) {
      throw new DomainError(
        'Validation failed',
        'VALIDATION_ERROR',
        400,
        {
          errors: validationResult.errors,
          controller: this.controllerName
        }
      );
    }

    return data as T;
  }

  /**
   * Create business context from request
   */
  protected createBusinessContext(req: AuthenticatedRequest): BusinessContext {
    return {
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      permissions: req.user?.permissions || [],
      metadata: {
        controller: this.controllerName,
        correlationId: req.correlationId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Create business operation from request
   */
  protected createBusinessOperation(
    type: string,
    data: any,
    context: BusinessContext
  ): BusinessOperation {
    return {
      type,
      data,
      context
    };
  }

  /**
   * Create successful response
   */
  protected createSuccessResponse<T>(
    data?: T,
    message?: string,
    metadata?: any
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Create error response
   */
  protected createErrorResponse(
    message: string,
    errors?: Array<{ code: string; message: string; field?: string }>,
    metadata?: any
  ): ApiResponse {
    return {
      success: false,
      message,
      errors,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Extract pagination parameters from request
   */
  protected extractPagination(req: Request): { page: number; limit: number } {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100);
    
    return { page, limit };
  }

  /**
   * Extract search parameters from request
   */
  protected extractSearchParams(req: Request): {
    search?: string;
    filters?: Record<string, any>;
    sort?: { field: string; direction: 'asc' | 'desc' };
  } {
    const search = req.query.search as string;
    const sortField = req.query.sortField as string;
    const sortDirection = (req.query.sortDirection as string) || 'desc';

    // Extract filters (any query param starting with 'filter.')
    const filters: Record<string, any> = {};
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('filter.')) {
        const filterKey = key.replace('filter.', '');
        filters[filterKey] = req.query[key];
      }
    });

    const sort = sortField ? {
      field: sortField,
      direction: (sortDirection === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
    } : undefined;

    return { search, filters, sort };
  }

  /**
   * Handle different types of errors and convert to API response
   */
  protected handleError(error: Error, correlationId: string): ApiResponse {
    if (error instanceof DomainError) {
      return {
        success: false,
        message: error.message,
        errors: [{
          code: error.code,
          message: error.message
        }],
        metadata: {
          timestamp: new Date().toISOString(),
          correlationId,
          errorType: 'DomainError'
        }
      };
    }

    if ((error as ApplicationError).code && (error as ApplicationError).statusCode) {
      const appError = error as ApplicationError;
      return {
        success: false,
        message: appError.message,
        errors: [{
          code: appError.code,
          message: appError.message
        }],
        metadata: {
          timestamp: new Date().toISOString(),
          correlationId,
          errorType: 'ApplicationError'
        }
      };
    }

    // Generic error
    return {
      success: false,
      message: 'An unexpected error occurred',
      errors: [{
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      }],
      metadata: {
        timestamp: new Date().toISOString(),
        correlationId,
        errorType: 'UnknownError'
      }
    };
  }

  /**
   * Get appropriate HTTP status code from API response
   */
  protected getStatusCode(response: ApiResponse): number {
    if (response.success) {
      return 200;
    }

    // Check for specific error codes
    if (response.errors && response.errors.length > 0) {
      const errorCode = response.errors[0].code;
      
      switch (errorCode) {
        case 'UNAUTHORIZED':
        case 'AUTHENTICATION_REQUIRED':
          return 401;
        case 'FORBIDDEN':
        case 'INSUFFICIENT_PERMISSIONS':
          return 403;
        case 'NOT_FOUND':
        case 'RESOURCE_NOT_FOUND':
          return 404;
        case 'VALIDATION_ERROR':
        case 'INVALID_INPUT':
          return 400;
        case 'CONFLICT':
        case 'DUPLICATE_RESOURCE':
          return 409;
        case 'RATE_LIMITED':
          return 429;
        default:
          return 500;
      }
    }

    return 500;
  }

  /**
   * Generate unique correlation ID
   */
  protected generateCorrelationId(): string {
    return `${this.controllerName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize sensitive data from request for logging
   */
  protected sanitizeForLogging(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };
    const sensitiveFields = [
      'password',
      'passwordHash',
      'secret',
      'token',
      'apiKey',
      'authorization',
      'cookie'
    ];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Check if user has required permission
   */
  protected hasPermission(req: AuthenticatedRequest, permission: string): boolean {
    return req.user?.permissions?.includes(permission) || false;
  }

  /**
   * Check if user has any of the required permissions
   */
  protected hasAnyPermission(req: AuthenticatedRequest, permissions: string[]): boolean {
    if (!req.user?.permissions) return false;
    return permissions.some(permission => req.user!.permissions.includes(permission));
  }

  /**
   * Check if user has all required permissions
   */
  protected hasAllPermissions(req: AuthenticatedRequest, permissions: string[]): boolean {
    if (!req.user?.permissions) return false;
    return permissions.every(permission => req.user!.permissions.includes(permission));
  }

  /**
   * Require authentication - throws error if user not authenticated
   */
  protected requireAuth(req: AuthenticatedRequest): void {
    if (!req.user) {
      throw new DomainError(
        'Authentication required',
        'AUTHENTICATION_REQUIRED',
        401
      );
    }
  }

  /**
   * Require specific permission - throws error if user doesn't have permission
   */
  protected requirePermission(req: AuthenticatedRequest, permission: string): void {
    this.requireAuth(req);
    
    if (!this.hasPermission(req, permission)) {
      throw new DomainError(
        `Permission required: ${permission}`,
        'INSUFFICIENT_PERMISSIONS',
        403,
        { requiredPermission: permission }
      );
    }
  }

  /**
   * Create paginated response with metadata
   */
  protected createPaginatedResponse<T>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore?: boolean;
    },
    message?: string
  ): ApiResponse<T[]> {
    return {
      success: true,
      data,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          hasMore: pagination.hasMore ?? ((pagination.page * pagination.limit) < pagination.total)
        }
      }
    };
  }

  /**
   * Parse request body with error handling
   */
  protected parseRequestBody<T>(req: Request): T {
    if (!req.body) {
      throw new DomainError(
        'Request body is required',
        'MISSING_REQUEST_BODY',
        400
      );
    }

    return req.body as T;
  }

  /**
   * Parse path parameter with validation
   */
  protected parsePathParam(req: Request, paramName: string, required: boolean = true): string {
    const value = req.params[paramName];
    
    if (required && !value) {
      throw new DomainError(
        `Path parameter '${paramName}' is required`,
        'MISSING_PATH_PARAMETER',
        400,
        { paramName }
      );
    }

    return value;
  }

  /**
   * Parse query parameter with optional type conversion
   */
  protected parseQueryParam<T = string>(
    req: Request,
    paramName: string,
    defaultValue?: T,
    converter?: (value: string) => T
  ): T | undefined {
    const value = req.query[paramName] as string;
    
    if (!value) {
      return defaultValue;
    }

    if (converter) {
      try {
        return converter(value);
      } catch (error) {
        throw new DomainError(
          `Invalid value for query parameter '${paramName}': ${value}`,
          'INVALID_QUERY_PARAMETER',
          400,
          { paramName, value }
        );
      }
    }

    return value as unknown as T;
  }
}