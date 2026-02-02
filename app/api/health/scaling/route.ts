/**
 * Scaling Health Check Endpoint
 * Monitors scaling metrics and system resource utilization
 *
 * @task UNI-439 - Implement Auto-scaling Configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAutoScalingConfig,
  getMonitoringThresholds,
} from '../../../../src/config/scaling.config';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ScalingMetrics {
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  region: string;
  instance: string;
  resources: {
    memory: {
      used: number;
      total: number;
      percentage: number;
      status: 'ok' | 'warning' | 'critical';
    };
    cpu: {
      usage: number;
      status: 'ok' | 'warning' | 'critical';
    };
  };
  requests: {
    active: number;
    queued: number;
    totalProcessed: number;
    errorRate: number;
    avgLatency: number;
  };
  rateLimit: {
    currentWindow: number;
    requestsInWindow: number;
    maxRequests: number;
    blocked: number;
  };
  uptime: number;
  version: string;
  config: {
    maxConcurrent: number;
    queueSize: number;
    circuitBreakerStatus: 'closed' | 'open' | 'half-open';
  };
}

// In-memory metrics tracking
const metricsStore = {
  requestCount: 0,
  errorCount: 0,
  totalLatency: 0,
  activeRequests: 0,
  queuedRequests: 0,
  blockedRequests: 0,
  startTime: Date.now(),
  windowStart: Date.now(),
  windowRequestCount: 0,
  circuitBreakerStatus: 'closed' as 'closed' | 'open' | 'half-open',
};

/**
 * Get memory usage metrics
 */
function getMemoryMetrics(): ScalingMetrics['resources']['memory'] {
  const thresholds = getMonitoringThresholds();

  // Get process memory usage
  const memUsage = process.memoryUsage();
  const heapUsed = memUsage.heapUsed;
  const heapTotal = memUsage.heapTotal;
  const percentage = heapUsed / heapTotal;

  let status: 'ok' | 'warning' | 'critical' = 'ok';
  if (percentage >= thresholds.memoryCritical) {
    status = 'critical';
  } else if (percentage >= thresholds.memoryWarning) {
    status = 'warning';
  }

  return {
    used: Math.round(heapUsed / 1024 / 1024), // MB
    total: Math.round(heapTotal / 1024 / 1024), // MB
    percentage: Math.round(percentage * 100) / 100,
    status,
  };
}

/**
 * Get CPU usage estimate
 */
function getCPUMetrics(): ScalingMetrics['resources']['cpu'] {
  const thresholds = getMonitoringThresholds();

  // Estimate CPU usage based on event loop lag
  // This is a rough estimate for serverless environments
  const startTime = Date.now();
  let cpuUsage = 0;

  // Check event loop by measuring time drift
  const expectedTime = 100; // ms
  const actualDelay = Date.now() - startTime;
  const lag = Math.max(0, actualDelay - expectedTime);

  // Convert lag to approximate CPU usage (rough estimate)
  cpuUsage = Math.min(1, lag / 1000);

  let status: 'ok' | 'warning' | 'critical' = 'ok';
  if (cpuUsage >= thresholds.cpuCritical) {
    status = 'critical';
  } else if (cpuUsage >= thresholds.cpuWarning) {
    status = 'warning';
  }

  return {
    usage: Math.round(cpuUsage * 100) / 100,
    status,
  };
}

/**
 * Get request metrics
 */
function getRequestMetrics(): ScalingMetrics['requests'] {
  const now = Date.now();
  const windowMs = 60000; // 1 minute window

  // Reset window if expired
  if (now - metricsStore.windowStart > windowMs) {
    metricsStore.windowStart = now;
    metricsStore.windowRequestCount = 0;
  }

  const errorRate =
    metricsStore.requestCount > 0
      ? metricsStore.errorCount / metricsStore.requestCount
      : 0;

  const avgLatency =
    metricsStore.requestCount > 0
      ? metricsStore.totalLatency / metricsStore.requestCount
      : 0;

  return {
    active: metricsStore.activeRequests,
    queued: metricsStore.queuedRequests,
    totalProcessed: metricsStore.requestCount,
    errorRate: Math.round(errorRate * 1000) / 1000,
    avgLatency: Math.round(avgLatency),
  };
}

/**
 * GET /api/health/scaling
 * Returns scaling metrics and system health
 */
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    const config = getAutoScalingConfig();
    const thresholds = getMonitoringThresholds();

    // Track this request
    metricsStore.requestCount++;
    metricsStore.windowRequestCount++;

    // Get resource metrics
    const memory = getMemoryMetrics();
    const cpu = getCPUMetrics();
    const requests = getRequestMetrics();

    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (
      memory.status === 'critical' ||
      cpu.status === 'critical' ||
      requests.errorRate >= thresholds.errorRateCritical
    ) {
      status = 'critical';
    } else if (
      memory.status === 'warning' ||
      cpu.status === 'warning' ||
      requests.errorRate >= thresholds.errorRateWarning
    ) {
      status = 'warning';
    }

    const metrics: ScalingMetrics = {
      timestamp: new Date().toISOString(),
      status,
      region: process.env.VERCEL_REGION || 'unknown',
      instance: process.env.VERCEL_URL || 'local',
      resources: {
        memory,
        cpu,
      },
      requests,
      rateLimit: {
        currentWindow: config.rateLimit.authenticated.windowMs,
        requestsInWindow: metricsStore.windowRequestCount,
        maxRequests: config.rateLimit.authenticated.maxRequests,
        blocked: metricsStore.blockedRequests,
      },
      uptime: Math.floor((Date.now() - metricsStore.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      config: {
        maxConcurrent: config.scaling.maxConcurrentRequests,
        queueSize: config.scaling.queueSize,
        circuitBreakerStatus: metricsStore.circuitBreakerStatus,
      },
    };

    // Track latency
    metricsStore.totalLatency += Date.now() - startTime;

    // Determine response status code
    let statusCode = 200;
    if (status === 'critical') {
      statusCode = 503;
    } else if (status === 'warning') {
      statusCode = 207;
    }

    return NextResponse.json(metrics, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'X-Response-Time': `${Date.now() - startTime}ms`,
      },
    });
  } catch (error: any) {
    console.error('Scaling health check error:', error);
    metricsStore.errorCount++;

    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to get scaling metrics',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/health/scaling
 * Record metrics (for internal use)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, value } = body;

    switch (action) {
      case 'request_start':
        metricsStore.activeRequests++;
        break;
      case 'request_end':
        metricsStore.activeRequests = Math.max(0, metricsStore.activeRequests - 1);
        break;
      case 'request_queued':
        metricsStore.queuedRequests++;
        break;
      case 'request_dequeued':
        metricsStore.queuedRequests = Math.max(0, metricsStore.queuedRequests - 1);
        break;
      case 'request_blocked':
        metricsStore.blockedRequests++;
        break;
      case 'error':
        metricsStore.errorCount++;
        break;
      case 'latency':
        metricsStore.totalLatency += value || 0;
        break;
      case 'circuit_breaker':
        metricsStore.circuitBreakerStatus = value || 'closed';
        break;
      case 'reset':
        // Reset all metrics
        metricsStore.requestCount = 0;
        metricsStore.errorCount = 0;
        metricsStore.totalLatency = 0;
        metricsStore.activeRequests = 0;
        metricsStore.queuedRequests = 0;
        metricsStore.blockedRequests = 0;
        metricsStore.windowStart = Date.now();
        metricsStore.windowRequestCount = 0;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
