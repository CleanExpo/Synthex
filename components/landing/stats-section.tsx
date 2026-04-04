'use client';

import { useRef, useEffect, useState } from 'react';

const STATS = [
  {
    value: '9',
    numericValue: 9,
    suffix: '',
    label: 'Platforms supported',
    highlight: true,
  },
  {
    value: '< 3s',
    numericValue: 3,
    prefix: '< ',
    suffix: 's',
    label: 'Avg. generation time',
    highlight: false,
  },
  {
    value: '24/7',
    numericValue: 24,
    suffix: '/7',
    label: 'AI availability',
    highlight: false,
  },
  {
    value: '\u221E',
    numericValue: null,
    suffix: '',
    label: 'Scheduling power',
    highlight: true,
  },
];

function CountUpValue({
  stat,
  shouldAnimate,
}: {
  stat: (typeof STATS)[number];
  shouldAnimate: boolean;
}) {
  const [count, setCount] = useState(stat.numericValue ?? 0);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!shouldAnimate || stat.numericValue === null || started) return;
    setStarted(true);
    const target = stat.numericValue;
    const duration = 1500;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    setCount(0);

    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), target);
      setCount(current);
      if (step >= steps) {
        clearInterval(timer);
        setDone(true);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [shouldAnimate, stat.numericValue, started]);

  if (stat.numericValue === null) {
    return <>{stat.value}</>;
  }

  return (
    <>
      {stat.prefix || ''}
      {done ? stat.numericValue : count}
      {stat.suffix || ''}
    </>
  );
}

/** Stats strip — 4 metrics with count-up animation on scroll */
export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '-80px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 border-y border-white/[0.02] bg-[#050508]/60 backdrop-blur-3xl relative overflow-hidden">
      {/* Subtle ambient light for stats */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center">
        <div className="w-full h-full max-w-7xl bg-gradient-to-r from-transparent via-[#9D4EDD]/[0.02] to-transparent" />
      </div>
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 relative">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center justify-center text-center py-10 px-6 relative ${
                index < STATS.length - 1 ? 'border-r border-white/5' : ''
              }`}
            >
              <span
                className={`text-5xl md:text-6xl font-display font-medium tracking-tight mb-3 ${
                  stat.highlight ? 'bg-gradient-to-r from-[#FF8A00] to-[#9D4EDD] bg-clip-text text-transparent' : 'text-white'
                }`}
              >
                <CountUpValue stat={stat} shouldAnimate={isInView} />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
