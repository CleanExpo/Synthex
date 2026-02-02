/**
 * Health Dashboard
 * Aggregated system health and status information
 *
 * @task UNI-423 - Monitoring & Observability Epic
 *
 * Usage:
 * ```typescript
 * import { getSystemHealth, HealthStatus } from '@/lib/observability';
 *
 * const health = await getSystemHealth();
 * console.log(health.status); // 'healthy' | 'degraded' | 'unhealthy'
 * ```
 */

import { checkDatabaseHealth, getPoolMetrics } from '@/lib/prisma';
import performanceMonitor from '@/lib/monitoring/performance-monitor';
import { getErrorStats, ErrorSeverity } from './error-tracker';

// ============================================================================
// TYPES
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  components: ComponentHealth[];
  metrics: {
    memory: {
      heapUsedMB: number;
      heapTotalMB: number;
      rssMB: number;
      usagePercent: number;
    };
    errors: {
      last5Minutes: number;
      last1Hour: number;
      bySeverity: Record<string, number>;
    };
    api: {
      requestsPerMinute: number;
      averageResponseTime: number;
      errorRate: number;
    };
  };
  alerts: string[];
}

// ============================================================================
// HEALTH CHECK FUNCTIONS
// ============================================================================

/**
 * Check database health
 */
async function checkDatabase(): Promise<ComponentHealth> {
  try {
    const result = await checkDatabaseHealth();
    const poolMetrics = getPoolMetrics();

    if (!result.healthy) {
      return {
        name: 'database',
        status: 'unhealthy',
        message: result.error || 'Database connection failed',
        latency: result.latency,
      };
    }

    // Check for pool issues
    if (poolMetrics.errors > 10) {
      return {
        name: 'database',
        status: 'degraded',
        message: `High error count: ${poolMetrics.errors}`,
        latency: result.latency,
        details: poolMetrics as unknown as Record<string, unknown>,
      };
    }

    return {
      name: 'database',
      status: 'healthy',
      latency: result.latency,
      details: poolMetrics as unknown as Record<string, unknown>,
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check memory health
 */
function checkMemory(): ComponentHealth {
  const memory = process.memoryUsage();
  const heapPercent = (memory.heapUsed / memory.heapTotal) * 100;

  if (heapPercent > 90) {
    return {
      name: 'memory',
      status: 'unhealthy',
      message: `Heap usage critical: ${heapPercent.toFixed(1)}%`,
      details: {
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
        rssMB: Math.round(memory.rss / 1024 / 1024),
      },
    };
  }

  if (heapPercent > 75) {
    return {
      name: 'memory',
      status: 'degraded',
      message: `Heap usage high: ${heapPercent.toFixed(1)}%`,
      details: {
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
      },
    };
  }

  return {
    name: 'memory',
    status: 'healthy',
    details: {
      heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
      heapPercent: Math.round(heapPercent),
    },
  };
}

/**
 * Check API performance health
 */
async function checkApiPerformance(): Promise<ComponentHealth> {
  try {
    const report = await performanceMonitor.generateReport(5);

    if (report.api.errorRate > 10) {
      return {
        name: 'api',
        status: 'unhealthy',
        message: `High error rate: ${report.api.errorRate.toFixed(1)}%`,
        details: {
          errorRate: report.api.errorRate,
          p95: report.api.p95,
        },
      };
    }

    if (report.api.errorRate > 5 || report.api.p95 > 2000) {
      return {
        name: 'api',
        status: 'degraded',
        message: report.api.errorRate > 5
          ? `Elevated error rate: ${report.api.errorRate.toFixed(1)}%`
          : `Slow responses: p95 = ${report.api.p95}ms`,
        details: {
          errorRate: report.api.errorRate,
          p95: report.api.p95,
          totalRequests: report.api.totalRequests,
        },
      };
    }

    return {
      name: 'api',
      status: 'healthy',
      details: {
        requestsPerMinute: Math.round(report.api.totalRequests / 5),
        averageResponseTime: Math.round(report.api.averageResponseTime),
        errorRate: report.api.errorRate,
      },
    };
  } catch (error) {
    return {
      name: 'api',
      status: 'degraded',
      message: 'Unable to get API metrics',
    };
  }
}

/**
 * Check error tracking health
 */
function checkErrors(): ComponentHealth {
  const stats5min = getErrorStats(5);
  const stats1hour = getErrorStats(60);

  const criticalErrors = stats5min.bySeverity[ErrorSeverity.CRITICAL] || 0;
  const highErrors = stats5min.bySeverity[ErrorSeverity.HIGH] || 0;

  if (criticalErrors > 0) {
    return {
      name: 'errors',
      status: 'unhealthy',
      message: `${criticalErrors} critical errors in last 5 minutes`,
      details: {
        last5Minutes: stats5min.total,
        critical: criticalErrors,
        high: highErrors,
      },
    };
  }

  if (highErrors > 5 || stats5min.total > 50) {
    return {
      name: 'errors',
      status: 'degraded',
      message: `High error volume: ${stats5min.total} errors in last 5 minutes`,
      details: {
        last5Minutes: stats5min.total,
        last1Hour: stats1hour.total,
        high: highErrors,
      },
    };
  }

  return {
    name: 'errors',
    status: 'healthy',
    details: {
      last5Minutes: stats5min.total,
      last1Hour: stats1hour.total,
    },
  };
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Get comprehensive system health
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const startTime = Date.now();

  // Run all health checks in parallel
  const [database, apiPerformance] = await Promise.all([
    checkDatabase(),
    checkApiPerformance(),
  ]);

  const memory = checkMemory();
  const errors = checkErrors();

  const components: ComponentHealth[] = [
    database,
    memory,
    apiPerformance,
    errors,
  ];

  // Determine overall status
  const hasUnhealthy = components.some((c) => c.status === 'unhealthy');
  const hasDegraded = components.some((c) => c.status === 'degraded');

  let status: HealthStatus = 'healthy';
  if (hasUnhealthy) {
    status = 'unhealthy';
  } else if (hasDegraded) {
    status = 'degraded';
  }

  // Generate alerts
  const alerts: string[] = [];
  for (const component of components) {
    if (component.status !== 'healthy' && component.message) {
      alerts.push(`[${component.name.toUpperCase()}] ${component.message}`);
    }
  }

  // Get metrics
  const memoryUsage = process.memoryUsage();
  const errorStats5min = getErrorStats(5);
  const errorStats1hour = getErrorStats(60);

  let apiMetrics = { requestsPerMinute: 0, averageResponseTime: 0, errorRate: 0 };
  try {
    const report = await performanceMonitor.generateReport(5);
    apiMetrics = {
      requestsPerMinute: Math.round(report.api.totalRequests / 5),
      averageResponseTime: Math.round(report.api.averageResponseTime),
      errorRate: report.api.errorRate,
    };
  } catch {
    // Use defaults
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '2.0.1',
    environment: process.env.NODE_ENV || 'development',
    components,
    metrics: {
      memory: {
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
        usagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      errors: {
        last5Minutes: errorStats5min.total,
        last1Hour: errorStats1hour.total,
        bySeverity: errorStats5min.bySeverity,
      },
      api: apiMetrics,
    },
    alerts,
  };
}

/**
 * Get quick health status (for liveness/readiness probes)
 */
export async function getQuickHealth(): Promise<{
  status: HealthStatus;
  checks: { database: boolean; memory: boolean };
}> {
  const dbHealth = await checkDatabase();
  const memHealth = checkMemory();

  const status: HealthStatus =
    dbHealth.status === 'unhealthy' || memHealth.status === 'unhealthy'
      ? 'unhealthy'
      : dbHealth.status === 'degraded' || memHealth.status === 'degraded'
      ? 'degraded'
      : 'healthy';

  return {
    status,
    checks: {
      database: dbHealth.status !== 'unhealthy',
      memory: memHealth.status !== 'unhealthy',
    },
  };
}

/**
 * Format uptime as human-readable string
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default {
  getSystemHealth,
  getQuickHealth,
  formatUptime,
};
