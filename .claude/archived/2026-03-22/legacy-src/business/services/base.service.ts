/**
 * Base Business Service
 * Provides common business logic patterns and error handling
 */

import {
  IBusinessService,
  BusinessOperation,
  BusinessResult,
  BusinessContext,
  BusinessError,
  ILogger,
  IMonitoringService,
  DomainError
} from '../../architecture/layer-interfaces';
import { UnitOfWork } from '../../data/unit-of-work';

export abstract class BaseService implements IBusinessService {
  protected unitOfWork: UnitOfWork;
  protected logger: ILogger;
  protected monitoring: IMonitoringService;
  protected serviceName: string;

  constructor(
    unitOfWork: UnitOfWork,
    logger: ILogger,
    monitoring: IMonitoringService,
    serviceName: string
  ) {
    this.unitOfWork = unitOfWork;
    this.logger = logger;
    this.monitoring = monitoring;
    this.serviceName = serviceName;
  }

  /**
   * Execute business operation with comprehensive error handling and monitoring
   */
  async execute(operation: BusinessOperation): Promise<BusinessResult> {
    const timer = this.monitoring.startTimer(`${this.serviceName}.${operation.type}`);
    
    try {
      this.logger.info(`Starting ${operation.type}`, {
        service: this.serviceName,
        operationType: operation.type,
        userId: operation.context.userId,
        tenantId: operation.context.tenantId
      });

      // Validate operation
      const validationResult = await this.validateOperation(operation);
      if (!validationResult.isValid) {
        return this.createErrorResult(validationResult.errors);
      }

      // Check permissions
      const authResult = await this.checkPermissions(operation);
      if (!authResult.isAuthorized) {
        return this.createErrorResult([{
          code: 'UNAUTHORIZED',
          message: authResult.message || 'Operation not authorized',
          details: { requiredPermissions: authResult.requiredPermissions }
        }]);
      }

      // Execute the actual business logic
      const result = await this.executeCore(operation);

      // Log successful operation
      this.logger.info(`Completed ${operation.type}`, {
        service: this.serviceName,
        operationType: operation.type,
        success: result.success,
        userId: operation.context.userId
      });

      // Record metrics
      this.monitoring.incrementCounter(`${this.serviceName}.${operation.type}.success`);

      return result;

    } catch (error) {
      this.logger.error(`Failed ${operation.type}`, error as Error, {
        service: this.serviceName,
        operationType: operation.type,
        userId: operation.context.userId
      });

      this.monitoring.incrementCounter(`${this.serviceName}.${operation.type}.error`);

      return this.createErrorResult([{
        code: 'OPERATION_FAILED',
        message: `Failed to execute ${operation.type}`,
        details: error
      }]);
    } finally {
      timer.end();
    }
  }

