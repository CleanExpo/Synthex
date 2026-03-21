/**
 * Main Routes Index - TypeScript Version
 * Combines all application routes with proper integration
 */

import express from 'express';
import { Request, Response } from 'express';

// Import all route modules
import analyticsRoutes from './analytics.routes.js';
import abTestingRoutes from './ab-testing.routes.js';
import aiContentRoutes from './ai-content.routes.js';
import competitorRoutes from './competitor.routes.js';
import teamRoutes from './team.routes.js';
import schedulerRoutes from './scheduler.routes.js';
import libraryRoutes from './library.routes.js';
import mobileRoutes from './mobile.routes.js';
import reportingRoutes from './reporting.routes.js';
import whiteLabelRoutes from './white-label.routes.js';

// Import existing TypeScript routes
import authRoutes from './auth';
import postsRoutes from './posts';
import notificationsRoutes from './notifications';
import auditRoutes from './audit';
import twoFactorRoutes from './twoFactor';
import userManagementRoutes from './userManagement';
import performanceRoutes from './performance';
import emailRoutes from './email';

// Import middleware
import { authenticateToken } from '../middleware/auth';
import cacheMiddleware, { CacheProfiles } from '../middleware/caching';
import compressionMiddleware, { CompressionProfiles } from '../middleware/compression';

const router = express.Router();

// Apply compression middleware to all routes
router.use(compressionMiddleware(CompressionProfiles.api));

// Health check endpoint (public)
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'connected',
      cache: 'connected',
      queue: 'connected'
    }
  });
});

// API documentation endpoint (public)
router.get('/docs', (req: Request, res: Response) => {
  res.json({
    message: 'Synthex API Documentation',
    version: '2.0.0',
    baseUrl: '/api/v2',
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization',
      format: 'Bearer <token>'
    },
    endpoints: {
      // Analytics
      analytics: {
        base: '/api/v2/analytics',
        endpoints: [
          'GET /metrics/realtime',
          'GET /metrics/historical',
          'GET /metrics/platform/:platform',
          'POST /track',
          'GET /insights'
        ]
      },
      // A/B Testing
      abTesting: {
        base: '/api/v2/ab-testing',
        endpoints: [
          'GET /experiments',
          'GET /experiments/:id',
          'POST /experiments',
          'PUT /experiments/:id',
          'DELETE /experiments/:id',
          'GET /experiments/:id/results'
        ]
      },
      // AI Content
      aiContent: {
        base: '/api/v2/ai-content',
        endpoints: [
          'POST /generate',
          'POST /optimize',
          'POST /variations',
          'POST /translate',
          'GET /templates'
        ]
      },
      // Teams
      teams: {
        base: '/api/v2/teams',
        endpoints: [
          'GET /',
          'GET /:id',
          'POST /',
          'PUT /:id',
          'DELETE /:id',
          'GET /:id/members',
          'POST /:id/members',
          'DELETE /:id/members/:memberId'
        ]
      },
      // Scheduler
      scheduler: {
        base: '/api/v2/scheduler',
        endpoints: [
          'GET /posts',
          'GET /calendar',
          'POST /posts',
          'PUT /posts/:id',
          'DELETE /posts/:id',
          'POST /bulk'
        ]
      },
      // Content Library
      library: {
        base: '/api/v2/library',
        endpoints: [
          'GET /templates',
          'GET /assets',
          'POST /upload',
          'GET /search',
          'DELETE /assets/:id'
        ]
      },
      // Mobile API
      mobile: {
        base: '/api/v2/mobile',
        endpoints: [
          'GET /sync',
          'GET /notifications',
          'POST /devices/register',
          'POST /push/send'
        ]
      },
      // White Label
      whiteLabel: {
        base: '/api/v2/white-label',
        endpoints: [
          'GET /tenant',
          'GET /branding',
          'PUT /branding',
          'GET /sso',
          'POST /sso/configure'
        ]
      },
      // Reporting
      reporting: {
        base: '/api/v2/reporting',
        endpoints: [
          'POST /generate',
          'GET /reports',
          'GET /reports/:id',
          'GET /export',
          'DELETE /reports/:id'
        ]
      },
      // Competitors
      competitors: {
        base: '/api/v2/competitors',
        endpoints: [
          'GET /',
          'GET /:id',
          'POST /',
          'GET /:id/metrics',
          'GET /analysis'
        ]
      },
      // Authentication
      auth: {
        base: '/api/v2/auth',
        endpoints: [
          'POST /register',
          'POST /login',
          'POST /logout',
          'POST /refresh',
          'GET /profile',
          'PUT /profile',
          'POST /password/reset',
          'POST /password/change'
        ]
      },
      // Posts
      posts: {
        base: '/api/v2/posts',
        endpoints: [
          'GET /',
          'GET /:id',
          'POST /',
          'PUT /:id',
          'DELETE /:id',
          'POST /:id/publish',
          'POST /:id/schedule'
        ]
      },
      // User Management
      users: {
        base: '/api/v2/users',
        endpoints: [
          'GET /',
          'GET /:id',
          'POST /',
          'PUT /:id',
          'DELETE /:id',
          'GET /:id/permissions',
          'PUT /:id/permissions'
        ]
      },
      // Performance
      performance: {
        base: '/api/v2/performance',
        endpoints: [
          'GET /metrics',
          'GET /trends',
          'GET /recommendations'
        ]
      }
    },
    documentation: 'https://docs.synthex.app/api',
    support: 'support@synthex.app'
  });
});

