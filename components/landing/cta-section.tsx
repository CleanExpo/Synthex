'use client';

import Link from 'next/link';

/**
 * Full-width CTA banner.
 * Styles sourced from globals.css (.premium-btn, .cta-card, gradientBorderShift)
 * — no duplicate style blocks.
 */
export function CTASection() {
  return (
    <section className="relative py-32 z-10">
      <div className="max-w-5xl mx-auto px-6">
        <div className="cta-card relative overflow-hidden rounded-3xl px-8 py-20 md:py-24 text-center backdrop-blur-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          {/* Single ambient gradient — calmness pass (one layer, lower opacity) */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div
              className="absolute inset-0 rounded-3xl blur-[80px] opacity-30"
              style={{
                background: `radial-gradient(ellipse at top right, rgb(var(--color-purple) / 0.25), transparent 60%), radial-gradient(ellipse at bottom left, rgb(var(--color-amber) / 0.2), transparent 60%)`,
              }}
            />
          </div>

          <div className="relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 mb-8 backdrop-blur-md mx-auto">
              <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-white/50">
                Ready To Grow?
              </span>
            </div>

            {/* Headline */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-medium tracking-tight text-white mb-6">
              Stop guessing. <br />
              <span
                className="bg-clip-text text-transparent italic pr-2"
                style={{
                  backgroundImage: `linear-gradient(to right, rgb(var(--color-amber)), rgb(var(--color-purple)))`,
                }}
              >
                Start dominating local.
              </span>
            </h2>

            {/* Subtext */}
            <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto font-sans leading-relaxed">
              Join 5,000+ businesses that have replaced manual posting with an
              automated AI marketing team that works 24/7.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="premium-btn inline-flex items-center justify-center px-10 py-4 text-white font-semibold rounded-full transition-all duration-300 text-[15px]"
              >
                Start free — no card required
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center justify-center px-10 py-4 bg-white/[0.03] border border-white/10 text-white font-medium rounded-full hover:bg-white/[0.08] hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300 text-[15px] backdrop-blur-md"
              >
                Watch how it works
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
