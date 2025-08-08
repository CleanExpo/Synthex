/**
 * Comprehensive Logging and Alerting System
 * Advanced logging with structured data, alerting, and monitoring integration
 */

import winston from 'winston';
import { redisService } from './redis.js';
import { emailService } from './email.js';
import { SentryService } from './sentry.js';

// Logging configuration
const LOG_CONFIG = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  
  // File rotation settings
  rotation: {
    maxSize: '20m',
    maxFiles: '14d',
    frequency: 'daily'
  },
  
  // Alerting thresholds
  alerting: {
    error: {
      threshold: 10, // errors per minute
      window: 60000, // 1 minute
      cooldown: 300000 // 5 minutes between alerts
    },
    warning: {
      threshold: 50, // warnings per minute
      window: 60000,
      cooldown: 600000 // 10 minutes
    },
    critical: {
      threshold: 5, // critical errors per minute
      window: 60000,
      cooldown: 60000 // 1 minute
    }
  }
};

// Create transports based on environment
const createTransports = () => {
  const transports = [
    // Console transport for all environments
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          let log = `${timestamp} [${level}] ${message}`;
          
          if (stack) {
            log += `\n${stack}`;
          }
          
          if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
          }
          
          return log;
        })
      )
    })
  ];
  
  // File transports for production
  if (process.env.NODE_ENV === 'production') {
    // Combined logs
    transports.push(new winston.transports.File({
      filename: 'logs/combined.log',
      ...LOG_CONFIG.rotation
    }));
    
    // Error logs
    transports.push(new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      ...LOG_CONFIG.rotation
    }));
    
    // Application logs
    transports.push(new winston.transports.File({
      filename: 'logs/app.log',
      level: 'info',
      ...LOG_CONFIG.rotation
    }));
  }
  
  return transports;
};

class AdvancedLogger {
  constructor() {
    this.winston = winston.createLogger({
      level: LOG_CONFIG.level,
      format: LOG_CONFIG.format,
      transports: createTransports(),
      exitOnError: false
    });
    
    this.alertCounts = new Map();
    this.lastAlertTime = new Map();
    this.errorPatterns = new Map();
    
    this.setupErrorTracking();
    this.startAlertMonitoring();
  }

  // Core logging methods
  debug(message, meta = {}) {
    this.winston.debug(message, this.enrichMeta(meta, 'debug'));
  }

  info(message, meta = {}) {
    this.winston.info(message, this.enrichMeta(meta, 'info'));
    this.trackMetrics('info');
  }

  warn(message, meta = {}) {
    this.winston.warn(message, this.enrichMeta(meta, 'warning'));
    this.trackMetrics('warning');
    this.checkAlertThreshold('warning');
  }

  error(message, error = null, meta = {}) {
    const errorMeta = this.processError(error, meta);
    this.winston.error(message, this.enrichMeta(errorMeta, 'error'));
    
    // Send to external services
    this.sendToSentry(message, error, errorMeta);
    this.trackMetrics('error');
    this.checkAlertThreshold('error');
    
    // Pattern analysis for recurring errors
    this.analyzeErrorPattern(message, error);
  }

  critical(message, error = null, meta = {}) {
    const errorMeta = this.processError(error, meta);
    this.winston.error(message, { 
      ...this.enrichMeta(errorMeta, 'critical'),
      critical: true 
    });
    
    // Immediate alerting for critical errors
    this.sendCriticalAlert(message, error, errorMeta);
    this.sendToSentry(message, error, { ...errorMeta, level: 'fatal' });
    this.trackMetrics('critical');
  }

  // Structured logging methods
  logRequest(req, res, duration) {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      requestId: req.id
    };

    const level = res.statusCode >= 400 ? 'error' : 'info';
    const message = `${req.method} ${req.url} ${res.statusCode} ${duration}ms`;
    
