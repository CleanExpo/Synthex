'use client';

import { motion } from 'framer-motion';
import { platformsData } from '@/components/icons/platform-icons';

export function PlatformMarquee() {
  // Duplicate the array to ensure endless smooth scrolling
  const scrollItems = [...platformsData, ...platformsData];

  return (
    <section className="py-24 border-y border-white/5 bg-surface-darker relative overflow-hidden">
      {/* Edge Gradients for Smooth Fade */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-surface-darker to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-surface-darker to-transparent z-10" />

      <div className="container mx-auto mb-10 text-center relative z-20">
        <h3 className="text-white/40 text-sm font-semibold uppercase tracking-widest">
          Autonomously Managing Content Across
        </h3>
      </div>

      <div className="relative flex overflow-x-hidden">
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{
            repeat: Infinity,
            ease: 'linear',
            duration: 40,
          }}
          className="flex whitespace-nowrap items-center space-x-12 px-6"
        >
          {scrollItems.map((platform, idx) => (
            <div
              key={`${platform.name}-${idx}`}
              className="flex items-center space-x-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 glass-hover transition-all"
            >
              <platform.Icon size={24} color={platform.color} />
              <span className="text-white/80 font-medium">{platform.name}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
