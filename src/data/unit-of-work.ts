/**
 * Unit of Work Implementation
 * Manages database transactions and maintains consistency across repository operations
 */

import { PrismaClient } from '@prisma/client';
import { IUnitOfWork, InfrastructureError } from '../architecture/layer-interfaces';
import { UserRepository } from './repositories/user.repository';

export class UnitOfWork implements IUnitOfWork {
  private prisma: PrismaClient;
  private transaction: PrismaClient | null = null;
  private isInTransaction = false;

  // Repository instances
  private _userRepository: UserRepository | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get user repository
   */
  get userRepository(): UserRepository {
    if (!this._userRepository) {
      this._userRepository = new UserRepository(this.getClient());
    }
    return this._userRepository;
  }

  /**
   * Begin transaction
   */
  async begin(): Promise<void> {
    if (this.isInTransaction) {
      throw new InfrastructureError(
        'Transaction already in progress',
        'TRANSACTION_ALREADY_ACTIVE',
        400
      );
    }

    try {
      // Prisma handles transactions differently - we'll use the $transaction method
      this.isInTransaction = true;
    } catch (error) {
      this.isInTransaction = false;
      throw new InfrastructureError(
        'Failed to begin transaction',
        'TRANSACTION_BEGIN_ERROR',
        500,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Commit transaction
   */
  async commit(): Promise<void> {
    if (!this.isInTransaction) {
      throw new InfrastructureError(
        'No active transaction to commit',
        'NO_ACTIVE_TRANSACTION',
        400
      );
    }

    try {
      // In Prisma, commits are handled automatically when the transaction function completes
      this.isInTransaction = false;
      this.transaction = null;
      this.resetRepositories();
    } catch (error) {
      throw new InfrastructureError(
        'Failed to commit transaction',
        'TRANSACTION_COMMIT_ERROR',
        500,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Rollback transaction
   */
  async rollback(): Promise<void> {
    if (!this.isInTransaction) {
      throw new InfrastructureError(
        'No active transaction to rollback',
        'NO_ACTIVE_TRANSACTION',
        400
      );
    }

    try {
      // In Prisma, rollbacks happen automatically if an error is thrown
      this.isInTransaction = false;
      this.transaction = null;
      this.resetRepositories();
    } catch (error) {
      throw new InfrastructureError(
        'Failed to rollback transaction',
        'TRANSACTION_ROLLBACK_ERROR',
        500,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Execute operation within transaction
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isInTransaction) {
      // If already in transaction, just execute the operation
      return await operation();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Set transaction context
        this.transaction = tx;
        this.isInTransaction = true;
        this.resetRepositories(); // Reset to use transaction client

        try {
          const result = await operation();
          return result;
        } finally {
          // Clean up transaction context
          this.isInTransaction = false;
          this.transaction = null;
          this.resetRepositories();
        }
      });
    } catch (error) {
      // Ensure clean state on error
      this.isInTransaction = false;
      this.transaction = null;
      this.resetRepositories();
      
      throw new InfrastructureError(
        'Transaction execution failed',
        'TRANSACTION_EXECUTION_ERROR',
        500,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Execute multiple operations atomically
   */
  async executeMultiple<T>(operations: (() => Promise<T>)[]): Promise<T[]> {
    return await this.execute(async () => {
      const results: T[] = [];
      for (const operation of operations) {
        const result = await operation();
        results.push(result);
      }
      return results;
    });
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(operation);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        if (attempt === maxRetries) {
          break;
        }

        // Wait before retrying
        await this.delay(delayMs * attempt);
      }
    }

    throw new InfrastructureError(
      `Operation failed after ${maxRetries} attempts`,
      'OPERATION_RETRY_EXHAUSTED',
      500,
      { maxRetries, attempts: maxRetries },
      lastError!
    );
  }

  /**
   * Create a savepoint within transaction
   */
  async createSavepoint(name: string): Promise<void> {
    if (!this.isInTransaction) {
      throw new InfrastructureError(
        'Cannot create savepoint outside of transaction',
        'NO_ACTIVE_TRANSACTION',
        400
      );
    }

    try {
      // Prisma doesn't directly support savepoints, but we can use raw SQL
      await this.getClient().$executeRawUnsafe(`SAVEPOINT ${name}`);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to create savepoint: ${name}`,
        'SAVEPOINT_CREATE_ERROR',
        500,
        { name },
        error as Error
      );
    }
  }

  /**
   * Rollback to savepoint
   */
  async rollbackToSavepoint(name: string): Promise<void> {
    if (!this.isInTransaction) {
      throw new InfrastructureError(
        'Cannot rollback to savepoint outside of transaction',
        'NO_ACTIVE_TRANSACTION',
        400
      );
    }

    try {
      await this.getClient().$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to rollback to savepoint: ${name}`,
        'SAVEPOINT_ROLLBACK_ERROR',
        500,
        { name },
        error as Error
      );
    }
  }

  /**
   * Release savepoint
   */
  async releaseSavepoint(name: string): Promise<void> {
    if (!this.isInTransaction) {
      throw new InfrastructureError(
        'Cannot release savepoint outside of transaction',
        'NO_ACTIVE_TRANSACTION',
        400
      );
    }

    try {
      await this.getClient().$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to release savepoint: ${name}`,
        'SAVEPOINT_RELEASE_ERROR',
        500,
        { name },
        error as Error
      );
    }
  }

  /**
   * Check if currently in transaction
   */
  get inTransaction(): boolean {
    return this.isInTransaction;
  }

  /**
   * Get database connection statistics
   */
  async getConnectionStats(): Promise<{
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
  }> {
    try {
      // This would need to be implemented based on your database type
      // For PostgreSQL:
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      const stats = result[0] || { total_connections: 0, active_connections: 0, idle_connections: 0 };

      return {
        totalConnections: parseInt(stats.total_connections),
        activeConnections: parseInt(stats.active_connections),
        idleConnections: parseInt(stats.idle_connections)
      };
    } catch (error) {
      // Return default stats if query fails
      return {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0
      };
    }
  }

  /**
   * Dispose of unit of work resources
   */
  async dispose(): Promise<void> {
    try {
      if (this.isInTransaction) {
        await this.rollback();
      }
      
      this.resetRepositories();
    } catch (error) {
      throw new InfrastructureError(
        'Failed to dispose unit of work',
        'DISPOSAL_ERROR',
        500,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get appropriate Prisma client (transaction or regular)
   */
  private getClient(): PrismaClient {
    return this.transaction || this.prisma;
  }

  /**
   * Reset repository instances to use current client
   */
  private resetRepositories(): void {
    const client = this.getClient();
    this._userRepository = new UserRepository(client);
    // Add other repositories here as they're created
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: any): boolean {
    if (!error) return false;

    const nonRetryableCodes = [
      'P2002', // Unique constraint violation
      'P2003', // Foreign key constraint violation
      'P2004', // Constraint violation
      'P2005', // Invalid value for field type
      'P2006', // Invalid value provided
      'P2007', // Data validation error
    ];

    // Check Prisma error codes
    if (error.code && nonRetryableCodes.includes(error.code)) {
      return true;
    }

    // Check HTTP status codes for business logic errors
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return true;
    }

    return false;
  }

  /**
   * Delay execution for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create nested unit of work for complex operations
   */
  async createNested(): Promise<UnitOfWork> {
    if (!this.isInTransaction) {
      throw new InfrastructureError(
        'Cannot create nested unit of work outside of transaction',
        'NO_ACTIVE_TRANSACTION',
        400
      );
    }

    // Return a new unit of work that uses the same transaction
    const nestedUow = new UnitOfWork(this.getClient());
    nestedUow.transaction = this.transaction;
    nestedUow.isInTransaction = true;
    
    return nestedUow;
  }
}