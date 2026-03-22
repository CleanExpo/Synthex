/** Testimonials — rotating cards with warm charcoal/amber theme.
 *  AI-generated placeholder testimonials until real customer reviews are collected. */

const TESTIMONIALS = [
  {
    quote:
      "Synthex didn't just automate our social footprint; it fundamentally redefined how we interface with global markets. The results are immediate, measurable, and real.",
    name: 'Josh Mackay',
    title: 'CEO / Digital Horizons',
    initials: 'JM',
  },
  {
    quote:
      "We went from spending 12 hours a week on social content to under two. The AI understands our brand voice better than most junior copywriters we've hired.",
    name: 'Priya Sharma',
    title: 'Marketing Director / Verdant Co.',
    initials: 'PS',
  },
  {
    quote:
      'The cross-platform scheduling alone saved us three headcounts. Pair that with the analytics engine and you have a genuine competitive advantage.',
    name: 'Liam Chen',
    title: 'Head of Growth / NovaBuild',
    initials: 'LC',
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 md:py-32 z-10">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-charcoal-800/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-10 md:p-16 relative overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-white/[0.04]">
          {/* Ambient amber glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/[0.04] blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10">
            {/* Large decorative quote mark */}
            <div className="text-orange-500/20 font-black text-[8rem] leading-none mb-4 select-none">
              &ldquo;
            </div>

            {/* Testimonial cards */}
            <div className="space-y-10">
              {TESTIMONIALS.map(t => (
                <div key={t.name}>
                  <blockquote className="text-lg md:text-xl lg:text-2xl font-bold tracking-tight text-white leading-snug mb-6 max-w-4xl">
                    {t.quote}
                  </blockquote>

                  {/* Attribution */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-charcoal-600 border border-orange-500/20 flex-shrink-0 flex items-center justify-center">
                      <span className="text-orange-400/60 text-xs font-bold">
                        {t.initials}
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">
                        {t.name}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">
                        {t.title}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* AI-generated disclaimer */}
            <div className="mt-10 pt-6 border-t border-white/[0.04]">
              <p className="text-[11px] text-white/20 leading-relaxed">
                These testimonials are AI-generated placeholders while we
                collect real customer feedback. We&apos;re striving for 5-star
                reviews from every client &mdash; yours could be next.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
