import { Request, Response } from 'express';
import { performance } from 'perf_hooks';
import AuditService from './audit';

// Performance metrics interface
interface PerformanceMetric {
  id: string;
  timestamp: Date;
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  userAgent?: string;
  userId?: string;
  responseSize?: number;
  requestSize?: number;
}

interface PerformanceStats {
  averageResponseTime: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  requestsPerSecond: number;
  errorRate: number;
  totalRequests: number;
  slowestEndpoints: Array<{
    endpoint: string;
    averageTime: number;
    requests: number;
  }>;
  memoryUsage: {
    current: NodeJS.MemoryUsage;
    average: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
}

// In-memory storage for performance metrics (in production, use database)
const metrics: PerformanceMetric[] = [];
const MAX_METRICS = 10000; // Keep only last 10k metrics

// CPU usage tracking
let lastCpuUsage = process.cpuUsage();

export class PerformanceService {
  /**
   * Record a performance metric
   */
  static recordMetric(data: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    const metric: PerformanceMetric = {
      id: this.generateId(),
      timestamp: new Date(),
      ...data
    };

    metrics.push(metric);

    // Trim old metrics to prevent memory leak
    if (metrics.length > MAX_METRICS) {
      metrics.splice(0, metrics.length - MAX_METRICS);
    }

    // Log slow requests for immediate attention
    if (data.duration > 5000) { // 5 seconds
      console.warn(`Slow request detected: ${data.method} ${data.endpoint} - ${data.duration}ms`);
      
      // Log critical slow requests to audit
      if (data.duration > 10000) { // 10 seconds
        Promise.resolve(AuditService.log({
          userId: data.userId,
          action: 'slow_request_detected',
          resource: 'performance',
          details: {
            endpoint: data.endpoint,
            method: data.method,
            duration: data.duration,
            statusCode: data.statusCode
          },
          severity: 'high',
          category: 'system',
          outcome: 'warning'
        })).catch(console.error);
      }
    }
  }

  /**
   * Get performance statistics for a time period
   */
  static getStats(timeRange: number = 3600000): PerformanceStats { // Default 1 hour
    const now = Date.now();
    const cutoff = new Date(now - timeRange);
    
    const recentMetrics = metrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) {
      return this.getEmptyStats();
    }

    const durations = recentMetrics.map(m => m.duration).sort((a, b) => a - b);
    const errors = recentMetrics.filter(m => m.statusCode >= 400);
    
    // Calculate percentiles
    const p50 = this.percentile(durations, 0.5);
    const p90 = this.percentile(durations, 0.9);
    const p95 = this.percentile(durations, 0.95);
    const p99 = this.percentile(durations, 0.99);
    
    // Calculate RPS
    const timeSpanSeconds = timeRange / 1000;
    const requestsPerSecond = recentMetrics.length / timeSpanSeconds;
    
