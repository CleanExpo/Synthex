'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export const HeroRedesign = () => {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden px-4 md:px-8">
      <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 1, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border border-aurora-purple/50 bg-aurora-purple/10 text-aurora-cyan text-sm font-medium mb-8 backdrop-blur-md"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aurora-cyan opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-aurora-cyan"></span>
          </span>
          <span>Synthex 2.0 Now Available</span>
        </motion.div>

        {/* Huge Hero Typography */}
        <motion.h1
          initial={{ opacity: 1, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-midnight-400 mb-8 max-w-4xl"
        >
          Automate Social.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-aurora-cyan via-aurora-purple to-aurora-magenta">
             Amplify Growth.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 1, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          className="text-lg md:text-2xl text-midnight-300 font-light max-w-2xl mb-12"
        >
          The AI-native platform that learns your brand voice, schedules content across 9 networks, and optimizes for maximum reach.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 1, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease: 'backOut' }}
          className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 z-10"
        >
          <Link
            href="/login"
            className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white transition-all duration-300 bg-midnight-950 border border-aurora-cyan/50 rounded-full hover:bg-aurora-cyan/10 hover:shadow-glow-aurora"
          >
            <span className="mr-2">Start Free Trial</span>
            <svg
              className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>

          <Link
            href="#how-it-works"
            className="group inline-flex items-center justify-center px-8 py-4 text-base font-medium text-midnight-300 transition-colors duration-300 hover:text-white"
          >
            <svg
              className="w-5 h-5 mr-2 opacity-70 group-hover:opacity-100"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            See how it works
          </Link>
        </motion.div>

        {/* Abstract 3D Mockup Graphic placeholder */}
        <motion.div
           initial={{ opacity: 1, y: 50 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 1, delay: 0.4, ease: 'circOut' }}
           className="mt-20 w-full max-w-5xl rounded-2xl border border-midnight-700 bg-midnight-900/50 backdrop-blur-xl shadow-2xl overflow-hidden aspect-video relative flex items-center justify-center"
        >
           <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-aurora-cyan/50 to-transparent"></div>
           <p className="text-midnight-500 text-lg font-mono tracking-widest">[ DASHBOARD INTERFACE PREVIEW ]</p>
        </motion.div>
      </div>
    </section>
  );
};
