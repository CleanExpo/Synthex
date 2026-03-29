'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from '@/components/icons';
import { HeroSection } from '@/components/landing/HeroSection';
import { PlatformMarquee } from '@/components/landing/PlatformMarquee';
import { BentoFeatures } from '@/components/landing/BentoFeatures';
import { AgentTerminal } from '@/components/landing/AgentTerminal';
import { CtaSection } from '@/components/landing/CtaSection';

export default function SynthexHomePage() {
  return (
    <div className="min-h-screen bg-charcoal-900 selection:bg-candy-orange/30 selection:text-candy-orange relative scroll-smooth">
      {/* Global Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-[#0A0A12]/80 backdrop-blur-xl border-b border-white/5 transition-all">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-candy-orange" />
              <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-candy-orange to-candy-pink tracking-tighter">
                Synthex
              </span>
            </Link>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/features"
                className="text-white/60 hover:text-white transition-colors text-sm font-medium"
              >
                Features
              </Link>
              <Link
                href="/pricing"
                className="text-white/60 hover:text-white transition-colors text-sm font-medium"
              >
                Pricing
              </Link>
              <Link
                href="/docs"
                className="text-white/60 hover:text-white transition-colors text-sm font-medium"
              >
                Docs
              </Link>
              <Link
                href="/login"
                className="text-white/80 hover:text-white transition-colors text-sm font-medium"
              >
                Log in
              </Link>
              <Button
                asChild
                className="bg-candy-orange hover:bg-candy-orange/90 text-charcoal-950 font-bold rounded-full shadow-[0_0_20px_rgba(255,107,53,0.3)] transition-all"
              >
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <Button variant="ghost" size="icon" className="text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full bg-[#0A0A12]">
        <HeroSection />
        {/* <PlatformMarquee /> */}
        {/* <BentoFeatures /> */}
        {/* <AgentTerminal /> */}
        {/* <CtaSection /> */}
      </main>

      {/* Global Footer */}
      <footer className="bg-[#050508] border-t border-white/5 py-16 px-6 relative overflow-hidden">
        {/* Subtle orange mesh blob in the footer */}
        <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-[radial-gradient(circle_at_center,rgba(255,107,53,0.05)_0%,transparent_70%)] pointer-events-none" />

        <div className="container mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center space-x-2 mb-6">
                <Sparkles className="w-6 h-6 text-candy-orange" />
                <span className="text-2xl font-black text-white tracking-tighter">
                  Synthex
                </span>
              </Link>
              <p className="text-white/40 text-sm leading-relaxed mb-6 max-w-xs">
                The world's first fully autonomous AI marketing agency.
                Generates, schedules, and optimizes content cross-platform.
              </p>
              <div className="flex space-x-4">
                {/* Social icons could go here */}
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6">Product</h4>
              <ul className="space-y-4 text-sm text-white/50">
                <li>
                  <Link
                    href="/features"
                    className="hover:text-candy-orange transition-colors"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="hover:text-candy-orange transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/integrations"
                    className="hover:text-candy-orange transition-colors"
                  >
                    Integrations
                  </Link>
                </li>
                <li>
                  <Link
                    href="/changelog"
                    className="hover:text-candy-orange transition-colors"
                  >
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6">Resources</h4>
              <ul className="space-y-4 text-sm text-white/50">
                <li>
                  <Link
                    href="/docs"
                    className="hover:text-candy-orange transition-colors"
                  >
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    href="/api"
                    className="hover:text-candy-orange transition-colors"
                  >
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link
                    href="/blog"
                    className="hover:text-candy-orange transition-colors"
                  >
                    Blog
                  </Link>
                </li>
                <li>
                  <Link
                    href="/guides"
                    className="hover:text-candy-orange transition-colors"
                  >
                    Automation Guides
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6">Company</h4>
              <ul className="space-y-4 text-sm text-white/50">
                <li>
                  <Link
                    href="/about"
                    className="hover:text-candy-orange transition-colors"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/careers"
                    className="hover:text-candy-orange transition-colors"
                  >
                    Careers
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-candy-orange transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="hover:text-candy-orange transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-16 pt-8 flex flex-col md:flex-row items-center justify-between text-white/30 text-sm">
            <p>
              &copy; {new Date().getFullYear()} Synthex, Inc. All rights
              reserved.
            </p>
            <div className="flex items-center space-x-2 mt-4 md:mt-0">
              <span className="w-2 h-2 rounded-full bg-candy-green animate-pulse" />
              <span>All Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
