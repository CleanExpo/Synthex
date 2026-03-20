'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/features', label: 'Platform' },
  { href: '/about', label: 'Solutions' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
];

/** Floating pill nav — warm charcoal/amber theme, fixed centred pill */
export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-5xl px-4">
      <nav
        className={`bg-charcoal-800/80 backdrop-blur-xl border border-white/[0.06] rounded-full px-6 py-3 flex items-center justify-between transition-shadow duration-300 ${
          scrolled ? 'shadow-lg shadow-black/40' : ''
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-charcoal-900 font-black text-xs">S</span>
          </div>
          <span className="text-white font-black tracking-[0.15em] text-sm uppercase hidden sm:block">
            SYNTHEX
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-white/50 hover:text-white text-sm font-medium transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/login"
            className="text-white/60 hover:text-white text-sm font-medium transition-colors px-3 py-1.5"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="bg-amber-500 text-charcoal-900 font-bold rounded-full px-5 py-2 text-sm hover:bg-amber-400 hover:-translate-y-0.5 transition-all duration-200"
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
        <div className="md:hidden mt-2 bg-charcoal-800/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl px-6 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-white/60 hover:text-white text-sm font-medium transition-colors"
            >
              {label}
            </Link>
          ))}
          <div className="pt-3 flex flex-col gap-2 border-t border-white/[0.06]">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-center text-white/60 hover:text-white text-sm font-medium transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-center bg-amber-500 text-charcoal-900 font-bold rounded-full text-sm"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
