'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, X } from '@/components/icons';
import { CheckoutButton } from '@/components/stripe/checkout-button';

type BillingCycle = 'monthly' | 'annual';

interface Plan {
  name: string;
  displayName?: string;
  monthlyPrice: string;
  annualPrice?: string;
  description: string;
  features: string[];
  notIncluded: string[];
  popular?: boolean;
  isFree?: boolean;
  isCustom?: boolean;
  isIntroductory?: boolean;
  ctaLabel: string;
  ctaHref?: string;
}

const plans: Plan[] = [
  {
    // prod_Tx8gdIuaNqDMVS — price_1TCO8GGib5mMf28d0W7pYdtY — $49/mo AUD
    name: 'Starter',
    monthlyPrice: '$49',
    description:
      'Everything you need to get started with AI-powered social media marketing',
    features: [
      '1 user seat',
      'Connect up to 3 social platforms',
      '50 AI-generated posts/month',
      'AI voice training (up to 30 samples)',
      'Basic analytics dashboard',
      'Content calendar & scheduling',
      'Email support',
    ],
    notIncluded: [
      'Content library access',
      'Persona profiles',
      'Advanced analytics',
      'Team collaboration',
    ],
    ctaLabel: 'Start Free Trial',
  },
  {
    // prod_Tx8cWpkBV5RP5X — price_1TCNtQGib5mMf28d0AD1agWQ — $99/mo for 2 months
    // then auto-transitions to price_1SzEKxGib5mMf28dZt4YEcYC ($249/mo)
    // Internal name must stay 'Introductory' for Stripe checkout routing
    name: 'Introductory',
    displayName: 'Professional (Starter Pack)',
    monthlyPrice: '$99',
    description:
      'Launch offer — full Professional features for 2 months, then $249/mo',
    features: [
      '5 social media accounts',
      '100 AI-generated posts/month',
      'Professional analytics',
      'Email support',
      '3 persona profiles',
      'Smart scheduling',
      'Content library access',
      'Basic automation',
      'Auto-transitions to Professional after 2 months',
    ],
    notIncluded: [],
    popular: true,
    isIntroductory: true,
    ctaLabel: 'Claim Intro Offer',
  },
  {
    // prod_Tx8cWpkBV5RP5X — price_1SzEKxGib5mMf28dZt4YEcYC — $249/mo AUD (default)
    name: 'Pro',
    displayName: 'Professional',
    monthlyPrice: '$249',
    annualPrice: '$199',
    description:
      'The complete AI marketing toolkit for professionals and growing teams',
    features: [
      '5 social media accounts',
      '100 AI-generated posts/month',
      'Professional analytics',
      'Email support',
      '3 persona profiles',
      'Smart scheduling',
      'Content library access',
      'Basic automation',
    ],
    notIncluded: [
      'Multiple business locations',
      'White-label solution',
      'Dedicated account manager',
      'API access',
    ],
    ctaLabel: 'Start Free Trial',
  },
  {
    // prod_Tx8jZd59rVws68 — price_1TCOOYGib5mMf28dszIDjxan ($249 base)
    //                      + price_1TCOOYGib5mMf28dWMxRfEFo ($99/additional business)
    name: 'Enterprise',
    monthlyPrice: '$249',
    description: '$249/mo base + $99/mo per additional business location',
    features: [
      'Everything in Professional',
      'Multiple business locations',
      'Unlimited social accounts',
      'Unlimited AI-generated posts',
      'Enterprise analytics suite',
      'Dedicated account manager',
      'Unlimited persona profiles',
      'Full API access',
      'White-label solution',
      'SLA guarantee',
      'Custom integrations',
      'Custom workflows',
    ],
    notIncluded: [],
    isCustom: true,
    ctaLabel: 'Contact Sales',
    ctaHref: '/contact',
  },
];

