'use client';

import { Brain, Workflow, TrendingUp } from 'lucide-react';

const FEATURES = [
  {
    icon: Brain,
    title: 'Sentiment Synthesis',
    description:
      'Automatically recalibrates brand tone based on subtle shifts in global audience sentiment.',
  },
  {
    icon: Workflow,
    title: 'Omnichannel Flow',
    description:
      'Synchronised multi-platform delivery that feels natively hand-crafted for every channel.',
  },
];

/** Unified Social Intelligence — 2-column section with animated bar chart visual */
export function IntelligenceSection() {
  return (
    <section className="relative py-24 md:py-32 z-10 border-y border-white/[0.02] bg-[#050508]/60">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — content */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 mb-8 backdrop-blur-md">
              <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-[#9D4EDD]">
                Platform Intelligence
              </span>
            </div>

            {/* Headline */}
            <h2 className="text-4xl md:text-5xl font-display font-medium tracking-tight text-white leading-[1.05] mb-6">
              AI Built For <br />
              <span className="bg-gradient-to-r from-[#FF8A00] to-[#9D4EDD] bg-clip-text text-transparent italic pr-2">
                Local Growth.
              </span>
            </h2>

            {/* Description */}
            <p className="text-white/50 text-sm leading-relaxed mb-10 max-w-md font-sans">
              Unlike generic ChatGPT wrappers, Synthex continuously models local market
              demand, generating highly targeted social content designed to rank locally
              and drive actual foot traffic to your business.
            </p>

            {/* Feature rows */}
            <div className="space-y-6">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#09090B] border border-white/5 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_15px_rgba(157,78,221,0.15)]">
                     <Icon className="w-5 h-5 text-white drop-shadow-[0_0_8px_rgba(255,138,0,0.8)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-wide text-white mb-1 font-display">
                      {title}
                    </h3>
                    <p className="text-xs text-white/40 leading-relaxed max-w-sm">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — abstract animated composition */}
          <div className="relative">
            {/* Main glass card with bar chart */}
            <div className="bg-[#09090B]/90 backdrop-blur-3xl border border-white/10 rounded-2xl p-8 relative overflow-hidden shadow-2xl shadow-black/80">
              {/* Ambient glow */}
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-[#9D4EDD]/10 blur-[80px] rounded-full pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-[#FF8A00]/10 blur-[80px] rounded-full pointer-events-none" />

              {/* Card header */}
              <div className="flex items-center justify-between mb-8 relative z-10">
                <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-white/50">
                  Local Demand Analysis
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF8A00] animate-pulse shadow-[0_0_8px_#FF8A00]" />
                  <span className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase text-[#FF8A00]">
                    Live
                  </span>
                </div>
              </div>

              {/* Animated bar chart */}
              <div className="flex items-end gap-2 h-32 relative z-10 mb-6">
                {[55, 70, 45, 85, 60, 90, 75, 88, 65, 95, 72, 82].map(
                  (height, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-[2px]"
                      style={{
                        height: `${height}%`,
                        background:
                          i % 3 === 0
                            ? 'rgba(157,78,221,0.8)'
                            : i % 3 === 1
                              ? 'rgba(255,138,0,0.6)'
                              : 'rgba(255,255,255,0.1)',
                        animation: `bar-pulse ${1.5 + i * 0.15}s ease-in-out infinite alternate`,
                      }}
                    />
                  )
                )}
              </div>

              {/* X-axis labels */}
              <div className="flex justify-between relative z-10">
                {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map(month => (
                  <span
                    key={month}
                    className="font-mono text-[8px] text-white/50 uppercase tracking-wider"
                  >
                    {month}
                  </span>
                ))}
              </div>
            </div>

            {/* Floating Predictive widget */}
            <div className="absolute -top-4 -right-4 bg-[#09090B] backdrop-blur-2xl border border-white/10 rounded-xl px-5 py-4 shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-[#FF8A00]" />
                <span className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase text-white/40">
                  Predictive
                </span>
              </div>
              <div className="text-xl font-display font-medium text-white">+127%</div>
              <div className="font-mono text-[8.5px] text-white/50 uppercase tracking-wider mt-1">
                Local Foot Traffic
              </div>
            </div>

            {/* Synchronising status badge */}
            <div className="absolute -bottom-6 left-8 bg-[#09090B] backdrop-blur-2xl border border-white/10 rounded-xl px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1 h-3 rounded-full bg-[#9D4EDD]"
                      style={{
                        animation: `sync-bar 1s ease-in-out ${i * 0.2}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-[#9D4EDD]">
                  Synchronizing Content
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS keyframes injected as a style tag */}
      <style>{`
        @keyframes bar-pulse {
          from { opacity: 0.7; }
          to { opacity: 1; transform: scaleY(1.05); transform-origin: bottom; }
        }
        @keyframes sync-bar {
          from { height: 6px; }
          to { height: 12px; }
        }
      `}</style>
    </section>
  );
}
