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
    <section className="relative py-24 md:py-32 z-10 border-y border-white/5 bg-zinc-950/20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — content */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#ffb87b]/10 border border-[#ffb87b]/20 mb-8">
              <span className="font-mono text-[10px] font-black tracking-[0.3em] uppercase text-[#ffb87b]">
                The Neural Core
              </span>
            </div>

            {/* Headline */}
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-[1.05] mb-6">
              Unified Social
              <br />
              Intelligence.
            </h2>

            {/* Description */}
            <p className="text-white/40 text-sm leading-relaxed mb-10 max-w-md">
              A continuously learning system that reads market signals,
              synthesises audience intelligence, and executes multi-platform
              content strategies with machine precision.
            </p>

            {/* Feature rows */}
            <div className="space-y-6">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-sm bg-[#ffb87b]/10 border border-[#ffb87b]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-[#ffb87b]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white mb-1">
                      {title}
                    </h3>
                    <p className="text-xs text-white/40 leading-relaxed">
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
            <div className="bg-[rgba(28,27,27,0.9)] backdrop-blur-xl border border-[rgba(255,220,194,0.08)] rounded-sm p-8 relative overflow-hidden">
              {/* Ambient glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#ffb87b]/[0.04] blur-3xl rounded-full pointer-events-none" />

              {/* Card header */}
              <div className="flex items-center justify-between mb-8 relative z-10">
                <span className="font-mono text-[10px] font-black tracking-[0.3em] uppercase text-white/50">
                  Signal Analysis
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ffb87b] animate-pulse" />
                  <span className="font-mono text-[9px] font-black tracking-[0.3em] uppercase text-[#ffb87b]">
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
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${height}%`,
                        background:
                          i % 3 === 0
                            ? 'rgba(255,184,123,0.6)'
                            : i % 3 === 1
                              ? 'rgba(255,184,123,0.25)'
                              : 'rgba(255,184,123,0.12)',
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
            <div className="absolute -top-4 -right-4 bg-[rgba(28,27,27,0.95)] backdrop-blur-xl border border-[rgba(255,220,194,0.12)] rounded-sm px-4 py-3 shadow-xl">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#ffb87b]" />
                <span className="font-mono text-[9px] font-black tracking-[0.25em] uppercase text-white/40">
                  Predictive
                </span>
              </div>
              <div className="text-lg font-black text-white">+127%</div>
              <div className="font-mono text-[8px] text-white/50 uppercase tracking-wider">
                Engagement Forecast
              </div>
            </div>

            {/* Synchronising status badge */}
            <div className="absolute -bottom-3 left-6 bg-[rgba(28,27,27,0.95)] backdrop-blur-xl border border-[rgba(255,220,194,0.12)] rounded-sm px-3 py-2 shadow-xl">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-0.5 h-3 rounded-full bg-[#ffb87b]"
                      style={{
                        animation: `sync-bar 1s ease-in-out ${i * 0.2}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[9px] font-black tracking-[0.3em] uppercase text-[#ffb87b]">
                  Synchronising
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
