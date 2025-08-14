/**
 * Three-Tier Architecture Layer Interfaces
 * Defines contracts and abstractions for each architectural layer
 */

import { Request, Response, NextFunction } from 'express';

// ===============================
// PRESENTATION LAYER INTERFACES
// ===============================

export interface IController {
  /**
   * Handle HTTP request and return response
   */
  handle(req: Request, res: Response, next: NextFunction): Promise<void> | void;
}

export interface IMiddleware {
  /**
   * Process HTTP request before reaching controller
   */
  execute(req: Request, res: Response, next: NextFunction): Promise<void> | void;
}

export interface IValidator {
  /**
   * Validate request data
   */
  validate(data: any): Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface IApiGateway {
  /**
   * Route request to appropriate service
   */
  route(req: Request): Promise<RouteResult>;
  
  /**
   * Apply rate limiting
   */
  rateLimit(req: Request): Promise<boolean>;
  
  /**
   * Transform request/response
   */
  transform(data: any, direction: 'request' | 'response'): any;
}

export interface RouteResult {
  service: string;
  method: string;
  params: Record<string, any>;
}

// ===============================
// BUSINESS LAYER INTERFACES
// ===============================

export interface IBusinessService {
  /**
   * Execute business operation
   */
  execute(operation: BusinessOperation): Promise<BusinessResult>;
}

export interface BusinessOperation {
  type: string;
  data: any;
  context: BusinessContext;
}

export interface BusinessContext {
  userId?: string;
  tenantId?: string;
  permissions: string[];
  metadata: Record<string, any>;
}

export interface BusinessResult {
  success: boolean;
  data?: any;
  errors?: BusinessError[];
  metadata?: Record<string, any>;
}

export interface BusinessError {
  code: string;
  message: string;
  details?: any;
}

export interface IWorkflowEngine {
  /**
   * Execute workflow
   */
  execute(workflow: WorkflowDefinition, context: BusinessContext): Promise<WorkflowResult>;
  
  /**
   * Get workflow status
   */
  getStatus(workflowId: string): Promise<WorkflowStatus>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  service: string;
  operation: string;
  input: any;
  conditions?: WorkflowCondition[];
}

export interface WorkflowTrigger {
  type: 'event' | 'schedule' | 'manual';
  configuration: any;
}

export interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'contains';
  value: any;
}

export interface WorkflowResult {
  workflowId: string;
  status: WorkflowStatus;
  results: StepResult[];
}

export interface StepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: BusinessError;
}

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// ===============================
// DATA LAYER INTERFACES
// ===============================

export interface IRepository<T> {
  /**
   * Find entity by ID
   */
  findById(id: string): Promise<T | null>;
  
  /**
   * Find entities by criteria
   */
  findByCriteria(criteria: SearchCriteria): Promise<SearchResult<T>>;
  
  /**
   * Create new entity
   */
  create(entity: Partial<T>): Promise<T>;
  
  /**
   * Update existing entity
   */
  update(id: string, updates: Partial<T>): Promise<T>;
  
  /**
   * Delete entity
   */
  delete(id: string): Promise<void>;
  
  /**
   * Check if entity exists
   */
  exists(id: string): Promise<boolean>;
}

export interface SearchCriteria {
  filters: SearchFilter[];
  sorting: SortOption[];
  pagination: PaginationOption;
  includes?: string[];
}

export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startsWith' | 'endsWith';
  value: any;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationOption {
  page: number;
  limit: number;
}

export interface SearchResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface IUnitOfWork {
  /**
   * Begin transaction
   */
  begin(): Promise<void>;
  
  /**
   * Commit transaction
   */
  commit(): Promise<void>;
  
  /**
   * Rollback transaction
   */
  rollback(): Promise<void>;
  
  /**
   * Execute in transaction
   */
  execute<T>(operation: () => Promise<T>): Promise<T>;
}

export interface IDataMapper<TEntity, TDto> {
  /**
   * Map entity to DTO
   */
  toDto(entity: TEntity): TDto;
  
  /**
   * Map DTO to entity
   */
  toEntity(dto: TDto): TEntity;
  
  /**
   * Map entity array to DTO array
   */
  toDtoArray(entities: TEntity[]): TDto[];
  
  /**
   * Map DTO array to entity array
   */
  toEntityArray(dtos: TDto[]): TEntity[];
}

