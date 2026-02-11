import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In-memory error storage (use database in production)
const errorLog: any[] = [];
const MAX_ERRORS = 1000;

export async function POST(request: NextRequest) {
  try {
    const error = await request.json();
    
    // Add server timestamp
    error.serverTimestamp = new Date().toISOString();
    
    // Get user info from session if available
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          error.userId = user.id;
          error.userEmail = user.email;
        }
      } catch (authError) {
        console.error('Failed to get user from token:', authError);
      }
    }

    // Store error (in production, save to database)
    errorLog.unshift(error);
    if (errorLog.length > MAX_ERRORS) {
      errorLog.length = MAX_ERRORS;
    }

    // Log critical errors
    if (error.level === 'error') {
      console.error('[Error Tracking]', {
        message: error instanceof Error ? error.message : String(error),
        stack: error.stack,
        context: error.context,
        timestamp: error.timestamp
      });
    }

    // TODO: Send to external monitoring service (Sentry, etc.)
    // if (process.env.SENTRY_DSN) {
    //   await sendToSentry(error);
    // }

    return NextResponse.json({ 
      success: true, 
      id: error.id 
    });
  } catch (err) {
    console.error('Error tracking failed:', err);
    return NextResponse.json(
      { error: 'Failed to track error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const level = searchParams.get('level');
    const startDate = searchParams.get('startDate');
    
    let errors = [...errorLog];
    
    // Filter by level if specified
    if (level) {
      errors = errors.filter(e => e.level === level);
    }
    
    // Filter by date if specified
    if (startDate) {
      const start = new Date(startDate);
      errors = errors.filter(e => new Date(e.timestamp) >= start);
    }
    
    // Apply limit
    errors = errors.slice(0, limit);
    
    // Calculate statistics
    const stats = {
      total: errorLog.length,
      last24Hours: errorLog.filter(e => {
        const date = new Date(e.timestamp);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return date > dayAgo;
      }).length,
      byLevel: {
        error: errorLog.filter(e => e.level === 'error').length,
        warning: errorLog.filter(e => e.level === 'warning').length,
        info: errorLog.filter(e => e.level === 'info').length
      }
    };
    
    return NextResponse.json({
      errors,
      stats
    });
  } catch (err) {
    console.error('Failed to retrieve errors:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve errors' },
      { status: 500 }
    );
  }
}