function PlanCard({ plan, billing }: { plan: Plan; billing: BillingCycle }) {
  const isAnnual = billing === 'annual';
  const displayPrice =
    plan.isFree || plan.isCustom
      ? plan.monthlyPrice
      : isAnnual && plan.annualPrice
        ? plan.annualPrice
        : plan.monthlyPrice;

  const showSavingsBadge =
    isAnnual && !plan.isFree && !plan.isCustom && plan.annualPrice;

  return (
    <Card
      variant={plan.popular ? 'glass-primary' : 'glass'}
      className={`p-8 relative bg-surface-base/80 backdrop-blur-sm border border-orange-500/10 hover:border-orange-500/30 transition-all duration-300 ${
        plan.popular
          ? 'scale-105 border-orange-500/30 shadow-lg shadow-orange-500/10'
          : ''
      }`}
    >
      {plan.isIntroductory && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-gradient-to-r from-orange-500 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg shadow-orange-500/25">
            Launch Offer
          </span>
        </div>
      )}
      {plan.popular && !plan.isIntroductory && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg shadow-orange-500/25">
            Most Popular
          </span>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">
          {plan.displayName ?? plan.name}
        </h3>
        <div className="mb-2 flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-300">
            {displayPrice}
          </span>
          {!plan.isFree && !plan.isCustom && (
            <span className="text-gray-500">/mo</span>
          )}
        </div>
        {plan.isIntroductory && (
          <p className="text-orange-400/80 text-xs font-medium mt-1">
            then $249/mo after 2 months
          </p>
        )}
        {showSavingsBadge && (
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
            Save 20%
          </span>
        )}
        <p className="text-gray-500 text-sm mt-2">{plan.description}</p>
      </div>

      <div className="space-y-4 mb-8">
        {plan.features.map(feature => (
          <div key={feature} className="flex items-start space-x-3">
            <Check className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <span className="text-gray-300 text-sm">{feature}</span>
          </div>
        ))}
        {plan.notIncluded.map(feature => (
          <div key={feature} className="flex items-start space-x-3 opacity-50">
            <X className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
            <span className="text-gray-600 text-sm">{feature}</span>
          </div>
        ))}
      </div>

      {plan.isFree && plan.ctaHref ? (
        <Link href={plan.ctaHref} className="block">
          <Button
            className="w-full bg-surface-dark border border-orange-500/20 text-gray-300 hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/40 transition-all duration-300"
            size="lg"
          >
            {plan.ctaLabel}
          </Button>
        </Link>
      ) : plan.isCustom && plan.ctaHref ? (
        <Link href={plan.ctaHref} className="block">
          <Button
            className="w-full bg-surface-dark border border-orange-500/20 text-gray-300 hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/40 transition-all duration-300"
            size="lg"
          >
            Contact Sales
          </Button>
        </Link>
      ) : (
        <CheckoutButton
          planName={plan.name}
          className={`w-full ${
            plan.popular
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40'
              : 'bg-surface-dark border border-orange-500/20 text-gray-300 hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/40'
          } transition-all duration-300`}
        >
          {plan.ctaLabel}
        </CheckoutButton>
      )}
    </Card>
  );
}

export function PricingGrid() {
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  return (
    <div className="max-w-7xl mx-auto">
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-4 mb-12">
        <span
          className={`text-sm font-medium transition-colours duration-200 ${
            billing === 'monthly' ? 'text-white' : 'text-gray-500'
          }`}
        >
          Monthly
        </span>
        <button
          type="button"
          onClick={() =>
            setBilling(billing === 'monthly' ? 'annual' : 'monthly')
          }
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colours duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] ${
            billing === 'annual' ? 'bg-orange-500' : 'bg-gray-700'
          }`}
          aria-label="Toggle billing cycle"
          aria-pressed={billing === 'annual'}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
              billing === 'annual' ? 'translate-x-8' : 'translate-x-1'
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium transition-colours duration-200 ${
            billing === 'annual' ? 'text-white' : 'text-gray-500'
          }`}
        >
          Annual
          <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
            Save 20%
          </span>
        </span>
      </div>

      {/* Cards grid — 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map(plan => (
          <PlanCard key={plan.name} plan={plan} billing={billing} />
        ))}
      </div>
    </div>
  );
}
