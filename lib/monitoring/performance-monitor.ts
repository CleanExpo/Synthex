/**
 * Performance Monitoring Service
 * Server-side performance metrics collection and reporting
 *
 * @task UNI-426 - Implement Performance Monitoring Suite
 */

import { getRedisClient } from '../redis-client';

// ============================================================================
// TYPES
// ============================================================================

export interface APIMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userId?: string;
  requestId?: string;
  error?: string;
}

export interface SystemMetrics {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    heapUsedPercent: number;
  };
  cpu?: {
    user: number;
    system: number;
  };
  uptime: number;
  activeConnections?: number;
}

export interface DatabaseMetrics {
  queryTime: number;
  query: string;
  timestamp: number;
  rowsAffected?: number;
  cached?: boolean;
}

export interface PerformanceReport {
  period: string;
  startTime: number;
  endTime: number;
  api: {
    totalRequests: number;
    averageResponseTime: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    errorRate: number;
    slowestEndpoints: Array<{
      endpoint: string;
      avgTime: number;
      count: number;
    }>;
    statusCodeDistribution: Record<string, number>;
  };
  system: {
    avgMemoryUsage: number;
    peakMemoryUsage: number;
    avgCpuUsage?: number;
  };
  database: {
    totalQueries: number;
    avgQueryTime: number;
    slowQueries: number;
    cacheHitRate: number;
  };
}

