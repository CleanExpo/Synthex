'use client';

import Link from 'next/link';

/** Google star SVG — filled */
function StarIcon() {
  return (
    <svg
      className="w-5 h-5 text-yellow-400 fill-yellow-400"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

/** Google G logo mark */
function GoogleLogo() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5 flex-shrink-0"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function Testimonials() {
  return (
    <section className="relative py-24 md:py-32 z-10">
      {/* Ambient candy glow background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/[0.08] blur-3xl rounded-full animate-pulse" />
        <div
          className="absolute top-1/3 right-1/4 w-80 h-80 bg-pink-500/[0.06] blur-3xl rounded-full animate-pulse"
          style={{ animationDelay: '1s' }}
        />
      </div>

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <div
          className="bg-charcoal-800/60 backdrop-blur-xl rounded-2xl p-10 md:p-16 relative overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-white/[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(135deg, rgba(18,18,30,0.6) 0%, rgba(26,15,35,0.6) 100%)',
            border: '1px solid',
            borderImage:
              'linear-gradient(135deg, rgba(255,107,53,0.3) 0%, rgba(244,114,182,0.3) 100%) 1',
          }}
        >
          {/* Ambient glow inside card */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-to-b from-orange-500/[0.08] via-pink-500/[0.05] to-transparent blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10 text-center">
            {/* Google branding */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <GoogleLogo />
              <span className="text-sm font-semibold text-white/60 tracking-wide">
                Google Reviews
              </span>
            </div>

            {/* Star rating */}
            <div className="flex items-center justify-center gap-1 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} />
              ))}
            </div>

            <p className="text-3xl md:text-4xl font-black tracking-tight text-white mb-4">
              See what our customers say
            </p>
            <p className="text-white/50 text-lg mb-10 max-w-xl mx-auto">
              Real reviews from real businesses using Synthex to grow their
              social presence with AI.
            </p>

            <Link
              href="https://g.page/r/synthex/review"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.10] hover:border-orange-500/40 text-white font-semibold px-8 py-4 rounded-full transition-all duration-200 group"
            >
              <GoogleLogo />
              <span>Read our Google Reviews</span>
              <svg
                className="w-4 h-4 text-white/40 group-hover:text-orange-400 transition-colors"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>

            <p className="text-white/25 text-xs mt-6">
              Leave a review and help other businesses discover Synthex
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
