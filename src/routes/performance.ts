import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import PerformanceService from '../services/performance';
import { getCacheStats, clearCache, clearUserCache } from '../middleware/caching';
import { getCompressionStats } from '../middleware/compression';
import { apiResponse } from '../utils/apiResponse';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Middleware to check admin permissions for sensitive operations
const requireAdmin = (req: Request, res: Response, next: Function) => {
  const userRole = (req.user as any)?.role || 'user';
  
  if (userRole !== 'admin' && userRole !== 'superadmin') {
    return apiResponse.error(res, 'Admin permissions required', 403);
  }
  
  next();
};

/**
 * @route   GET /api/v1/performance/stats
 * @desc    Get performance statistics
 * @access  Private (Admin)
 */
router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : 3600000; // Default 1 hour
    const stats = PerformanceService.getStats(timeRange);
    
    return apiResponse.success(res, stats, 'Performance statistics retrieved successfully');
  } catch (error) {
    console.error('Error fetching performance stats:', error);
    return apiResponse.error(res, 'Failed to fetch performance statistics');
  }
});

/**
 * @route   GET /api/v1/performance/health
 * @desc    Get system health status
 * @access  Private
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = PerformanceService.getHealthStatus();
    
    // Set appropriate HTTP status based on health
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 503 : 500;
    
    return res.status(statusCode).json({
      success: true,
      data: health,
      message: `System is ${health.status}`
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    return apiResponse.error(res, 'Failed to check system health', 500);
  }
});

/**
 * @route   GET /api/v1/performance/endpoint/:endpoint
 * @desc    Get performance stats for specific endpoint
 * @access  Private (Admin)
 */
router.get('/endpoint/*endpoint', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get the full path after /endpoint/
    const rawEndpoint = req.params.endpoint;
    const endpoint = rawEndpoint.startsWith('/') ? rawEndpoint : `/${rawEndpoint}`;
    const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : 3600000;
    
    const stats = PerformanceService.getEndpointStats(endpoint, timeRange);
    
    if (!stats) {
      return apiResponse.notFound(res, 'No performance data found for this endpoint');
    }
    
    return apiResponse.success(res, stats, 'Endpoint performance statistics retrieved successfully');
  } catch (error) {
    console.error('Error fetching endpoint stats:', error);
    return apiResponse.error(res, 'Failed to fetch endpoint statistics');
  }
});

/**
 * @route   GET /api/v1/performance/cache/stats
 * @desc    Get cache statistics
 * @access  Private (Admin)
 */
router.get('/cache/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const cacheStats = getCacheStats();
    const compressionStats = getCompressionStats();
    
    return apiResponse.success(res, {
      cache: cacheStats,
      compression: compressionStats
    }, 'Cache statistics retrieved successfully');
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    return apiResponse.error(res, 'Failed to fetch cache statistics');
  }
});

/**
 * @route   POST /api/v1/performance/cache/clear
 * @desc    Clear cache
 * @access  Private (Admin)
 */
router.post('/cache/clear', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { pattern, userId } = req.body;
    
    let clearedCount = 0;
    
    if (userId) {
      clearedCount = clearUserCache(userId);
    } else if (pattern) {
      clearedCount = clearCache(pattern);
    } else {
      clearedCount = clearCache(); // Clear all
    }
    
    return apiResponse.success(res, {
      clearedCount
    }, `${clearedCount} cache entries cleared`);
  } catch (error) {
    console.error('Error clearing cache:', error);
    return apiResponse.error(res, 'Failed to clear cache');
  }
});

/**
 * @route   POST /api/v1/performance/metrics/clear
 * @desc    Clear old performance metrics
 * @access  Private (Admin)
 */
router.post('/metrics/clear', requireAdmin, async (req: Request, res: Response) => {
  try {
    const olderThanMs = req.body.olderThanMs || 86400000; // Default 24 hours
    const clearedCount = PerformanceService.clearMetrics(olderThanMs);
    
    return apiResponse.success(res, {
      clearedCount
    }, `${clearedCount} old metrics cleared`);
  } catch (error) {
    console.error('Error clearing metrics:', error);
    return apiResponse.error(res, 'Failed to clear metrics');
  }
});

/**
 * @route   GET /api/v1/performance/export
 * @desc    Export performance metrics
 * @access  Private (Admin)
 */
router.get('/export', requireAdmin, async (req: Request, res: Response) => {
  try {
    const format = req.query.format as 'json' | 'csv' || 'json';
    const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : undefined;
    
    const exportData = PerformanceService.exportMetrics(format, timeRange);
    
    // Set appropriate headers for download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `synthex-performance-${timestamp}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    
    return res.send(exportData);
  } catch (error) {
    console.error('Error exporting metrics:', error);
    return apiResponse.error(res, 'Failed to export metrics');
  }
});

/**
 * @route   GET /api/v1/performance/system
 * @desc    Get system information and resources
 * @access  Private (Admin)
 */
