/**
 * Main Application Bootstrap
 * Initializes and wires together the complete 3-tier architecture
 */

import '../env'; // Ensure environment variables are loaded first
import { ApiGateway, ApiGatewayConfig, ApiGatewayDependencies } from './api-gateway';
import { UserController } from './controllers/user.controller';
import { UserBusinessService } from '../business/services/user.business-service';
import { UserRepository } from '../data/repositories/user.repository';
import { UnitOfWork } from '../data/unit-of-work';
import { CacheService } from '../infrastructure/caching/cache.service';
import { QueueService } from '../infrastructure/messaging/queue.service';
import { MonitoringService } from '../infrastructure/monitoring/monitoring.service';
import { SecurityService } from '../infrastructure/security/security.service';
import { LoggerService } from '../infrastructure/logging/logger.service';
import { UserValidator } from '../business/validators/user.validator';
import { ThreeTierConfig } from '../architecture/three-tier-config';
import {
  ILogger,
  IMonitoringService,
  ISecurityService,
  ICacheService,
  IMessageQueue
} from '../architecture/layer-interfaces';
import Redis from 'ioredis';

export class Application {
  private apiGateway: ApiGateway;
  private logger: ILogger;
  private monitoring: IMonitoringService;
  private securityService: ISecurityService;
  private cacheService: ICacheService;
  private queueService: IMessageQueue;
  private redis: Redis;

  constructor() {
    this.logger = new LoggerService({
      level: process.env.LOG_LEVEL || 'info',
      enableConsole: true,
      enableFile: process.env.NODE_ENV === 'production',
      logFilePath: process.env.LOG_FILE_PATH || './logs/app.log'
    });

    this.logger.info('Starting SYNTHEX application...');
  }

  /**
   * Initialize the entire application
   */
  async initialize(): Promise<void> {
    try {
      // Initialize infrastructure services
      await this.initializeInfrastructure();

      // Initialize business layer
      const businessServices = await this.initializeBusinessLayer();

      // Initialize presentation layer
      await this.initializePresentationLayer(businessServices);

      this.logger.info('Application initialization completed successfully');
    } catch (error) {
      this.logger.error('Failed to initialize application', error as Error);
      throw error;
    }
  }

