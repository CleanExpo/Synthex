/**
 * Authentication Health Check Endpoint
 * Used by monitoring and CI/CD to verify auth system status
 */

import { NextResponse } from 'next/server';
import { signInFlow } from '@/src/lib/auth/signInFlow';
import { authMonitor } from '@/src/lib/auth/monitoring';

// Force dynamic rendering - prevent static generation
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    status: 'healthy',
    checks: {
      demo_auth: false,
      session_validation: false,
      monitoring: false,
      database: false
    },
    errors: [] as string[],
    stats: {} as any
  };

  try {
    // Test 1: Demo authentication
    try {
      const demoResult = await signInFlow.authenticate('demo', {
        email: 'demo@synthex.com',
        password: 'demo123'
      });
      
      checks.checks.demo_auth = demoResult.success;
      if (!demoResult.success) {
        checks.errors.push(`Demo auth failed: ${demoResult.error}`);
      }
    } catch (error) {
      checks.checks.demo_auth = false;
      checks.errors.push(`Demo auth error: ${error}`);
    }

    // Test 2: Session validation
    try {
      // Create a test token
      const testResult = await signInFlow.authenticate('demo', {
        email: 'health-check@synthex.com',
        password: 'health-check'
      });
      
      if (testResult.success && testResult.session) {
        const validateResult = await signInFlow.validateSession(testResult.session.accessToken);
        checks.checks.session_validation = validateResult.success;
        
        // Clean up test session
        await signInFlow.signOut(testResult.session.accessToken);
      }
    } catch (error) {
      checks.checks.session_validation = false;
      checks.errors.push(`Session validation error: ${error}`);
    }

    // Test 3: Monitoring system
    try {
      const stats = authMonitor.getStats();
      checks.checks.monitoring = true;
      checks.stats = {
        totalEvents: stats.totalEvents,
        failureRate: stats.failures,
        successRate: stats.successRate.toFixed(2) + '%'
      };
    } catch (error) {
      checks.checks.monitoring = false;
      checks.errors.push(`Monitoring error: ${error}`);
    }

    // Test 4: Database connectivity (if configured)
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && 
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co') {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const { error } = await supabase.from('sessions').select('count').limit(1);
        checks.checks.database = !error;
        if (error) {
          checks.errors.push(`Database error: ${error.message}`);
        }
      } else {
        checks.checks.database = true; // Skip if not configured
      }
    } catch (error) {
      checks.checks.database = false;
      checks.errors.push(`Database error: ${error}`);
    }

    // Determine overall health
    const failedChecks = Object.values(checks.checks).filter(v => !v).length;
    if (failedChecks > 0) {
      checks.status = failedChecks > 2 ? 'unhealthy' : 'degraded';
    }

    // Return appropriate status code
    const statusCode = checks.status === 'healthy' ? 200 : 
                       checks.status === 'degraded' ? 206 : 503;

    return NextResponse.json(checks, { status: statusCode });

  } catch (error) {
    return NextResponse.json({
      ...checks,
      status: 'unhealthy',
      errors: [`Critical error: ${error}`]
    }, { status: 503 });
  }
}