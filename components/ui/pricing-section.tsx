'use client';

import * as React from 'react';
import { BadgeCheck, ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PricingTier {
  id: string;
  name: string;
  price: Record<string, number | string>;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  popular?: boolean;
}

interface PricingSectionProps {
  title: string;
  subtitle: string;
  tiers: PricingTier[];
  frequencies: string[];
}

// ── Frequency Tab ─────────────────────────────────────────────────────────────

interface TabProps {
  text: string;
  selected: boolean;
  setSelected: (text: string) => void;
  discount?: boolean;
}

function Tab({ text, selected, setSelected, discount = false }: TabProps) {
  return (
    <button
      onClick={() => setSelected(text)}
      className={cn(
        'relative w-fit px-4 py-2 text-sm font-semibold capitalize transition-colors',
        discount && 'flex items-center justify-center gap-2',
        selected ? 'text-white' : 'text-white/40 hover:text-white/60'
      )}
    >
      <span className="relative z-10">{text}</span>
      {selected && (
        <span className="absolute inset-0 z-0 rounded-sm bg-white/[0.06] border-[0.5px] border-white/[0.08]" />
      )}
      {discount && (
        <span
          className={cn(
            'relative z-10 whitespace-nowrap text-[10px] font-medium px-1.5 py-0.5 rounded-sm border-[0.5px]',
            selected
              ? 'bg-orange-500/[0.08] border-orange-500/20 text-orange-400'
              : 'bg-white/[0.04] border-white/[0.06] text-white/40'
          )}
        >
          Save 35%
        </span>
      )}
    </button>
  );
}

// ── Pricing Card ──────────────────────────────────────────────────────────────

interface PricingCardProps {
  tier: PricingTier;
  paymentFrequency: string;
}

function PricingCard({ tier, paymentFrequency }: PricingCardProps) {
  const price = tier.price[paymentFrequency];
  const isHighlighted = tier.highlighted;
  const isPopular = tier.popular;

  return (
    <div
      className={cn(
        'relative flex flex-col gap-6 overflow-hidden p-5 rounded-sm border-[0.5px] transition-all duration-200',
        isHighlighted
          ? 'bg-orange-500/[0.06] border-orange-500/20'
          : 'bg-[#050505] border-white/[0.06] hover:border-white/10',
        isPopular && 'ring-1 ring-orange-500/30'
      )}
    >
      {/* Grid pattern overlay for highlighted card */}
      {isHighlighted && (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:45px_45px]" />
      )}

      {/* Name + Popular badge */}
      <div className="flex items-center gap-3 relative z-10">
        <h2
          className={cn(
            'text-base font-medium capitalize',
            isHighlighted ? 'text-orange-400' : 'text-white'
          )}
        >
          {tier.name}
        </h2>
        {isPopular && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-sm bg-orange-500/[0.08] border-[0.5px] border-orange-500/20 text-orange-400">
            Most Popular
          </span>
        )}
      </div>

      {/* Price */}
      <div className="relative h-10 z-10">
        <div key={`${tier.id}-${paymentFrequency}`}>
          {typeof price === 'number' ? (
            <>
              <span
                className={cn(
                  'text-3xl font-semibold',
                  isHighlighted ? 'text-white' : 'text-white'
                )}
              >
                ${price}
              </span>
              <p className="mt-0.5 text-[11px] text-white/40">
                AUD / month per user
              </p>
            </>
          ) : (
            <span
              className={cn(
                'text-3xl font-semibold',
                isHighlighted ? 'text-orange-400' : 'text-white'
              )}
            >
              {price}
            </span>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="flex-1 space-y-2 z-10">
        <h3 className="text-xs font-medium text-white/60">
          {tier.description}
        </h3>
        <ul className="space-y-2">
          {tier.features.map((feature, index) => (
            <li
              key={index}
              className="flex items-center gap-2 text-sm text-white/60"
            >
              <BadgeCheck
                className={cn(
                  'h-4 w-4 shrink-0',
                  isHighlighted ? 'text-orange-400' : 'text-orange-400/60'
                )}
              />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <button
        className={cn(
          'relative z-10 w-full py-2 px-4 rounded-sm text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2',
          isHighlighted
            ? 'bg-orange-500/[0.12] border-[0.5px] border-orange-500/30 text-orange-400 hover:bg-orange-500/[0.20]'
            : 'bg-white/[0.04] border-[0.5px] border-white/[0.06] text-white hover:bg-white/[0.08] hover:border-white/10'
        )}
      >
        {tier.cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Pricing Section ───────────────────────────────────────────────────────────

export function PricingSection({
  title,
  subtitle,
  tiers,
  frequencies,
}: PricingSectionProps) {
  const [selectedFrequency, setSelectedFrequency] = React.useState(
    frequencies[0]
  );

  return (
    <section className="flex flex-col items-center gap-10 py-10">
      <div className="space-y-7 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-medium md:text-5xl text-white">
            {title}
          </h1>
          <p className="text-white/60 text-sm">{subtitle}</p>
        </div>
        <div className="mx-auto flex w-fit rounded-sm bg-[#0a0a0a] border-[0.5px] border-white/[0.06] p-1">
          {frequencies.map(freq => (
            <Tab
              key={freq}
              text={freq}
              selected={selectedFrequency === freq}
              setSelected={setSelectedFrequency}
              discount={freq === 'yearly'}
            />
          ))}
        </div>
      </div>

      <div className="grid w-full max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-4 px-4">
        {tiers.map(tier => (
          <PricingCard
            key={tier.id}
            tier={tier}
            paymentFrequency={selectedFrequency}
          />
        ))}
      </div>
    </section>
  );
}
