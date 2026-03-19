const STATS = [
  { value: '10K+', label: 'Operations', highlight: false },
  { value: '50M+', label: 'Signals', highlight: true },
  { value: '99.9%', label: 'Stability', highlight: false },
  { value: '24/7', label: 'Core Link', highlight: true },
];

/** Stats strip — 4 industrial metrics in a horizontal row */
export function StatsSection() {
  return (
    <section className="py-24 border-y border-white/5 bg-zinc-950/40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center justify-center text-center py-10 px-6 ${
                index < STATS.length - 1 ? 'border-r border-white/5' : ''
              }`}
            >
              <span
                className={`text-4xl md:text-5xl font-black tracking-tight mb-2 ${
                  stat.highlight ? 'text-[#ffb87b]' : 'text-white'
                }`}
              >
                {stat.value}
              </span>
              <span className="font-mono text-[10px] font-black uppercase tracking-[0.4em] text-white/30">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
