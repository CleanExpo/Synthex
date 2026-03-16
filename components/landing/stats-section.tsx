'use client';

/** Horizontal data strip — Scientific Luxury: mono font, single-pixel separators */
const STATS = [
  { value: '10K+', label: 'Active Users' },
  { value: '50M+', label: 'Posts Published' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '4.9', suffix: '/ 5', label: 'User Rating' },
  { value: '$120K', label: 'Agency Cost Replaced / Year' },
  { value: '2.2×', label: 'Avg. Engagement Lift' },
];

export function StatsSection() {
  return (
    <section className="relative py-16 z-10 bg-white/[0.01] border-y border-[0.5px] border-white/[0.06]">
      <div className="container mx-auto px-6">

        {/* Label */}
        <div className="text-center mb-8">
          <span className="text-[10px] uppercase tracking-[0.35em] text-white/25">
            Platform Metrics
          </span>
        </div>

        {/* Data strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 divide-y md:divide-y-0 lg:divide-x divide-white/[0.06]">
          {STATS.map((stat, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center py-6 px-4 gap-1.5 group"
            >
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl lg:text-3xl font-medium text-white tabular-nums">
                  {stat.value}
                </span>
                {stat.suffix && (
                  <span className="font-mono text-sm text-white/30">{stat.suffix}</span>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 text-center">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
