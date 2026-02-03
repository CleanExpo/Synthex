/**
 * Base Repository Implementation
 * Provides generic CRUD operations and advanced querying capabilities
 */

import { PrismaClient } from '@prisma/client';
import {
  IRepository,
  SearchCriteria,
  SearchResult,
  SearchFilter,
  SortOption,
  PaginationOption,
  BaseEntity,
  DomainError
} from '../../architecture/layer-interfaces';

export abstract class BaseRepository<T extends BaseEntity> implements IRepository<T> {
  protected prisma: PrismaClient;
  protected modelName: string;

  constructor(prisma: PrismaClient, modelName: string) {
    this.prisma = prisma;
    this.modelName = modelName;
  }

  /**
   * Get the Prisma model for this repository
   */
  protected get model() {
    return (this.prisma as any)[this.modelName];
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const entity = await this.model.findUnique({
        where: { id }
      });
      return entity;
    } catch (error) {
      throw new DomainError(
        `Failed to find ${this.modelName} by ID: ${id}`,
        'FIND_BY_ID_ERROR',
        500,
        { id, modelName: this.modelName },
        error as Error
      );
    }
  }

  /**
   * Find entities by criteria with advanced filtering, sorting, and pagination
   */
  async findByCriteria(criteria: SearchCriteria): Promise<SearchResult<T>> {
    try {
      const where = this.buildWhereClause(criteria.filters);
      const orderBy = this.buildOrderByClause(criteria.sorting);
      const { skip, take } = this.buildPaginationClause(criteria.pagination);

      // Include related entities if specified
      const include = criteria.includes ? this.buildIncludeClause(criteria.includes) : undefined;

      // Execute count query for total results
      const total = await this.model.count({ where });

      // Execute main query
      const data = await this.model.findMany({
        where,
        orderBy,
        skip,
        take,
        include
      });

      return {
        data,
        total,
        page: criteria.pagination.page,
        limit: criteria.pagination.limit,
        hasMore: (criteria.pagination.page * criteria.pagination.limit) < total
      };
    } catch (error) {
      throw new DomainError(
        `Failed to find ${this.modelName} by criteria`,
        'FIND_BY_CRITERIA_ERROR',
        500,
        { criteria, modelName: this.modelName },
        error as Error
      );
    }
  }

  /**
   * Create new entity
   */
  async create(entity: Partial<T>): Promise<T> {
    try {
      const now = new Date();
      const entityWithTimestamps = {
        ...entity,
        createdAt: now,
        updatedAt: now
      };

      const created = await this.model.create({
        data: entityWithTimestamps
      });

      return created;
    } catch (error) {
      throw new DomainError(
        `Failed to create ${this.modelName}`,
        'CREATE_ERROR',
        400,
        { entity, modelName: this.modelName },
        error as Error
      );
    }
  }

  /**
   * Update existing entity
   */
  async update(id: string, updates: Partial<T>): Promise<T> {
    try {
      const entityWithTimestamp = {
        ...updates,
        updatedAt: new Date()
      };

      const updated = await this.model.update({
        where: { id },
        data: entityWithTimestamp
      });

      return updated;
    } catch (error) {
      throw new DomainError(
        `Failed to update ${this.modelName} with ID: ${id}`,
        'UPDATE_ERROR',
        400,
        { id, updates, modelName: this.modelName },
        error as Error
      );
    }
  }

  /**
   * Delete entity (soft delete if supported)
   */
  async delete(id: string): Promise<void> {
    try {
      // Check if model supports soft delete
      const modelFields = await this.getModelFields();
      
      if (modelFields.includes('isDeleted')) {
        // Soft delete
        await this.model.update({
          where: { id },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date()
          }
        });
      } else {
        // Hard delete
        await this.model.delete({
          where: { id }
        });
      }
    } catch (error) {
      throw new DomainError(
        `Failed to delete ${this.modelName} with ID: ${id}`,
        'DELETE_ERROR',
        400,
        { id, modelName: this.modelName },
        error as Error
      );
    }
  }

  /**
   * Check if entity exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.model.count({
        where: { id }
      });
      return count > 0;
    } catch (error) {
      throw new DomainError(
        `Failed to check existence of ${this.modelName} with ID: ${id}`,
        'EXISTS_ERROR',
        500,
        { id, modelName: this.modelName },
        error as Error
      );
    }
  }

  /**
   * Batch create entities
   */
  async createMany(entities: Partial<T>[]): Promise<T[]> {
    try {
      const now = new Date();
      const entitiesWithTimestamps = entities.map(entity => ({
        ...entity,
        createdAt: now,
        updatedAt: now
      }));

      await this.model.createMany({
        data: entitiesWithTimestamps,
        skipDuplicates: true
      });

      // Since createMany doesn't return created entities, we need to fetch them
      // This is a limitation of Prisma's createMany
      const lastEntity = entitiesWithTimestamps[entitiesWithTimestamps.length - 1];
      const createdEntities = await this.model.findMany({
        where: {
          createdAt: now,
          // Add additional criteria if possible to narrow down results
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: entities.length
      });

      return createdEntities;
    } catch (error) {
      throw new DomainError(
        `Failed to create multiple ${this.modelName} entities`,
        'CREATE_MANY_ERROR',
        400,
        { count: entities.length, modelName: this.modelName },
        error as Error
      );
    }
  }

  /**
   * Find entities with complex queries
   */
  async findByRawQuery(query: string, parameters?: any[]): Promise<T[]> {
    try {
      const result = await this.prisma.$queryRawUnsafe(query, ...(parameters || []));
      return result as T[];
    } catch (error) {
      throw new DomainError(
        `Failed to execute raw query for ${this.modelName}`,
        'RAW_QUERY_ERROR',
        500,
        { query, parameters, modelName: this.modelName },
        error as Error
      );
    }
  }

  /**
   * Count entities by criteria
   */
  async countByCriteria(filters: SearchFilter[]): Promise<number> {
    try {
      const where = this.buildWhereClause(filters);
      return await this.model.count({ where });
    } catch (error) {
      throw new DomainError(
        `Failed to count ${this.modelName} by criteria`,
        'COUNT_ERROR',
        500,
        { filters, modelName: this.modelName },
        error as Error
      );
    }
  }

  /**
   * Build WHERE clause from search filters
   */
  protected buildWhereClause(filters: SearchFilter[]): any {
    const where: any = {};

    for (const filter of filters) {
      switch (filter.operator) {
        case 'eq':
          where[filter.field] = filter.value;
          break;
        case 'ne':
          where[filter.field] = { not: filter.value };
          break;
        case 'gt':
          where[filter.field] = { gt: filter.value };
          break;
        case 'gte':
          where[filter.field] = { gte: filter.value };
          break;
        case 'lt':
          where[filter.field] = { lt: filter.value };
          break;
        case 'lte':
          where[filter.field] = { lte: filter.value };
          break;
        case 'in':
          where[filter.field] = { in: filter.value };
          break;
        case 'nin':
          where[filter.field] = { notIn: filter.value };
          break;
        case 'contains':
          where[filter.field] = { contains: filter.value, mode: 'insensitive' };
          break;
        case 'startsWith':
          where[filter.field] = { startsWith: filter.value, mode: 'insensitive' };
          break;
        case 'endsWith':
          where[filter.field] = { endsWith: filter.value, mode: 'insensitive' };
          break;
      }
    }

    // Always exclude soft-deleted records if the model supports it
    if (this.supportsSoftDelete()) {
      where.isDeleted = false;
    }

    return where;
  }

  /**
   * Build ORDER BY clause from sort options
   */
  protected buildOrderByClause(sorting: SortOption[]): any {
    if (!sorting || sorting.length === 0) {
      return { createdAt: 'desc' }; // Default sorting
    }

    if (sorting.length === 1) {
      const sort = sorting[0];
      return { [sort.field]: sort.direction };
    }

    // Multiple sort fields
    return sorting.map(sort => ({
      [sort.field]: sort.direction
    }));
  }

  /**
   * Build pagination clause
   */
  protected buildPaginationClause(pagination: PaginationOption): { skip: number; take: number } {
    const page = Math.max(1, pagination.page);
    const limit = Math.min(Math.max(1, pagination.limit), 1000); // Max 1000 records per page
    
    return {
      skip: (page - 1) * limit,
      take: limit
    };
  }

  /**
   * Build INCLUDE clause for related entities
   */
  protected buildIncludeClause(includes: string[]): any {
    const include: any = {};
    
    for (const relation of includes) {
      // Handle nested relations (e.g., "user.profile")
      const parts = relation.split('.');
      let current = include;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          current[part] = true;
        } else {
          current[part] = current[part] || { include: {} };
          current = current[part].include;
        }
      }
    }
    
    return include;
  }

  /**
   * Get model fields (for checking soft delete support)
   */
  protected async getModelFields(): Promise<string[]> {
    // This is a simplified implementation
    // In a real scenario, you might want to use Prisma's introspection capabilities
    const modelInfo = (this.prisma as any)._dmmf.datamodel.models.find(
      (m: any) => m.name.toLowerCase() === this.modelName.toLowerCase()
    );
    
    return modelInfo ? modelInfo.fields.map((f: any) => f.name) : [];
  }

  /**
   * Check if model supports soft delete
   */
  protected supportsSoftDelete(): boolean {
    // This could be cached or determined at construction time
    // For now, we'll assume models with these fields support soft delete
    return true; // Simplified - in practice, check for isDeleted field
  }

  /**
   * Execute operation within transaction
   */
  async executeInTransaction<TResult>(
    operation: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>) => Promise<TResult>
  ): Promise<TResult> {
    return await this.prisma.$transaction(operation);
  }

  /**
   * Refresh entity from database (useful after updates)
   */
  async refresh(entity: T): Promise<T> {
    if (!entity.id) {
      throw new DomainError(
        'Cannot refresh entity without ID',
        'REFRESH_ERROR',
        400,
        { entity }
      );
    }
    
    const refreshed = await this.findById(entity.id);
    if (!refreshed) {
      throw new DomainError(
        `Entity ${this.modelName} with ID ${entity.id} no longer exists`,
        'ENTITY_NOT_FOUND',
        404,
        { id: entity.id, modelName: this.modelName }
      );
    }
    
    return refreshed;
  }
}