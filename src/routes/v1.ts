import { Router } from 'express';
import authRoutes from './auth';
import campaignRoutes from './campaigns';
import contentRoutes from './content';
import analyticsRoutes from './analytics';
import notificationRoutes from './notifications';
import teamRoutes from './team';
import userManagementRoutes from './userManagement';
import twoFactorRoutes from './twoFactor';
import auditRoutes from './audit';
import performanceRoutes from './performance';
import mcpRoutes from './mcp';
import emailRoutes from './email';
import dashboardRoutes from './dashboard-api';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/content', contentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/team', teamRoutes);
router.use('/dashboard', dashboardRoutes);

// Enterprise features
router.use('/users', userManagementRoutes);
router.use('/2fa', twoFactorRoutes);
router.use('/audit', auditRoutes);

// Performance monitoring
router.use('/performance', performanceRoutes);

// AI & MCP integration
router.use('/mcp', mcpRoutes);

// Email notifications
router.use('/email', emailRoutes);

// API v1 info
router.get('/', (req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      campaigns: '/api/v1/campaigns',
      content: '/api/v1/content',
      analytics: '/api/v1/analytics',
      notifications: '/api/v1/notifications',
      team: '/api/v1/team',
      // Enterprise features
      users: '/api/v1/users',
      '2fa': '/api/v1/2fa',
      audit: '/api/v1/audit',
      // Performance monitoring
      performance: '/api/v1/performance',
      // AI & MCP integration
      mcp: '/api/v1/mcp',
      // Email notifications  
      email: '/api/v1/email'
    },
    enterpriseFeatures: {
      userManagement: {
        description: 'Advanced user management with role-based permissions',
        endpoints: [
          'GET /api/v1/users - List users with filtering',
          'POST /api/v1/users - Create new user',
          'GET /api/v1/users/:id - Get user details',
          'PUT /api/v1/users/:id - Update user',
          'POST /api/v1/users/:id/deactivate - Deactivate user',
          'POST /api/v1/users/:id/reactivate - Reactivate user',
          'GET /api/v1/users/stats - User statistics',
          'GET /api/v1/users/permissions - Available permissions',
          'POST /api/v1/users/check-permission - Check user permission'
        ]
      },
      twoFactorAuth: {
        description: 'Two-factor authentication with TOTP and backup codes',
        endpoints: [
          'GET /api/v1/2fa/status - Get 2FA status',
          'POST /api/v1/2fa/setup - Setup 2FA',
          'POST /api/v1/2fa/verify-setup - Verify and enable 2FA',
          'POST /api/v1/2fa/verify - Verify 2FA token',
          'POST /api/v1/2fa/disable - Disable 2FA',
          'POST /api/v1/2fa/backup-codes/regenerate - Generate new backup codes'
        ]
      },
      auditLogging: {
        description: 'Comprehensive audit logging and monitoring',
        endpoints: [
          'GET /api/v1/audit/logs - Get audit logs with filtering',
          'GET /api/v1/audit/logs/:id - Get specific audit log',
          'GET /api/v1/audit/stats - Get audit statistics',
          'GET /api/v1/audit/user/:userId - Get user audit logs',
          'POST /api/v1/audit/cleanup - Cleanup old audit logs'
        ]
      },
      performanceMonitoring: {
        description: 'Performance monitoring, caching, and optimization',
        endpoints: [
          'GET /api/v1/performance/health - System health status',
          'GET /api/v1/performance/stats - Performance statistics',
          'GET /api/v1/performance/endpoint/* - Endpoint-specific performance',
          'GET /api/v1/performance/cache/stats - Cache statistics',
          'POST /api/v1/performance/cache/clear - Clear cache',
          'GET /api/v1/performance/system - System information',
          'GET /api/v1/performance/trends - Performance trends',
          'GET /api/v1/performance/alerts - Performance alerts',
          'GET /api/v1/performance/export - Export performance metrics'
        ]
      }
    }
  });
});

export default router;
