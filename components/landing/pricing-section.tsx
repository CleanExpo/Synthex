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
  price: number;
  yearlyPrice: number;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
}

const PLANS: PricingPlan[] = [
  {
    name: 'Starter',
    price: 49,
    yearlyPrice: 39,
    period: 'per month',
    features: [
      '5 social accounts',
      '100 AI posts/month',
      'Basic analytics',
      'Email support',
    ],
    description: 'Perfect for individuals',
    buttonText: 'Start Free Trial',
    href: '/register',
    isPopular: false,
  },
  {
    name: 'Pro',
    price: 99,
    yearlyPrice: 79,
    period: 'per month',
    features: [
      '25 social accounts',
      'Unlimited AI posts',
      'Advanced analytics',
      'Priority support',
      'BYOK API keys',
      'Team collaboration',
    ],
    description: 'Ideal for growing teams',
    buttonText: 'Get Started',
    href: '/register',
    isPopular: true,
  },
  {
    name: 'Agency',
    price: 249,
    yearlyPrice: 199,
    period: 'per month',
    features: [
      'Unlimited accounts',
      'Unlimited AI posts',
      'White-label reports',
      'Dedicated support',
      'Custom integrations',
      'SLA agreement',
    ],
    description: 'For agencies and enterprises',
    buttonText: 'Contact Sales',
    href: '/contact',
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
        colors: ['#22d3ee', '#0891b2', '#06b6d4'],
        ticks: 200,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
        shapes: ['circle'],
      });
    }
  };

  return (
    <div className="container py-20">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-white">
          {title}
        </h2>
        <p className="text-white/60 text-lg whitespace-pre-line">{description}</p>
      </div>

      <div className="flex justify-center items-center gap-3 mb-10">
        <Label className="text-white/60 text-sm font-medium">Monthly</Label>
        <Switch
          ref={switchRef as React.RefObject<HTMLButtonElement>}
          checked={!isMonthly}
          onCheckedChange={handleToggle}
          className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-white/10"
        />
        <span className="text-sm font-medium text-white/60">
          Annual{' '}
          <span className="text-cyan-400 font-semibold">(Save 20%)</span>
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
                    y: plan.isPopular ? -20 : 0,
                    opacity: 1,
                    x: index === 2 ? -30 : index === 0 ? 30 : 0,
                    scale: index === 0 || index === 2 ? 0.94 : 1.0,
                  }
                : { opacity: 1, y: 0 }
            }
            viewport={{ once: true }}
            transition={{
              duration: 1.6,
              type: 'spring',
              stiffness: 100,
              damping: 30,
              delay: 0.4,
              opacity: { duration: 0.5 },
            }}
            className={cn(
              'rounded-sm border-[0.5px] p-6 text-center flex flex-col relative',
              plan.isPopular
                ? 'border-cyan-500/30 bg-cyan-500/[0.04]'
                : 'border-white/[0.06] bg-[#0a1628]',
              !plan.isPopular && 'mt-5',
              index === 0 && 'origin-right',
              index === 2 && 'origin-left'
            )}
          >
            {plan.isPopular && (
              <div className="absolute top-0 right-0 bg-cyan-500 py-0.5 px-2 rounded-bl-sm rounded-tr-sm flex items-center">
                <Star className="text-[#080e1a] h-4 w-4 fill-current" />
                <span className="text-[#080e1a] ml-1 font-sans font-semibold text-sm">
                  Popular
                </span>
              </div>
            )}

            <div className="flex-1 flex flex-col">
              <p className="text-base font-semibold text-white/60">{plan.name}</p>

              <div className="mt-6 flex items-center justify-center gap-x-2">
                <span className="text-5xl font-bold tracking-tight text-white">
                  <NumberFlow
                    value={isMonthly ? plan.price : plan.yearlyPrice}
                    format={{
                      style: 'currency',
                      currency: 'USD',
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
                <span className="text-sm font-semibold leading-6 tracking-wide text-white/40">
                  / {plan.period}
                </span>
              </div>

              <p className="text-xs leading-5 text-white/40 mt-1">
                {isMonthly ? 'billed monthly' : 'billed annually'}
              </p>

              <ul className="mt-5 gap-2 flex flex-col text-left">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-cyan-400 mt-1 flex-shrink-0" />
                    <span className="text-white/70 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <hr className="w-full my-4 border-white/[0.06]" />

              <Link
                href={plan.href}
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'group relative w-full gap-2 overflow-hidden text-sm font-semibold tracking-tight',
                  'transition-all duration-300',
                  plan.isPopular
                    ? 'bg-cyan-500 text-[#080e1a] border-cyan-500 hover:bg-cyan-400 hover:border-cyan-400'
                    : 'bg-transparent text-white border-white/[0.06] hover:border-cyan-500/30 hover:bg-cyan-500/[0.08] hover:text-cyan-300'
                )}
              >
                {plan.buttonText}
              </Link>

              <p className="mt-4 text-xs leading-5 text-white/40">{plan.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default PricingSection;
