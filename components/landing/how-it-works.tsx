'use client';

import { Network, Sparkles, Rocket } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    icon: Network,
    title: 'Enter your URL',
    description:
      'Paste your website URL. Our AI extracts your brand voice, colours, and tone automatically.',
    borderColor: '#FF6B35',
  },
  {
    number: '02',
    icon: Sparkles,
    title: 'AI extracts your brand',
    description:
      'Within seconds, Synthex builds a Brand DNA profile — your unique voice, values, and visual identity.',
    borderColor: '#FFD60A',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Approve your first post',
    description:
      'Review and approve your first AI-generated post. Go live in under 60 seconds.',
    borderColor: '#34D399',
  },
];

/** How It Works — premium candy-coloured 3-step with gradient text and animated elements */
export function HowItWorks() {
  return (
    <section className="relative py-24 md:py-32 z-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-orange-400">
              How it works
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
            Up and running in minutes
          </h2>
          <p className="text-white/40 text-base max-w-lg">
            No setup required. No manual configuration. Just your URL and you're
            live.
          </p>
        </div>

        {/* Cards grid with connecting dots */}
        <div className="relative">
          {/* Connecting dots between cards (desktop only) */}
          <div className="hidden md:flex absolute top-16 left-0 right-0 justify-between px-8 z-0">
            <div className="flex-1 flex justify-center items-center relative -mx-4">
              <div className="flex-1 h-0.5 bg-gradient-to-r from-orange-500/30 via-yellow-400/30 to-transparent" />
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-orange-500 to-yellow-400 shadow-lg shadow-orange-500/50" />
            </div>
            <div className="flex-1 flex justify-center items-center relative -mx-4">
              <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-yellow-400/30 to-green-400/30" />
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-yellow-400 to-green-400 shadow-lg shadow-yellow-400/50" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {STEPS.map(
              (
                { number, icon: Icon, title, description, borderColor },
                idx
              ) => (
                <div
                  key={number}
                  className="group relative bg-charcoal-800/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-white/[0.04] hover:-translate-y-1 transition-all duration-300 z-10"
                  style={{
                    borderTopColor: borderColor,
                    borderTopWidth: '2px',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = borderColor;
                    el.style.borderTopColor = borderColor;
                    el.style.boxShadow = `0 0 20px ${borderColor}40, 0 25px 50px rgba(0,0,0,0.3)`;
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = 'rgba(255,255,255,0.06)';
                    el.style.borderTopColor = borderColor;
                    el.style.boxShadow = '0 25px 50px rgba(0,0,0,0.3)';
                  }}
                >
                  {/* Step number — gradient orange→yellow */}
                  <div
                    className="font-black text-5xl leading-none mb-6 select-none bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        'linear-gradient(135deg, #FF6B35 0%, #FFD60A 100%)',
                    }}
                  >
                    {number}
                  </div>

                  {/* Icon with gradient circle background */}
                  <div
                    className="relative w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(255,107,53,0.2) 0%, rgba(255,214,10,0.2) 100%)',
                      border: '1px solid',
                      borderColor: borderColor + '50',
                      boxShadow: `0 0 20px ${borderColor}40`,
                    }}
                  >
                    <Icon className="w-6 h-6 text-orange-400" />
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
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