  /**
   * Execute operation within a database transaction
   */
  protected async executeInTransaction<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    return await this.unitOfWork.execute(operation);
  }

  /**
   * Execute multiple operations atomically
   */
  protected async executeMultiple(
    operations: BusinessOperation[]
  ): Promise<BusinessResult[]> {
    return await this.unitOfWork.executeMultiple(
      operations.map(op => () => this.execute(op))
    );
  }

  /**
   * Abstract method for core business logic implementation
   */
  protected abstract executeCore(operation: BusinessOperation): Promise<BusinessResult>;

  /**
   * Validate business operation
   */
  protected async validateOperation(operation: BusinessOperation): Promise<{
    isValid: boolean;
    errors: BusinessError[];
  }> {
    const errors: BusinessError[] = [];

    // Basic validation
    if (!operation.type) {
      errors.push({
        code: 'INVALID_OPERATION_TYPE',
        message: 'Operation type is required'
      });
    }

    if (!operation.context) {
      errors.push({
        code: 'MISSING_CONTEXT',
        message: 'Operation context is required'
      });
    }

    // Allow derived classes to add specific validation
    const customErrors = await this.validateOperationCustom(operation);
    errors.push(...customErrors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Custom validation to be implemented by derived classes
   */
  protected async validateOperationCustom(operation: BusinessOperation): Promise<BusinessError[]> {
    return [];
  }

  /**
   * Check permissions for operation
   */
  protected async checkPermissions(operation: BusinessOperation): Promise<{
    isAuthorized: boolean;
    message?: string;
    requiredPermissions?: string[];
  }> {
    // Get required permissions for operation
    const requiredPermissions = this.getRequiredPermissions(operation.type);
    
    if (requiredPermissions.length === 0) {
      return { isAuthorized: true };
    }

    // Check if user has required permissions
    const userPermissions = operation.context.permissions || [];
    const hasAllPermissions = requiredPermissions.every(perm => 
      userPermissions.includes(perm)
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(perm => 
        !userPermissions.includes(perm)
      );

      return {
        isAuthorized: false,
        message: `Missing required permissions: ${missingPermissions.join(', ')}`,
        requiredPermissions
      };
    }

    return { isAuthorized: true };
  }

  /**
   * Get required permissions for operation type
   */
  protected getRequiredPermissions(operationType: string): string[] {
    // Default implementation - override in derived classes
    const permissionMap: Record<string, string[]> = {
      'create': ['create'],
      'read': ['read'],
      'update': ['update'],
      'delete': ['delete'],
      'admin': ['admin']
    };

    return permissionMap[operationType] || [];
  }

  /**
   * Create error result
   */
  protected createErrorResult(errors: BusinessError[]): BusinessResult {
    return {
      success: false,
      errors,
      metadata: {
        service: this.serviceName,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Create success result
   */
  protected createSuccessResult(data?: any, metadata?: Record<string, any>): BusinessResult {
    return {
      success: true,
      data,
      metadata: {
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Apply business rules
   */
  protected async applyBusinessRules(
    operation: BusinessOperation,
    data: any
  ): Promise<{ isValid: boolean; errors: BusinessError[] }> {
    const errors: BusinessError[] = [];

    // Apply common business rules
    const commonRuleErrors = await this.applyCommonBusinessRules(operation, data);
    errors.push(...commonRuleErrors);

    // Apply operation-specific rules
    const specificRuleErrors = await this.applyOperationSpecificRules(operation, data);
    errors.push(...specificRuleErrors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Apply common business rules (override in derived classes)
   */
  protected async applyCommonBusinessRules(
    operation: BusinessOperation,
    data: any
  ): Promise<BusinessError[]> {
    return [];
  }

  /**
   * Apply operation-specific business rules (override in derived classes)
   */
  protected async applyOperationSpecificRules(
    operation: BusinessOperation,
    data: any
  ): Promise<BusinessError[]> {
    return [];
  }

  /**
   * Transform data for external consumption
   */
  protected transformForOutput(data: any, context: BusinessContext): any {
    // Remove sensitive fields
    if (data && typeof data === 'object') {
      const sensitiveFields = ['password', 'passwordHash', 'secret', 'token'];
      const transformed = { ...data };
      
      sensitiveFields.forEach(field => {
        delete transformed[field];
      });

      return transformed;
    }

    return data;
  }

  /**
   * Log business event
   */
  protected logBusinessEvent(
    eventType: string,
    operation: BusinessOperation,
    data?: any
  ): void {
    this.logger.info(`Business event: ${eventType}`, {
      service: this.serviceName,
      eventType,
      operationType: operation.type,
      userId: operation.context.userId,
      tenantId: operation.context.tenantId,
      data: this.sanitizeLogData(data)
    });
  }

  /**
   * Sanitize data for logging (remove sensitive information)
   */
  protected sanitizeLogData(data: any): any {
    if (!data) return data;

    if (typeof data === 'object') {
      const sanitized = { ...data };
      const sensitiveFields = ['password', 'passwordHash', 'secret', 'token', 'apiKey'];
      
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });

      return sanitized;
    }

    return data;
  }

  /**
   * Create business context from operation
   */
  protected createContext(
    userId?: string,
    tenantId?: string,
    permissions: string[] = [],
    metadata: Record<string, any> = {}
  ): BusinessContext {
    return {
      userId,
      tenantId,
      permissions,
      metadata: {
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  /**
   * Handle concurrent operations
   */
  protected async handleConcurrentOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    return await this.unitOfWork.executeWithRetry(operation, maxRetries);
  }

  /**
   * Create domain event
   */
  protected createDomainEvent(
    eventType: string,
    aggregateId: string,
    data: any,
    context: BusinessContext
  ): DomainEvent {
    return {
      id: this.generateEventId(),
      eventType,
      aggregateId,
      aggregateType: this.serviceName,
      data,
      metadata: {
        userId: context.userId,
        tenantId: context.tenantId,
        timestamp: new Date().toISOString(),
        service: this.serviceName
      }
    };
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${this.serviceName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Domain Event interface
 */
export interface DomainEvent {
  id: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  data: any;
  metadata: {
    userId?: string;
    tenantId?: string;
    timestamp: string;
    service: string;
    [key: string]: any;
  };
}

/**
 * Service factory for creating service instances
 */
export abstract class ServiceFactory {
  protected unitOfWork: UnitOfWork;
  protected logger: ILogger;
  protected monitoring: IMonitoringService;

  constructor(
    unitOfWork: UnitOfWork,
    logger: ILogger,
    monitoring: IMonitoringService
  ) {
    this.unitOfWork = unitOfWork;
    this.logger = logger;
    this.monitoring = monitoring;
  }

  /**
   * Create service instance
   */
  abstract createService<T extends BaseService>(serviceType: string): T;
}