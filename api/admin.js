/**
 * Admin API Routes
 * Secure API endpoints for system administration and monitoring
 */

import express from 'express';
import { adminDashboard } from '../src/admin/dashboard.js';
import { logger } from '../src/lib/logger.js';
import { rateLimiter } from '../src/lib/rate-limiter.js';
import { verifyJWT } from '../src/lib/auth.js';

const router = express.Router();

// Admin authentication middleware
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const decoded = await verifyJWT(token);
    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    logger.error('Admin authentication failed', error, { category: 'admin' });
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// Rate limiting for admin endpoints
const adminRateLimit = rateLimiter.createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for admin
  skipSuccessfulRequests: false,
  keyGenerator: (req) => `admin:${req.admin?.id || req.ip}`
});

// Apply middleware to all admin routes
router.use(adminRateLimit);
router.use(requireAdmin);

// System Overview
router.get('/overview', async (req, res) => {
  try {
    const overview = await adminDashboard.getSystemOverview();
    res.json(overview);
  } catch (error) {
    logger.error('Admin overview request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get system overview' });
  }
});

// User Management
router.get('/users', async (req, res) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      search: req.query.search,
      plan: req.query.plan,
      status: req.query.status
    };

    const users = await adminDashboard.getUsers(filters);
    res.json(users);
  } catch (error) {
    logger.error('Admin users request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Validate updates
    const allowedUpdates = ['plan', 'status', 'first_name', 'last_name'];
    const filteredUpdates = {};
    
    for (const key of Object.keys(updates)) {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    }

    const updatedUser = await adminDashboard.updateUser(userId, filteredUpdates);
    
    logger.info('User updated by admin', {
      category: 'admin',
      adminId: req.admin.id,
      userId,
      updates: Object.keys(filteredUpdates)
    });

    res.json(updatedUser);
  } catch (error) {
    logger.error('Admin user update failed', error, { 
      category: 'admin',
      adminId: req.admin.id,
      userId: req.params.userId
    });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.post('/users/:userId/suspend', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = 'Admin action' } = req.body;

    await adminDashboard.suspendUser(userId, reason);
    
    logger.warn('User suspended by admin', {
      category: 'admin',
      adminId: req.admin.id,
      userId,
      reason
    });

    res.json({ success: true, message: 'User suspended successfully' });
  } catch (error) {
    logger.error('Admin user suspension failed', error, { 
      category: 'admin',
      adminId: req.admin.id,
      userId: req.params.userId
    });
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// Content Management
router.get('/content/moderation', async (req, res) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      status: req.query.status,
      category: req.query.category
    };

    const moderation = await adminDashboard.getContentModeration(filters);
    res.json(moderation);
  } catch (error) {
    logger.error('Admin content moderation request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get content moderation data' });
  }
});

// System Configuration
router.get('/config', async (req, res) => {
  try {
    const config = await adminDashboard.getSystemConfiguration();
    res.json(config);
  } catch (error) {
    logger.error('Admin config request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get system configuration' });
  }
});

// Maintenance Mode Management
router.post('/maintenance/enable', async (req, res) => {
  try {
    const { message, estimatedDuration } = req.body;
    
    const maintenanceMode = await adminDashboard.enableMaintenanceMode(
      req.admin.id, 
      message || 'System maintenance in progress',
      estimatedDuration
    );

    logger.warn('Maintenance mode enabled', {
      category: 'admin',
      adminId: req.admin.id,
      message
    });

    res.json(maintenanceMode);
  } catch (error) {
    logger.error('Enable maintenance mode failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to enable maintenance mode' });
  }
});

router.post('/maintenance/disable', async (req, res) => {
  try {
    const result = await adminDashboard.disableMaintenanceMode(req.admin.id);

    logger.info('Maintenance mode disabled', {
      category: 'admin',
      adminId: req.admin.id
    });

    res.json(result);
  } catch (error) {
    logger.error('Disable maintenance mode failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to disable maintenance mode' });
  }
});

