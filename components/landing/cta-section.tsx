'use client';

import Link from 'next/link';

/** Full-width CTA banner — candy-coloured premium design with animated gradient border */
export function CTASection() {
  return (
    <>
      <style jsx>{`
        @keyframes gradientBorderShift {
          0% {
            border-color: #FF8A00;
            box-shadow:
              0 0 30px rgba(255, 138, 0, 0.4),
              inset 0 0 30px rgba(255, 138, 0, 0.1);
          }
          50% {
            border-color: #9D4EDD;
            box-shadow:
              0 0 30px rgba(157, 78, 221, 0.4),
              inset 0 0 30px rgba(157, 78, 221, 0.1);
          }
          100% {
            border-color: #FF8A00;
            box-shadow:
              0 0 30px rgba(255, 138, 0, 0.4),
              inset 0 0 30px rgba(255, 138, 0, 0.1);
          }
        }

        .cta-card {
          animation: gradientBorderShift 6s ease infinite;
          background: rgba(9, 9, 11, 0.8);
        }

        .premium-btn {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 4px 12px rgba(0, 0, 0, 0.5);
          position: relative;
          overflow: hidden;
        }

        .premium-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, #FF8A00, #9D4EDD);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0.8;
          transition: opacity 0.3s ease;
        }

        .premium-btn:hover {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%);
          transform: translateY(-1px);
        }

        .premium-btn:hover::before {
          opacity: 1;
        }
      `}</style>

      <section className="relative py-32 z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="cta-card relative overflow-hidden rounded-3xl px-8 py-20 md:py-24 text-center backdrop-blur-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            {/* Mesh gradient background */}
            <div className="absolute inset-0 pointer-events-none opacity-50">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[#9D4EDD]/20 via-transparent to-transparent blur-[120px] rounded-full" />
              <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-[#FF8A00]/20 via-transparent to-transparent blur-[120px] rounded-full" />
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
                <span className="bg-gradient-to-r from-[#FF8A00] to-[#9D4EDD] bg-clip-text text-transparent italic pr-2">
                  Start dominating local.
                </span>
              </h2>

              {/* Subtext */}
              <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto font-sans leading-relaxed">
                Join 5,000+ businesses that have replaced manual posting with an automated AI marketing team that works 24/7.
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
    </>
  );
}
