/**
 * Admin Dashboard System
 * Comprehensive system management, monitoring, and administration interface
 */

import { db } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { redisService } from '../lib/redis.js';
import { emailService } from '../lib/email.js';
import { contentModerator } from '../lib/content-moderation.js';
import { backupSystem } from '../../scripts/backup-system.js';
import { dbOptimizer } from '../../database/optimization/query-optimizer.js';
import { rateLimiter } from '../lib/rate-limiter.js';
import { i18n } from '../lib/i18n.js';
import { translationService } from '../services/translation.js';

// Admin dashboard configuration
const ADMIN_CONFIG = {
  // Authentication
  auth: {
    enabled: true,
    requiredRole: 'admin',
    sessionTimeout: 3600000, // 1 hour
    maxLoginAttempts: 5,
    lockoutDuration: 900000 // 15 minutes
  },
  
  // Dashboard refresh intervals
  refresh: {
    systemStats: 30000,    // 30 seconds
    userActivity: 60000,   // 1 minute
    performance: 120000,   // 2 minutes
    logs: 10000           // 10 seconds
  },
  
  // Alert thresholds
  thresholds: {
    cpuUsage: 80,
    memoryUsage: 85,
    diskUsage: 90,
    errorRate: 5, // errors per minute
    slowQueries: 1000, // ms
    failedLogins: 10 // per hour
  },
  
  // System maintenance
  maintenance: {
    allowedUsers: ['admin', 'maintainer'],
    gracePeriod: 300000, // 5 minutes
    maintenancePage: '/maintenance.html'
  }
};

class AdminDashboard {
  constructor() {
    this.systemStats = new Map();
    this.alerts = [];
    this.maintenanceMode = false;
    this.connectedAdmins = new Set();
    this.init();
  }

  async init() {
    logger.info('Initializing admin dashboard', { category: 'admin' });
    
    // Start system monitoring
    this.startSystemMonitoring();
    
    // Initialize alert system
    this.startAlertSystem();
    
    // Set up maintenance mode handlers
    this.setupMaintenanceMode();
    
    logger.info('Admin dashboard initialized', { category: 'admin' });
  }

  // System Overview and Statistics
  async getSystemOverview() {
    try {
      const [
        userStats,
        contentStats,
        systemHealth,
        performanceMetrics,
        recentActivity
      ] = await Promise.all([
        this.getUserStatistics(),
        this.getContentStatistics(),
        this.getSystemHealth(),
        this.getPerformanceMetrics(),
        this.getRecentActivity()
      ]);

      return {
        timestamp: new Date().toISOString(),
        overview: {
          users: userStats,
          content: contentStats,
          system: systemHealth,
          performance: performanceMetrics
        },
        recentActivity,
        alerts: this.getActiveAlerts(),
        maintenanceMode: this.maintenanceMode
      };

    } catch (error) {
      logger.error('Failed to get system overview', error, { category: 'admin' });
      throw error;
    }
  }

  // User Management and Statistics
  async getUserStatistics() {
    try {
      const { data: users, error } = await db.supabase
        .from('profiles')
        .select('id, plan, created_at, last_login_at, status');

      if (error) throw error;

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = {
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        newToday: users.filter(u => new Date(u.created_at) > last24h).length,
        newThisWeek: users.filter(u => new Date(u.created_at) > last7d).length,
        newThisMonth: users.filter(u => new Date(u.created_at) > last30d).length,
        activeToday: users.filter(u => u.last_login_at && new Date(u.last_login_at) > last24h).length,
        byPlan: {
          free: users.filter(u => u.plan === 'free').length,
          pro: users.filter(u => u.plan === 'pro').length,
          enterprise: users.filter(u => u.plan === 'enterprise').length
        },
        retention: {
          daily: this.calculateRetentionRate(users, 1),
          weekly: this.calculateRetentionRate(users, 7),
          monthly: this.calculateRetentionRate(users, 30)
        }
      };

      return stats;

    } catch (error) {
      logger.error('Failed to get user statistics', error, { category: 'admin' });
      return {};
    }
  }

