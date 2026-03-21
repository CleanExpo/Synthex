const STATS = [
  { value: '2,400+', label: 'Businesses', highlight: false },
  { value: '50M+', label: 'Posts generated', highlight: true },
  { value: '99.9%', label: 'Uptime', highlight: false },
  { value: '9', label: 'Platforms', highlight: true },
];

/** Stats strip — 4 metrics in a horizontal row with amber number accents */
export function StatsSection() {
  return (
    <section className="py-20 border-y border-white/[0.04] bg-charcoal-800/30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center justify-center text-center py-10 px-6 ${
                index < STATS.length - 1 ? 'border-r border-white/[0.04]' : ''
              }`}
            >
              <span
                className={`text-4xl md:text-5xl font-black tracking-tight mb-2 ${
                  stat.highlight ? 'text-amber-500' : 'text-white'
                }`}
              >
                {stat.value}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
