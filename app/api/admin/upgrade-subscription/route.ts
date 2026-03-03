/**
 * Admin Subscription Upgrade Endpoint
 *
 * Upgrades a user's subscription to a specified plan.
 * Protected by admin API key or admin JWT.
 * Uses Supabase REST API instead of Prisma (connection pooler is broken).
 *
 * @route POST /api/admin/upgrade-subscription
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL (CRITICAL)
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access (CRITICAL)
 * - ADMIN_API_KEY: Admin authentication key (SECRET)
 * - JWT_SECRET: Token verification key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PLAN_LIMITS } from '@/lib/stripe/subscription-service';

// =============================================================================
// Supabase Admin Client
// =============================================================================

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// =============================================================================
// Schema
// =============================================================================

const upgradeSchema = z.object({
  email: z.string().email(),
  plan: z.enum(['professional', 'business', 'custom']),
});

// =============================================================================
// Helpers
// =============================================================================

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// =============================================================================
// Admin Auth
// =============================================================================

async function verifyAdmin(request: NextRequest): Promise<{
  isAdmin: boolean;
  userId?: string;
  error?: string;
}> {
  const apiKey = request.headers.get('x-admin-api-key');
  if (apiKey && safeCompare(apiKey, process.env.ADMIN_API_KEY ?? '')) {
    return { isAdmin: true };
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { isAdmin: false, error: 'Authentication required' };
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { verifyToken } = await import('@/lib/auth/jwt-utils');
    const decoded = verifyToken(token) as {
      userId: string;
      role?: string;
    };

    const supabaseAdmin = getSupabaseAdmin();
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, preferences')
      .eq('id', decoded.userId)
      .single();

    const prefs = user?.preferences as { role?: string } | null;
    if (!user || (prefs?.role !== 'admin' && prefs?.role !== 'superadmin')) {
      return { isAdmin: false, userId: decoded.userId, error: 'Admin access required' };
    }

    return { isAdmin: true, userId: decoded.userId };
  } catch {
    return { isAdmin: false, error: 'Invalid token' };
  }
}

// =============================================================================
// POST - Upgrade Subscription
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: auth.error || 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = upgradeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { email, plan } = validation.data;
    const limits = PLAN_LIMITS[plan];

    if (!limits) {
      return NextResponse.json(
        { error: 'Invalid plan', message: `Plan "${plan}" not found` },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Find user by email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not Found', message: `No user found with email: ${email}` },
        { status: 404 }
      );
    }

    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    // Check if subscription exists
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('userId', user.id)
      .maybeSingle();

    let subscription;

    if (existingSub) {
      // Update existing subscription
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .update({
          plan,
          status: 'active',
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: oneYearFromNow.toISOString(),
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          maxSocialAccounts: limits.maxSocialAccounts,
          maxAiPosts: limits.maxAiPosts,
          maxPersonas: limits.maxPersonas,
        })
        .eq('userId', user.id)
        .select()
        .single();

      if (error) throw error;
      subscription = data;
    } else {
      // Create new subscription
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          userId: user.id,
          plan,
          status: 'active',
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: oneYearFromNow.toISOString(),
          maxSocialAccounts: limits.maxSocialAccounts,
          maxAiPosts: limits.maxAiPosts,
          maxPersonas: limits.maxPersonas,
        })
        .select()
        .single();

      if (error) throw error;
      subscription = data;
    }

    // Create audit log
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        userId: auth.userId || 'system',
        action: 'subscription_upgraded',
        resource: 'subscription',
        resourceId: subscription.id,
        details: {
          targetEmail: email,
          targetUserId: user.id,
          plan,
          limits,
        },
        severity: 'high',
        category: 'admin',
        outcome: 'success',
      });

    return NextResponse.json({
      success: true,
      message: `Subscription upgraded to ${plan}`,
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          limits: {
            maxSocialAccounts: subscription.maxSocialAccounts,
            maxAiPosts: subscription.maxAiPosts,
            maxPersonas: subscription.maxPersonas,
          },
        },
      },
    });
  } catch (error: unknown) {
    console.error('Admin upgrade subscription error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to upgrade subscription',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
