/**
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STRIPE_SECRET_KEY: Stripe secret key for API operations (CRITICAL)
 * - NEXT_PUBLIC_APP_URL: Application URL for redirects (PUBLIC)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 * 
 * FAILURE MODE: Returns error response if missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/config';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequestOrCookies, verifyTokenSafe, unauthorizedResponse } from '@/lib/auth/jwt-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        { 
          error: 'Billing portal not available',
          message: 'Payment processing is not configured yet. Contact support for billing inquiries.',
          bypass: true 
        },
        { status: 503 }
      );
    }

    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get user from token
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    // Extract email from token for Stripe customer creation
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const tokenPayload = authToken ? verifyTokenSafe(authToken) : null;
    const userEmail = tokenPayload?.email || '';

    // Get user's Stripe customer ID from database
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    let customerId = subscription?.stripe_customer_id;

    // If no customer exists, create one
    if (!customerId) {
      const customer = await stripe!.customers.create({
        email: userEmail,
        metadata: {
          userId,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          status: 'inactive',
          plan: 'free',
        });
    }

    // Create billing portal session
    const session = await stripe!.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}