'use client';

import React from 'react';
import { Network, Sparkles, Rocket } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    icon: Network,
    title: 'Enter your URL',
    description:
      'Paste your website URL. Our AI extracts your local business data, brand voice, and services automatically.',
    borderColor: '#FF8A00',
  },
  {
    number: '02',
    icon: Sparkles,
    title: 'AI executes discovery strategy',
    description:
      'Synthex builds a Local Discovery plan — generating high-converting content for your specific region and audience.',
    borderColor: '#9D4EDD',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Dominate every platform',
    description:
      'Review and approve your first AI-generated post. Go live everywhere your locals are searching in under 60 seconds.',
    borderColor: '#6366F1',
  },
];

/** How It Works — premium candy-coloured 3-step with gradient text and animated elements */
export function HowItWorks() {
  return (
    <section className="relative py-24 md:py-32 z-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 mb-6 backdrop-blur-md">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#FF8A00]">
              The Workflow
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-medium tracking-tight text-white mb-4">
            Local Discovery on Autopilot.
          </h2>
          <p className="text-white/50 text-base max-w-lg">
            No agencies. No retainers. Just your business URL and you're
            live everywhere your locals are searching.
          </p>
        </div>

        {/* Cards grid with connecting dots */}
        <div className="relative">
          {/* Connecting dots between cards (desktop only) */}
          <div className="hidden md:flex absolute top-16 left-0 right-0 justify-between px-8 z-0">
            <div className="flex-1 flex justify-center items-center relative -mx-4">
              <div className="flex-1 h-0.5 bg-gradient-to-r from-[#FF8A00]/30 via-[#9D4EDD]/30 to-transparent" />
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#FF8A00] to-[#9D4EDD] shadow-[0_0_15px_#9D4EDD]" />
            </div>
            <div className="flex-1 flex justify-center items-center relative -mx-4">
              <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-[#9D4EDD]/30 to-indigo-500/30" />
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#9D4EDD] to-indigo-500 shadow-[0_0_15px_#6366F1]" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {STEPS.map(
              (
                { number, icon: Icon, title, description, borderColor },
                idx
              ) => (
                <React.Fragment key={number}>
                  <div
                    key={number}
                    className="group relative bg-[#09090B]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 overflow-hidden shadow-2xl shadow-black/80 ring-1 ring-white/[0.02] hover:-translate-y-1 transition-all duration-300 z-10"
                    style={{
                      borderTopColor: borderColor,
                      borderTopWidth: '2px',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = borderColor;
                      el.style.borderTopColor = borderColor;
                      el.style.boxShadow = `0 0 25px ${borderColor}20, 0 25px 50px rgba(0,0,0,0.8)`;
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = 'rgba(255,255,255,0.06)';
                      el.style.borderTopColor = borderColor;
                      el.style.boxShadow = '0 25px 50px rgba(0,0,0,0.8)';
                    }}
                  >
                    {/* Step number — gradient */}
                    <div
                      className="font-display font-bold text-5xl leading-none mb-6 select-none bg-clip-text text-transparent"
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${borderColor} 0%, rgba(255,255,255,0.8) 100%)`,
                      }}
                    >
                      {number}
                    </div>

                    {/* Icon with gradient circle background */}
                    <div
                      className="relative w-14 h-14 rounded-xl flex items-center justify-center mb-5 bg-[#09090B] border border-white/5"
                      style={{
                        boxShadow: `0 0 20px ${borderColor}20`,
                      }}
                    >
                      <Icon className="w-6 h-6 text-white" style={{ filter: `drop-shadow(0 0 4px ${borderColor}80)` }} />
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold tracking-tight text-white mb-3">
                      {title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-white/40 leading-relaxed">
                      {description}
                    </p>
                  </div>
                  {/* Mobile-only vertical connector */}
                  {idx < STEPS.length - 1 && (
                    <div className="md:hidden flex flex-col items-center py-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-orange-500 to-yellow-400 ring-2 ring-offset-2 ring-offset-black/20 mb-1" />
                      <div className="w-px h-8 bg-gradient-to-b from-orange-500/60 via-yellow-400/30 to-transparent" />
                    </div>
                  )}
                </React.Fragment>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
