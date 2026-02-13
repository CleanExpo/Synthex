/**
 * ENVIRONMENT VARIABLES (OPTIONAL):
 * - STRIPE_SECRET_KEY: Stripe secret key for API operations
 * - STRIPE_PUBLISHABLE_KEY: Stripe publishable key for client-side
 * - STRIPE_WEBHOOK_SECRET: Webhook endpoint secret for verification
 * - NEXT_PUBLIC_APP_URL: Application URL for redirects
 * 
 * FAILURE MODE: Stripe features disabled if not configured
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

// Product/Price IDs - These should match your Stripe dashboard
// Using placeholder IDs - replace with actual Stripe price IDs
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

export function getProductByPriceId(priceId: string) {
  return Object.values(PRODUCTS).find(product => product.priceId === priceId);
}

export function getProductByName(name: string) {
  return PRODUCTS[name.toLowerCase() as keyof typeof PRODUCTS];
}