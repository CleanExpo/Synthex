/**
 * Performance Metrics API
 * Real-time performance metrics endpoint
 *
 * @task UNI-426 - Implement Performance Monitoring Suite
 */

import { NextRequest, NextResponse } from 'next/server';
import performanceMonitor from '@/lib/monitoring/performance-monitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/performance/metrics
 * Get current performance metrics
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const period = parseInt(searchParams.get('period') || '5', 10); // Default: 5 minutes
    const format = searchParams.get('format') || 'json';

    // Generate report for the specified period
    const report = await performanceMonitor.generateReport(period);

    // Get current system state
    const memory = process.memoryUsage();
    const uptime = process.uptime();

    const metrics = {
      timestamp: new Date().toISOString(),
      period: `${period} minutes`,

      // Current system state
      system: {
        uptime: Math.floor(uptime),
        uptimeFormatted: formatUptime(uptime),
        memory: {
          heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
          rssMB: Math.round(memory.rss / 1024 / 1024),
          externalMB: Math.round(memory.external / 1024 / 1024),
          heapUsedPercent: Math.round((memory.heapUsed / memory.heapTotal) * 100),
        },
        nodeVersion: process.version,
        platform: process.platform,
      },

      // API performance
      api: {
        totalRequests: report.api.totalRequests,
        averageResponseTime: Math.round(report.api.averageResponseTime),
        percentiles: {
          p50: Math.round(report.api.p50),
          p90: Math.round(report.api.p90),
          p95: Math.round(report.api.p95),
          p99: Math.round(report.api.p99),
        },
        errorRate: report.api.errorRate.toFixed(2) + '%',
        statusCodes: report.api.statusCodeDistribution,
        slowestEndpoints: report.api.slowestEndpoints.slice(0, 5).map((e) => ({
          endpoint: e.endpoint,
          avgTime: Math.round(e.avgTime),
          requests: e.count,
        })),
      },

      // Database performance
      database: {
        totalQueries: report.database.totalQueries,
        averageQueryTime: Math.round(report.database.avgQueryTime),
        slowQueries: report.database.slowQueries,
        cacheHitRate: report.database.cacheHitRate.toFixed(1) + '%',
      },

      // Health summary
      health: {
        status: getHealthStatus(report),
        memoryStatus: getMemoryStatus(memory),
        apiStatus: getAPIStatus(report),
      },

      // Response metadata
      responseTime: Date.now() - startTime,
    };

    // Format response based on requested format
    if (format === 'prometheus') {
      return new NextResponse(formatPrometheus(metrics), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4',
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        metrics,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Response-Time': `${Date.now() - startTime}ms`,
        },
      }
    );
  } catch (error: any) {
    console.error('Metrics error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get metrics',
        responseTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/performance/metrics
 * Record client-side performance metrics (Web Vitals)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metrics, url, timestamp, userAgent } = body;

    // Validate required fields
    if (!metrics) {
      return NextResponse.json(
        { success: false, error: 'Metrics data required' },
        { status: 400 }
      );
    }

    // Log client metrics (in production, store these)
    console.log('[CLIENT_METRICS]', {
      url,
      timestamp,
      fcp: metrics.fcp,
      lcp: metrics.lcp,
      cls: metrics.cls,
      fid: metrics.fid,
      ttfb: metrics.ttfb,
    });

    // Store metrics (you could extend this to store in database)
    // For now, we'll just acknowledge receipt

    return NextResponse.json({
      success: true,
      message: 'Metrics recorded',
      received: {
        timestamp: timestamp || new Date().toISOString(),
        metricsCount: Object.keys(metrics).length,
      },
    });
  } catch (error: any) {
    console.error('Failed to record metrics:', error);

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record metrics' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatUptime(seconds: number): string {
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

function getHealthStatus(report: any): 'healthy' | 'degraded' | 'unhealthy' {
  if (report.api.errorRate > 10 || report.system?.avgMemoryUsage > 90) {
    return 'unhealthy';
  }
  if (report.api.errorRate > 5 || report.system?.avgMemoryUsage > 80 || report.api.p95 > 2000) {
    return 'degraded';
  }
  return 'healthy';
}

function getMemoryStatus(memory: NodeJS.MemoryUsage): 'healthy' | 'warning' | 'critical' {
  const heapPercent = (memory.heapUsed / memory.heapTotal) * 100;
  if (heapPercent > 90) return 'critical';
  if (heapPercent > 75) return 'warning';
  return 'healthy';
}

function getAPIStatus(report: any): 'healthy' | 'degraded' | 'unhealthy' {
  if (report.api.errorRate > 10) return 'unhealthy';
  if (report.api.errorRate > 5 || report.api.p90 > 1000) return 'degraded';
  return 'healthy';
}

function formatPrometheus(metrics: any): string {
  const lines: string[] = [];

  // Memory metrics
  lines.push('# HELP synthex_memory_heap_used_bytes Heap memory used');
  lines.push('# TYPE synthex_memory_heap_used_bytes gauge');
  lines.push(`synthex_memory_heap_used_bytes ${metrics.system.memory.heapUsedMB * 1024 * 1024}`);

  lines.push('# HELP synthex_memory_heap_total_bytes Total heap memory');
  lines.push('# TYPE synthex_memory_heap_total_bytes gauge');
  lines.push(`synthex_memory_heap_total_bytes ${metrics.system.memory.heapTotalMB * 1024 * 1024}`);

  // API metrics
  lines.push('# HELP synthex_api_requests_total Total API requests');
  lines.push('# TYPE synthex_api_requests_total counter');
  lines.push(`synthex_api_requests_total ${metrics.api.totalRequests}`);

  lines.push('# HELP synthex_api_response_time_ms Average API response time');
  lines.push('# TYPE synthex_api_response_time_ms gauge');
  lines.push(`synthex_api_response_time_ms ${metrics.api.averageResponseTime}`);

  lines.push('# HELP synthex_api_response_time_p95_ms 95th percentile response time');
  lines.push('# TYPE synthex_api_response_time_p95_ms gauge');
  lines.push(`synthex_api_response_time_p95_ms ${metrics.api.percentiles.p95}`);

  // Database metrics
  lines.push('# HELP synthex_db_queries_total Total database queries');
  lines.push('# TYPE synthex_db_queries_total counter');
  lines.push(`synthex_db_queries_total ${metrics.database.totalQueries}`);

  lines.push('# HELP synthex_db_query_time_ms Average query time');
  lines.push('# TYPE synthex_db_query_time_ms gauge');
  lines.push(`synthex_db_query_time_ms ${metrics.database.averageQueryTime}`);

  // Uptime
  lines.push('# HELP synthex_uptime_seconds Server uptime');
  lines.push('# TYPE synthex_uptime_seconds gauge');
  lines.push(`synthex_uptime_seconds ${metrics.system.uptime}`);

  return lines.join('\n');
}
