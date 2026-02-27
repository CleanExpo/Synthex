/**
 * Stripe Configuration
 *
 * ENVIRONMENT VARIABLES (OPTIONAL):
 * - STRIPE_SECRET_KEY: Stripe secret key for API operations
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Stripe publishable key for client-side
 * - STRIPE_WEBHOOK_SECRET: Webhook endpoint secret for verification
 * - NEXT_PUBLIC_APP_URL: Application URL for redirects
 * - STRIPE_PROFESSIONAL_PRICE_ID: Stripe price ID for Professional plan
 * - STRIPE_BUSINESS_PRICE_ID: Stripe price ID for Business plan
 * - STRIPE_CUSTOM_PRICE_ID: Stripe price ID for Custom/Enterprise plan
 *
 * FAILURE MODE: Stripe features disabled if not configured.
 * Placeholder price IDs are kept so the app compiles, but the checkout route
 * rejects them at runtime with a clear error message.
 */

import Stripe from 'stripe';

// Make Stripe optional - app works without it
const STRIPE_ENABLED = !!process.env.STRIPE_SECRET_KEY;

export const stripe = STRIPE_ENABLED
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-07-30.basil' as Stripe.LatestApiVersion,
      typescript: true,
    })
  : null;

// Product/Price IDs - These MUST match your Stripe dashboard
// Placeholder IDs are rejected at checkout time (see app/api/stripe/checkout/route.ts)
export const PRODUCTS = {
  professional: {
    name: 'Professional',
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || 'price_professional_placeholder',
    price: 249,
    features: {
      socialAccounts: 5,
      aiPosts: 100,
      personas: 3,
      analytics: 'professional',
      support: 'email',
      scheduling: true,
      contentLibrary: true,
    },
  },
  business: {
    name: 'Business',
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID || 'price_business_placeholder',
    price: 399,
    features: {
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
  },
  custom: {
    name: 'Custom',
    priceId: process.env.STRIPE_CUSTOM_PRICE_ID || 'price_custom_placeholder',
    price: -1, // custom pricing
    features: {
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
  },
};

/**
 * Check whether Stripe billing is fully configured (keys + at least one real price ID)
 */
export function isStripeBillingReady(): boolean {
  if (!STRIPE_ENABLED) return false;
  // At minimum, the Professional plan price ID must be a real Stripe ID
  return !PRODUCTS.professional.priceId.includes('placeholder');
}

export function getProductByPriceId(priceId: string) {
  return Object.values(PRODUCTS).find(product => product.priceId === priceId);
}

export function getProductByName(name: string) {
  return PRODUCTS[name.toLowerCase() as keyof typeof PRODUCTS];
}
