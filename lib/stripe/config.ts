/**
 * Stripe Configuration
 *
 * ENVIRONMENT VARIABLES (OPTIONAL):
 * - STRIPE_SECRET_KEY: Stripe secret key for API operations
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Stripe publishable key for client-side
 * - STRIPE_WEBHOOK_SECRET: Webhook endpoint secret for verification
 * - NEXT_PUBLIC_APP_URL: Application URL for redirects
 *
 * Active plans (prod_* = Stripe product ID):
 * - STRIPE_STARTER_PRICE_ID:          $49 AUD/mo   — prod_Tx8gdIuaNqDMVS
 * - STRIPE_INTRODUCTORY_PRICE_ID:     $99 AUD/mo   — prod_Tx8cWpkBV5RP5X (2 months, then transitions to Pro)
 * - STRIPE_PRO_PRICE_ID:              $249 AUD/mo  — prod_Tx8cWpkBV5RP5X
 * - STRIPE_ENTERPRISE_PRICE_ID:       $249 AUD/mo  — prod_Tx8jZd59rVws68 (base, 1 business)
 * - STRIPE_ENTERPRISE_TIER_PRICE_ID:  $99 AUD/mo   — prod_Tx8jZd59rVws68 (per additional business)
 *
 * Legacy (kept for existing subscribers — do not remove):
 * - STRIPE_GROWTH_PRICE_ID, STRIPE_SCALE_PRICE_ID
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
  // ── STARTER ────────────────────────────────────────────────────────────────
  // prod_Tx8gdIuaNqDMVS | $49/mo AUD
  starter: {
    name: 'Starter',
    productId: 'prod_Tx8gdIuaNqDMVS',
    priceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter_placeholder',
    price: 49,
    features: {
      socialAccounts: 3,
      aiPosts: 50,
      personas: 1,
      analytics: 'basic',
      support: 'email',
      scheduling: true,
      aiVoiceSamples: 30,
    },
  },

  // ── PROFESSIONAL — INTRODUCTORY ────────────────────────────────────────────
  // prod_Tx8cWpkBV5RP5X | $99/mo AUD (first 2 months via Subscription Schedule,
  // then auto-transitions to STRIPE_PRO_PRICE_ID at $249/mo)
  introductory: {
    name: 'Introductory',
    productId: 'prod_Tx8cWpkBV5RP5X',
    priceId:
      process.env.STRIPE_INTRODUCTORY_PRICE_ID ||
      'price_introductory_placeholder',
    price: 99,
    transitionToPriceId:
      process.env.STRIPE_PRO_PRICE_ID || 'price_pro_placeholder',
    transitionAfterCycles: 2,
    features: {
      socialAccounts: 5,
      aiPosts: 100,
      personas: 3,
      analytics: 'professional',
      support: 'email',
      scheduling: true,
      contentLibrary: true,
      basicAutomation: true,
    },
  },

  // ── PROFESSIONAL ───────────────────────────────────────────────────────────
  // prod_Tx8cWpkBV5RP5X | $249/mo AUD (default price on product)
  pro: {
    name: 'Professional',
    productId: 'prod_Tx8cWpkBV5RP5X',
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_placeholder',
    price: 249,
    features: {
      socialAccounts: 5,
      aiPosts: 100,
      personas: 3,
      analytics: 'professional',
      support: 'email',
      scheduling: true,
      contentLibrary: true,
      basicAutomation: true,
    },
  },

  // ── ENTERPRISE ─────────────────────────────────────────────────────────────
  // prod_Tx8jZd59rVws68 | $249/mo base + $99/mo per additional business
  // Checkout: two line items — priceId × 1, tierPriceId × (additional locations)
  enterprise: {
    name: 'Enterprise',
    productId: 'prod_Tx8jZd59rVws68',
    priceId:
      process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder',
    price: 249,
    // Per-location add-on ($99/mo each additional business)
    tierPriceId:
      process.env.STRIPE_ENTERPRISE_TIER_PRICE_ID ||
      'price_enterprise_tier_placeholder',
    tierPrice: 99,
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
      multiBusiness: true,
    },
  },

  // ── LEGACY (kept for existing subscribers — do not remove or break) ─────────
  growth: {
    name: 'Growth',
    productId: '',
    priceId:
      process.env.STRIPE_GROWTH_PRICE_ID ||
      process.env.STRIPE_BUSINESS_PRICE_ID ||
      'price_growth_placeholder',
    price: 449,
    features: {
      socialAccounts: 10,
      aiPosts: -1,
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
  scale: {
    name: 'Scale',
    productId: '',
    priceId:
      process.env.STRIPE_SCALE_PRICE_ID ||
      process.env.STRIPE_CUSTOM_PRICE_ID ||
      'price_scale_placeholder',
    price: 799,
    features: {
      socialAccounts: -1,
      aiPosts: -1,
      personas: -1,
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
  // At minimum, the Starter plan price ID must be a real Stripe ID
  return !PRODUCTS.starter.priceId.includes('placeholder');
}

export function getProductByPriceId(priceId: string) {
  return Object.values(PRODUCTS).find(
    p =>
      p.priceId === priceId || ('tierPriceId' in p && p.tierPriceId === priceId)
  );
}

export function getProductByName(name: string) {
  const key = name.toLowerCase() as keyof typeof PRODUCTS;
  return PRODUCTS[key];
}

// Add-on price IDs
export const AUTHORITY_ADDON_PRICE_ID =
  process.env.STRIPE_AUTHORITY_ADDON_PRICE_ID || '';
