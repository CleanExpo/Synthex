'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

/** Full-width CTA banner — warm amber glow on charcoal */
export function CTASection() {
  return (
    <section className="relative py-24 z-10">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-2xl px-12 py-20 text-center bg-charcoal-800/80 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/50 ring-1 ring-white/[0.04]"
        >
          {/* Warm amber radial glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-orange-500/[0.08] blur-[100px] rounded-full" />
          </div>

          <div className="relative z-10">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4">
              Ready to get started?
            </h2>
            <p className="text-white/50 text-base mb-10 max-w-xl mx-auto">
              Start growing your social presence on autopilot.
            </p>

            {/* CTAs with whileHover + whileTap micro-interactions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/signup"
                  className="group relative inline-flex items-center justify-center px-8 py-3.5 bg-orange-500 text-charcoal-900 font-bold rounded-full hover:bg-orange-400 transition-all duration-200 text-sm overflow-hidden"
                >
                  <span className="relative z-10">Start free</span>
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/contact"
                  className="group relative inline-flex items-center justify-center px-8 py-3.5 bg-white/[0.04] border border-white/10 text-white font-medium rounded-full hover:bg-white/[0.08] transition-all duration-200 text-sm overflow-hidden"
                >
                  <span className="relative z-10">Book a demo</span>
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
