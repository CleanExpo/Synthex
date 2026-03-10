/**
 * @deprecated No active callers. Candidate for removal in a future cleanup phase.
 * Last reviewed: 2026-03-03
 * Reason: Cache stats duplicated by /api/monitoring/metrics; uses src/infrastructure path not in use.
 */

/**
 * Cache Management API
 * Provides endpoints for cache statistics and management
 */

import { NextRequest, NextResponse } from 'next/server';
import { CacheFactory } from '@/src/infrastructure/caching/cache.factory';
import { ConsoleLogger } from '@/src/infrastructure/logging/console-logger';
import { invalidateCache, clearApiCache, getCacheStats } from '@/src/middleware/cache-middleware';
import { logger } from '@/lib/logger';

// Initialize cache service
const logger = new ConsoleLogger();
const cache = CacheFactory.createCacheService(logger);

// GET: Get cache statistics
export async function GET(req: NextRequest) {
  try {
    const stats = await getCacheStats();
    
    // Get additional metrics
    const apiCacheKeys = await cache.getKeys('api:*');
    const sessionKeys = await cache.getKeys('session:*');
    const rateLimitKeys = await cache.getKeys('rate:*');
    
    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        apiCacheCount: apiCacheKeys.length,
        sessionCount: sessionKeys.length,
        rateLimitCount: rateLimitKeys.length,
        totalKeys: apiCacheKeys.length + sessionKeys.length + rateLimitKeys.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    return NextResponse.json(
      { error: 'Failed to get cache statistics' },
      { status: 500 }
    );
  }
}

// DELETE: Clear cache
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pattern = searchParams.get('pattern');
    const type = searchParams.get('type') || 'api';
    
    // Verify admin authorization
    const authHeader = req.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!authHeader || !authHeader.includes(adminKey!)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    let deleted = 0;
    
    if (pattern) {
      // Clear by pattern
      if (type === 'all') {
        deleted = await cache.deletePattern(pattern);
      } else {
        deleted = await invalidateCache(pattern);
      }
    } else {
      // Clear all cache of specified type
      switch (type) {
        case 'api':
          await clearApiCache();
          break;
        case 'session':
          deleted = await cache.deletePattern('session:*');
          break;
        case 'rate':
          deleted = await cache.deletePattern('rate:*');
          break;
        case 'all':
          await cache.clear();
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid cache type' },
            { status: 400 }
          );
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Cache cleared successfully`,
      deleted,
      type,
      pattern,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

// POST: Warm up cache
export async function POST(req: NextRequest) {
  try {
    const { patterns, ttl = 3600 } = await req.json();
    
    // Verify admin authorization
    const authHeader = req.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!authHeader || !authHeader.includes(adminKey!)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (!patterns || !Array.isArray(patterns)) {
      return NextResponse.json(
        { error: 'Invalid patterns array' },
        { status: 400 }
      );
    }
    
    // Warm up cache with provided patterns
    const results: { key: string; success: boolean; error?: string }[] = [];
    
    for (const pattern of patterns) {
      try {
        await cache.set(pattern.key, pattern.value, ttl);
        results.push({ key: pattern.key, success: true });
      } catch (error) {
        results.push({ key: pattern.key, success: false, error: (error as Error).message });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return NextResponse.json({
      success: true,
      message: `Cache warmed up: ${successful} successful, ${failed} failed`,
      results,
      ttl,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error warming cache:', error);
    return NextResponse.json(
      { error: 'Failed to warm cache' },
      { status: 500 }
    );
  }
}