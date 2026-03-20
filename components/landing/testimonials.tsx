/** Testimonials — single large card with warm charcoal/amber theme */
export function Testimonials() {
  return (
    <section className="relative py-24 md:py-32 z-10">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-charcoal-800/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-10 md:p-16 relative overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-white/[0.04]">
          {/* Ambient amber glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/[0.04] blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10">
            {/* Large decorative quote mark */}
            <div className="text-amber-500/20 font-black text-[8rem] leading-none mb-4 select-none">
              &ldquo;
            </div>

            {/* Quote */}
            <blockquote className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-white leading-snug mb-10 max-w-4xl">
              Synthex didn&apos;t just automate our social footprint; it
              fundamentally redefined how we interface with global markets. The
              results are immediate, measurable, and real.
            </blockquote>

            {/* Attribution */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-charcoal-600 border border-amber-500/20 flex-shrink-0" />
              <div>
                <div className="font-bold text-white text-sm">Josh Mackay</div>
                <div className="text-xs text-white/40 mt-0.5">
                  CEO / Digital Horizons
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
