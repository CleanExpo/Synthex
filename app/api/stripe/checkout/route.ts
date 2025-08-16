/**
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STRIPE_SECRET_KEY: Stripe secret key for API operations (CRITICAL)
 * - NEXT_PUBLIC_APP_URL: Application URL for redirects (PUBLIC)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 * 
 * FAILURE MODE: Returns error response if missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRODUCTS } from '@/lib/stripe/config';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        { 
          error: 'Payment processing not configured',
          message: 'Stripe is not set up yet. Contact support for manual subscription.',
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
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token || !process.env.JWT_SECRET) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      userId = decoded.userId || decoded.id;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    const { priceId, planName } = await request.json();

    // Validate the plan
    const product = planName ? PRODUCTS[planName.toLowerCase() as keyof typeof PRODUCTS] : null;
    const finalPriceId = priceId || product?.priceId;

    if (!finalPriceId) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400 }
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId,
        planName: product?.name || planName,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_email: undefined, // Will be collected in checkout
      subscription_data: {
        trial_period_days: 14, // 14-day free trial
        metadata: {
          userId,
          planName: product?.name || planName,
        },
      },
    });

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}