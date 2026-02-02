/**
 * Alert Notification API
 * Manage and send alerts through configured notification channels
 *
 * @task UNI-424 - Implement Alert Notification Channels
 *
 * Endpoints:
 *   GET  /api/monitoring/alerts              - Get alert channels and history
 *   POST /api/monitoring/alerts              - Send a new alert
 *   POST /api/monitoring/alerts?action=test  - Test a notification channel
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  alertManager,
  AlertSeverity,
  NotificationChannel,
  type Alert,
} from '@/lib/alerts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_SEVERITIES = ['info', 'warning', 'error', 'critical'];
const VALID_CHANNELS = ['console', 'email', 'slack', 'discord', 'webhook'];

/**
 * GET /api/monitoring/alerts
 * Get configured channels and alert history
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'full';
    const historyCount = parseInt(searchParams.get('count') || '20', 10);

    switch (view) {
      case 'channels': {
        const channels = alertManager.getChannels().map(c => ({
          type: c.type,
          enabled: c.enabled,
          minSeverity: c.minSeverity,
          // Don't expose sensitive config
        }));

        return NextResponse.json(
          {
            success: true,
            channels,
            responseTime: Date.now() - startTime,
          },
          { status: 200 }
        );
      }

      case 'history': {
        const history = alertManager.getHistory(historyCount);

        return NextResponse.json(
          {
            success: true,
            alerts: history,
            count: history.length,
            responseTime: Date.now() - startTime,
          },
          { status: 200 }
        );
      }

      case 'full':
      default: {
        const channels = alertManager.getChannels().map(c => ({
          type: c.type,
          enabled: c.enabled,
          minSeverity: c.minSeverity,
        }));

        const history = alertManager.getHistory(historyCount);

        return NextResponse.json(
          {
            success: true,
            channels,
            alerts: history,
            alertCount: history.length,
            responseTime: Date.now() - startTime,
          },
          { status: 200 }
        );
      }
    }
  } catch (error: any) {
    console.error('Alerts API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get alerts',
        responseTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/alerts
 * Send a new alert or test a channel
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const body = await request.json();

    // Test a specific channel
    if (action === 'test') {
      const { channel } = body;

      if (!channel || !VALID_CHANNELS.includes(channel)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid channel. Valid values: ${VALID_CHANNELS.join(', ')}`,
          },
          { status: 400 }
        );
      }

      const result = await alertManager.testChannel(channel as NotificationChannel);

      return NextResponse.json(
        {
          success: result.success,
          result,
          responseTime: Date.now() - startTime,
        },
        { status: result.success ? 200 : 500 }
      );
    }

    // Send a new alert
    const { title, message, severity, source, metadata, tags } = body;

    // Validate required fields
    if (!title || !message || !severity || !source) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: title, message, severity, source',
        },
        { status: 400 }
      );
    }

    // Validate severity
    if (!VALID_SEVERITIES.includes(severity)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid severity. Valid values: ${VALID_SEVERITIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const alert: Alert = {
      title,
      message,
      severity: severity as AlertSeverity,
      source,
      metadata,
      tags,
    };

    const results = await alertManager.sendAlert(alert);

    const allSuccessful = results.every(r => r.success);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json(
      {
        success: allSuccessful,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: results.length - successCount,
        },
        responseTime: Date.now() - startTime,
      },
      { status: allSuccessful ? 200 : 207 } // 207 Multi-Status for partial success
    );
  } catch (error: any) {
    console.error('Alerts API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send alert',
        responseTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
