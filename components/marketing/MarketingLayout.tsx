'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ReactNode } from 'react';

// Synthex Logo Component
export function SynthexLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Top Chevron */}
      <path
        d="M50 10 L85 35 L50 45 L15 35 Z"
        fill="url(#gradient1)"
      />
      {/* Bottom Chevron */}
      <path
        d="M50 90 L85 65 L50 55 L15 65 Z"
        fill="url(#gradient2)"
      />
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="gradient2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Floating Particles Component
export function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400/20 rounded-full animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${5 + Math.random() * 10}s`,
          }}
        />
      ))}
    </div>
  );
}

// Navigation Component
export function MarketingNav({ currentPage }: { currentPage?: string }) {
  return (
    <nav className="fixed top-0 w-full z-50 bg-surface-dark/80 backdrop-blur-md border-b border-cyan-500/10">
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
            <Link
              href="/features"
              className={`${currentPage === 'features' ? 'text-cyan-400' : 'text-gray-400'} hover:text-cyan-400 transition-colors text-sm font-medium`}
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className={`${currentPage === 'pricing' ? 'text-cyan-400' : 'text-gray-400'} hover:text-cyan-400 transition-colors text-sm font-medium`}
            >
              Pricing
            </Link>
            <Link
              href="/about"
              className={`${currentPage === 'about' ? 'text-cyan-400' : 'text-gray-400'} hover:text-cyan-400 transition-colors text-sm font-medium`}
            >
              About
            </Link>
            <Link
              href="/login"
              className="text-gray-400 hover:text-cyan-400 transition-colors text-sm font-medium"
            >
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

// Footer Component
export function MarketingFooter() {
  return (
    <footer className="relative z-10 border-t border-cyan-500/10 bg-surface-dark/50">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-3">
              <SynthexLogo className="w-10 h-10" />
              <span className="text-xl font-bold text-white">SYNTHEX</span>
            </Link>
            <p className="text-gray-500 text-sm">
              The world's first fully autonomous AI marketing agency.
            </p>
            <p className="text-cyan-400 font-medium">synthex.social</p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              <li><Link href="/features" className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">Features</Link></li>
              <li><Link href="/pricing" className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">Pricing</Link></li>
              <li><Link href="/docs" className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">Integrations</Link></li>
              <li><Link href="/changelog" className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">Changelog</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link href="/about" className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">About</Link></li>
              <li><Link href="/blog" className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">Blog</Link></li>
              <li><Link href="/careers" className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">Careers</Link></li>
              <li><Link href="/support" className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              <li><Link href="/privacy" className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">Security</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-cyan-500/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-600 text-sm">
            &copy; 2026 SYNTHEX. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-gray-600 hover:text-cyan-400 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
            </a>
            <a href="#" className="text-gray-600 hover:text-cyan-400 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
            <a href="#" className="text-gray-600 hover:text-cyan-400 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Marketing Layout Component
interface MarketingLayoutProps {
  children: ReactNode;
  currentPage?: string;
  showFooter?: boolean;
}

export default function MarketingLayout({
  children,
  currentPage,
  showFooter = true
}: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Deep Navy Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f172a] to-[#0a1628]" />

      {/* Subtle Grid Pattern */}
      <div className="fixed inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />

      {/* Floating Particles */}
      <FloatingParticles />

      {/* Glow Effects */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Navigation */}
      <MarketingNav currentPage={currentPage} />

      {/* Main Content */}
      <main className="relative z-10 pt-20">
        {children}
      </main>

      {/* Footer */}
      {showFooter && <MarketingFooter />}
    </div>
  );
}