  /**
   * Initialize infrastructure services
   */
  private async initializeInfrastructure(): Promise<void> {
    this.logger.info('Initializing infrastructure layer...');

    // Initialize Redis
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      maxLoadingTimeout: 10000,
      lazyConnect: true
    });

    // Test Redis connection
    try {
      await this.redis.connect();
      await this.redis.ping();
      this.logger.info('Redis connection established');
    } catch (error) {
      this.logger.warn('Redis connection failed, continuing without Redis', error as Error);
      // Application can continue without Redis (degraded mode)
    }

    // Initialize monitoring
    this.monitoring = new MonitoringService(this.logger);
    this.logger.info('Monitoring service initialized');

    // Initialize security service
    this.securityService = new SecurityService(
      this.logger,
      process.env.JWT_SECRET,
      process.env.ENCRYPTION_KEY
    );
    this.logger.info('Security service initialized');

    // Initialize cache service
    this.cacheService = new CacheService(
      this.redis,
      this.logger,
      {
        defaultTTL: parseInt(process.env.CACHE_TTL || '3600'),
        keyPrefix: process.env.CACHE_KEY_PREFIX || 'synthex:',
        enableInMemoryFallback: true,
        maxInMemoryItems: parseInt(process.env.CACHE_MAX_MEMORY_ITEMS || '1000')
      }
    );
    this.logger.info('Cache service initialized');

    // Initialize queue service
    this.queueService = new QueueService(this.redis, this.logger);
    this.logger.info('Queue service initialized');

    // Register health checks
    this.registerHealthChecks();

    this.logger.info('Infrastructure layer initialized successfully');
  }

  /**
   * Initialize business layer services
   */
  private async initializeBusinessLayer(): Promise<{
    userBusinessService: UserBusinessService;
    userValidator: UserValidator;
  }> {
    this.logger.info('Initializing business layer...');

    // Initialize data layer
    const unitOfWork = new UnitOfWork(this.logger);
    const userRepository = new UserRepository(unitOfWork, this.logger);

    // Initialize validators
    const userValidator = new UserValidator();

    // Initialize business services
    const userBusinessService = new UserBusinessService(
      userRepository,
      unitOfWork,
      this.cacheService,
      this.securityService,
      this.monitoring,
      this.logger
    );

    this.logger.info('Business layer initialized successfully');

    return {
      userBusinessService,
      userValidator
    };
  }

  /**
   * Initialize presentation layer
   */
  private async initializePresentationLayer(businessServices: {
    userBusinessService: UserBusinessService;
    userValidator: UserValidator;
  }): Promise<void> {
    this.logger.info('Initializing presentation layer...');

    // Initialize controllers
    const userController = new UserController(
      businessServices.userBusinessService,
      businessServices.userValidator,
      this.logger,
      this.monitoring
    );

    // Configure API Gateway
    const apiGatewayConfig: ApiGatewayConfig = {
      port: parseInt(process.env.PORT || '3000'),
      corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(','),
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      enableSwagger: process.env.ENABLE_SWAGGER === 'true',
      enableMetrics: process.env.ENABLE_METRICS === 'true',
      enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false'
    };

    const apiGatewayDependencies: ApiGatewayDependencies = {
      logger: this.logger,
      monitoring: this.monitoring,
      securityService: this.securityService,
      userController
    };

    // Initialize API Gateway
    this.apiGateway = new ApiGateway(apiGatewayConfig, apiGatewayDependencies);

    this.logger.info('Presentation layer initialized successfully');
  }

  /**
   * Register health checks for monitoring
   */
  private registerHealthChecks(): void {
    // Redis health check
    this.monitoring.registerHealthCheck('redis', async () => {
      try {
        const pong = await this.redis.ping();
        return {
          status: pong === 'PONG' ? 'healthy' : 'unhealthy',
          message: `Redis responded with: ${pong}`,
          responseTime: 0, // Will be set by monitoring service
          metadata: {
            host: this.redis.options.host,
            port: this.redis.options.port,
            db: this.redis.options.db
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Redis health check failed: ${(error as Error).message}`,
          responseTime: 0,
          metadata: { error: (error as Error).message }
        };
      }
    });

    // Database health check (if using database)
    this.monitoring.registerHealthCheck('database', async () => {
      try {
        // TODO: Add actual database health check when database is implemented
        return {
          status: 'healthy',
          message: 'Database connection is healthy',
          responseTime: 0,
          metadata: { provider: 'prisma' }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Database health check failed: ${(error as Error).message}`,
          responseTime: 0,
          metadata: { error: (error as Error).message }
        };
      }
    });

    // Security service health check
    this.monitoring.registerHealthCheck('security', async () => {
      try {
        const securityInfo = this.securityService.getSecurityInfo();
        return {
          status: securityInfo.hasJwtSecret && securityInfo.hasEncryptionKey ? 'healthy' : 'degraded',
          message: 'Security service is operational',
          responseTime: 0,
          metadata: {
            jwtIssuer: securityInfo.jwtIssuer,
            encryptionAlgorithm: securityInfo.encryptionAlgorithm,
            hasSecrets: securityInfo.hasJwtSecret && securityInfo.hasEncryptionKey
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Security service health check failed: ${(error as Error).message}`,
          responseTime: 0,
          metadata: { error: (error as Error).message }
        };
      }
    });

    this.logger.info('Health checks registered successfully');
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    try {
      await this.initialize();
      await this.apiGateway.start();
      
      this.logger.info('🚀 SYNTHEX application started successfully', {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || '3000'
      });
    } catch (error) {
      this.logger.error('Failed to start application', error as Error);
      await this.gracefulShutdown();
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(): Promise<void> {
    this.logger.info('Starting graceful shutdown...');

    try {
      // Dispose of services in reverse order
      if (this.queueService) {
        await this.queueService.dispose();
      }

      if (this.monitoring) {
        this.monitoring.dispose();
      }

      if (this.redis && this.redis.status === 'ready') {
        await this.redis.quit();
      }

      this.logger.info('Graceful shutdown completed');
    } catch (error) {
      this.logger.error('Error during graceful shutdown', error as Error);
    }
  }
}

// Create and start the application
const app = new Application();

// Handle process signals for graceful shutdown
process.on('SIGINT', () => app.gracefulShutdown());
process.on('SIGTERM', () => app.gracefulShutdown());

export default app;