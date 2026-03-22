'use client';

import Link from 'next/link';

/** Full-width CTA banner — candy-coloured premium design with animated gradient border */
export function CTASection() {
  return (
    <>
      <style jsx>{`
        @keyframes gradientBorderShift {
          0% {
            border-color: #ff6b35;
            box-shadow:
              0 0 30px rgba(255, 107, 53, 0.5),
              inset 0 0 30px rgba(255, 107, 53, 0.1);
          }
          25% {
            border-color: #ffd60a;
            box-shadow:
              0 0 30px rgba(255, 214, 10, 0.4),
              inset 0 0 30px rgba(255, 214, 10, 0.08);
          }
          50% {
            border-color: #f472b6;
            box-shadow:
              0 0 30px rgba(244, 114, 182, 0.5),
              inset 0 0 30px rgba(244, 114, 182, 0.1);
          }
          75% {
            border-color: #ff3b5c;
            box-shadow:
              0 0 30px rgba(255, 59, 92, 0.5),
              inset 0 0 30px rgba(255, 59, 92, 0.1);
          }
          100% {
            border-color: #ff6b35;
            box-shadow:
              0 0 30px rgba(255, 107, 53, 0.5),
              inset 0 0 30px rgba(255, 107, 53, 0.1);
          }
        }

        .cta-card {
          animation: gradientBorderShift 6s ease infinite;
        }

        @keyframes floatOrbs {
          0%,
          100% {
            transform: translateY(0px) scale(1);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-20px) scale(1.1);
            opacity: 0.6;
          }
        }

        .floating-orb {
          animation: floatOrbs 6s ease-in-out infinite;
          position: absolute;
          border-radius: 50%;
        }

        .candy-gradient-btn {
          background: linear-gradient(135deg, #ff6b35 0%, #ff3b5c 100%);
          box-shadow: 0 0 30px rgba(255, 107, 53, 0.4);
        }

        .candy-gradient-btn:hover {
          box-shadow:
            0 0 50px rgba(255, 107, 53, 0.6),
            0 0 80px rgba(255, 59, 92, 0.4);
          transform: translateY(-2px);
        }
      `}</style>

      <section className="relative py-24 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="cta-card relative overflow-hidden rounded-2xl px-12 py-20 text-center backdrop-blur-xl border-2 shadow-2xl shadow-black/50 ring-1 ring-white/[0.04]">
            {/* Mesh gradient background - deep purples to orange to pink */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Base gradient mesh */}
              <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-gradient-to-br from-purple-900/30 via-orange-500/10 to-transparent blur-[120px] rounded-full" />
              <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-gradient-to-l from-pink-500/20 via-orange-400/10 to-transparent blur-[150px] rounded-full" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-gradient-to-t from-orange-500/15 to-transparent blur-[100px] rounded-full" />
            </div>

            {/* Floating light orbs */}
            {[0, 1, 2].map(i => (
              <div
                key={`orb-${i}`}
                className="floating-orb"
                style={{
                  width: `${60 + i * 40}px`,
                  height: `${60 + i * 40}px`,
                  background: [
                    'rgba(255, 107, 53, 0.2)',
                    'rgba(244, 114, 182, 0.2)',
                    'rgba(255, 214, 10, 0.15)',
                  ][i],
                  left: `${20 + i * 30}%`,
                  top: `${15 + i * 20}%`,
                  animationDelay: `${i * 1.5}s`,
                }}
              />
            ))}

            <div className="relative z-10">
              {/* Headline */}
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4">
                Ready to get started?
              </h2>

              {/* Subtext */}
              <p className="text-white/50 text-base mb-10 max-w-xl mx-auto">
                Start growing your social presence on autopilot.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/signup"
                  className="candy-gradient-btn inline-flex items-center justify-center px-8 py-3.5 text-charcoal-900 font-bold rounded-full transition-all duration-200 text-sm"
                >
                  Start free
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center px-8 py-3.5 bg-white/[0.08] border border-white/20 text-white font-medium rounded-full hover:bg-white/[0.12] hover:border-white/30 hover:-translate-y-0.5 transition-all duration-200 text-sm backdrop-blur-sm"
                >
                  Book a demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
