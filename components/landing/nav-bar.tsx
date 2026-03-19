'use client';

import { useState } from 'react';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/platform', label: 'Platform' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/resources', label: 'Resources' },
  { href: '/pricing', label: 'Pricing' },
];

/** Fixed top navigation — industrial amber/orange theme, sharp corners */
export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-zinc-950/80 backdrop-blur-2xl border-b border-orange-500/15">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-7 h-7 bg-gradient-to-br from-[#ffb87b] to-[#ff8f00] rounded-sm flex items-center justify-center flex-shrink-0">
              <span className="text-[#2e1500] font-black text-xs">S</span>
            </div>
            <span className="text-white font-black tracking-[0.2em] text-sm uppercase">
              SYNTHEX
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
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
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-white/60 hover:text-white text-sm font-medium transition-colors px-3 py-2"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="bg-gradient-to-r from-[#ffb87b] to-[#ff8f00] text-[#2e1500] font-black rounded-sm px-5 py-2 text-sm hover:shadow-[0_0_25px_rgba(255,184,123,0.4)] hover:-translate-y-0.5 transition-all duration-200"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile toggle */}
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
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pt-4 pb-2 border-t border-white/5 mt-4 space-y-0.5">
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
            <div className="pt-3 flex flex-col gap-2">
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
                className="block py-2.5 text-center bg-gradient-to-r from-[#ffb87b] to-[#ff8f00] text-[#2e1500] font-black rounded-sm text-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
