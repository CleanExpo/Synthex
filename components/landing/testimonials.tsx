/** Single large testimonial card — industrial amber theme */
export function Testimonials() {
  return (
    <section className="relative py-24 md:py-32 z-10">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-[rgba(28,27,27,0.9)] backdrop-blur-xl border border-[rgba(255,220,194,0.08)] rounded-sm p-10 md:p-16 relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#ffb87b]/[0.05] blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10">
            {/* Large decorative quote mark */}
            <div className="text-[#ffb87b]/20 font-black text-[8rem] leading-none mb-4 select-none">
              &ldquo;
            </div>

            {/* Quote */}
            <blockquote className="text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-tight text-white leading-snug mb-10 max-w-4xl">
              Synthex didn&apos;t just automate our social footprint; it
              fundamentally redefined how we interface with global markets. The
              results are immediate, measurable, and industrial.
            </blockquote>

            {/* Attribution */}
            <div className="flex items-center gap-4">
              {/* Placeholder avatar */}
              <div className="w-14 h-14 rounded-sm bg-zinc-800 border border-[#ffb87b]/20 flex-shrink-0" />
              <div>
                <div className="font-black text-white text-sm uppercase tracking-wide">
                  Josh Mackay
                </div>
                <div className="font-mono text-[10px] text-white/40 uppercase tracking-[0.2em] mt-0.5">
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
