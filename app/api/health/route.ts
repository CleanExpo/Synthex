import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/supabase-client';

export async function GET() {
  try {
    // Check database connectivity
    let dbStatus = 'healthy';
    let dbLatency = 0;
    let dbMessage = 'Connected';
    
    try {
      const startTime = Date.now();
      const connectionTest = await testConnection();
      dbLatency = Date.now() - startTime;
      dbStatus = connectionTest.connected ? 'healthy' : 'unhealthy';
      dbMessage = connectionTest.message;
    } catch (dbError: any) {
      dbStatus = 'unhealthy';
      dbMessage = dbError.message || 'Connection failed';
      console.error('Database health check failed:', dbError);
    }
    
    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'ENCRYPTION_KEY',
      'JWT_SECRET',
      'OPENROUTER_API_KEY'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(
      varName => !process.env[varName]
    );
    
    const envStatus = missingEnvVars.length === 0 ? 'healthy' : 'degraded';
    
    // Determine overall health status
    const overallStatus = dbStatus === 'unhealthy' ? 'unhealthy' : 
                         envStatus === 'degraded' ? 'degraded' : 'healthy';
    
    // Prepare response
    const healthResponse = {
      status: overallStatus === 'healthy' ? 'ok' : overallStatus,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '2.0.1',
      message: `SYNTHEX API is ${overallStatus}`,
      checks: {
        database: {
          status: dbStatus,
          latency: `${dbLatency}ms`,
          message: dbMessage
        },
        environment: {
          status: envStatus,
          missingVars: missingEnvVars.length > 0 ? missingEnvVars : undefined
        }
      }
    };
    
    // Return appropriate status code based on health
    const statusCode = overallStatus === 'healthy' ? 200 : 
                       overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(healthResponse, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error: any) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '2.0.1',
      message: 'SYNTHEX API health check failed',
      error: error.message || 'Unknown error occurred'
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}