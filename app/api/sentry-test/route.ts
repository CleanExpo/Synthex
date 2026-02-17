import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// Guard: disable in production — this is a dev/staging debug tool only
function productionGuard(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const guard = productionGuard();
  if (guard) return guard;
  try {
    // Check if Sentry is configured
    const isDsnConfigured = !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
    
    if (!isDsnConfigured) {
      return NextResponse.json({
        status: 'not_configured',
        message: 'Sentry DSN not found in environment variables',
        instructions: 'Please run: node setup-sentry.js'
      }, { status: 503 });
    }
    
    // Test based on query parameter
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'error') {
      // Trigger a test error
      throw new Error('Sentry test error - this is intentional!');
    }
    
    if (action === 'message') {
      // Send a test message
      Sentry.captureMessage('Sentry test message from SYNTHEX', 'info');
      return NextResponse.json({
        status: 'success',
        message: 'Test message sent to Sentry'
      });
    }
    
    if (action === 'user') {
      // Set user context and send event
      Sentry.setUser({
        id: 'test-user-123',
        email: 'test@synthex.social',
        username: 'testuser'
      });
      
      Sentry.captureMessage('User context test', 'info');
      
      return NextResponse.json({
        status: 'success',
        message: 'User context sent to Sentry'
      });
    }
    
    // Default response - show available tests
    return NextResponse.json({
      status: 'ready',
      message: 'Sentry is configured and ready',
      dsn_configured: isDsnConfigured,
      available_tests: {
        error: '/api/sentry-test?action=error',
        message: '/api/sentry-test?action=message',
        user: '/api/sentry-test?action=user'
      },
      instructions: 'Add ?action=error to trigger a test error'
    });
    
  } catch (error) {
    // This error will be captured by Sentry
    Sentry.captureException(error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Test error triggered successfully!',
      check_sentry: 'Check your Sentry dashboard for the error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = productionGuard();
  if (guard) return guard;

  try {
    const body = await request.json();
    
    // Custom error with context
    const error = new Error(body.message || 'Custom test error');
    
    Sentry.withScope((scope) => {
      scope.setTag('test', true);
      scope.setLevel('error');
      scope.setContext('test_data', body);
      Sentry.captureException(error);
    });
    
    return NextResponse.json({
      status: 'success',
      message: 'Custom error sent to Sentry with context'
    });
    
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to process request'
    }, { status: 500 });
  }
}