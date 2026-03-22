const STATS = [
  { value: '10+', label: 'Platforms supported', highlight: true },
  { value: '< 3s', label: 'Avg. generation time', highlight: false },
  { value: '24/7', label: 'AI availability', highlight: false },
  { value: '\u221E', label: 'Scheduling power', highlight: true },
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
                  stat.highlight ? 'text-orange-500' : 'text-white'
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
