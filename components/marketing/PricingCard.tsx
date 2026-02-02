'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Zap } from 'lucide-react';

/**
 * Pricing Card Component
 * Premium pricing display with glassmorphism design
 *
 * @task UNI-413 - Implement Marketing Page Components
 */

export interface PricingFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

export interface PricingTier {
  name: string;
  description: string;
  price: string;
  period?: string;
  originalPrice?: string;
  features: PricingFeature[];
  ctaText?: string;
  ctaHref?: string;
  popular?: boolean;
  badge?: string;
  icon?: React.ReactNode;
}

export interface PricingCardProps {
  tier: PricingTier;
  onSelect?: (tier: PricingTier) => void;
  className?: string;
  variant?: 'default' | 'popular' | 'enterprise';
}

export function PricingCard({ tier, onSelect, className, variant = 'default' }: PricingCardProps) {
  const isPopular = variant === 'popular' || tier.popular;
  const isEnterprise = variant === 'enterprise';

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-500',
        isPopular
          ? 'glass-primary scale-105 z-10 shadow-[0_0_60px_rgba(139,92,246,0.2)]'
          : isEnterprise
            ? 'glass-gradient border-emerald-500/30'
            : 'glass hover:glass-interactive',
        className
      )}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-px left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" />
      )}

      {/* Badge */}
      {tier.badge && (
        <div className="absolute -right-8 top-6 rotate-45 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-10 py-1 text-xs font-semibold text-white shadow-lg">
          {tier.badge}
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-2">
          {tier.icon || (
            isPopular ? <Sparkles className="w-5 h-5 text-violet-400" /> :
            isEnterprise ? <Zap className="w-5 h-5 text-emerald-400" /> : null
          )}
          <h3 className={cn(
            'text-xl font-bold',
            isPopular ? 'text-white' : 'text-slate-100'
          )}>
            {tier.name}
          </h3>
        </div>
        <p className="text-sm text-slate-400">{tier.description}</p>
      </CardHeader>

      <CardContent className="pb-6">
        {/* Price */}
        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            {tier.originalPrice && (
              <span className="text-lg text-slate-500 line-through mr-2">
                {tier.originalPrice}
              </span>
            )}
            <span className={cn(
              'text-4xl font-bold tracking-tight',
              isPopular
                ? 'bg-gradient-to-r from-violet-200 to-fuchsia-200 bg-clip-text text-transparent'
                : 'text-white'
            )}>
              {tier.price}
            </span>
            {tier.period && (
              <span className="text-slate-400 text-sm">/{tier.period}</span>
            )}
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-3">
          {tier.features.map((feature, index) => (
            <li
              key={index}
              className={cn(
                'flex items-start gap-3 text-sm',
                feature.included ? 'text-slate-300' : 'text-slate-500'
              )}
            >
              <Check
                className={cn(
                  'w-4 h-4 mt-0.5 flex-shrink-0',
                  feature.included
                    ? feature.highlight
                      ? 'text-violet-400'
                      : 'text-emerald-400'
                    : 'text-slate-600'
                )}
              />
              <span className={feature.highlight ? 'font-medium text-slate-200' : ''}>
                {feature.text}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          onClick={() => onSelect?.(tier)}
          className={cn(
            'w-full font-semibold transition-all duration-300',
            isPopular
              ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]'
              : isEnterprise
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white'
                : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
          )}
        >
          {tier.ctaText || 'Get Started'}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default PricingCard;