  // Content Management and Statistics
  async getContentStatistics() {
    try {
      const { data: content, error } = await db.supabase
        .from('optimized_content')
        .select('id, platform, score, created_at, user_id');

      if (error) throw error;

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = {
        total: content.length,
        createdToday: content.filter(c => new Date(c.created_at) > last24h).length,
        createdThisWeek: content.filter(c => new Date(c.created_at) > last7d).length,
        averageScore: content.length > 0 ? 
          content.reduce((sum, c) => sum + (c.score || 0), 0) / content.length : 0,
        byPlatform: {
          instagram: content.filter(c => c.platform === 'instagram').length,
          facebook: content.filter(c => c.platform === 'facebook').length,
          twitter: content.filter(c => c.platform === 'twitter').length,
          linkedin: content.filter(c => c.platform === 'linkedin').length,
          tiktok: content.filter(c => c.platform === 'tiktok').length
        },
        qualityDistribution: {
          excellent: content.filter(c => c.score >= 80).length,
          good: content.filter(c => c.score >= 60 && c.score < 80).length,
          average: content.filter(c => c.score >= 40 && c.score < 60).length,
          poor: content.filter(c => c.score < 40).length
        },
        topCreators: await this.getTopContentCreators(content)
      };

      return stats;

    } catch (error) {
      logger.error('Failed to get content statistics', error, { category: 'admin' });
      return {};
    }
  }

  // System Health Monitoring
  async getSystemHealth() {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        overall: 'healthy',
        services: {},
        resources: await this.getSystemResources(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      };

      // Check individual services
      const services = [
        { name: 'database', check: () => db.supabase.rpc('execute_sql', { sql: 'SELECT 1' }) },
        { name: 'redis', check: () => redisService.ping() },
        { name: 'email', check: () => emailService.healthCheck() },
        { name: 'moderation', check: () => contentModerator.healthCheck() },
        { name: 'backup', check: () => backupSystem.healthCheck?.() || { status: 'healthy' } },
        { name: 'database_optimizer', check: () => dbOptimizer.healthCheck() },
        { name: 'rate_limiter', check: () => rateLimiter.healthCheck() },
        { name: 'i18n', check: () => i18n.healthCheck() },
        { name: 'translation', check: () => translationService.healthCheck() }
      ];

      for (const service of services) {
        try {
          const result = await service.check();
          health.services[service.name] = {
            status: result?.status || 'healthy',
            ...result
          };
        } catch (error) {
          health.services[service.name] = {
            status: 'unhealthy',
            error: error.message
          };
          health.overall = 'degraded';
        }
      }

      // Check for critical issues
      const unhealthyServices = Object.values(health.services)
        .filter(service => service.status === 'unhealthy').length;
      
      if (unhealthyServices >= services.length / 2) {
        health.overall = 'critical';
      } else if (unhealthyServices > 0) {
        health.overall = 'degraded';
      }

      return health;

    } catch (error) {
      logger.error('Failed to get system health', error, { category: 'admin' });
      return {
        overall: 'unknown',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Performance Metrics
  async getPerformanceMetrics() {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        database: await dbOptimizer.generatePerformanceReport(),
        rateLimiting: await rateLimiter.getStatistics(),
        moderation: await contentModerator.getModerationStats(),
        translation: translationService.getStatistics(),
        system: {
          memory: process.memoryUsage(),
          cpu: await this.getCPUUsage(),
          eventLoop: this.getEventLoopMetrics(),
          gc: this.getGCMetrics()
        }
      };

      return metrics;

    } catch (error) {
      logger.error('Failed to get performance metrics', error, { category: 'admin' });
      return {};
    }
  }

