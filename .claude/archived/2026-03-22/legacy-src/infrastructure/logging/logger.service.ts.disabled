/**
 * Logger Service Implementation
 * Provides structured logging with multiple transports and formatting
 */

import winston from 'winston';
import { ILogger } from '../../architecture/layer-interfaces';

export interface LoggerConfig {
  level: string;
  enableConsole: boolean;
  enableFile: boolean;
  logFilePath?: string;
  maxSize?: string;
  maxFiles?: number;
  enableErrorFile?: boolean;
  errorFilePath?: string;
}

export class LoggerService implements ILogger {
  private logger: winston.Logger;
  private config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.logger = this.createLogger();
  }

  /**
   * Create Winston logger instance with configured transports
   */
  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `[${timestamp}] ${level}: ${message} ${metaStr}`;
            })
          )
        })
      );
    }

    // File transport for all logs
    if (this.config.enableFile && this.config.logFilePath) {
      transports.push(
        new winston.transports.File({
          filename: this.config.logFilePath,
          maxsize: this.parseSize(this.config.maxSize || '20m'),
          maxFiles: this.config.maxFiles || 5,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        })
      );
    }

    // Separate error file transport
    if (this.config.enableErrorFile && this.config.errorFilePath) {
      transports.push(
        new winston.transports.File({
          filename: this.config.errorFilePath,
          level: 'error',
          maxsize: this.parseSize(this.config.maxSize || '20m'),
          maxFiles: this.config.maxFiles || 5,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        })
      );
    }

    return winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
      ),
      transports,
      // Handle uncaught exceptions
      exceptionHandlers: this.config.enableFile ? [
        new winston.transports.File({ 
          filename: this.config.logFilePath?.replace('.log', '.exceptions.log') || 'exceptions.log' 
        })
      ] : undefined,
      // Handle unhandled rejections
      rejectionHandlers: this.config.enableFile ? [
        new winston.transports.File({ 
          filename: this.config.logFilePath?.replace('.log', '.rejections.log') || 'rejections.log' 
        })
      ] : undefined
    });
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(sizeStr: string): number {
    const units: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024
    };

    const match = sizeStr.toLowerCase().match(/^(\d+)([bkmg])?$/);
    if (!match) {
      return 20 * 1024 * 1024; // Default 20MB
    }

    const size = parseInt(match[1]);
    const unit = match[2] || 'b';
    
    return size * (units[unit] || 1);
  }

  /**
   * Sanitize sensitive data from metadata
   */
  private sanitizeMetadata(metadata: any): any {
    if (!metadata || typeof metadata !== 'object') {
      return metadata;
    }

    const sanitized = { ...metadata };
    const sensitiveFields = [
      'password',
      'passwordHash',
      'token',
      'secret',
      'key',
      'apiKey',
      'authorization',
      'cookie',
      'session',
      'jwt',
      'privateKey',
      'encryptionKey'
    ];

    const sanitizeObject = (obj: any, path: string = ''): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map((item, index) => sanitizeObject(item, `${path}[${index}]`));
      }

      const result = { ...obj };
      Object.keys(result).forEach(key => {
        const fullPath = path ? `${path}.${key}` : key;
        
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          result[key] = '[REDACTED]';
        } else if (typeof result[key] === 'object' && result[key] !== null) {
          result[key] = sanitizeObject(result[key], fullPath);
        }
      });

      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: any): void {
    this.logger.debug(message, this.sanitizeMetadata(metadata));
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: any): void {
    this.logger.info(message, this.sanitizeMetadata(metadata));
  }

  /**
   * Log warning message
   */
  warn(message: string, error?: Error, metadata?: any): void {
    const logData = {
      ...this.sanitizeMetadata(metadata),
      ...(error ? { error: this.formatError(error) } : {})
    };
    
    this.logger.warn(message, logData);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: any): void {
    const logData = {
      ...this.sanitizeMetadata(metadata),
      ...(error ? { error: this.formatError(error) } : {})
    };
    
    this.logger.error(message, logData);
  }

  /**
   * Format error for logging
   */
  private formatError(error: Error): any {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      // Include additional properties if they exist
      ...(error instanceof Error && 'code' in error ? { code: (error as any).code } : {}),
      ...(error instanceof Error && 'statusCode' in error ? { statusCode: (error as any).statusCode } : {}),
      ...(error instanceof Error && 'details' in error ? { details: (error as any).details } : {})
    };
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): ILogger {
    const childLogger = this.logger.child(this.sanitizeMetadata(context));
    
    return {
      debug: (message: string, metadata?: any) => {
        childLogger.debug(message, this.sanitizeMetadata(metadata));
      },
      info: (message: string, metadata?: any) => {
        childLogger.info(message, this.sanitizeMetadata(metadata));
      },
      warn: (message: string, error?: Error, metadata?: any) => {
        const logData = {
          ...this.sanitizeMetadata(metadata),
          ...(error ? { error: this.formatError(error) } : {})
        };
        childLogger.warn(message, logData);
      },
      error: (message: string, error?: Error, metadata?: any) => {
        const logData = {
          ...this.sanitizeMetadata(metadata),
          ...(error ? { error: this.formatError(error) } : {})
        };
        childLogger.error(message, logData);
      },
      child: (childContext: Record<string, any>) => {
        return this.child({ ...context, ...childContext });
      }
    };
  }

  /**
   * Get current log level
   */
  getLevel(): string {
    return this.logger.level;
  }

  /**
   * Set log level
   */
  setLevel(level: string): void {
    this.logger.level = level;
  }

  /**
   * Check if level is enabled
   */
  isLevelEnabled(level: string): boolean {
    return this.logger.isLevelEnabled(level);
  }

  /**
   * Flush logs (useful for testing)
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      // Winston doesn't have a built-in flush method, but we can end all transports
      let pending = 0;
      
      this.logger.transports.forEach(transport => {
        if ('_flush' in transport && typeof transport._flush === 'function') {
          pending++;
          transport._flush(() => {
            pending--;
            if (pending === 0) resolve();
          });
        }
      });
      
      if (pending === 0) resolve();
    });
  }

  /**
   * Close logger and cleanup resources
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.close(() => {
        resolve();
      });
    });
  }

  /**
   * Get logger statistics
   */
  getStats(): {
    level: string;
    transports: string[];
    exceptionsHandled: boolean;
    rejectionsHandled: boolean;
  } {
    return {
      level: this.logger.level,
      transports: this.logger.transports.map(t => t.constructor.name),
      exceptionsHandled: this.logger.exceptions.handle.length > 0,
      rejectionsHandled: this.logger.rejections.handle.length > 0
    };
  }

  /**
   * Profile performance (start timing)
   */
  startTimer(id: string): void {
    this.logger.profile(id);
  }

  /**
   * Profile performance (end timing)
   */
  endTimer(id: string, metadata?: any): void {
    this.logger.profile(id, this.sanitizeMetadata(metadata));
  }

  /**
   * Log with custom level
   */
  log(level: string, message: string, metadata?: any): void {
    this.logger.log(level, message, this.sanitizeMetadata(metadata));
  }
}