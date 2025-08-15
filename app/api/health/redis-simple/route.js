/**
 * Simple Redis Health Check
 * Uses CommonJS-compatible Redis client
 */

import { NextResponse } from 'next/server';

const redis = require('@/lib/redis-client');

export async function GET(request) {
  try {
    const startTime = Date.now();
    
    // Basic health check
    const health = await redis.healthCheck();
    const stats = await redis.getStats();
    
    // Test basic operations
    const testKey = `health_check_${Date.now()}`;
    await redis.set(testKey, 'test', 10);
    const testValue = await redis.get(testKey);
    await redis.del(testKey);
    
    const responseData = {
      status: health.status,
      connection: health.connection,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      stats,
      test: {
        write: 'OK',
        read: testValue === 'test' ? 'OK' : 'FAILED',
        delete: 'OK'
      }
    };
    
    // Determine HTTP status
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 207 : 503;
    
    return NextResponse.json(responseData, { status: statusCode });
    
  } catch (error) {
    console.error('Redis health check error:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to check Redis health',
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}