    // Slowest endpoints
    const endpointStats = this.groupBy(recentMetrics, 'endpoint');
    const slowestEndpoints = Object.entries(endpointStats)
      .map(([endpoint, metrics]) => ({
        endpoint,
        averageTime: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
        requests: metrics.length
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);
    
    // Memory usage stats
    const memoryStats = recentMetrics.map(m => m.memoryUsage);
    const currentMemory = process.memoryUsage();
    const averageMemory = this.averageMemoryUsage(memoryStats);
    const peakMemory = this.peakMemoryUsage(memoryStats);
    
    // CPU usage
    const currentCpuUsage = process.cpuUsage(lastCpuUsage);
    lastCpuUsage = process.cpuUsage();

    return {
      averageResponseTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p50,
      p90,
      p95,
      p99,
      requestsPerSecond,
      errorRate: errors.length / recentMetrics.length,
      totalRequests: recentMetrics.length,
      slowestEndpoints,
      memoryUsage: {
        current: currentMemory,
        average: averageMemory,
        peak: peakMemory
      },
      cpuUsage: {
        user: currentCpuUsage.user / 1000000, // Convert to milliseconds
        system: currentCpuUsage.system / 1000000
      }
    };
  }

  /**
   * Get performance metrics for a specific endpoint
   */
  static getEndpointStats(endpoint: string, timeRange: number = 3600000): any {
    const now = Date.now();
    const cutoff = new Date(now - timeRange);
    
    const endpointMetrics = metrics.filter(m => 
      m.endpoint === endpoint && m.timestamp >= cutoff
    );
    
    if (endpointMetrics.length === 0) {
      return null;
    }

    const durations = endpointMetrics.map(m => m.duration).sort((a, b) => a - b);
    const errors = endpointMetrics.filter(m => m.statusCode >= 400);
    const methods = this.groupBy(endpointMetrics, 'method');
    
    return {
      endpoint,
      totalRequests: endpointMetrics.length,
      averageResponseTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p50: this.percentile(durations, 0.5),
      p90: this.percentile(durations, 0.9),
      p95: this.percentile(durations, 0.95),
      p99: this.percentile(durations, 0.99),
      minResponseTime: Math.min(...durations),
      maxResponseTime: Math.max(...durations),
      errorRate: errors.length / endpointMetrics.length,
      errorCount: errors.length,
      methodBreakdown: Object.entries(methods).map(([method, metrics]) => ({
        method,
        count: metrics.length,
        averageTime: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
      })),
      statusCodes: this.groupBy(endpointMetrics, 'statusCode'),
      recentTrend: this.calculateTrend(endpointMetrics)
    };
  }

  /**
   * Get system health status
   */
  static getHealthStatus(): any {
    const stats = this.getStats(300000); // Last 5 minutes
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    const isTestEnv = process.env.NODE_ENV === 'test';
    
    // Determine health status
    let status = 'healthy';
    const issues: string[] = [];
    
    if (stats.averageResponseTime > 2000) {
      status = 'degraded';
      issues.push('High average response time');
    }
    
    if (stats.errorRate > 0.05) { // 5% error rate
      status = 'degraded';
      issues.push('High error rate');
    }
    
    if (stats.p95 > 5000) {
      status = 'degraded';
      issues.push('High P95 response time');
    }
    
    if (!isTestEnv && memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
      status = 'critical';
      issues.push('High memory usage');
    }
    
    return {
      status,
      issues,
      uptime,
      metrics: {
        responseTime: stats.averageResponseTime,
        errorRate: stats.errorRate,
        requestsPerSecond: stats.requestsPerSecond,
        memoryUsagePercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      timestamp: new Date()
    };
  }

  /**
   * Clear old metrics
   */
  static clearMetrics(olderThanMs: number = 86400000): number { // Default 24 hours
    if (olderThanMs <= 0) {
      const cleared = metrics.length;
      metrics.length = 0;
      return cleared;
    }

    const cutoff = new Date(Date.now() - olderThanMs);
    const initialLength = metrics.length;
    
    for (let i = metrics.length - 1; i >= 0; i--) {
      if (metrics[i].timestamp < cutoff) {
        metrics.splice(i, 1);
      }
    }
    
    return initialLength - metrics.length;
  }

  /**
   * Export metrics for external monitoring
   */
  static exportMetrics(format: 'json' | 'csv' = 'json', timeRange?: number): string {
    const metricsToExport = timeRange 
      ? metrics.filter(m => m.timestamp >= new Date(Date.now() - timeRange))
      : metrics;
    
    if (format === 'csv') {
      const headers = ['timestamp', 'endpoint', 'method', 'duration', 'statusCode', 'memoryUsed'];
      const rows = metricsToExport.map(m => [
        m.timestamp.toISOString(),
        m.endpoint,
        m.method,
        m.duration.toString(),
        m.statusCode.toString(),
        m.memoryUsage.heapUsed.toString()
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    return JSON.stringify(metricsToExport, null, 2);
  }

  // Helper methods
  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private static percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    if (p >= 0.99) {
      return values[values.length - 1];
    }

    const index = Math.floor(values.length * p) - 1;
    const safeIndex = Math.min(values.length - 1, Math.max(0, index));
    return values[safeIndex] || 0;
  }

  private static groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private static averageMemoryUsage(memoryStats: NodeJS.MemoryUsage[]): NodeJS.MemoryUsage {
    if (memoryStats.length === 0) return process.memoryUsage();
    
    const sum = memoryStats.reduce((acc, mem) => ({
      rss: acc.rss + mem.rss,
      heapTotal: acc.heapTotal + mem.heapTotal,
      heapUsed: acc.heapUsed + mem.heapUsed,
      external: acc.external + mem.external,
      arrayBuffers: acc.arrayBuffers + mem.arrayBuffers
    }), { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 });
    
    const count = memoryStats.length;
    return {
      rss: Math.round(sum.rss / count),
      heapTotal: Math.round(sum.heapTotal / count),
      heapUsed: Math.round(sum.heapUsed / count),
      external: Math.round(sum.external / count),
      arrayBuffers: Math.round(sum.arrayBuffers / count)
    };
  }

  private static peakMemoryUsage(memoryStats: NodeJS.MemoryUsage[]): NodeJS.MemoryUsage {
    if (memoryStats.length === 0) return process.memoryUsage();
    
    return memoryStats.reduce((peak, mem) => ({
      rss: Math.max(peak.rss, mem.rss),
      heapTotal: Math.max(peak.heapTotal, mem.heapTotal),
      heapUsed: Math.max(peak.heapUsed, mem.heapUsed),
      external: Math.max(peak.external, mem.external),
      arrayBuffers: Math.max(peak.arrayBuffers, mem.arrayBuffers)
    }));
  }

  private static calculateTrend(metrics: PerformanceMetric[]): 'improving' | 'degrading' | 'stable' {
    if (metrics.length < 10) return 'stable';
    
    // Compare first half vs second half
    const midpoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, midpoint);
    const secondHalf = metrics.slice(midpoint);
    
    const firstAvg = firstHalf.reduce((sum, m) => sum + m.duration, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, m) => sum + m.duration, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change < -0.1) return 'improving'; // 10% improvement
    if (change > 0.1) return 'degrading'; // 10% degradation
    return 'stable';
  }

  private static getEmptyStats(): PerformanceStats {
    return {
      averageResponseTime: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      totalRequests: 0,
      slowestEndpoints: [],
      memoryUsage: {
        current: process.memoryUsage(),
        average: process.memoryUsage(),
        peak: process.memoryUsage()
      },
      cpuUsage: {
        user: 0,
        system: 0
      }
    };
  }
}

/**
 * Performance monitoring middleware
 */
export function performanceMiddleware() {
  return (req: Request, res: Response, next: Function) => {
    const startTime = performance.now();
    const startCpuUsage = process.cpuUsage();
    const startMemoryUsage = process.memoryUsage();
    
    // Track request size
    const requestSize = req.get('content-length') ? parseInt(req.get('content-length')!) : 0;
    
    // Override end method to capture response time
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const endCpuUsage = process.cpuUsage(startCpuUsage);
      const endMemoryUsage = process.memoryUsage();
      
      // Track response size
      const responseSize = res.get('content-length') ? parseInt(res.get('content-length')!) : 0;
      
      // Record the metric
      PerformanceService.recordMetric({
        endpoint: req.route?.path || req.path,
        method: req.method,
        duration,
        statusCode: res.statusCode,
        memoryUsage: endMemoryUsage,
        cpuUsage: endCpuUsage,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        responseSize,
        requestSize
      });
      
      // Call original end method
      return originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
}

export default PerformanceService;