// Backup Management
router.post('/backup/trigger', async (req, res) => {
  try {
    const { type = 'manual' } = req.body;
    
    const backup = await adminDashboard.triggerBackup(type, req.admin.id);

    logger.info('Manual backup triggered', {
      category: 'admin',
      adminId: req.admin.id,
      type
    });

    res.json(backup);
  } catch (error) {
    logger.error('Backup trigger failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to trigger backup' });
  }
});

router.get('/backup/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await adminDashboard.getBackupHistory(limit);
    res.json(history);
  } catch (error) {
    logger.error('Backup history request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get backup history' });
  }
});

// Analytics and Reporting
router.get('/reports/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const dateRange = {
      start: req.query.start,
      end: req.query.end
    };

    const report = await adminDashboard.generateSystemReport(type, dateRange);

    logger.info('System report generated', {
      category: 'admin',
      adminId: req.admin.id,
      type
    });

    res.json(report);
  } catch (error) {
    logger.error('Report generation failed', error, { 
      category: 'admin',
      adminId: req.admin.id,
      type: req.params.type
    });
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Alert Management
router.get('/alerts', async (req, res) => {
  try {
    const alerts = adminDashboard.getActiveAlerts();
    res.json({ alerts });
  } catch (error) {
    logger.error('Alerts request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

router.post('/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    const alert = adminDashboard.acknowledgeAlert(parseInt(alertId), req.admin.id);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    logger.info('Alert acknowledged', {
      category: 'admin',
      adminId: req.admin.id,
      alertId
    });

    res.json(alert);
  } catch (error) {
    logger.error('Alert acknowledgment failed', error, { 
      category: 'admin',
      adminId: req.admin.id,
      alertId: req.params.alertId
    });
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// System Health Check
router.get('/health', async (req, res) => {
  try {
    const health = await adminDashboard.getSystemHealth();
    res.json(health);
  } catch (error) {
    logger.error('Health check failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get system health' });
  }
});

// Performance Metrics
router.get('/performance', async (req, res) => {
  try {
    const metrics = await adminDashboard.getPerformanceMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Performance metrics request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

// System Statistics
router.get('/stats/users', async (req, res) => {
  try {
    const stats = await adminDashboard.getUserStatistics();
    res.json(stats);
  } catch (error) {
    logger.error('User stats request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

router.get('/stats/content', async (req, res) => {
  try {
    const stats = await adminDashboard.getContentStatistics();
    res.json(stats);
  } catch (error) {
    logger.error('Content stats request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get content statistics' });
  }
});

// Recent Activity
router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const activity = await adminDashboard.getRecentActivity(limit);
    res.json({ activity });
  } catch (error) {
    logger.error('Recent activity request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get recent activity' });
  }
});

// Security Report
router.get('/security', async (req, res) => {
  try {
    const report = await adminDashboard.getSecurityReport();
    res.json(report);
  } catch (error) {
    logger.error('Security report request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get security report' });
  }
});

// Log Management
router.get('/logs', async (req, res) => {
  try {
    const {
      level = 'info',
      category,
      limit = 100,
      offset = 0
    } = req.query;

    // This would integrate with your logging system to retrieve logs
    // For now, return a mock response
    const logs = {
      entries: [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: 0
      },
      filters: {
        level,
        category
      }
    };

    res.json(logs);
  } catch (error) {
    logger.error('Logs request failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Export logs
router.get('/logs/export', async (req, res) => {
  try {
    const {
      format = 'json',
      start,
      end,
      level,
      category
    } = req.query;

    // Set appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="system-logs-${Date.now()}.${format}"`);
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');

    // This would export actual logs based on the filters
    const exportData = {
      exportedAt: new Date().toISOString(),
      filters: { start, end, level, category },
      logs: []
    };

    logger.info('Logs exported by admin', {
      category: 'admin',
      adminId: req.admin.id,
      format,
      filters: { start, end, level, category }
    });

    res.json(exportData);
  } catch (error) {
    logger.error('Log export failed', error, { 
      category: 'admin',
      adminId: req.admin.id 
    });
    res.status(500).json({ error: 'Failed to export logs' });
  }
});

// Error handler for admin routes
router.use((error, req, res, next) => {
  logger.error('Admin API error', error, { 
    category: 'admin',
    adminId: req.admin?.id,
    path: req.path,
    method: req.method
  });

  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

export default router;