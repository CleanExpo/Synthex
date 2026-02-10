'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Sparkles, CheckCircle2
} from '@/components/icons';

// Lazy load the robot component
const AIRobot = dynamic(() => import('@/components/visuals/AIRobot'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-64 h-80 bg-gradient-to-b from-gray-200 via-gray-100 to-gray-200 rounded-t-full animate-pulse" />
    </div>
  )
});

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#EBEBEF]">
      {/* Soft Light Gray Background - Matching Reference Image Exactly */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#F0F0F3] via-[#EBEBEF] to-[#E8E8EC]" />

      {/* Minimal Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#EBEBEF]/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-[#C41E3A]" />
              <span className="text-xl font-bold tracking-tight text-gray-800">
                <span className="text-[#C41E3A]">Synth</span>ex
              </span>
            </div>

            <div className="hidden md:flex items-center space-x-6">
              <Link href="/features" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
                Features
              </Link>
              <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
                Pricing
              </Link>
              <Link href="/login" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
                Login
              </Link>
              <Link href="/signup">
                <Button className="bg-gray-900 hover:bg-gray-800 text-white text-sm px-5">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button className="md:hidden p-2 text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Minimalist Layout Matching Reference Image */}
      <section className="relative min-h-screen flex items-center">
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 items-center">

            {/* Left Side - 3D Robot with Particle Dispersion */}
            <div className="relative order-2 lg:order-1 flex justify-center lg:justify-start">
              <div className="relative w-[320px] h-[420px] sm:w-[400px] sm:h-[500px] lg:w-[450px] lg:h-[550px]">
                <AIRobot />
              </div>
            </div>

            {/* Right Side - Pill Headlines & Branding */}
            <div className="order-1 lg:order-2 text-center lg:text-left">
              {/* Pill-style Headlines - Exact Match to Reference */}
              <div className="flex flex-col items-center lg:items-start gap-4 mb-8">
                <div className="inline-flex">
                  <span className="px-8 py-5 bg-gray-900 text-white text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black uppercase rounded-2xl tracking-tight shadow-xl">
                    AI Marketing
                  </span>
                </div>
                <div className="inline-flex">
                  <span className="px-8 py-5 bg-white text-gray-900 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black uppercase rounded-2xl tracking-tight shadow-lg border border-gray-200">
                    Agency Guide
                  </span>
                </div>
              </div>

              {/* Brand Name with Ruby Accent - Like Reference */}
              <div className="mb-10">
                <span className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  <span className="text-[#C41E3A]">Synth</span>
                  <span className="text-gray-800">exMediaGroup</span>
                  <span className="text-[#C41E3A] text-lg align-super">®</span>
                </span>
              </div>

              {/* Subtle tagline */}
              <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-md mx-auto lg:mx-0 leading-relaxed">
                AI-powered social media automation that delivers
                <span className="text-gray-800 font-medium"> agency-level results</span> at a fraction of the cost.
              </p>

              {/* CTA Buttons - Simple & Clean */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-gray-900 hover:bg-gray-800 text-white font-medium shadow-lg px-8 py-6 text-base"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-gray-300 hover:border-gray-400 bg-white/80 hover:bg-white text-gray-800 px-8 py-6 text-base"
                  >
                    Watch Demo
                  </Button>
                </Link>
              </div>

              {/* Trust indicators - Minimal */}
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>14-day free trial</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="relative z-10 py-8 px-6 border-t border-gray-200/50">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-[#C41E3A]" />
              <span className="text-lg font-semibold text-gray-800">
                <span className="text-[#C41E3A]">Synth</span>ex
              </span>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/privacy" className="hover:text-gray-700 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-gray-700 transition-colors">Terms</Link>
              <Link href="/contact" className="hover:text-gray-700 transition-colors">Contact</Link>
            </div>

            <p className="text-sm text-gray-400">
              © 2025 SYNTHEX. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Animation keyframes */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0) rotate(0deg);
            opacity: 0.6;
          }
          25% {
            transform: translateY(-10px) translateX(-5px) rotate(5deg);
            opacity: 0.4;
          }
          50% {
            transform: translateY(-5px) translateX(-10px) rotate(-3deg);
            opacity: 0.7;
          }
          75% {
            transform: translateY(-15px) translateX(-3px) rotate(8deg);
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}
