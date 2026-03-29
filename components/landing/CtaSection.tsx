'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from '@/components/icons';

export function CtaSection() {
  return (
    <section className="py-32 px-6 relative overflow-hidden bg-[#0A0A12]">
      {/* Background glow and grid */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(255,107,53,0.15)_0%,transparent_70%)] pointer-events-none" />

      <div className="container mx-auto relative z-10 text-center max-w-4xl">
        <motion.div
          initial={{ opacity: 1, scale: 1 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="p-1 rounded-3xl bg-gradient-to-br from-white/10 via-surface-darker to-white/5 relative overflow-hidden"
        >
          {/* Animated border sweep effect */}
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,107,53,0.3)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%] animate-shimmer" />

          <div className="bg-surface-darker rounded-[1.35rem] p-12 md:p-20 relative overflow-hidden">
            {/* Inner glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle_at_center,rgba(255,107,53,0.1)_0%,transparent_70%)]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.1)_0%,transparent_70%)]" />

            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tighter">
              Stop Posting.
              <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-candy-orange via-candy-yellow to-candy-green">
                Start Autoresizing.
              </span>
            </h2>

            <p className="text-xl text-white/50 mb-10 max-w-2xl mx-auto">
              Join the waiting list to secure early access. Or try the
              autonomous engine for 14 days, absolutely free.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  asChild
                  size="lg"
                  className="h-16 px-10 text-xl font-bold rounded-full bg-candy-orange hover:bg-candy-orange text-charcoal-950 shadow-[0_0_40px_rgba(255,107,53,0.3)] transition-all glow-effect"
                >
                  <Link href="/signup">
                    Start Free Trial
                    <ArrowRight className="ml-3 w-6 h-6" />
                  </Link>
                </Button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-16 px-10 text-xl font-bold rounded-full bg-transparent border-white/10 hover:bg-white/5 text-white backdrop-blur-md"
                >
                  <Link href="/contact">Contact Sales</Link>
                </Button>
              </motion.div>
            </div>

            <p className="mt-8 text-sm text-white/40 font-mono uppercase tracking-widest">
              No credit card required. Cancel anytime.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
