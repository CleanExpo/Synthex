/**
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL (PUBLIC)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anonymous key (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: For bypassing RLS (SECRET) - optional but recommended
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * FAILURE MODE: Returns error response if missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// Use anon key since RLS policy allows SELECT for all authenticated API requests
// Service role key can be added back when properly rotated
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get user ID from security context (already verified by APISecurityChecker)
    const userId = security.context.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get subscription details
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error;
    }

    // If no subscription found, return free tier
    if (!subscription) {
      return NextResponse.json({
        plan: 'free',
        status: 'inactive',
        features: {
          socialAccounts: 1,
          aiPosts: 5,
          personas: 1,
          analytics: 'basic',
          support: 'community',
        },
      });
    }

    // Get plan features based on subscription
    const planFeatures = {
      professional: {
        socialAccounts: 5,
        aiPosts: 100,
        personas: 3,
        analytics: 'professional',
        support: 'email',
        scheduling: true,
        contentLibrary: true,
      },
      business: {
        socialAccounts: 10,
        aiPosts: -1, // unlimited
        personas: 10,
        analytics: 'advanced',
        support: 'priority',
        patternAnalysis: true,
        customAI: true,
        competitorAnalysis: true,
        abTesting: true,
        teamCollaboration: true,
      },
      custom: {
        socialAccounts: -1, // unlimited
        aiPosts: -1, // unlimited
        personas: -1, // unlimited
        analytics: 'enterprise',
        support: 'dedicated',
        apiAccess: true,
        whiteLabel: true,
        customIntegrations: true,
        sla: true,
        onPremise: true,
      },
      free: {
        socialAccounts: 1,
        aiPosts: 5,
        personas: 1,
        analytics: 'basic',
        support: 'community',
      },
    };

    return NextResponse.json({
      ...subscription,
      features: planFeatures[subscription.plan as keyof typeof planFeatures] || planFeatures.free,
    });
  } catch (error: any) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch subscription details',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        code: error?.code
      },
      { status: 500 }
    );
  }
}