  // Recent System Activity
  async getRecentActivity(limit = 50) {
    try {
      // This would typically query a system activity log table
      // For now, we'll return recent database changes
      const activities = [];

      // Get recent user registrations
      const { data: newUsers } = await db.supabase
        .from('profiles')
        .select('id, email, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      newUsers?.forEach(user => {
        activities.push({
          type: 'user_registration',
          timestamp: user.created_at,
          description: `New user registered: ${user.email}`,
          metadata: { userId: user.id }
        });
      });

      // Get recent content creation
      const { data: newContent } = await db.supabase
        .from('optimized_content')
        .select('id, platform, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(20);

      newContent?.forEach(content => {
        activities.push({
          type: 'content_created',
          timestamp: content.created_at,
          description: `New content created for ${content.platform}`,
          metadata: { contentId: content.id, userId: content.user_id }
        });
      });

      // Sort by timestamp and limit
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return activities.slice(0, limit);

    } catch (error) {
      logger.error('Failed to get recent activity', error, { category: 'admin' });
      return [];
    }
  }

  // User Management Functions
  async getUsers(filters = {}) {
    try {
      let query = db.supabase
        .from('profiles')
        .select(`
          id, email, first_name, last_name, plan, status,
          created_at, last_login_at, updated_at
        `);

      // Apply filters
      if (filters.plan) {
        query = query.eq('plan', filters.plan);
      }
      
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.or(`email.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
      }

      // Pagination
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const offset = (page - 1) * limit;

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        users: data || [],
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit)
        }
      };

    } catch (error) {
      logger.error('Failed to get users', error, { category: 'admin' });
      throw error;
    }
  }

  async updateUser(userId, updates) {
    try {
      const { data, error } = await db.supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      logger.info('User updated by admin', {
        category: 'admin',
        userId,
        updates: Object.keys(updates)
      });

      return data;

    } catch (error) {
      logger.error('Failed to update user', error, { category: 'admin' });
      throw error;
    }
  }

  async suspendUser(userId, reason = 'Admin action') {
    try {
      await this.updateUser(userId, { 
        status: 'suspended',
        suspended_at: new Date().toISOString(),
        suspension_reason: reason
      });

      // Send notification to user
      const { data: user } = await db.supabase
        .from('profiles')
        .select('email, first_name')
        .eq('id', userId)
        .single();

      if (user?.email) {
        await emailService.sendNotificationEmail(
          user.email,
          user.first_name || 'User',
          'Account Suspended',
          `Your account has been suspended. Reason: ${reason}. Please contact support for more information.`
        );
      }

      logger.warn('User suspended', {
        category: 'admin',
        userId,
        reason
      });

    } catch (error) {
      logger.error('Failed to suspend user', error, { category: 'admin' });
      throw error;
    }
  }

  // Content Management Functions
  async getContentModeration(filters = {}) {
    try {
      // Get flagged content and moderation statistics
      const moderationData = await contentModerator.getModerationStats('24h');
      
      return {
        stats: moderationData,
        flaggedContent: await this.getFlaggedContent(filters),
        moderationQueue: await this.getModerationQueue(),
        recentActions: await this.getRecentModerationActions()
      };

    } catch (error) {
      logger.error('Failed to get content moderation data', error, { category: 'admin' });
      throw error;
    }
  }

  async getFlaggedContent(filters = {}) {
    try {
      // This would query a moderation_flags table
      // For now, return mock data structure
      return {
        items: [],
        pagination: { page: 1, total: 0, pages: 0 }
      };

    } catch (error) {
      logger.error('Failed to get flagged content', error, { category: 'admin' });
      return { items: [], pagination: { page: 1, total: 0, pages: 0 } };
    }
  }

  // System Configuration Management
  async getSystemConfiguration() {
    try {
      return {
        features: {
          contentModeration: true,
          autoTranslation: true,
          backupSystem: true,
          rateLimiting: true,
          emailNotifications: true
        },
        limits: {
          freeUsers: { contentPerMonth: 100, apiCallsPerHour: 50 },
          proUsers: { contentPerMonth: 1000, apiCallsPerHour: 500 },
          enterpriseUsers: { contentPerMonth: -1, apiCallsPerHour: 2000 }
        },
        maintenance: {
          enabled: this.maintenanceMode,
          scheduledDowntime: null,
          lastBackup: await this.getLastBackupInfo()
        },
        integrations: {
          email: emailService.healthCheck(),
          redis: redisService.isConnected,
          translation: translationService.getStatistics()
        }
      };

    } catch (error) {
      logger.error('Failed to get system configuration', error, { category: 'admin' });
      throw error;
    }
  }

  // Maintenance Mode Management
  async enableMaintenanceMode(adminId, message = 'System maintenance in progress') {
    try {
      this.maintenanceMode = {
        enabled: true,
        enabledAt: new Date().toISOString(),
        enabledBy: adminId,
        message,
        estimatedDuration: null
      };

      // Notify all connected users
      await this.notifyMaintenanceMode(true, message);

      logger.warn('Maintenance mode enabled', {
        category: 'admin',
        adminId,
        message
      });

      return this.maintenanceMode;

    } catch (error) {
      logger.error('Failed to enable maintenance mode', error, { category: 'admin' });
      throw error;
    }
  }

  async disableMaintenanceMode(adminId) {
    try {
      const previousMode = this.maintenanceMode;
      this.maintenanceMode = false;

      // Notify users that system is back online
      await this.notifyMaintenanceMode(false);

      logger.info('Maintenance mode disabled', {
        category: 'admin',
        adminId,
        duration: previousMode ? 
          Date.now() - new Date(previousMode.enabledAt).getTime() : 0
      });

      return { enabled: false, disabledAt: new Date().toISOString() };

    } catch (error) {
      logger.error('Failed to disable maintenance mode', error, { category: 'admin' });
      throw error;
    }
  }

  // Backup and Recovery Management
  async triggerBackup(type = 'manual', adminId = null) {
    try {
      logger.info('Manual backup triggered by admin', {
        category: 'admin',
        type,
        adminId
      });

      const result = await backupSystem.performBackup({
        type,
        triggeredBy: adminId,
        priority: 'high'
      });

      return result;

    } catch (error) {
      logger.error('Failed to trigger backup', error, { category: 'admin' });
      throw error;
    }
  }

  async getBackupHistory(limit = 20) {
    try {
      // This would query backup history from database or logs
      // For now, return mock structure
      return {
        backups: [],
        stats: {
          total: 0,
          successful: 0,
          failed: 0,
          avgSize: 0,
          lastBackup: null
        }
      };

    } catch (error) {
      logger.error('Failed to get backup history', error, { category: 'admin' });
      return { backups: [], stats: {} };
    }
  }

  // Analytics and Reporting
  async generateSystemReport(type = 'daily', dateRange = {}) {
    try {
      const report = {
        type,
        generatedAt: new Date().toISOString(),
        dateRange,
        sections: {
          overview: await this.getSystemOverview(),
          users: await this.getUserStatistics(),
          content: await this.getContentStatistics(),
          performance: await this.getPerformanceMetrics(),
          security: await this.getSecurityReport(),
          financials: await this.getFinancialReport()
        }
      };

      return report;

    } catch (error) {
      logger.error('Failed to generate system report', error, { category: 'admin' });
      throw error;
    }
  }

  // Security and Audit Functions
  async getSecurityReport() {
    try {
      return {
        failedLogins: await this.getFailedLoginAttempts(),
        suspiciousActivity: await this.getSuspiciousActivity(),
        moderationActions: await this.getRecentModerationActions(),
        apiAbuse: await this.getAPIAbuseReport(),
        systemAlerts: this.getActiveAlerts().filter(alert => 
          alert.category === 'security'
        )
      };

    } catch (error) {
      logger.error('Failed to get security report', error, { category: 'admin' });
      return {};
    }
  }

  // Alert System
  startAlertSystem() {
    setInterval(async () => {
      await this.checkSystemAlerts();
    }, 60000); // Check every minute
  }

  async checkSystemAlerts() {
    try {
      const health = await this.getSystemHealth();
      const performance = await this.getPerformanceMetrics();
      
      // Check resource usage
      if (performance.system?.memory?.heapUsed) {
        const memoryUsage = (performance.system.memory.heapUsed / 
          performance.system.memory.heapTotal) * 100;
        
        if (memoryUsage > ADMIN_CONFIG.thresholds.memoryUsage) {
          this.createAlert('warning', 'High memory usage detected', {
            usage: `${memoryUsage.toFixed(2)}%`,
            threshold: `${ADMIN_CONFIG.thresholds.memoryUsage}%`
          });
        }
      }

      // Check service health
      if (health.overall !== 'healthy') {
        this.createAlert('critical', `System health is ${health.overall}`, {
          services: Object.keys(health.services || {})
            .filter(key => health.services[key].status !== 'healthy')
        });
      }

    } catch (error) {
      logger.error('Failed to check system alerts', error, { category: 'admin' });
    }
  }

  createAlert(level, message, metadata = {}) {
    const alert = {
      id: Date.now(),
      level,
      message,
      metadata,
      createdAt: new Date().toISOString(),
      acknowledged: false
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    logger.warn('System alert created', {
      category: 'admin',
      level,
      message,
      metadata
    });

    return alert;
  }

  getActiveAlerts() {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  acknowledgeAlert(alertId, adminId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
      alert.acknowledgedBy = adminId;
    }
    return alert;
  }

  // Utility Functions
  calculateRetentionRate(users, days) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const eligibleUsers = users.filter(u => 
      new Date(u.created_at) <= cutoffDate
    );
    const activeUsers = eligibleUsers.filter(u => 
      u.last_login_at && new Date(u.last_login_at) > cutoffDate
    );
    
    return eligibleUsers.length > 0 ? 
      (activeUsers.length / eligibleUsers.length) * 100 : 0;
  }

  async getTopContentCreators(content) {
    const creatorCounts = {};
    content.forEach(c => {
      creatorCounts[c.user_id] = (creatorCounts[c.user_id] || 0) + 1;
    });

    const top10 = Object.entries(creatorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    return top10.map(([userId, count]) => ({ userId, count }));
  }

  async getSystemResources() {
    const memoryUsage = process.memoryUsage();
    
    return {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      uptime: process.uptime(),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    };
  }

  startSystemMonitoring() {
    setInterval(() => {
      this.systemStats.set('timestamp', Date.now());
      this.systemStats.set('memory', process.memoryUsage());
      this.systemStats.set('uptime', process.uptime());
    }, ADMIN_CONFIG.refresh.systemStats);
  }

  setupMaintenanceMode() {
    // This would integrate with your Express app to show maintenance pages
    // when maintenanceMode is enabled
  }

  async notifyMaintenanceMode(enabled, message = '') {
    // This would send WebSocket notifications to all connected users
    // about maintenance mode status
  }

  // Placeholder methods for missing functionality
  async getCPUUsage() { return 0; }
  async getEventLoopMetrics() { return {}; }
  async getGCMetrics() { return {}; }
  async getModerationQueue() { return []; }
  async getRecentModerationActions() { return []; }
  async getLastBackupInfo() { return null; }
  async getFailedLoginAttempts() { return []; }
  async getSuspiciousActivity() { return []; }
  async getAPIAbuseReport() { return {}; }
  async getFinancialReport() { return {}; }
}

// Create singleton instance
export const adminDashboard = new AdminDashboard();

// Export convenience methods
export const {
  getSystemOverview,
  getUserStatistics,
  getUsers,
  updateUser,
  suspendUser,
  getContentModeration,
  enableMaintenanceMode,
  disableMaintenanceMode,
  triggerBackup,
  generateSystemReport,
  getActiveAlerts,
  acknowledgeAlert
} = adminDashboard;

export default adminDashboard;