export interface AlertThresholds {
  responseTime: number; // ms
  errorRate: number; // percentage
  memoryUsage: number; // percentage
  cpuUsage: number; // percentage
  slowQueryTime: number; // ms
}

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metricsBuffer: APIMetrics[] = [];
  private systemMetricsBuffer: SystemMetrics[] = [];
  private dbMetricsBuffer: DatabaseMetrics[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private systemMonitorInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();

  private readonly BUFFER_SIZE = 1000;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds
  private readonly SYSTEM_MONITOR_INTERVAL = 10000; // 10 seconds
  private readonly METRICS_TTL = 86400; // 24 hours in seconds

  private thresholds: AlertThresholds = {
    responseTime: 1000, // 1 second
    errorRate: 5, // 5%
    memoryUsage: 85, // 85%
    cpuUsage: 80, // 80%
    slowQueryTime: 500, // 500ms
  };

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // ============================================================================
  // METRICS COLLECTION
  // ============================================================================

  /**
   * Record API request metrics
   */
  recordAPIMetrics(metrics: Omit<APIMetrics, 'timestamp'>): void {
    const fullMetrics: APIMetrics = {
      ...metrics,
      timestamp: Date.now(),
    };

    this.metricsBuffer.push(fullMetrics);

    // Check for alerts
    this.checkAPIAlerts(fullMetrics);

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
      this.flushAPIMetrics();
    }
  }

  /**
   * Record database query metrics
   */
  recordDatabaseMetrics(metrics: Omit<DatabaseMetrics, 'timestamp'>): void {
    const fullMetrics: DatabaseMetrics = {
      ...metrics,
      timestamp: Date.now(),
    };

    this.dbMetricsBuffer.push(fullMetrics);

    // Check for slow queries
    if (metrics.queryTime > this.thresholds.slowQueryTime) {
      this.logSlowQuery(fullMetrics);
    }

    // Flush if buffer is full
    if (this.dbMetricsBuffer.length >= this.BUFFER_SIZE) {
      this.flushDatabaseMetrics();
    }
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): SystemMetrics {
    const memory = process.memoryUsage();
    const uptime = process.uptime();

    const metrics: SystemMetrics = {
      timestamp: Date.now(),
      memory: {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        rss: memory.rss,
        heapUsedPercent: (memory.heapUsed / memory.heapTotal) * 100,
      },
      uptime,
    };

    // Check for memory alerts
    this.checkMemoryAlerts(metrics);

    return metrics;
  }

  // ============================================================================
  // MONITORING LIFECYCLE
  // ============================================================================

  private startMonitoring(): void {
    // Start periodic flushing
    this.flushInterval = setInterval(() => {
      this.flushAllMetrics();
    }, this.FLUSH_INTERVAL);

    // Start system monitoring
    this.systemMonitorInterval = setInterval(() => {
      const metrics = this.collectSystemMetrics();
      this.systemMetricsBuffer.push(metrics);

      if (this.systemMetricsBuffer.length >= 100) {
        this.flushSystemMetrics();
      }
    }, this.SYSTEM_MONITOR_INTERVAL);

    // Ensure cleanup on exit
    process.on('beforeExit', () => this.shutdown());
  }

  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    if (this.systemMonitorInterval) {
      clearInterval(this.systemMonitorInterval);
      this.systemMonitorInterval = null;
    }

    // Final flush
    this.flushAllMetrics();
  }

  // ============================================================================
  // METRICS STORAGE
  // ============================================================================

  private async flushAllMetrics(): Promise<void> {
    await Promise.all([
      this.flushAPIMetrics(),
      this.flushSystemMetrics(),
      this.flushDatabaseMetrics(),
    ]);
  }

  private async flushAPIMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      const redis = getRedisClient();
      const key = `perf:api:${this.getTimeSlot()}`;

      // Store as JSON array
      const existing = await redis.get(key);
      const existingMetrics = existing ? JSON.parse(existing) : [];
      const combined = [...existingMetrics, ...metrics];

      await redis.setex(key, this.METRICS_TTL, JSON.stringify(combined));
    } catch (error) {
      // Re-add metrics to buffer on failure
      this.metricsBuffer.push(...metrics);
      console.error('Failed to flush API metrics:', error);
    }
  }

  private async flushSystemMetrics(): Promise<void> {
    if (this.systemMetricsBuffer.length === 0) return;

    const metrics = [...this.systemMetricsBuffer];
    this.systemMetricsBuffer = [];

    try {
      const redis = getRedisClient();
      const key = `perf:system:${this.getTimeSlot()}`;

      const existing = await redis.get(key);
      const existingMetrics = existing ? JSON.parse(existing) : [];
      const combined = [...existingMetrics, ...metrics];

      await redis.setex(key, this.METRICS_TTL, JSON.stringify(combined));
    } catch (error) {
      this.systemMetricsBuffer.push(...metrics);
      console.error('Failed to flush system metrics:', error);
    }
  }

  private async flushDatabaseMetrics(): Promise<void> {
    if (this.dbMetricsBuffer.length === 0) return;

    const metrics = [...this.dbMetricsBuffer];
    this.dbMetricsBuffer = [];

    try {
      const redis = getRedisClient();
      const key = `perf:db:${this.getTimeSlot()}`;

      const existing = await redis.get(key);
      const existingMetrics = existing ? JSON.parse(existing) : [];
      const combined = [...existingMetrics, ...metrics];

      await redis.setex(key, this.METRICS_TTL, JSON.stringify(combined));
    } catch (error) {
      this.dbMetricsBuffer.push(...metrics);
      console.error('Failed to flush database metrics:', error);
    }
  }

  private getTimeSlot(): string {
    // 5-minute time slots
    const now = new Date();
    const slot = Math.floor(now.getTime() / (5 * 60 * 1000));
    return `${now.toISOString().split('T')[0]}_${slot}`;
  }

  // ============================================================================
  // ALERTS
  // ============================================================================

  private checkAPIAlerts(metrics: APIMetrics): void {
    if (metrics.responseTime > this.thresholds.responseTime) {
      this.logAlert('SLOW_RESPONSE', {
        endpoint: metrics.endpoint,
        responseTime: metrics.responseTime,
        threshold: this.thresholds.responseTime,
      });
    }

    if (metrics.statusCode >= 500) {
      this.logAlert('SERVER_ERROR', {
        endpoint: metrics.endpoint,
        statusCode: metrics.statusCode,
        error: metrics.error,
      });
    }
  }

  private checkMemoryAlerts(metrics: SystemMetrics): void {
    if (metrics.memory.heapUsedPercent > this.thresholds.memoryUsage) {
      this.logAlert('HIGH_MEMORY', {
        usage: metrics.memory.heapUsedPercent,
        threshold: this.thresholds.memoryUsage,
      });
    }
  }

  private logSlowQuery(metrics: DatabaseMetrics): void {
    this.logAlert('SLOW_QUERY', {
      queryTime: metrics.queryTime,
      query: metrics.query.substring(0, 100),
      threshold: this.thresholds.slowQueryTime,
    });
  }

  private logAlert(type: string, data: Record<string, any>): void {
    const alert = {
      type,
      timestamp: new Date().toISOString(),
      ...data,
    };

    console.warn(`[PERF_ALERT] ${type}:`, JSON.stringify(alert));

    // Store alert for later retrieval
    this.storeAlert(alert).catch(console.error);
  }

  private async storeAlert(alert: Record<string, any>): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = 'perf:alerts:recent';

      // Add to list, keep last 100 alerts
      await redis.lpush(key, JSON.stringify(alert));
      await redis.ltrim(key, 0, 99);
    } catch (error) {
      console.error('Failed to store alert:', error);
    }
  }

  // ============================================================================
  // REPORTING
  // ============================================================================

  /**
   * Generate performance report for a time period
   */
  async generateReport(periodMinutes: number = 60): Promise<PerformanceReport> {
    const endTime = Date.now();
    const startTime = endTime - periodMinutes * 60 * 1000;

    const [apiMetrics, systemMetrics, dbMetrics] = await Promise.all([
      this.getAPIMetrics(startTime, endTime),
      this.getSystemMetrics(startTime, endTime),
      this.getDatabaseMetrics(startTime, endTime),
    ]);

    // Calculate API stats
    const responseTimes = apiMetrics.map((m) => m.responseTime).sort((a, b) => a - b);
    const totalRequests = apiMetrics.length;
    const errors = apiMetrics.filter((m) => m.statusCode >= 400).length;

    // Endpoint aggregation
    const endpointStats = new Map<string, { times: number[]; count: number }>();
    apiMetrics.forEach((m) => {
      const key = `${m.method} ${m.endpoint}`;
      const stat = endpointStats.get(key) || { times: [], count: 0 };
      stat.times.push(m.responseTime);
      stat.count++;
      endpointStats.set(key, stat);
    });

    const slowestEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stat]) => ({
        endpoint,
        avgTime: stat.times.reduce((a, b) => a + b, 0) / stat.times.length,
        count: stat.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    // Status code distribution
    const statusCodes: Record<string, number> = {};
    apiMetrics.forEach((m) => {
      const group = `${Math.floor(m.statusCode / 100)}xx`;
      statusCodes[group] = (statusCodes[group] || 0) + 1;
    });

    // System stats
    const memoryUsages = systemMetrics.map((m) => m.memory.heapUsedPercent);

    // Database stats
    const queryTimes = dbMetrics.map((m) => m.queryTime);
    const slowQueries = dbMetrics.filter((m) => m.queryTime > this.thresholds.slowQueryTime).length;
    const cachedQueries = dbMetrics.filter((m) => m.cached).length;

    return {
      period: `${periodMinutes} minutes`,
      startTime,
      endTime,
      api: {
        totalRequests,
        averageResponseTime: totalRequests > 0 ? responseTimes.reduce((a, b) => a + b, 0) / totalRequests : 0,
        p50: this.percentile(responseTimes, 50),
        p90: this.percentile(responseTimes, 90),
        p95: this.percentile(responseTimes, 95),
        p99: this.percentile(responseTimes, 99),
        errorRate: totalRequests > 0 ? (errors / totalRequests) * 100 : 0,
        slowestEndpoints,
        statusCodeDistribution: statusCodes,
      },
      system: {
        avgMemoryUsage: memoryUsages.length > 0 ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length : 0,
        peakMemoryUsage: memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0,
      },
      database: {
        totalQueries: dbMetrics.length,
        avgQueryTime: queryTimes.length > 0 ? queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length : 0,
        slowQueries,
        cacheHitRate: dbMetrics.length > 0 ? (cachedQueries / dbMetrics.length) * 100 : 0,
      },
    };
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  }

  private async getAPIMetrics(startTime: number, endTime: number): Promise<APIMetrics[]> {
    try {
      const redis = getRedisClient();
      const keys = await this.getMetricKeys('perf:api:', startTime, endTime);

      const allMetrics: APIMetrics[] = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const metrics = JSON.parse(data) as APIMetrics[];
          allMetrics.push(...metrics.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime));
        }
      }

      // Include buffer metrics
      allMetrics.push(
        ...this.metricsBuffer.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime)
      );

      return allMetrics;
    } catch (error) {
      console.error('Failed to get API metrics:', error);
      return this.metricsBuffer.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime);
    }
  }

  private async getSystemMetrics(startTime: number, endTime: number): Promise<SystemMetrics[]> {
    try {
      const redis = getRedisClient();
      const keys = await this.getMetricKeys('perf:system:', startTime, endTime);

      const allMetrics: SystemMetrics[] = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const metrics = JSON.parse(data) as SystemMetrics[];
          allMetrics.push(...metrics.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime));
        }
      }

      allMetrics.push(
        ...this.systemMetricsBuffer.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime)
      );

      return allMetrics;
    } catch (error) {
      console.error('Failed to get system metrics:', error);
      return this.systemMetricsBuffer.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime);
    }
  }

  private async getDatabaseMetrics(startTime: number, endTime: number): Promise<DatabaseMetrics[]> {
    try {
      const redis = getRedisClient();
      const keys = await this.getMetricKeys('perf:db:', startTime, endTime);

      const allMetrics: DatabaseMetrics[] = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const metrics = JSON.parse(data) as DatabaseMetrics[];
          allMetrics.push(...metrics.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime));
        }
      }

      allMetrics.push(
        ...this.dbMetricsBuffer.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime)
      );

      return allMetrics;
    } catch (error) {
      console.error('Failed to get database metrics:', error);
      return this.dbMetricsBuffer.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime);
    }
  }

  private async getMetricKeys(prefix: string, startTime: number, endTime: number): Promise<string[]> {
    // Generate potential keys for the time range
    const keys: string[] = [];
    const startSlot = Math.floor(startTime / (5 * 60 * 1000));
    const endSlot = Math.floor(endTime / (5 * 60 * 1000));

    for (let slot = startSlot; slot <= endSlot; slot++) {
      const date = new Date(slot * 5 * 60 * 1000);
      keys.push(`${prefix}${date.toISOString().split('T')[0]}_${slot}`);
    }

    return keys;
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  setThresholds(thresholds: Partial<AlertThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(count: number = 20): Promise<any[]> {
    try {
      const redis = getRedisClient();
      const alerts = await redis.lrange('perf:alerts:recent', 0, count - 1);
      return alerts.map((a) => JSON.parse(a));
    } catch (error) {
      console.error('Failed to get alerts:', error);
      return [];
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    uptime: number;
    bufferedMetrics: { api: number; system: number; db: number };
    thresholds: AlertThresholds;
  } {
    return {
      uptime: Date.now() - this.startTime,
      bufferedMetrics: {
        api: this.metricsBuffer.length,
        system: this.systemMetricsBuffer.length,
        db: this.dbMetricsBuffer.length,
      },
      thresholds: this.thresholds,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const performanceMonitor = PerformanceMonitor.getInstance();

/**
 * Middleware helper to track API response time
 */
export function trackAPIResponse(
  endpoint: string,
  method: string,
  statusCode: number,
  startTime: number,
  userId?: string,
  requestId?: string,
  error?: string
): void {
  performanceMonitor.recordAPIMetrics({
    endpoint,
    method,
    statusCode,
    responseTime: Date.now() - startTime,
    userId,
    requestId,
    error,
  });
}

/**
 * Track database query performance
 */
export function trackDatabaseQuery(
  query: string,
  queryTime: number,
  rowsAffected?: number,
  cached?: boolean
): void {
  performanceMonitor.recordDatabaseMetrics({
    query,
    queryTime,
    rowsAffected,
    cached,
  });
}

export default performanceMonitor;
