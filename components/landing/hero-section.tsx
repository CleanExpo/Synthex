'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { LiveDemoWidget } from './LiveDemoWidget';

function EyebrowPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-8">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
      <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-orange-400">
        {children}
      </span>
    </div>
  );
}

function SocialProofRow() {
  return (
    <div className="flex items-center gap-3 mt-8">
      <div className="flex -space-x-2">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="w-8 h-8 rounded-full border-2 border-charcoal-900 bg-charcoal-600 flex-shrink-0"
          />
        ))}
      </div>
      <p className="text-sm text-white/50">
        Start growing your social presence
      </p>
    </div>
  );
}

const heroTextVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex items-center pt-24 pb-16 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-orange-500/[0.07] to-transparent blur-[160px] rounded-full" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-orange-500/[0.05] blur-[140px] rounded-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-orange-500/[0.04] blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-12 items-center">
          {/* Left — copy */}
          <div>
            <motion.div
              custom={0}
              variants={heroTextVariants}
              initial="hidden"
              animate="visible"
            >
              <EyebrowPill>AI-native social media</EyebrowPill>
            </motion.div>

            <motion.h1
              custom={1}
              variants={heroTextVariants}
              initial="hidden"
              animate="visible"
              className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.05] mb-6"
            >
              Stop spending{' '}
              <em className="text-orange-500 not-italic">10+ hours a week</em>{' '}
              on social media.
            </motion.h1>

            <motion.p
              custom={2}
              variants={heroTextVariants}
              initial="hidden"
              animate="visible"
              className="text-lg text-white/50 max-w-lg leading-relaxed mb-10"
            >
              Synthex learns your brand voice, then creates and schedules posts
              across all 9 platforms — automatically.
            </motion.p>

            <motion.div
              custom={3}
              variants={heroTextVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/signup"
                  className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-orange-500 text-charcoal-900 font-bold rounded-full hover:bg-orange-400 hover:-translate-y-0.5 transition-all duration-200 text-sm overflow-hidden"
                >
                  <span className="relative z-10">Start free</span>
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </Link>
                <Link
                  href="/features"
                  className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/[0.04] border border-white/10 text-white/80 hover:text-white hover:bg-white/[0.08] rounded-full transition-all duration-200 text-sm font-medium overflow-hidden"
                >
                  <span className="relative z-10">See it work</span>
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </Link>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                No credit card required · Cancel anytime · 30-day money-back
                guarantee
              </p>
            </motion.div>

            <motion.div
              custom={4}
              variants={heroTextVariants}
              initial="hidden"
              animate="visible"
            >
              <SocialProofRow />
            </motion.div>
          </div>

          {/* Right — LiveDemoWidget */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: 0.5,
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            }}
          >
            <LiveDemoWidget />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
