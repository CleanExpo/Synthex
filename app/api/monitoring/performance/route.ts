/**
 * Performance Monitoring API
 * Comprehensive performance metrics and reports
 *
 * @task UNI-426 - Implement Performance Monitoring Suite
 *
 * Endpoints:
 *   GET  /api/monitoring/performance        - Get performance report
 *   GET  /api/monitoring/performance/status - Get monitor status
 *   GET  /api/monitoring/performance/alerts - Get recent alerts
 *   POST /api/monitoring/performance/config - Update thresholds
 */

import { NextRequest, NextResponse } from 'next/server';
import performanceMonitor from '@/lib/monitoring/performance-monitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/monitoring/performance
 * Get performance report for specified time period
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'report';
    const period = parseInt(searchParams.get('period') || '60', 10);

    switch (view) {
      case 'report': {
        const report = await performanceMonitor.generateReport(period);

        return NextResponse.json(
          {
            success: true,
            report,
            generatedAt: new Date().toISOString(),
            responseTime: Date.now() - startTime,
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'no-store, max-age=0',
              'X-Response-Time': `${Date.now() - startTime}ms`,
            },
          }
        );
      }

      case 'status': {
        const status = performanceMonitor.getStatus();

        return NextResponse.json(
          {
            success: true,
            status,
            responseTime: Date.now() - startTime,
          },
          { status: 200 }
        );
      }

      case 'alerts': {
        const count = parseInt(searchParams.get('count') || '20', 10);
        const alerts = await performanceMonitor.getRecentAlerts(count);

        return NextResponse.json(
          {
            success: true,
            alerts,
            count: alerts.length,
            responseTime: Date.now() - startTime,
          },
          { status: 200 }
        );
      }

      case 'realtime': {
        // Get current metrics snapshot
        const currentMetrics = {
          timestamp: Date.now(),
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          status: performanceMonitor.getStatus(),
        };

        return NextResponse.json(
          {
            success: true,
            metrics: currentMetrics,
            responseTime: Date.now() - startTime,
          },
          { status: 200 }
        );
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown view: ${view}. Valid options: report, status, alerts, realtime`,
          },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Performance monitoring error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate performance report',
        responseTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/performance
 * Update performance monitoring configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, thresholds } = body;

    switch (action) {
      case 'update-thresholds': {
        if (!thresholds || typeof thresholds !== 'object') {
          return NextResponse.json(
            {
              success: false,
              error: 'Thresholds object required',
            },
            { status: 400 }
          );
        }

        performanceMonitor.setThresholds(thresholds);

        return NextResponse.json({
          success: true,
          message: 'Thresholds updated',
          thresholds: performanceMonitor.getThresholds(),
        });
      }

      case 'get-thresholds': {
        return NextResponse.json({
          success: true,
          thresholds: performanceMonitor.getThresholds(),
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}. Valid options: update-thresholds, get-thresholds`,
          },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Performance config error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update configuration',
      },
      { status: 500 }
    );
  }
}
