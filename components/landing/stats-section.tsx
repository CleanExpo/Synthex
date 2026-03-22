'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

const STATS = [
  { value: '10+', numericValue: 10, suffix: '+', label: 'Platforms supported', highlight: true },
  { value: '< 3s', numericValue: 3, prefix: '< ', suffix: 's', label: 'Avg. generation time', highlight: false },
  { value: '24/7', numericValue: 24, suffix: '/7', label: 'AI availability', highlight: false },
  { value: '\u221E', numericValue: null, suffix: '', label: 'Scheduling power', highlight: true },
];

function CountUpValue({ stat, shouldAnimate }: {
  stat: typeof STATS[number];
  shouldAnimate: boolean;
}) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!shouldAnimate || stat.numericValue === null) return;
    const target = stat.numericValue;
    const duration = 1500;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    let step = 0;

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
  }, [shouldAnimate, stat.numericValue]);

  if (stat.numericValue === null) {
    return <>{stat.value}</>;
  }

  if (!shouldAnimate && !done) {
    return <>0</>;
  }

  return (
    <>
      {stat.prefix || ''}{done ? stat.numericValue : count}{stat.suffix || ''}
    </>
  );
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

/** Stats strip — 4 metrics with count-up animation on scroll */
export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section className="py-20 border-y border-white/[0.04] bg-charcoal-800/30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          className="grid grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              className={`flex flex-col items-center justify-center text-center py-10 px-6 ${
                index < STATS.length - 1 ? 'border-r border-white/[0.04]' : ''
              }`}
            >
              <span
                className={`text-4xl md:text-5xl font-black tracking-tight mb-2 ${
                  stat.highlight ? 'text-orange-500' : 'text-white'
                }`}
              >
                <CountUpValue stat={stat} shouldAnimate={isInView} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
