/**
 * Security Configuration
 * Centralized security settings for the application
 */

import helmet from 'helmet';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';

// Environment-based configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * CORS Configuration
 */
export const corsConfig = {
  origin: (origin: string | undefined, callback: any) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://synthex.app',
      'https://www.synthex.app',
      process.env.FRONTEND_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Allow all origins in development
    if (isDevelopment) {
      return callback(null, true);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-Device-ID',
    'X-Platform',
    'X-Locale',
    'X-Session-ID'
  ],
  exposedHeaders: [
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'X-Request-ID',
    'X-Response-Time'
  ],
  maxAge: 86400 // 24 hours
};

/**
 * Helmet Security Headers Configuration
 */
export const helmetConfig = {
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.googletagmanager.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://api.synthex.app', 'wss://synthex.app'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", 'https://www.youtube.com'],
      upgradeInsecureRequests: []
    }
  } : false,
  crossOriginEmbedderPolicy: !isDevelopment,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};

/**
 * Rate Limiting Configurations by Endpoint Type
 */
export const rateLimitConfigs = {
  // Authentication endpoints
  auth: {
    login: { windowMs: 15 * 60 * 1000, max: 5 },
    register: { windowMs: 60 * 60 * 1000, max: 3 },
    passwordReset: { windowMs: 60 * 60 * 1000, max: 3 },
    twoFactor: { windowMs: 15 * 60 * 1000, max: 5 }
  },
  
  // API endpoints
  api: {
    standard: { windowMs: 15 * 60 * 1000, max: 100 },
    search: { windowMs: 60 * 1000, max: 30 },
    analytics: { windowMs: 60 * 1000, max: 60 },
    aiGeneration: { windowMs: 60 * 60 * 1000, max: 30 }
  },
  
  // Content operations
  content: {
    create: { windowMs: 60 * 60 * 1000, max: 50 },
    update: { windowMs: 60 * 60 * 1000, max: 100 },
    delete: { windowMs: 60 * 60 * 1000, max: 20 },
    publish: { windowMs: 60 * 60 * 1000, max: 30 }
  },
  
  // File operations
  file: {
    upload: { windowMs: 60 * 60 * 1000, max: 10 },
    download: { windowMs: 60 * 60 * 1000, max: 50 }
  },
  
  // Platform-specific
  platform: {
    twitter: { windowMs: 15 * 60 * 1000, max: 300 },
    instagram: { windowMs: 60 * 1000, max: 200 },
    linkedin: { windowMs: 15 * 60 * 1000, max: 100 },
    tiktok: { windowMs: 60 * 1000, max: 60 }
  },
  
  // User tier-based
  tier: {
    free: { windowMs: 15 * 60 * 1000, max: 50 },
    basic: { windowMs: 15 * 60 * 1000, max: 200 },
    pro: { windowMs: 15 * 60 * 1000, max: 500 },
    enterprise: { windowMs: 15 * 60 * 1000, max: 2000 }
  }
};

/**
 * API Key Validation Middleware
 */
export const validateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide an API key in the X-API-Key header'
    });
  }
  
  try {
    // Validate API key (implement your validation logic)
    // This is a placeholder - implement actual validation
    const isValid = apiKey.length === 32; // Example validation
    
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or expired'
      });
    }
    
    // Add API key info to request
    (req as any).apiKey = {
      key: apiKey,
      tier: 'pro', // Determine from database
      rateLimit: rateLimitConfigs.tier.pro
    };
    
    next();
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to validate API key'
    });
  }
};

/**
 * Request ID Middleware
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] as string || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

/**
 * Response Time Middleware
 */
export const responseTimeMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });
  
  next();
};

/**
 * Security Headers Middleware
 */
export const securityHeadersMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove unnecessary headers
  res.removeHeader('X-Powered-By');
  
  next();
};

/**
 * Input Sanitization Middleware
 */
export const sanitizationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        // Remove script tags and SQL injection attempts
        req.query[key] = (req.query[key] as string)
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER)\b)/gi, '');
      }
    }
  }
  
  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    const sanitizeObject = (obj: any): any => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key]
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER)\b)/gi, '');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };
    sanitizeObject(req.body);
  }
  
  next();
};

/**
 * Device Detection Middleware
 */
export const deviceDetectionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userAgent = req.headers['user-agent'] || '';
  
  (req as any).device = {
    isMobile: /mobile|android|iphone/i.test(userAgent),
    isTablet: /ipad|tablet/i.test(userAgent),
    isDesktop: !/mobile|android|iphone|ipad|tablet/i.test(userAgent),
    userAgent
  };
  
  next();
};

/**
 * IP Address Middleware
 */
export const ipAddressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const ip = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress;
  
  (req as any).clientIp = ip;
  
  next();
};

/**
 * Session Validation Middleware
 */
export const sessionValidationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (sessionId) {
    // Validate session (implement your logic)
    (req as any).sessionId = sessionId;
  }
  
  next();
};

/**
 * Platform Detection Middleware
 */
export const platformDetectionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const platform = req.headers['x-platform'] as string || 
    req.query.platform as string || 
    'web';
  
  (req as any).platform = platform;
  
  next();
};

/**
 * Error Logging Middleware
 */
export const errorLoggingMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Request Error:', {
    requestId: (req as any).requestId,
    method: req.method,
    url: req.url,
    ip: (req as any).clientIp,
    error: err.message,
    stack: err.stack
  });
  
  next(err);
};

/**
 * Combined Security Middleware Stack
 */
export const securityMiddlewareStack = [
  requestIdMiddleware,
  responseTimeMiddleware,
  ipAddressMiddleware,
  deviceDetectionMiddleware,
  platformDetectionMiddleware,
  securityHeadersMiddleware,
  sanitizationMiddleware,
  sessionValidationMiddleware
];

export default {
  corsConfig,
  helmetConfig,
  rateLimitConfigs,
  validateApiKey,
  securityMiddlewareStack,
  errorLoggingMiddleware
};
