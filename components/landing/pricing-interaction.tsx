'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingInteractionProps {
  starterMonth: number;
  starterAnnual: number;
  proMonth: number;
  proAnnual: number;
}

// ---------------------------------------------------------------------------
// AnimatedPrice — displays the dollar value; transitions handled by CSS.
// ---------------------------------------------------------------------------

interface AnimatedPriceProps {
  value: number;
  className?: string;
}

function AnimatedPrice({ value, className }: AnimatedPriceProps) {
  const formatted = value.toFixed(2);

  return (
    <span className={cn('inline-block tabular-nums', className)}>
      {formatted}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PricingInteraction
// ---------------------------------------------------------------------------

export function PricingInteraction({
  starterMonth,
  starterAnnual,
  proMonth,
  proAnnual,
}: PricingInteractionProps) {
  const [active, setActive] = React.useState(0);
  const [period, setPeriod] = React.useState(0);
  const [starter, setStarter] = React.useState(starterMonth);
  const [pro, setPro] = React.useState(proMonth);

  const handleChangePlan = (index: number) => {
    setActive(index);
  };

  const handleChangePeriod = (index: number) => {
    setPeriod(index);
    if (index === 0) {
      setStarter(starterMonth);
      setPro(proMonth);
    } else {
      setStarter(starterAnnual);
      setPro(proAnnual);
    }
  };

  const plans = [
    {
      name: 'Free',
      price: null, // Always $0.00 — no animation needed
      badge: null,
    },
    {
      name: 'Starter',
      price: starter,
      badge: 'Popular',
    },
    {
      name: 'Pro',
      price: pro,
      badge: null,
    },
  ];

  return (
    <div
      className={cn(
        'rounded-sm border-[0.5px] border-white/[0.06] p-3 shadow-md max-w-sm w-full flex flex-col items-center gap-3',
        'bg-[#0a1628]'
      )}
    >
      {/* Period toggle */}
      <div className="rounded-full relative w-full bg-[#080e1a] border-[0.5px] border-white/[0.06] p-1.5 flex items-center">
        {(['Monthly', 'Yearly'] as const).map((label, i) => (
          <button
            key={label}
            className={cn(
              'font-semibold rounded-full w-full p-1.5 text-sm z-20 transition-colors duration-200',
              period === i ? 'text-white' : 'text-white/40'
            )}
            onClick={() => handleChangePeriod(i)}
          >
            {label}
            {label === 'Yearly' && period === 0 && (
              <span className="ml-1.5 text-[10px] text-orange-400/70 font-normal">
                Save 25%
              </span>
            )}
          </button>
        ))}
        {/* Sliding pill */}
        <div
          className="p-1.5 flex items-center justify-center absolute inset-0 w-1/2 z-10"
          style={{
            transform: `translateX(${period * 100}%)`,
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div className="bg-[#0a1628] border-[0.5px] border-white/[0.06] shadow-sm rounded-full w-full h-full" />
        </div>
      </div>

      {/* Plan cards */}
      <div className="w-full relative flex flex-col items-center justify-center gap-2">
        {plans.map((plan, index) => (
          <div
            key={plan.name}
            className={cn(
              'w-full flex justify-between cursor-pointer border-[0.5px] p-4 rounded-sm',
              'transition-colors duration-200 active:scale-[0.995]',
              active === index
                ? 'border-orange-500/20 bg-orange-500/[0.04]'
                : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02]'
            )}
            onClick={() => handleChangePlan(index)}
          >
            <div className="flex flex-col items-start">
              <p className="font-semibold text-base flex items-center gap-2 text-white">
                {plan.name}
                {plan.badge && (
                  <span
                    className={cn(
                      'py-0.5 px-2 rounded-sm text-xs',
                      'bg-orange-500/[0.08] border-[0.5px] border-orange-500/20 text-orange-400'
                    )}
                  >
                    {plan.badge}
                  </span>
                )}
              </p>
              <p className="text-white/40 text-sm mt-0.5 flex items-baseline gap-0.5">
                <span className="text-white font-medium flex items-baseline gap-px">
                  <span>$</span>
                  {plan.price !== null ? (
                    <AnimatedPrice value={plan.price} />
                  ) : (
                    <span className="tabular-nums">0.00</span>
                  )}
                </span>
                <span>/month</span>
              </p>
            </div>

            {/* Radio indicator */}
            <div
              className="size-5 rounded-full mt-0.5 p-1 flex items-center justify-center flex-shrink-0"
              style={{
                border: `1.5px solid ${active === index ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.2)'}`,
                transition: 'border-color 0.3s',
              }}
            >
              <div
                className="size-2.5 rounded-full bg-orange-400"
                style={{
                  opacity: active === index ? 1 : 0,
                  transition: 'opacity 0.3s',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        className={cn(
          'rounded-sm text-sm font-semibold text-white w-full p-3',
          'bg-orange-500/[0.08] border-[0.5px] border-orange-500/20',
          'hover:bg-orange-500/[0.14] hover:border-orange-500/40',
          'active:scale-[0.98] transition-all duration-200'
        )}
      >
        Get Started
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo helper (mirrors the source demo.tsx usage)
// ---------------------------------------------------------------------------

export function PricingInteractionDemo() {
  return (
    <div className="flex items-center justify-center p-8 bg-[#080e1a] min-h-[400px]">
      <PricingInteraction
        starterMonth={9.99}
        starterAnnual={7.49}
        proMonth={19.99}
        proAnnual={17.49}
      />
    </div>
  );
}
