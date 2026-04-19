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

/**
 * Floating pill nav — premium glass morphism.
 * .nav-glass and .premium-btn are defined in globals.css (single source of truth).
 */
export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-5xl px-4">
      <nav
        className={`nav-glass rounded-full px-5 py-2.5 flex items-center justify-between transition-all duration-300 ${
          scrolled ? 'shadow-2xl shadow-black/80 ring-1 ring-white/5' : ''
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
          <div
            className="w-8 h-8 rounded-lg p-[1px] transition-shadow"
            style={{
              background: `linear-gradient(to bottom right, rgb(var(--color-amber)), rgb(var(--color-purple)))`,
              boxShadow: `0 0 20px rgb(var(--color-purple) / 0.3)`,
            }}
          >
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

        {/* Mobile: hamburger — min 44×44 touch target */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2.5 text-white/60 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
              className="block py-3 text-white/70 hover:text-white text-base font-medium transition-colors min-h-[44px] flex items-center"
            >
              {label}
            </Link>
          ))}
          <div className="pt-4 mt-2 flex flex-col gap-3 border-t border-white/10">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-center text-white/70 hover:text-white text-base font-medium transition-colors rounded-xl border border-white/5 bg-white/5 min-h-[44px] flex items-center justify-center"
            >
              Login
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              className="premium-btn block py-3 text-center text-white font-semibold rounded-xl text-base min-h-[44px] flex items-center justify-center"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
