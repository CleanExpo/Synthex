/**
 * API Gateway Implementation
 * Central routing and middleware management for the presentation layer
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { UserController } from './controllers/user.controller';
import { AuthenticatedRequest } from './controllers/base.controller';
import {
  ILogger,
  IMonitoringService,
  ISecurityService,
  ApplicationError,
  DomainError
} from '../architecture/layer-interfaces';

export interface ApiGatewayConfig {
  port: number;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  enableSwagger: boolean;
  enableMetrics: boolean;
  enableHealthCheck: boolean;
}

export interface ApiGatewayDependencies {
  logger: ILogger;
  monitoring: IMonitoringService;
  securityService: ISecurityService;
  userController: UserController;
}

export class ApiGateway {
  private app: Express;
  private config: ApiGatewayConfig;
  private dependencies: ApiGatewayDependencies;
  private logger: ILogger;

  constructor(config: ApiGatewayConfig, dependencies: ApiGatewayDependencies) {
    this.config = config;
    this.dependencies = dependencies;
    this.logger = dependencies.logger;
    this.app = express();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  /**
   * Setup core middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Correlation-ID'],
      credentials: true
    }));

    // Rate limiting
    const rateLimiter = rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.rateLimitMaxRequests,
      message: {
        error: 'Too many requests',
        retryAfter: Math.ceil(this.config.rateLimitWindowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(rateLimiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging and correlation ID
    this.app.use(this.requestLoggingMiddleware.bind(this));

    // Authentication middleware
    this.app.use(this.authenticationMiddleware.bind(this));

    // Monitoring middleware
    this.app.use(this.monitoringMiddleware.bind(this));
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    if (this.config.enableHealthCheck) {
      this.app.get('/health', this.healthCheckHandler.bind(this));
      this.app.get('/health/detailed', this.detailedHealthCheckHandler.bind(this));
    }

    // Metrics endpoint
    if (this.config.enableMetrics) {
      this.app.get('/metrics', this.metricsHandler.bind(this));
    }

    // API version prefix
    const apiV1 = express.Router();

    // User routes
    this.setupUserRoutes(apiV1);

    // Mount API routes
    this.app.use('/api/v1', apiV1);

    // Swagger documentation
    if (this.config.enableSwagger) {
      this.setupSwaggerDocs();
    }

    // 404 handler for undefined routes
    this.app.use('*', this.notFoundHandler.bind(this));
  }

  /**
   * Setup user routes
   */
  private setupUserRoutes(router: express.Router): void {
    // Create user
    router.post('/users', (req, res, next) => {
      this.dependencies.userController.handle(req as AuthenticatedRequest, res, next);
    });

    // Get user by ID
    router.get('/users/:id', (req, res, next) => {
      this.dependencies.userController.handle(req as AuthenticatedRequest, res, next);
    });

    // Update user
    router.put('/users/:id', (req, res, next) => {
      this.dependencies.userController.handle(req as AuthenticatedRequest, res, next);
    });

    // Delete user
    router.delete('/users/:id', (req, res, next) => {
      this.dependencies.userController.handle(req as AuthenticatedRequest, res, next);
    });

    // List/search users
    router.get('/users', (req, res, next) => {
      this.dependencies.userController.handle(req as AuthenticatedRequest, res, next);
    });

    // User authentication
    router.post('/users/:id/authenticate', (req, res, next) => {
      this.dependencies.userController.handle(req as AuthenticatedRequest, res, next);
    });

    // User activation/deactivation
    router.patch('/users/:id/activate', (req, res, next) => {
      this.dependencies.userController.handle(req as AuthenticatedRequest, res, next);
    });

    router.patch('/users/:id/deactivate', (req, res, next) => {
      this.dependencies.userController.handle(req as AuthenticatedRequest, res, next);
    });

    // User statistics
    router.get('/users/statistics', (req, res, next) => {
      this.dependencies.userController.handle(req as AuthenticatedRequest, res, next);
    });
  }

  /**
   * Setup Swagger documentation
   */
  private setupSwaggerDocs(): void {
    try {
      const swaggerJsdoc = require('swagger-jsdoc');
      const swaggerUi = require('swagger-ui-express');

      const options = {
        definition: {
          openapi: '3.0.0',
          info: {
            title: 'SYNTHEX API',
            version: '1.0.0',
            description: 'Auto Marketing Platform API with 3-Tier Architecture',
          },
          servers: [
            {
              url: '/api/v1',
              description: 'API V1',
            },
          ],
          components: {
            securitySchemes: {
              bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
              },
            },
          },
          security: [
            {
              bearerAuth: [],
            },
          ],
        },
        apis: ['./src/presentation/controllers/*.ts', './src/presentation/docs/*.yaml'],
      };

      const specs = swaggerJsdoc(options);
      this.app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'SYNTHEX API Documentation'
      }));

      this.logger.info('Swagger documentation enabled at /api/docs');
    } catch (error) {
      this.logger.warn('Failed to setup Swagger documentation', error as Error);
    }
  }

  /**
   * Request logging middleware
   */
  private requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    
    // Generate correlation ID if not present
    const correlationId = req.headers['x-correlation-id'] as string || 
                         req.headers['x-request-id'] as string ||
                         this.generateRequestId();
    
    (req as AuthenticatedRequest).correlationId = correlationId;
    
    // Set response headers
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Request-ID', correlationId);

    // Log request
    this.logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      correlationId
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      this.logger.info('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        correlationId
      });
    });

    next();
  }

  /**
   * Authentication middleware
   */
  private async authenticationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Skip authentication for public endpoints
      const publicEndpoints = ['/health', '/metrics', '/api/docs'];
      if (publicEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
        return next();
      }

      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return next(); // Let controllers handle auth requirements
      }

      // Extract and verify JWT token
      const token = authHeader.replace('Bearer ', '');
      const payload = await this.dependencies.securityService.verifyToken(token);

      // Set user context
      (req as AuthenticatedRequest).user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions,
        tenantId: payload.tenantId
      };

      this.logger.debug('User authenticated', {
        userId: payload.userId,
        email: payload.email,
        role: payload.role
      });

      next();
    } catch (error) {
      if (error instanceof ApplicationError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          errors: [{ code: error.code, message: error.message }]
        });
      }

      this.logger.warn('Authentication failed', error as Error);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        errors: [{ code: 'INVALID_TOKEN', message: 'Authentication failed' }]
      });
    }
  }

  /**
   * Monitoring middleware
   */
  private monitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
    const timer = this.dependencies.monitoring.startTimer('http_request');
    
    // Record request metrics
    this.dependencies.monitoring.incrementCounter('http_requests_total', {
      method: req.method,
      path: req.route?.path || req.path
    });

    res.on('finish', () => {
      // Record response metrics
      timer.end({
        method: req.method,
        status: res.statusCode.toString(),
        path: req.route?.path || req.path
      });

      this.dependencies.monitoring.incrementCounter('http_responses_total', {
        method: req.method,
        status: res.statusCode.toString()
      });
    });

    next();
  }

  /**
   * Health check handler
   */
  private healthCheckHandler(req: Request, res: Response): void {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime()
    });
  }

  /**
   * Detailed health check handler
   */
  private detailedHealthCheckHandler(req: Request, res: Response): void {
    const healthStatus = this.dependencies.monitoring.getHealthStatus();
    const systemMetrics = this.dependencies.monitoring.getSystemMetrics();

    res.json({
      status: healthStatus.overall,
      timestamp: healthStatus.timestamp,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks: healthStatus.checks,
      system: systemMetrics
    });
  }

  /**
   * Metrics handler (Prometheus format)
   */
  private metricsHandler(req: Request, res: Response): void {
    const metrics = this.dependencies.monitoring.exportPrometheusMetrics();
    res.setHeader('Content-Type', 'text/plain');
    res.send(metrics);
  }

  /**
   * 404 handler
   */
  private notFoundHandler(req: Request, res: Response): void {
    const correlationId = (req as AuthenticatedRequest).correlationId;
    
    this.logger.warn('Route not found', {
      method: req.method,
      path: req.path,
      correlationId
    });

    res.status(404).json({
      success: false,
      message: 'Route not found',
      errors: [{ 
        code: 'ROUTE_NOT_FOUND', 
        message: `${req.method} ${req.path} not found` 
      }],
      metadata: {
        timestamp: new Date().toISOString(),
        correlationId
      }
    });
  }

  /**
   * Setup global error handlers
   */
  private setupErrorHandlers(): void {
    // Express error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      const correlationId = (req as AuthenticatedRequest).correlationId;
      
      this.logger.error('Unhandled error in API Gateway', error, {
        method: req.method,
        path: req.path,
        correlationId
      });

      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        errors: [{ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: isDevelopment ? error.message : 'An unexpected error occurred' 
        }],
        metadata: {
          timestamp: new Date().toISOString(),
          correlationId
        }
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.logger.error('Unhandled Promise Rejection', new Error(reason), {
        reason,
        promise: promise.toString()
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('Uncaught Exception', error);
      process.exit(1); // Exit gracefully
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start the API gateway server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.app.listen(this.config.port, () => {
        this.logger.info(`API Gateway started on port ${this.config.port}`, {
          port: this.config.port,
          environment: process.env.NODE_ENV || 'development',
          cors: this.config.corsOrigins,
          swagger: this.config.enableSwagger ? '/api/docs' : 'disabled',
          metrics: this.config.enableMetrics ? '/metrics' : 'disabled'
        });
        resolve();
      });

      // Graceful shutdown
      const gracefulShutdown = () => {
        this.logger.info('Shutting down API Gateway gracefully...');
        server.close(() => {
          this.logger.info('API Gateway shutdown complete');
          process.exit(0);
        });
      };

      process.on('SIGINT', gracefulShutdown);
      process.on('SIGTERM', gracefulShutdown);
    });
  }

  /**
   * Get Express app instance
   */
  getApp(): Express {
    return this.app;
  }
}