export interface ICacheService {
  /**
   * Get value from cache
   */
  get<T>(key: string): Promise<T | null>;
  
  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  
  /**
   * Delete value from cache
   */
  delete(key: string): Promise<void>;
  
  /**
   * Clear all cache
   */
  clear(): Promise<void>;
  
  /**
   * Check if key exists
   */
  exists(key: string): Promise<boolean>;
  
  /**
   * Get multiple keys at once
   */
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  
  /**
   * Set multiple keys at once
   */
  mset<T>(keyValuePairs: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  
  /**
   * Increment numeric value
   */
  increment(key: string, amount?: number): Promise<number>;
  
  /**
   * Get cache statistics
   */
  getStats(): Promise<{
    redisAvailable: boolean;
    memoryCacheSize: number;
    memoryCacheHits: number;
    memoryCacheMisses: number;
  }>;
  
  /**
   * Get keys matching pattern
   */
  getKeys(pattern: string): Promise<string[]>;
  
  /**
   * Delete keys matching pattern
   */
  deletePattern(pattern: string): Promise<number>;
}

// ===============================
// CROSS-CUTTING INTERFACES
// ===============================

export interface ILogger {
  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void;
  
  /**
   * Log info message
   */
  info(message: string, meta?: any): void;
  
  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void;
  
  /**
   * Log error message
   */
  error(message: string, error?: Error, meta?: any): void;
}

export interface IMonitoringService {
  /**
   * Record metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
  
  /**
   * Increment counter
   */
  incrementCounter(name: string, tags?: Record<string, string>): void;
  
  /**
   * Start timing
   */
  startTimer(name: string): Timer;
  
  /**
   * Record histogram
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
}

export interface Timer {
  /**
   * End timing and record duration
   */
  end(tags?: Record<string, string>): void;
}

export interface IMessageQueue {
  /**
   * Send message to queue
   */
  send(queue: string, message: any, options?: MessageOptions): Promise<void>;
  
  /**
   * Listen for messages on queue
   */
  listen(queue: string, handler: MessageHandler, options?: ListenOptions): Promise<void>;
  
  /**
   * Create queue
   */
  createQueue(name: string, options?: QueueOptions): Promise<void>;
  
  /**
   * Delete queue
   */
  deleteQueue(name: string): Promise<void>;
}

export interface MessageOptions {
  delay?: number;
  priority?: number;
  retries?: number;
  ttl?: number;
}

export interface ListenOptions {
  concurrency?: number;
  prefetch?: number;
  deadLetterQueue?: string;
}

export interface QueueOptions {
  durable?: boolean;
  autoDelete?: boolean;
  exclusive?: boolean;
}

export type MessageHandler = (message: any, context: MessageContext) => Promise<void>;

export interface MessageContext {
  messageId: string;
  queue: string;
  attempt: number;
  timestamp: Date;
}

export interface ISecurityService {
  /**
   * Hash password
   */
  hashPassword(password: string): Promise<string>;
  
  /**
   * Verify password
   */
  verifyPassword(password: string, hash: string): Promise<boolean>;
  
  /**
   * Generate JWT token
   */
  generateToken(payload: any, options?: TokenOptions): Promise<string>;
  
  /**
   * Verify JWT token
   */
  verifyToken(token: string): Promise<any>;
  
  /**
   * Encrypt data
   */
  encrypt(data: string): Promise<string>;
  
  /**
   * Decrypt data
   */
  decrypt(encryptedData: string): Promise<string>;
}

export interface TokenOptions {
  expiresIn?: string;
  issuer?: string;
  audience?: string;
}

// ===============================
// ENTITY INTERFACES
// ===============================

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface AuditableEntity extends BaseEntity {
  version: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface TenantEntity extends BaseEntity {
  tenantId: string;
}

// ===============================
// ERROR INTERFACES
// ===============================

export interface ApplicationError extends Error {
  code: string;
  statusCode: number;
  details?: any;
  inner?: Error;
}

export class DomainError extends Error implements ApplicationError {
  public code: string;
  public statusCode: number;
  public details?: any;
  public inner?: Error;

  constructor(message: string, code: string, statusCode: number = 400, details?: any, inner?: Error) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.inner = inner;
  }
}

export class InfrastructureError extends Error implements ApplicationError {
  public code: string;
  public statusCode: number;
  public details?: any;
  public inner?: Error;

  constructor(message: string, code: string, statusCode: number = 500, details?: any, inner?: Error) {
    super(message);
    this.name = 'InfrastructureError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.inner = inner;
  }
}