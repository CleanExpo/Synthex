'use client';

import Link from 'next/link';
import { SynthexLogo } from './synthex-logo';

/** Bottom CTA banner — Scientific Luxury: sharp corners, single-pixel border */
export function CTASection() {
  return (
    <section className="relative py-32 z-10">
      <div className="container mx-auto px-6">
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
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-tight text-white mb-4">
              Ready to replace your<br />
              <span className="text-cyan-400">marketing agency?</span>
            </h2>

            {/* Subtext */}
            <p className="text-white/50 text-base mb-10 leading-relaxed">
              Join 10,000+ businesses that have automated their social media with Synthex. Start your 14-day free trial — no credit card required, cancel anytime.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-[#0a1628] font-semibold text-base tracking-wide rounded-sm transition-colors duration-200"
              >
                Start Free Trial
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 px-10 py-4 border-[0.5px] border-white/[0.15] hover:border-white/30 text-white/60 hover:text-white text-base tracking-wide rounded-sm transition-all duration-200 bg-white/[0.02]"
              >
                View Pricing
              </Link>
            </div>

            {/* Trust */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/30">
              {['No credit card required', '14-day free trial', 'Cancel anytime', 'BYOK supported'].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-cyan-400/60" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
