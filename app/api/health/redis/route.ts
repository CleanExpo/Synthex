/**
 * Redis Health Check Endpoint
 * Monitors Redis connection status and performance
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  healthCheck,
  getStats,
  set,
  get,
  del,
  getImplementationType
} from '@/lib/redis-unified';
import { withOptionalSession } from '@/src/middleware/session';
import { logger } from '@/lib/logger';

interface PerfStats {
  min?: number;
  max?: number;
  avg?: number;
  median?: number;
  p95?: number;
  p99?: number;
  total?: number;
}

interface PerfSummary {
  write?: PerfStats | null;
  read?: PerfStats | null;
  delete?: PerfStats | null;
  totalTime?: number;
  totalOperations?: number;
  successRate?: { write: number; read: number; delete: number };
  health?: string;
}

// Force dynamic rendering - prevent static generation
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const runtime = 'nodejs';

// Performance test configuration
const PERF_TEST_CONFIG = {
  iterations: 10,
  dataSize: 1024, // 1KB test data
  ttl: 60 // 60 seconds TTL for test keys
};

/**
 * GET /api/health/redis
 * Returns Redis health status and statistics
 */
export async function GET(request: NextRequest) {
  return withOptionalSession(request, async (req, session) => {
    try {
      const startTime = Date.now();
      
      // Basic health check
      const health = await healthCheck();
      const stats = await getStats();
      const implementation = await getImplementationType();
      
      // Prepare response data
      const responseData: Record<string, unknown> = {
        status: health.status,
        implementation,
        connection: health.connection,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        stats: {
          ...stats,
          implementation
        }
      };
      
      // Add error message if unhealthy
      if (health.error) {
        responseData.error = health.error;
      }
      
      if (health.message) {
        responseData.message = health.message;
      }
      
      // Determine HTTP status code
      let statusCode = 200;
      if (health.status === 'unhealthy') {
        statusCode = 503; // Service Unavailable
      } else if (health.status === 'degraded') {
        statusCode = 207; // Multi-Status (partially working)
      }
      
      // Add session info if admin
      if (session?.user?.id) {
        const isAdmin = await get(`user_role:${session.user.id}`) === 'admin';
        if (isAdmin) {
          responseData.detailed = true;
          responseData.sessionInfo = {
            userId: session.user.id,
            sessionId: session.sessionId
          };
        }
      }
      
      return NextResponse.json(responseData, { status: statusCode });
      
    } catch (error: unknown) {
      logger.error('Redis health check error:', error);
      
      return NextResponse.json(
        {
          status: 'error',
          message: 'Failed to check Redis health',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/health/redis
 * Runs performance tests on Redis (admin only)
 */
export async function POST(request: NextRequest) {
  return withOptionalSession(request, async (req, session) => {
    try {
      // Check if user is admin
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      const isAdmin = await get(`user_role:${session.user.id}`) === 'admin';
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }
      
      // Parse request body for custom config
      const body = await request.json().catch(() => ({}));
      const config = {
        ...PERF_TEST_CONFIG,
        ...body
      };
      
      // Run performance tests
      const results = {
        implementation: await getImplementationType(),
        timestamp: new Date().toISOString(),
        config,
        tests: {
          write: { times: [] as number[], errors: 0 },
          read: { times: [] as number[], errors: 0 },
          delete: { times: [] as number[], errors: 0 }
        },
        summary: {} as PerfSummary
      };
      
      // Generate test data
      const testData = 'x'.repeat(config.dataSize);
      const testKeys: string[] = [];
      
      // Write performance test
      for (let i = 0; i < config.iterations; i++) {
        const key = `perf_test:${Date.now()}_${i}`;
        testKeys.push(key);
        
        const start = Date.now();
        try {
          await set(key, testData, config.ttl);
          results.tests.write.times.push(Date.now() - start);
        } catch (error) {
          results.tests.write.errors++;
          logger.error('Write test error:', error);
        }
      }
      
      // Read performance test
      for (const key of testKeys) {
        const start = Date.now();
        try {
          await get(key);
          results.tests.read.times.push(Date.now() - start);
        } catch (error) {
          results.tests.read.errors++;
          logger.error('Read test error:', error);
        }
      }
      
      // Delete performance test
      for (const key of testKeys) {
        const start = Date.now();
        try {
          await del(key);
          results.tests.delete.times.push(Date.now() - start);
        } catch (error) {
          results.tests.delete.errors++;
          logger.error('Delete test error:', error);
        }
      }
      
      // Calculate statistics
      const calculateStats = (times: number[]) => {
        if (times.length === 0) return null;
        
        const sorted = [...times].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        const avg = sum / sorted.length;
        const median = sorted[Math.floor(sorted.length / 2)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];
        
        return {
          min: sorted[0],
          max: sorted[sorted.length - 1],
          avg: Math.round(avg * 100) / 100,
          median,
          p95,
          p99,
          total: sum
        };
      };
      
      // Add statistics to results
      results.summary = {
        write: calculateStats(results.tests.write.times),
        read: calculateStats(results.tests.read.times),
        delete: calculateStats(results.tests.delete.times),
        totalTime: Object.values(results.tests).reduce(
          (sum, test) => sum + test.times.reduce((a, b) => a + b, 0),
          0
        ),
        totalOperations: config.iterations * 3,
        successRate: {
          write: ((config.iterations - results.tests.write.errors) / config.iterations) * 100,
          read: ((config.iterations - results.tests.read.errors) / config.iterations) * 100,
          delete: ((config.iterations - results.tests.delete.errors) / config.iterations) * 100
        }
      };
      
      // Overall health assessment
      const sr = results.summary.successRate;
      const overallSuccessRate = sr
        ? (sr.write + sr.read + sr.delete) / 3
        : 0;
      
      results.summary.health = 
        overallSuccessRate === 100 ? 'excellent' :
        overallSuccessRate >= 95 ? 'good' :
        overallSuccessRate >= 80 ? 'fair' :
        'poor';
      
      return NextResponse.json(results);
      
    } catch (error: unknown) {
      logger.error('Redis performance test error:', error);
      
      return NextResponse.json(
        {
          error: 'Failed to run performance tests',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/health/redis
 * Clear Redis cache (admin only, use with caution!)
 */
export async function DELETE(request: NextRequest) {
  return withOptionalSession(request, async (req, session) => {
    try {
      // Check if user is admin
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      const isAdmin = await get(`user_role:${session.user.id}`) === 'admin';
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }
      
      // Parse request body for pattern
      const body = await request.json().catch(() => ({}));
      const { pattern = 'perf_test:*', confirm = false } = body;
      
      if (!confirm) {
        return NextResponse.json(
          { 
            error: 'Confirmation required',
            message: 'Set confirm: true in request body to proceed'
          },
          { status: 400 }
        );
      }
      
      // For safety, only allow clearing test keys by default
      if (!pattern.includes('test') && pattern !== 'perf_test:*') {
        return NextResponse.json(
          { 
            error: 'Safety check failed',
            message: 'Can only clear test keys. Use pattern with "test" in it.'
          },
          { status: 400 }
        );
      }
      
      // Note: This is a simplified implementation
      // In production, you'd want to use SCAN and DEL commands
      return NextResponse.json({
        success: true,
        message: 'Cache clearing not fully implemented in memory fallback mode',
        pattern,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: unknown) {
      logger.error('Redis cache clear error:', error);
      
      return NextResponse.json(
        {
          error: 'Failed to clear cache',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
  });
}