    this[level](message, meta);
  }

  logApiCall(endpoint, method, userId, duration, success, details = {}) {
    this.info(`API Call: ${method} ${endpoint}`, {
      endpoint,
      method,
      userId,
      duration,
      success,
      ...details,
      category: 'api'
    });
  }

  logDatabaseQuery(query, duration, success, error = null) {
    const meta = {
      query: query.substring(0, 200), // Truncate long queries
      duration,
      success,
      category: 'database'
    };

    if (error) {
      this.error(`Database query failed: ${error.message}`, error, meta);
    } else {
      this.info(`Database query executed in ${duration}ms`, meta);
    }
  }

  logAIOperation(platform, action, userId, duration, success, tokens = 0) {
    this.info(`AI Operation: ${action} for ${platform}`, {
      platform,
      action,
      userId,
      duration,
      success,
      tokens,
      category: 'ai'
    });
  }

  logSecurityEvent(event, userId, ip, details = {}) {
    this.warn(`Security Event: ${event}`, {
      event,
      userId,
      ip,
      ...details,
      category: 'security'
    });
  }

  // Enrich log metadata
  enrichMeta(meta, level) {
    return {
      ...meta,
      timestamp: new Date().toISOString(),
      level,
      environment: process.env.NODE_ENV,
      service: 'synthex-api',
      version: process.env.npm_package_version || '1.0.0',
      hostname: process.env.HOSTNAME || 'localhost',
      processId: process.pid,
      memoryUsage: process.memoryUsage(),
      correlationId: meta.correlationId || this.generateCorrelationId()
    };
  }

  // Process error objects
  processError(error, meta) {
    if (!error) return meta;

    return {
      ...meta,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        status: error.status,
        details: error.details
      }
    };
  }

  // Setup error tracking
  setupErrorTracking() {
    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      this.critical('Uncaught Exception', error, {
        category: 'system',
        fatal: true
      });
      
      // Give time for logs to write
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Unhandled promise rejection
    process.on('unhandledRejection', (reason, promise) => {
      this.critical('Unhandled Promise Rejection', reason, {
        category: 'system',
        promise: promise.toString()
      });
    });

    // Process warnings
    process.on('warning', (warning) => {
      this.warn('Process Warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
        category: 'system'
      });
    });
  }

  // Alert monitoring
  startAlertMonitoring() {
    setInterval(() => {
      this.checkSystemHealth();
    }, 60000); // Check every minute
  }

  checkAlertThreshold(level) {
    const config = LOG_CONFIG.alerting[level];
    if (!config) return;

    const now = Date.now();
    const windowStart = now - config.window;
    const key = `alert_count:${level}`;

    // Get current count
    const currentCount = this.alertCounts.get(key) || [];
    const filteredCount = currentCount.filter(time => time > windowStart);
    
    // Add current event
    filteredCount.push(now);
    this.alertCounts.set(key, filteredCount);

    // Check if threshold exceeded
    if (filteredCount.length >= config.threshold) {
      const lastAlert = this.lastAlertTime.get(key) || 0;
      
      if (now - lastAlert > config.cooldown) {
        this.sendAlert(level, filteredCount.length, config.threshold);
        this.lastAlertTime.set(key, now);
      }
    }
  }

  // Send alerts
  async sendAlert(level, count, threshold) {
    const message = `Alert: ${count} ${level} events in the last minute (threshold: ${threshold})`;
    
    try {
      // Send email alert
      if (process.env.ADMIN_EMAIL) {
        await emailService.sendNotificationEmail(
          process.env.ADMIN_EMAIL,
          'System Admin',
          `Synthex ${level.toUpperCase()} Alert`,
          message,
          'https://synthex.social/admin/logs',
          'View Logs'
        );
      }

      // Send to Slack if configured
      if (process.env.SLACK_WEBHOOK_URL) {
        await this.sendSlackAlert(message, level);
      }

      // Log the alert
      this.warn(`Alert sent: ${message}`, { category: 'alerting' });

    } catch (error) {
      this.error('Failed to send alert', error, { category: 'alerting' });
    }
  }

  async sendCriticalAlert(message, error, meta) {
    const alertMessage = `🚨 CRITICAL ERROR: ${message}`;
    
    try {
      // Immediate email to admins
      if (process.env.ADMIN_EMAIL) {
        await emailService.sendNotificationEmail(
          process.env.ADMIN_EMAIL,
          'System Admin',
          'CRITICAL: Synthex System Error',
          `${alertMessage}\n\nError: ${error?.message}\n\nMetadata: ${JSON.stringify(meta, null, 2)}`,
          'https://synthex.social/admin/errors',
          'View Details'
        );
      }

      // Immediate Slack notification
      if (process.env.SLACK_WEBHOOK_URL) {
        await this.sendSlackAlert(alertMessage, 'critical', error);
      }

    } catch (alertError) {
      console.error('Failed to send critical alert:', alertError);
    }
  }

  // Slack integration
  async sendSlackAlert(message, level, error = null) {
    if (!process.env.SLACK_WEBHOOK_URL) return;

    const colors = {
      info: '#36a64f',
      warning: '#ff9500',
      error: '#ff0000',
      critical: '#8B0000'
    };

    const payload = {
      text: message,
      attachments: [{
        color: colors[level] || colors.error,
        fields: [
          {
            title: 'Environment',
            value: process.env.NODE_ENV,
            short: true
          },
          {
            title: 'Service',
            value: 'Synthex API',
            short: true
          },
          {
            title: 'Timestamp',
            value: new Date().toISOString(),
            short: true
          }
        ]
      }]
    };

    if (error) {
      payload.attachments[0].fields.push({
        title: 'Error Details',
        value: `${error.name}: ${error.message}`,
        short: false
      });
    }

    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Failed to send Slack alert:', err);
    }
  }

  // Send to Sentry
  sendToSentry(message, error, meta) {
    if (SentryService.isInitialized()) {
      if (error) {
        SentryService.captureException(error, {
          tags: { category: meta.category },
          extra: meta
        });
      } else {
        SentryService.captureMessage(message, 'error', {
          tags: { category: meta.category },
          extra: meta
        });
      }
    }
  }

  // Error pattern analysis
  analyzeErrorPattern(message, error) {
    if (!error) return;

    const pattern = `${error.name}:${error.message?.substring(0, 100)}`;
    const count = this.errorPatterns.get(pattern) || 0;
    this.errorPatterns.set(pattern, count + 1);

    // Alert on recurring errors
    if (count > 0 && count % 10 === 0) {
      this.warn(`Recurring error detected (${count} times)`, {
        pattern,
        message,
        error: error.message,
        category: 'pattern_analysis'
      });
    }
  }

  // System health monitoring
  async checkSystemHealth() {
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    // Memory usage alert
    if (memUsagePercent > 85) {
      this.warn(`High memory usage: ${memUsagePercent.toFixed(2)}%`, {
        memoryUsage: memUsage,
        category: 'system_health'
      });
    }

    // Check Redis connection
    if (redisService.isConnected) {
      try {
        await redisService.healthCheck();
      } catch (error) {
        this.error('Redis health check failed', error, { category: 'system_health' });
      }
    }
  }

  // Metrics tracking
  trackMetrics(level) {
    // This would integrate with your metrics system
    if (redisService.isConnected) {
      redisService.publish('metrics', {
        type: 'log',
        level,
        timestamp: Date.now()
      });
    }
  }

  // Generate correlation ID for request tracking
  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Query logs
  async queryLogs(filters = {}) {
    // This would integrate with your log storage system
    // For now, return empty array
    return [];
  }

  // Get log statistics
  getLogStats() {
    return {
      alertCounts: Object.fromEntries(this.alertCounts),
      errorPatterns: Object.fromEntries(this.errorPatterns),
      lastAlertTimes: Object.fromEntries(this.lastAlertTime)
    };
  }

  // Graceful shutdown
  async shutdown() {
    return new Promise((resolve) => {
      this.winston.end(() => {
        resolve();
      });
    });
  }
}

// Create singleton instance
export const logger = new AdvancedLogger();

// Export convenience methods
export const {
  debug,
  info,
  warn,
  error,
  critical,
  logRequest,
  logApiCall,
  logDatabaseQuery,
  logAIOperation,
  logSecurityEvent
} = logger;

// Express middleware for request logging
export function requestLoggingMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    
    // Generate request ID
    req.id = logger.generateCorrelationId();
    res.set('X-Request-ID', req.id);

    // Log request completion
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.logRequest(req, res, duration);
    });

    next();
  };
}

// Error handling middleware
export function errorLoggingMiddleware() {
  return (error, req, res, next) => {
    logger.error('Request error', error, {
      method: req.method,
      url: req.url,
      requestId: req.id,
      userId: req.user?.id,
      category: 'request_error'
    });

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && !error.status) {
      error.message = 'Internal Server Error';
    }

    next(error);
  };
}

export default logger;