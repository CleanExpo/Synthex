'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SynthexLogo } from './synthex-logo';

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/blog', label: 'Blog' },
  { href: '/docs', label: 'Docs' },
];

/** Fixed top navigation — Scientific Luxury: single-pixel border, sharp corners, opacity text */
export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0a1628]/90 backdrop-blur-md border-b border-[0.5px] border-white/[0.06]">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <SynthexLogo className="w-8 h-8 transition-opacity group-hover:opacity-80" />
            <span className="text-sm font-light tracking-[0.25em] text-white uppercase">Synthex</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-white/50 hover:text-white text-sm tracking-wide transition-colors duration-200"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-white/50 hover:text-white text-sm tracking-wide transition-colors duration-200"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-[#0a1628] text-sm font-semibold tracking-wide transition-colors duration-200 rounded-sm"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-white/50 hover:text-white transition-colors"
            aria-label="Toggle navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pt-4 pb-2 border-t border-[0.5px] border-white/[0.06] mt-4 space-y-0.5">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="block py-2.5 text-white/50 hover:text-white text-sm tracking-wide transition-colors"
              >
                {label}
              </Link>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block py-2.5 text-white/50 hover:text-white text-sm tracking-wide text-center border-[0.5px] border-white/[0.06] rounded-sm transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="block py-3 bg-cyan-500 hover:bg-cyan-400 text-[#0a1628] text-sm font-semibold tracking-wide text-center rounded-sm transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
