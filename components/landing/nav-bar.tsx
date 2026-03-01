'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SynthexLogo } from './synthex-logo';

/** Fixed top navigation bar for the landing page */
export function NavBar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0a1628]/80 backdrop-blur-md border-b border-cyan-500/10">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <SynthexLogo className="w-10 h-10 transition-transform group-hover:scale-110" />
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-white">SYNTHEX</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/features" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm font-medium">
              Features
            </Link>
            <Link href="/pricing" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm font-medium">
              Pricing
            </Link>
            <Link href="/about" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm font-medium">
              About
            </Link>
            <Link href="/login" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm font-medium">
              Login
            </Link>
            <Link href="/signup">
              <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white text-sm px-6 py-2 rounded-lg font-medium shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40">
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
