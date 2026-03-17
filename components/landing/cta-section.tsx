'use client';

import Link from 'next/link';
import { SynthexLogo } from './synthex-logo';

/** Bottom CTA banner — Scientific Luxury: sharp corners, single-pixel border */
export function CTASection() {
  return (
    <section className="relative py-16 md:py-20 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative border-[0.5px] border-white/[0.1] bg-white/[0.02] p-12 sm:p-16 overflow-hidden">
          {/* Background ambient */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-cyan-500/[0.02] pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-1 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-16 h-16 border-l border-t border-cyan-400/20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-16 h-16 border-r border-b border-white/[0.06] pointer-events-none" />

          <div className="relative z-10 text-center max-w-2xl mx-auto">
            {/* Logo */}
            <SynthexLogo className="w-12 h-12 mx-auto mb-8 opacity-80" />

            {/* Heading */}
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
              Start Growing.{' '}
              <span className="text-cyan-400">Stop Grinding.</span>
            </h2>

            {/* Subtext */}
            <p className="text-gray-400 text-base mb-10 leading-relaxed">
              Join 10,000+ creators and marketers who let Synthex handle
              content, so they can focus on strategy.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-base rounded-full transition-colors duration-200"
              >
                Start Free Trial
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 text-base rounded-full transition-all duration-200"
              >
                See a Demo
              </Link>
            </div>

            {/* Trust */}
            <p className="text-sm text-white/40">
              14-day free trial · No credit card required · Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