router.get('/system', requireAdmin, async (req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const systemInfo = {
      uptime: process.uptime(),
      memoryUsage: {
        ...memoryUsage,
        heapUsedPercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        rssInMB: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedInMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalInMB: Math.round(memoryUsage.heapTotal / 1024 / 1024)
      },
      cpuUsage: {
        user: cpuUsage.user / 1000000, // Convert to milliseconds
        system: cpuUsage.system / 1000000
      },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid
    };
    
    return apiResponse.success(res, systemInfo, 'System information retrieved successfully');
  } catch (error) {
    console.error('Error fetching system info:', error);
    return apiResponse.error(res, 'Failed to fetch system information');
  }
});

/**
 * @route   GET /api/v1/performance/trends
 * @desc    Get performance trends over time
 * @access  Private (Admin)
 */
router.get('/trends', requireAdmin, async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24; // Default 24 hours
    const intervals = parseInt(req.query.intervals as string) || 24; // Default 24 data points
    
    const intervalMs = (hours * 60 * 60 * 1000) / intervals;
    const trends = [];
    
    for (let i = intervals - 1; i >= 0; i--) {
      const endTime = Date.now() - (i * intervalMs);
      const startTime = endTime - intervalMs;
      
      const stats = PerformanceService.getStats(intervalMs);
      
      trends.push({
        timestamp: new Date(endTime),
        responseTime: stats.averageResponseTime,
        requestsPerSecond: stats.requestsPerSecond,
        errorRate: stats.errorRate,
        memoryUsagePercent: (stats.memoryUsage.current.heapUsed / stats.memoryUsage.current.heapTotal) * 100
      });
    }
    
    return apiResponse.success(res, {
      trends,
      interval: intervalMs,
      hours
    }, 'Performance trends retrieved successfully');
  } catch (error) {
    console.error('Error fetching performance trends:', error);
    return apiResponse.error(res, 'Failed to fetch performance trends');
  }
});

/**
 * @route   GET /api/v1/performance/alerts
 * @desc    Get performance alerts and thresholds
 * @access  Private (Admin)
 */
router.get('/alerts', requireAdmin, async (req: Request, res: Response) => {
  try {
    const health = PerformanceService.getHealthStatus();
    const stats = PerformanceService.getStats(300000); // Last 5 minutes
    
    const thresholds = {
      responseTime: { warning: 2000, critical: 5000 },
      errorRate: { warning: 0.05, critical: 0.1 },
      memoryUsage: { warning: 0.8, critical: 0.9 },
      p95ResponseTime: { warning: 3000, critical: 8000 }
    };
    
    const alerts = [];
    
    // Check response time
    if (stats.averageResponseTime > thresholds.responseTime.critical) {
      alerts.push({
        type: 'critical',
        metric: 'response_time',
        message: `Average response time is ${stats.averageResponseTime}ms (threshold: ${thresholds.responseTime.critical}ms)`,
        value: stats.averageResponseTime,
        threshold: thresholds.responseTime.critical
      });
    } else if (stats.averageResponseTime > thresholds.responseTime.warning) {
      alerts.push({
        type: 'warning',
        metric: 'response_time',
        message: `Average response time is elevated: ${stats.averageResponseTime}ms`,
        value: stats.averageResponseTime,
        threshold: thresholds.responseTime.warning
      });
    }
    
    // Check error rate
    if (stats.errorRate > thresholds.errorRate.critical) {
      alerts.push({
        type: 'critical',
        metric: 'error_rate',
        message: `Error rate is ${(stats.errorRate * 100).toFixed(2)}% (threshold: ${thresholds.errorRate.critical * 100}%)`,
        value: stats.errorRate,
        threshold: thresholds.errorRate.critical
      });
    } else if (stats.errorRate > thresholds.errorRate.warning) {
      alerts.push({
        type: 'warning',
        metric: 'error_rate',
        message: `Error rate is elevated: ${(stats.errorRate * 100).toFixed(2)}%`,
        value: stats.errorRate,
        threshold: thresholds.errorRate.warning
      });
    }
    
    // Check memory usage
    const memoryPercent = health.metrics.memoryUsagePercent / 100;
    if (memoryPercent > thresholds.memoryUsage.critical) {
      alerts.push({
        type: 'critical',
        metric: 'memory_usage',
        message: `Memory usage is ${health.metrics.memoryUsagePercent.toFixed(2)}% (threshold: ${thresholds.memoryUsage.critical * 100}%)`,
        value: memoryPercent,
        threshold: thresholds.memoryUsage.critical
      });
    } else if (memoryPercent > thresholds.memoryUsage.warning) {
      alerts.push({
        type: 'warning',
        metric: 'memory_usage',
        message: `Memory usage is elevated: ${health.metrics.memoryUsagePercent.toFixed(2)}%`,
        value: memoryPercent,
        threshold: thresholds.memoryUsage.warning
      });
    }
    
    return apiResponse.success(res, {
      alerts,
      thresholds,
      systemStatus: health.status
    }, 'Performance alerts retrieved successfully');
  } catch (error) {
    console.error('Error fetching performance alerts:', error);
    return apiResponse.error(res, 'Failed to fetch performance alerts');
  }
});

export default router;
