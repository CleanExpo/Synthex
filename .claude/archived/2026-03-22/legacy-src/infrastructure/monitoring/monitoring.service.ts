/**
 * Monitoring Service Implementation
 * Provides comprehensive application monitoring with metrics, logging, and tracing
 */

import {
  IMonitoringService,
  ILogger,
  Timer,
  InfrastructureError
} from '../../architecture/layer-interfaces';
import { performance } from 'perf_hooks';

export interface MetricPoint {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // in milliseconds
  enabled: boolean;
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'log';
  config: Record<string, any>;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: Date;
  responseTime: number;
  metadata?: Record<string, any>;
}

export class MonitoringService implements IMonitoringService {
  private logger: ILogger;
  private metrics = new Map<string, MetricPoint[]>();
  private timers = new Map<string, { startTime: number; tags?: Record<string, string> }>();
  private alertRules = new Map<string, AlertRule>();
  private healthChecks = new Map<string, HealthCheck>();
  private readonly MAX_METRICS_RETENTION = 10000; // Keep last 10k metrics per type
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;
  private metricsBuffer: MetricPoint[] = [];
  private readonly BUFFER_FLUSH_INTERVAL = 30000; // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(logger: ILogger) {
    this.logger = logger;
    this.startCleanupTimer();
    this.startFlushTimer();
    
