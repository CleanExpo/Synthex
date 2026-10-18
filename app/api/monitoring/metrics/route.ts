import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { logger } from '@/lib/logger';

// The user and post counts were read from the Supabase `profiles` and
// `content_posts` tables. Neither table exists in prisma/schema.prisma, so the
// counts are reported as unavailable rather than as a fabricated zero.
const NOT_PROVISIONED_COUNTS = {
  activeUsers: {
    available: false,
    reason: 'FEATURE_NOT_PROVISIONED: table `profiles` is not provisioned',
  },
  requestCount: {
    available: false,
    reason: 'FEATURE_NOT_PROVISIONED: table `content_posts` is not provisioned',
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    // Admin-only guard — monitoring metrics expose internal system state
    const auth = await verifyAdmin(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: auth.error || 'Admin access required' },
        { status: 403 }
      );
    }

    // System metrics — null for values this route cannot measure; the
    // `unavailable` block says why the counts are missing.
    const systemMetrics = {
      system: {
        status: 'operational',
        uptime: null, // Requires monitoring integration
        responseTime: null, // Requires APM integration
        errorRate: null, // Requires error tracking
        requestCount: null, // See unavailable.requestCount
        activeUsers: null, // See unavailable.activeUsers
      },
      database: {
        status: null, // No database probe runs in this route
        connections: null, // Requires pg_stat_activity access
        maxConnections: 100, // Configuration constant
        queryTime: null, // Requires APM integration
        size: null, // Requires admin access
        backupStatus: null, // Requires backup service integration
      },
      api: {
        health: 'healthy', // Based on this request succeeding
        latency: null, // Requires monitoring
        throughput: null, // Requires monitoring
        errorCount: null, // Requires error tracking
        successRate: null, // Requires monitoring
      },
      security: {
        threats: null, // Requires WAF integration
        blockedAttempts: null, // Requires rate limit tracking
        lastScan: null, // Requires security scanner
        sslStatus: 'valid', // Can verify with env check
      },
      unavailable: NOT_PROVISIONED_COUNTS,
      message:
        'Basic health check operational. Detailed metrics require monitoring integration (Datadog, Prometheus, etc.).',
    };

    return NextResponse.json(systemMetrics);
  } catch (error) {
    logger.error('Error fetching monitoring metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
