'use client';

const STATS = [
  { value: 10, suffix: 'K+', label: 'Active Users' },
  { value: 50, suffix: 'M+', label: 'Posts Created' },
  { value: 99.9, suffix: '%', label: 'Uptime' },
  { value: 4.9, suffix: '/5', label: 'User Rating' },
];

/** Landing page social proof stats bar */
export function StatsSection() {
  return (
    <section className="relative py-20 z-10 border-y border-cyan-500/10">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-cyan-400 mb-2">
                <span
                  data-stat-number
                  data-value={stat.value}
                  data-suffix={stat.suffix}
                >
                  {stat.value}
                </span>
                <span data-stat-suffix>{stat.suffix}</span>
              </div>
              <div data-stat-label className="text-gray-500 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