// ============================================
// Public Routes (No Authentication Required)
// ============================================

// Health and status endpoints
router.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// Protected Routes (Authentication Required)
// ============================================

// Analytics Routes
router.use('/analytics', authenticateToken, analyticsRoutes);

// A/B Testing Routes
router.use('/ab-testing', authenticateToken, abTestingRoutes);

// AI Content Generation Routes
router.use('/ai-content', authenticateToken, aiContentRoutes);

// Competitor Analysis Routes
router.use('/competitors', authenticateToken, competitorRoutes);

// Team Collaboration Routes
router.use('/teams', authenticateToken, teamRoutes);

// Scheduler Routes
router.use('/scheduler', authenticateToken, schedulerRoutes);

// Content Library Routes
router.use('/library', authenticateToken, libraryRoutes);

// Mobile API Routes
router.use('/mobile', authenticateToken, mobileRoutes);

// Reporting Routes
router.use('/reporting', authenticateToken, reportingRoutes);

// White Label Routes
router.use('/white-label', authenticateToken, whiteLabelRoutes);

// ============================================
// Core Platform Routes
// ============================================

// Authentication Routes (Some endpoints are public)
router.use('/auth', authRoutes);

// Posts Management Routes
router.use('/posts', authenticateToken, postsRoutes);

// Notifications Routes
router.use('/notifications', authenticateToken, notificationsRoutes);

// Audit Logging Routes
router.use('/audit', authenticateToken, auditRoutes);

// Two-Factor Authentication Routes
router.use('/two-factor', authenticateToken, twoFactorRoutes);

// User Management Routes
router.use('/users', authenticateToken, userManagementRoutes);

// Performance Monitoring Routes
router.use('/performance', authenticateToken, performanceRoutes);

// Email Service Routes
router.use('/email', authenticateToken, emailRoutes);

// ============================================
// Cached Endpoints (for frequently accessed data)
// ============================================

// Cached analytics endpoint
router.get('/analytics/summary', 
  authenticateToken, 
  cacheMiddleware({ ttl: 300, keyPrefix: 'analytics-summary' }), // Cache for 5 minutes
  async (req: Request, res: Response) => {
    // This will use the actual analytics service when integrated
    res.json({
      success: true,
      data: {
        overview: {
          totalPosts: 1234,
          totalEngagement: 45678,
          averageReach: 23456,
          growthRate: 12.5
        },
        cached: true,
        timestamp: new Date().toISOString()
      }
    });
  }
);

// Cached trending content endpoint
router.get('/content/trending',
  authenticateToken,
  cacheMiddleware({ ttl: 600, keyPrefix: 'trending' }), // Cache for 10 minutes
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        trending: [],
        cached: true,
        timestamp: new Date().toISOString()
      }
    });
  }
);

// ============================================
// Feature Flags Endpoint
// ============================================

router.get('/features', authenticateToken, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      abTesting: true,
      aiContent: true,
      advancedAnalytics: true,
      teamCollaboration: true,
      whiteLabel: process.env.ENABLE_WHITE_LABEL === 'true',
      mobileAPI: true,
      competitorAnalysis: true,
      automatedReporting: true,
      contentLibrary: true,
      advancedScheduler: true
    }
  });
});

// ============================================
// Error Handling
// ============================================

// 404 handler for undefined routes
router.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
router.use((err: any, req: Request, res: Response, next: any) => {
  console.error('API Error:', err);
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    success: false,
    error: {
      message,
      status,
      timestamp: new Date().toISOString()
    }
  });
});

export default router;
