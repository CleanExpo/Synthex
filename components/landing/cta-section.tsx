import Link from 'next/link';

/** Full-width orange gradient CTA banner */
export function CTASection() {
  return (
    <section className="relative py-24 z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div
          className="relative overflow-hidden rounded-sm px-12 py-20 text-center"
          style={{
            background: 'linear-gradient(135deg, #ffb87b 0%, #ff8f00 100%)',
          }}
        >
          {/* Subtle dot texture overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.4) 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          />

          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-24 h-24 border-l-2 border-t-2 border-black/10 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-24 h-24 border-r-2 border-b-2 border-black/10 pointer-events-none" />

          <div className="relative z-10">
            {/* Headline */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-[#2e1500] mb-4">
              Ready to ascend?
            </h2>

            {/* Subtext */}
            <p className="text-[#2e1500]/70 text-base font-mono mb-10 max-w-xl mx-auto">
              Join 10,000+ organisations scaling with industrial social
              intelligence.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-[#2e1500] text-[#ffb87b] font-black rounded-sm hover:bg-black hover:-translate-y-0.5 transition-all duration-200 text-sm uppercase tracking-wide"
              >
                Initialize Platform
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-transparent border-2 border-white/40 text-white font-black rounded-sm hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-200 text-sm uppercase tracking-wide"
              >
                Book Strategy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
