'use client';

import React from 'react';
import { AnimatedGroup } from '@/components/ui/animated-group';

const transitionVariants = {
  item: {
    hidden: { opacity: 0, filter: 'blur(12px)', y: 12 },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: { type: 'spring' as const, bounce: 0.3, duration: 1.5 },
    },
  },
};

export interface CustomerLogo {
  src: string;
  alt: string;
  height: number;
}

interface StatsSectionProps {
  customers?: CustomerLogo[];
  className?: string;
}

const STATS = [
  {
    value: '10,000+',
    label: 'Active Users',
    description: 'Creators and marketers across 50 countries',
  },
  {
    value: '50M+',
    label: 'Posts Generated',
    description: 'Platform-optimised content published at scale',
  },
  {
    value: '97%',
    label: 'Customer Satisfaction',
    description: 'Measured across all active subscriptions',
  },
  {
    value: '3.5×',
    label: 'Average ROI',
    description: 'Return on investment within the first 90 days',
  },
];

export function StatsSection({ className }: StatsSectionProps) {
  return (
    <section className={`py-20 md:py-28 bg-[#0a1628] ${className ?? ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section label */}
        <p className="text-center text-white/40 text-xs uppercase tracking-widest mb-12">
          Trusted by 10,000+ creators and marketing teams
        </p>

        <AnimatedGroup
          variants={{
            container: {
              visible: {
                transition: { staggerChildren: 0.1, delayChildren: 0.3 },
              },
            },
            ...transitionVariants,
          }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden"
        >
          {STATS.map(stat => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center text-center px-6 py-10 bg-[#0a1628] hover:bg-white/[0.03] transition-colors duration-300"
            >
              <span className="font-mono text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
                {stat.value}
              </span>
              <span className="text-sm font-semibold text-cyan-400 mb-2">
                {stat.label}
              </span>
              <span className="text-xs text-gray-400 leading-relaxed max-w-[14ch]">
                {stat.description}
              </span>
            </div>
          ))}
        </AnimatedGroup>
      </div>
    </section>
  );
}
