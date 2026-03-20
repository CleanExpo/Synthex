import Link from 'next/link';

/** Full-width CTA banner — warm amber glow on charcoal */
export function CTASection() {
  return (
    <section className="relative py-24 z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="relative overflow-hidden rounded-2xl px-12 py-20 text-center bg-charcoal-800/80 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/50 ring-1 ring-white/[0.04]">
          {/* Warm amber radial glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/[0.08] blur-[100px] rounded-full" />
          </div>

          <div className="relative z-10">
            {/* Headline */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4">
              Ready to get started?
            </h2>

            {/* Subtext */}
            <p className="text-white/50 text-base mb-10 max-w-xl mx-auto">
              Join 2,400+ businesses using Synthex to grow their social presence
              on autopilot.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-amber-500 text-charcoal-900 font-bold rounded-full hover:bg-amber-400 hover:-translate-y-0.5 transition-all duration-200 text-sm"
              >
                Start free
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-white/[0.04] border border-white/10 text-white font-medium rounded-full hover:bg-white/[0.08] hover:-translate-y-0.5 transition-all duration-200 text-sm"
              >
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
