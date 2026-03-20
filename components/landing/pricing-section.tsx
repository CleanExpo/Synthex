'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import NumberFlow from '@number-flow/react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { buttonVariants } from '@/components/ui/button';

interface PricingPlan {
  name: string;
  price: number | null;
  yearlyPrice: number | null;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
  isEnterprise?: boolean;
}

const PLANS: PricingPlan[] = [
  {
    name: 'Starter',
    price: 49,
    yearlyPrice: 39,
    period: 'mo',
    features: [
      '1 user seat',
      'Connect up to 3 social platforms',
      '50 AI-generated posts per month',
      'AI voice training (up to 30 samples)',
      'Basic analytics dashboard',
      'Content calendar & scheduling',
      'Email support',
    ],
    description:
      'Solo creators and freelancers just getting started with AI content',
    buttonText: 'Start Free Trial',
    href: '/signup',
    isPopular: false,
  },
  {
    name: 'Pro',
    price: 99,
    yearlyPrice: 79,
    period: 'mo',
    features: [
      'Up to 5 user seats',
      'All 9 social platforms',
      'Unlimited AI-generated posts',
      'Advanced analytics & competitor insights',
      'A/B testing for content variations',
      'Hashtag intelligence & trending topics',
      'Priority email & chat support',
      'Team collaboration tools',
    ],
    description: 'Growing brands and small teams managing multiple platforms',
    buttonText: 'Start Free Trial',
    href: '/signup',
    isPopular: true,
  },
  {
    name: 'Agency',
    price: 249,
    yearlyPrice: 199,
    period: 'mo',
    features: [
      'Unlimited user seats',
      'Unlimited client workspaces',
      'Separate brand voices per client',
      'White-label PDF reports',
      'Custom branding on client dashboards',
      'API access',
      'Dedicated account manager',
      'SLA-backed support (4-hour response)',
    ],
    description: 'Agencies managing multiple client brands',
    buttonText: 'Start Free Trial',
    href: '/signup',
    isPopular: false,
  },
];

interface PricingSectionProps {
  title?: string;
  description?: string;
}

export function PricingSection({
  title = 'Simple, Transparent Pricing',
  description = 'Choose the plan that works for you. All plans include a 14-day free trial.',
}: PricingSectionProps) {
  const [isMonthly, setIsMonthly] = useState(true);
  const [isDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const switchRef = useRef<HTMLButtonElement>(null);

  const handleToggle = (checked: boolean) => {
    setIsMonthly(!checked);
    if (checked && switchRef.current) {
      const rect = switchRef.current.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      confetti({
        particleCount: 50,
        spread: 60,
        origin: {
          x: x / window.innerWidth,
          y: y / window.innerHeight,
        },
        colors: ['#f59e0b', '#d97706', '#fde68a'],
        ticks: 200,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
        shapes: ['circle'],
      });
    }
  };

  return (
    <div className="container py-20 md:py-28">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-white">
          {title}
        </h2>
        <p className="text-white/60 text-lg whitespace-pre-line">
          {description}
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex justify-center items-center gap-3 mb-10">
        <Label className="text-white/60 text-sm font-medium">Monthly</Label>
        <Switch
          ref={switchRef as React.RefObject<HTMLButtonElement>}
          checked={!isMonthly}
          onCheckedChange={handleToggle}
          className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-white/10"
        />
        <span className="text-sm font-medium text-white/60">
          Annual{' '}
          <span className="inline-flex items-center bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs px-2.5 py-0.5 font-semibold ml-1">
            Save 20%
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan, index) => (
          <motion.div
            key={index}
            initial={{ y: 50, opacity: 0 }}
            whileInView={
              isDesktop
                ? {
                    y: plan.isPopular ? -12 : 0,
                    opacity: 1,
                    scale: plan.isPopular ? 1.02 : 1.0,
                  }
                : { opacity: 1, y: 0 }
            }
            viewport={{ once: true }}
            transition={{
              duration: 1.6,
              type: 'spring',
              stiffness: 100,
              damping: 30,
              delay: 0.1 + index * 0.1,
              opacity: { duration: 0.5 },
            }}
            className={cn(
              'rounded-2xl border p-6 text-center flex flex-col relative',
              plan.isPopular
                ? 'border-amber-500/40 bg-amber-500/[0.04] shadow-2xl shadow-amber-500/10 ring-1 ring-amber-500/20'
                : 'border-white/[0.08] bg-charcoal-800/60 shadow-lg shadow-black/30',
              !plan.isPopular && 'mt-5'
            )}
          >
            {/* Most Popular badge */}
            {plan.isPopular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs px-3 py-1 font-semibold whitespace-nowrap">
                  <Star className="h-3 w-3 fill-current" />
                  Most Popular
                </span>
              </div>
            )}

            <div className="flex-1 flex flex-col">
              <p className="text-base font-semibold text-white/60 mt-2">
                {plan.name}
              </p>

              <div className="mt-6 flex items-end justify-center gap-x-1">
                {plan.isEnterprise ? (
                  <span className="text-4xl font-bold tracking-tight text-white">
                    Custom
                  </span>
                ) : (
                  <>
                    <span className="text-5xl font-bold tracking-tight text-white">
                      <NumberFlow
                        value={
                          isMonthly
                            ? (plan.price ?? 0)
                            : (plan.yearlyPrice ?? 0)
                        }
                        format={{
                          style: 'currency',
                          currency: 'AUD',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }}
                        transformTiming={{
                          duration: 500,
                          easing: 'ease-out',
                        }}
                        willChange
                        className="tabular-nums"
                      />
                    </span>
                    <span className="text-sm font-semibold leading-6 tracking-wide text-white/40 mb-1.5">
                      /{plan.period}
                    </span>
                  </>
                )}
              </div>

              {!plan.isEnterprise && (
                <p className="text-xs leading-5 text-white/40 mt-1">
                  {isMonthly ? 'billed monthly' : 'billed annually'}
                </p>
              )}
              {plan.isEnterprise && (
                <p className="text-xs leading-5 text-white/40 mt-1">
                  contact us for pricing
                </p>
              )}

              <ul className="mt-5 gap-2 flex flex-col text-left">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <hr className="w-full my-4 border-white/[0.06]" />

              <Link
                href={plan.href}
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'group relative w-full gap-2 overflow-hidden text-sm font-semibold tracking-tight rounded-full py-3',
                  'transition-all duration-300',
                  plan.isPopular
                    ? 'bg-amber-500 text-charcoal-900 border-amber-500 hover:bg-amber-400 hover:border-amber-400'
                    : 'bg-transparent text-white border-white/20 hover:border-amber-500/50 hover:bg-amber-500/[0.08] hover:text-amber-300'
                )}
              >
                {plan.buttonText}
              </Link>

              <p className="mt-4 text-xs leading-5 text-white/40">
                {plan.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default PricingSection;