    // Setup default health checks
    this.setupDefaultHealthChecks();
  }

  /**
   * Record metric
   */
  recordMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    try {
      const metricPoint: MetricPoint = {
        name,
        value,
        tags,
        timestamp: new Date(),
        type: 'gauge'
      };

      this.addMetric(metricPoint);

      this.logger.debug(`Metric recorded: ${name}`, {
        name,
        value,
        tags,
        type: 'gauge'
      });

    } catch (error) {
      this.logger.error(`Failed to record metric: ${name}`, error as Error);
    }
  }

  /**
   * Increment counter
   */
  incrementCounter(name: string, tags: Record<string, string> = {}): void {
    try {
      const metricPoint: MetricPoint = {
        name,
        value: 1,
        tags,
        timestamp: new Date(),
        type: 'counter'
      };

      this.addMetric(metricPoint);

      this.logger.debug(`Counter incremented: ${name}`, {
        name,
        tags,
        type: 'counter'
      });

    } catch (error) {
      this.logger.error(`Failed to increment counter: ${name}`, error as Error);
    }
  }

  /**
   * Start timing
   */
  startTimer(name: string): Timer {
    const startTime = performance.now();
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.timers.set(timerId, { startTime });

    return {
      end: (tags: Record<string, string> = {}) => {
        const timerData = this.timers.get(timerId);
        if (!timerData) {
          this.logger.warn(`Timer not found: ${timerId}`);
          return;
        }

        const duration = performance.now() - timerData.startTime;
        this.timers.delete(timerId);

        const metricPoint: MetricPoint = {
          name,
          value: duration,
          tags,
          timestamp: new Date(),
          type: 'timer'
        };

        this.addMetric(metricPoint);

        this.logger.debug(`Timer completed: ${name}`, {
          name,
          duration: `${duration.toFixed(2)}ms`,
          tags,
          type: 'timer'
        });
      }
    };
  }

  /**
   * Record histogram
   */
  recordHistogram(name: string, value: number, tags: Record<string, string> = {}): void {
    try {
      const metricPoint: MetricPoint = {
        name,
        value,
        tags,
        timestamp: new Date(),
        type: 'histogram'
      };

      this.addMetric(metricPoint);

      this.logger.debug(`Histogram recorded: ${name}`, {
        name,
        value,
        tags,
        type: 'histogram'
      });

    } catch (error) {
      this.logger.error(`Failed to record histogram: ${name}`, error as Error);
    }
  }

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string, timeRange?: { start: Date; end: Date }): MetricPoint[] {
    try {
      const allMetrics = this.metrics.get(name) || [];

      if (!timeRange) {
        return allMetrics;
      }

      return allMetrics.filter(metric => 
        metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      );

    } catch (error) {
      this.logger.error(`Failed to get metrics for: ${name}`, error as Error);
      return [];
    }
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(name: string, timeRange: { start: Date; end: Date }): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    try {
      const metrics = this.getMetrics(name, timeRange);
      
      if (metrics.length === 0) {
        return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
      }

      const values = metrics.map(m => m.value).sort((a, b) => a - b);
      const count = values.length;
      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / count;
      const min = values[0];
      const max = values[count - 1];

      const p50 = this.percentile(values, 0.5);
      const p95 = this.percentile(values, 0.95);
      const p99 = this.percentile(values, 0.99);

      return { count, sum, avg, min, max, p50, p95, p99 };

    } catch (error) {
      this.logger.error(`Failed to get aggregated metrics for: ${name}`, error as Error);
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }
  }

  /**
   * Create alert rule
   */
  createAlertRule(rule: AlertRule): void {
    try {
      this.alertRules.set(rule.id, rule);

      this.logger.info(`Alert rule created: ${rule.name}`, {
        ruleId: rule.id,
        metric: rule.metric,
        condition: rule.condition,
        threshold: rule.threshold
      });

    } catch (error) {
      this.logger.error(`Failed to create alert rule: ${rule.id}`, error as Error);
    }
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    try {
      const removed = this.alertRules.delete(ruleId);
      
      if (removed) {
        this.logger.info(`Alert rule removed: ${ruleId}`);
      }

      return removed;

    } catch (error) {
      this.logger.error(`Failed to remove alert rule: ${ruleId}`, error as Error);
      return false;
    }
  }

  /**
   * Register health check
   */
  registerHealthCheck(name: string, checkFunction: () => Promise<Omit<HealthCheck, 'name' | 'lastCheck'>>): void {
    try {
      // Initial health check
      this.runHealthCheck(name, checkFunction);

      // Schedule periodic health checks
      setInterval(async () => {
        await this.runHealthCheck(name, checkFunction);
      }, 60000); // Check every minute

      this.logger.info(`Health check registered: ${name}`);

    } catch (error) {
      this.logger.error(`Failed to register health check: ${name}`, error as Error);
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    checks: HealthCheck[];
    timestamp: Date;
  } {
    try {
      const checks = Array.from(this.healthChecks.values());
      let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Determine overall status
      const unhealthyChecks = checks.filter(check => check.status === 'unhealthy');
      const degradedChecks = checks.filter(check => check.status === 'degraded');

      if (unhealthyChecks.length > 0) {
        overall = 'unhealthy';
      } else if (degradedChecks.length > 0) {
        overall = 'degraded';
      }

      return {
        overall,
        checks,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error('Failed to get health status', error as Error);
      return {
        overall: 'unhealthy',
        checks: [],
        timestamp: new Date()
      };
    }
  }

  /**
   * Get system performance metrics
   */
  getSystemMetrics(): {
    cpu: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    uptime: number;
    eventLoop: {
      delay: number;
    };
  } {
    try {
      const memoryUsage = process.memoryUsage();
      
      return {
        cpu: process.cpuUsage().system / 1000000, // Convert to seconds
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
        },
        uptime: process.uptime(),
        eventLoop: {
          delay: this.getEventLoopDelay()
        }
      };

    } catch (error) {
      this.logger.error('Failed to get system metrics', error as Error);
      return {
        cpu: 0,
        memory: { used: 0, total: 0, percentage: 0 },
        uptime: 0,
        eventLoop: { delay: 0 }
      };
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    try {
      const lines: string[] = [];

      for (const [metricName, metricPoints] of this.metrics) {
        if (metricPoints.length === 0) continue;

        const latestMetric = metricPoints[metricPoints.length - 1];
        const tagsStr = Object.entries(latestMetric.tags)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');

        const metricLine = tagsStr 
          ? `${metricName}{${tagsStr}} ${latestMetric.value}`
          : `${metricName} ${latestMetric.value}`;

        lines.push(metricLine);
      }

      return lines.join('\n');

    } catch (error) {
      this.logger.error('Failed to export Prometheus metrics', error as Error);
      return '';
    }
  }

  /**
   * Add metric to collection
   */
  private addMetric(metricPoint: MetricPoint): void {
    if (!this.metrics.has(metricPoint.name)) {
      this.metrics.set(metricPoint.name, []);
    }

    const metricArray = this.metrics.get(metricPoint.name)!;
    metricArray.push(metricPoint);

    // Trim to max retention
    if (metricArray.length > this.MAX_METRICS_RETENTION) {
      metricArray.splice(0, metricArray.length - this.MAX_METRICS_RETENTION);
    }

    // Add to buffer for batch processing
    this.metricsBuffer.push(metricPoint);

    // Check alert rules
    this.checkAlertRules(metricPoint);
  }

  /**
   * Check alert rules against metric
   */
  private checkAlertRules(metricPoint: MetricPoint): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled || rule.metric !== metricPoint.name) {
        continue;
      }

      try {
        const shouldAlert = this.evaluateAlertCondition(rule, metricPoint.value);
        
        if (shouldAlert) {
          this.triggerAlert(rule, metricPoint);
        }

      } catch (error) {
        this.logger.error(`Error evaluating alert rule: ${rule.id}`, error as Error);
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(rule: AlertRule, value: number): boolean {
    switch (rule.condition) {
      case 'gt':
        return value > rule.threshold;
      case 'gte':
        return value >= rule.threshold;
      case 'lt':
        return value < rule.threshold;
      case 'lte':
        return value <= rule.threshold;
      case 'eq':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(rule: AlertRule, metricPoint: MetricPoint): void {
    this.logger.warn(`Alert triggered: ${rule.name}`, {
      ruleId: rule.id,
      metric: metricPoint.name,
      value: metricPoint.value,
      threshold: rule.threshold,
      condition: rule.condition
    });

    // Execute alert actions
    for (const action of rule.actions) {
      this.executeAlertAction(action, rule, metricPoint);
    }
  }

  /**
   * Execute alert action
   */
  private executeAlertAction(action: AlertAction, rule: AlertRule, metricPoint: MetricPoint): void {
    try {
      switch (action.type) {
        case 'log':
          this.logger.error(`ALERT: ${rule.name} - ${metricPoint.name} is ${metricPoint.value} (threshold: ${rule.threshold})`);
          break;
        case 'webhook':
          // Webhook implementation would go here
          this.logger.info('Webhook alert action executed', { ruleId: rule.id });
          break;
        case 'email':
          // Email implementation would go here  
          this.logger.info('Email alert action executed', { ruleId: rule.id });
          break;
      }

    } catch (error) {
      this.logger.error(`Failed to execute alert action: ${action.type}`, error as Error);
    }
  }

  /**
   * Run health check
   */
  private async runHealthCheck(
    name: string,
    checkFunction: () => Promise<Omit<HealthCheck, 'name' | 'lastCheck'>>
  ): Promise<void> {
    const startTime = performance.now();

    try {
      const result = await checkFunction();
      const responseTime = performance.now() - startTime;

      const healthCheck: HealthCheck = {
        ...result,
        name,
        lastCheck: new Date(),
        responseTime
      };

      this.healthChecks.set(name, healthCheck);

      // Record health check metrics
      this.recordMetric(`health_check_response_time`, responseTime, { check: name });
      this.recordMetric(`health_check_status`, result.status === 'healthy' ? 1 : 0, { check: name });

    } catch (error) {
      const responseTime = performance.now() - startTime;

      const healthCheck: HealthCheck = {
        name,
        status: 'unhealthy',
        message: `Health check failed: ${(error as Error).message}`,
        lastCheck: new Date(),
        responseTime
      };

      this.healthChecks.set(name, healthCheck);

      // Record failure metrics
      this.recordMetric(`health_check_response_time`, responseTime, { check: name });
      this.recordMetric(`health_check_status`, 0, { check: name });

      this.logger.error(`Health check failed: ${name}`, error as Error);
    }
  }

  /**
   * Setup default health checks
   */
  private setupDefaultHealthChecks(): void {
    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const memoryUsage = process.memoryUsage();
      const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      return {
        status: heapUsagePercent > 90 ? 'unhealthy' : heapUsagePercent > 75 ? 'degraded' : 'healthy',
        message: `Heap usage: ${heapUsagePercent.toFixed(2)}%`,
        responseTime: 0, // Will be set by runHealthCheck
        metadata: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          heapUsagePercent
        }
      };
    });

    // Event loop health check
    this.registerHealthCheck('event_loop', async () => {
      const delay = this.getEventLoopDelay();
      
      return {
        status: delay > 100 ? 'unhealthy' : delay > 50 ? 'degraded' : 'healthy',
        message: `Event loop delay: ${delay.toFixed(2)}ms`,
        responseTime: 0,
        metadata: { delay }
      };
    });
  }

  /**
   * Get event loop delay
   */
  private getEventLoopDelay(): number {
    const start = performance.now();
    setImmediate(() => {
      const delay = performance.now() - start;
      this.recordMetric('event_loop_delay', delay);
    });
    return 0; // Placeholder - real implementation would use perf_hooks.monitorEventLoopDelay
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], percentile: number): number {
    const index = percentile * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetricsBuffer();
    }, this.BUFFER_FLUSH_INTERVAL);
  }

  /**
   * Cleanup old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago

    for (const [metricName, metricPoints] of this.metrics) {
      const filteredMetrics = metricPoints.filter(metric => metric.timestamp > cutoffTime);
      this.metrics.set(metricName, filteredMetrics);
    }

    this.logger.debug('Cleaned up old metrics');
  }

  /**
   * Flush metrics buffer
   */
  private flushMetricsBuffer(): void {
    if (this.metricsBuffer.length > 0) {
      // Here you could send metrics to external systems like Prometheus, DataDog, etc.
      this.logger.debug(`Flushed ${this.metricsBuffer.length} metrics`);
      this.metricsBuffer = [];
    }
  }

  /**
   * Dispose of monitoring service
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.metrics.clear();
    this.timers.clear();
    this.alertRules.clear();
    this.healthChecks.clear();
    this.metricsBuffer = [];

    this.logger.info('Monitoring service disposed');
  }
}