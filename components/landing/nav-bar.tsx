'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SynthexLogo } from './synthex-logo';

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/agencies', label: 'Agencies' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  // { href: '/blog', label: 'Blog' }, // Blog link hidden until content is ready
];

/** Floating pill nav — candy-themed premium glass morphism */
export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <style jsx>{`
        .nav-glass {
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          background: rgba(9, 9, 11, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .premium-btn {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 4px 12px rgba(0, 0, 0, 0.2);
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
          opacity: 0.5;
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

      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-5xl px-4">
        <nav
          className={`nav-glass rounded-full px-5 py-2.5 flex items-center justify-between transition-all duration-300 ${
            scrolled ? 'shadow-2xl shadow-black/80 ring-1 ring-white/5' : ''
          }`}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF8A00] to-[#9D4EDD] p-[1px] shadow-[0_0_20px_rgba(157,78,221,0.3)] group-hover:shadow-[0_0_25px_rgba(255,138,0,0.4)] transition-shadow">
               <div className="w-full h-full bg-black/80 rounded-[7px] flex items-center justify-center backdrop-blur-md">
                 <SynthexLogo className="w-5 h-5 flex-shrink-0 text-white" />
               </div>
            </div>
            <span className="text-white font-display font-bold tracking-widest text-sm uppercase hidden sm:block">
              SYNTHEX
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-white/60 hover:text-white text-sm font-medium transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-white/60 hover:text-white text-sm font-medium transition-colors px-3 py-1.5"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="premium-btn text-white font-semibold rounded-full px-6 py-2 text-sm transition-all duration-300"
            >
              Get started
            </Link>
          </div>

          {/* Mobile: hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
            aria-label="Toggle navigation"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </nav>

        {/* Mobile dropdown (below pill) */}
        {mobileOpen && (
          <div className="md:hidden mt-3 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl px-6 py-5 shadow-2xl">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="block py-3 text-white/70 hover:text-white text-base font-medium transition-colors"
              >
                {label}
              </Link>
            ))}
            <div className="pt-4 mt-2 flex flex-col gap-3 border-t border-white/10">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block py-3 text-center text-white/70 hover:text-white text-base font-medium transition-colors rounded-xl border border-white/5 bg-white/5"
              >
                Login
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="premium-btn block py-3 text-center text-white font-semibold rounded-xl text-base"
              >
                Get started
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
