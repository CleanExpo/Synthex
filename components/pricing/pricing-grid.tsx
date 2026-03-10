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
  monthlyPrice: string;
  annualPrice?: string;
  description: string;
  features: string[];
  notIncluded: string[];
  popular?: boolean;
  isFree?: boolean;
  isCustom?: boolean;
  ctaLabel: string;
  ctaHref?: string;
}

const plans: Plan[] = [
  {
    name: 'Starter',
    monthlyPrice: 'Free',
    description: '14-day trial — no credit card required',
    features: [
      '2 social accounts',
      '10 AI posts/month',
      'Basic analytics',
      '1 persona profile',
    ],
    notIncluded: [],
    isFree: true,
    ctaLabel: 'Start Free Trial',
    ctaHref: '/signup',
  },
  {
    name: 'Pro',
    monthlyPrice: '$249',
    annualPrice: '$199',
    description: 'Perfect for professionals and content creators',
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
      'Advanced pattern analysis',
      'Custom AI training',
      'Team collaboration',
      'Priority support',
    ],
    ctaLabel: 'Start Free Trial',
  },
  {
    name: 'Growth',
    monthlyPrice: '$449',
    annualPrice: '$359',
    description: 'For businesses and marketing teams',
    features: [
      '10 social media accounts',
      'Unlimited AI-generated posts',
      'Advanced analytics & insights',
      'Priority email & chat support',
      '10 persona profiles',
      'Smart scheduling with AI optimisation',
      'Viral pattern analysis',
      'Custom AI training',
      'Competitor analysis',
      'A/B testing tools',
      'Team collaboration tools',
      'Brand voice customisation',
    ],
    notIncluded: [
      'White-label solution',
      'Dedicated account manager',
      'API access',
    ],
    popular: true,
    ctaLabel: 'Start Free Trial',
  },
  {
    name: 'Scale',
    monthlyPrice: '$799',
    annualPrice: '$639',
    description: 'Enterprise solutions tailored to your needs',
    features: [
      'Unlimited social media accounts',
      'Unlimited AI-generated posts',
      'Enterprise analytics suite',
      'Dedicated account manager',
      'Unlimited persona profiles',
      'Custom AI model training',
      'Full API access',
      'White-label solution',
      'SLA guarantee',
      'Custom integrations',
      'On-premise deployment option',
      'Advanced security features',
      'Custom workflows',
      'Priority development',
    ],
    notIncluded: [],
    ctaLabel: 'Start Free Trial',
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

  const showSavingsBadge = isAnnual && !plan.isFree && !plan.isCustom && plan.annualPrice;

  return (
    <Card
      variant={plan.popular ? 'glass-primary' : 'glass'}
      className={`p-8 relative bg-surface-base/80 backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300 ${
        plan.popular ? 'scale-105 border-cyan-500/30 shadow-lg shadow-cyan-500/10' : ''
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg shadow-cyan-500/25">
            Most Popular
          </span>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
        <div className="mb-2 flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
            {displayPrice}
          </span>
          {!plan.isFree && !plan.isCustom && (
            <span className="text-gray-500">/mo</span>
          )}
        </div>
        {showSavingsBadge && (
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
            Save 20%
          </span>
        )}
        <p className="text-gray-500 text-sm mt-2">{plan.description}</p>
      </div>

      <div className="space-y-4 mb-8">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-start space-x-3">
            <Check className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <span className="text-gray-300 text-sm">{feature}</span>
          </div>
        ))}
        {plan.notIncluded.map((feature) => (
          <div key={feature} className="flex items-start space-x-3 opacity-50">
            <X className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
            <span className="text-gray-600 text-sm">{feature}</span>
          </div>
        ))}
      </div>

      {plan.isFree && plan.ctaHref ? (
        <Link href={plan.ctaHref} className="block">
          <Button
            className="w-full bg-surface-dark border border-cyan-500/20 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/40 transition-all duration-300"
            size="lg"
          >
            {plan.ctaLabel}
          </Button>
        </Link>
      ) : plan.isCustom && plan.ctaHref ? (
        <Link href={plan.ctaHref} className="block">
          <Button
            className="w-full bg-surface-dark border border-cyan-500/20 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/40 transition-all duration-300"
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
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40'
              : 'bg-surface-dark border border-cyan-500/20 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/40'
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
          onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colours duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628] ${
            billing === 'annual' ? 'bg-cyan-500' : 'bg-gray-700'
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {plans.map((plan) => (
          <PlanCard key={plan.name} plan={plan} billing={billing} />
        ))}
      </div>
    </div>
  );
}
