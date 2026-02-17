/**
 * Rate Limit Management API
 * Provides endpoints for checking and managing rate limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitStatus, resetRateLimits } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Get rate limit status
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(req);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const status = await getRateLimitStatus(userId);
    
    // Get user's subscription info
    const { data: user } = await supabase
      .from('users')
      .select('email, subscription_plan, rate_limit_override')
      .eq('id', userId)
      .single();
    
    return NextResponse.json({
      success: true,
      userId,
      email: user?.email,
      plan: user?.subscription_plan || 'free',
      customLimit: user?.rate_limit_override,
      status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    return NextResponse.json(
      { error: 'Failed to get rate limit status' },
      { status: 500 }
    );
  }
}

// POST: Reset rate limits (admin only)
export async function POST(req: NextRequest) {
  try {
    const adminKey = req.headers.get('x-admin-key');
    
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }
    
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }
    
    // Verify user exists
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Reset rate limits
    await resetRateLimits(userId);
    
    // Log admin action
    await supabase
      .from('audit_logs')
      .insert({
        action: 'rate_limit_reset',
        admin_id: 'system',
        target_user_id: userId,
        metadata: { reason: 'Admin manual reset' }
      });
    
    return NextResponse.json({
      success: true,
      message: `Rate limits reset for user ${user.email}`,
      userId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error resetting rate limits:', error);
    return NextResponse.json(
      { error: 'Failed to reset rate limits' },
      { status: 500 }
    );
  }
}

// PATCH: Update user's custom rate limit
export async function PATCH(req: NextRequest) {
  try {
    const adminKey = req.headers.get('x-admin-key');
    
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }
    
    const { userId, limit } = await req.json();
    
    if (!userId || typeof limit !== 'number') {
      return NextResponse.json(
        { error: 'User ID and numeric limit required' },
        { status: 400 }
      );
    }
    
    if (limit < 0 || limit > 100000) {
      return NextResponse.json(
        { error: 'Limit must be between 0 and 100000' },
        { status: 400 }
      );
    }
    
    // Update user's custom rate limit
    const { data: user, error } = await supabase
      .from('users')
      .update({ rate_limit_override: limit })
      .eq('id', userId)
      .select('email')
      .single();
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }
    
    // Log admin action
    await supabase
      .from('audit_logs')
      .insert({
        action: 'rate_limit_update',
        admin_id: 'system',
        target_user_id: userId,
        metadata: { 
          old_limit: null,
          new_limit: limit,
          reason: 'Admin manual update'
        }
      });
    
    return NextResponse.json({
      success: true,
      message: `Rate limit updated for user ${user.email}`,
      userId,
      newLimit: limit,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error updating rate limit:', error);
    return NextResponse.json(
      { error: 'Failed to update rate limit' },
      { status: 500 }
    );
  }
}