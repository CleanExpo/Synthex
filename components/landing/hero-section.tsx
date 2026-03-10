'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from '@/components/icons';

/** Landing page hero section with image and CTA */
export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-20">
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left Side - AI Robot Hero Image */}
          <div className="relative order-2 lg:order-1 flex justify-center lg:justify-start">
            <div className="relative">
              {/* Hero Image Container */}
              <div className="relative w-full max-w-[600px]">
                {/* Glow behind image */}
                <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/30 via-cyan-400/10 to-transparent rounded-3xl blur-3xl scale-110" />

                {/* Main Hero Image */}
                <div data-hero-image className="relative z-10 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/20">
                  <Image
                    src="/images/hero-robot.png"
                    alt="AI Marketing Automation Robot"
                    width={2048}
                    height={1152}
                    priority
                    className="w-full h-auto object-cover"
                  />
                </div>

                {/* Floating accent elements */}
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full blur-2xl opacity-40 animate-pulse" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-full blur-xl opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
            </div>
          </div>

          {/* Right Side - Content */}
          <div className="order-1 lg:order-2 text-center lg:text-left">
            {/* Pill-style Headlines */}
            <div className="flex flex-col items-center lg:items-start gap-4 mb-8">
              <div className="inline-flex overflow-hidden">
                <span data-hero-pill className="px-8 py-5 bg-white text-slate-950 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black uppercase rounded-2xl tracking-tight shadow-2xl shadow-white/10">
                  AI Marketing
                </span>
              </div>
              <div className="inline-flex overflow-hidden">
                <span data-hero-pill className="px-8 py-5 bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black uppercase rounded-2xl tracking-tight shadow-2xl shadow-cyan-500/30">
                  Agency
                </span>
              </div>
            </div>

            {/* Brand Domain */}
            <div className="mb-8">
              <span data-hero-content className="text-2xl sm:text-3xl font-light tracking-wide text-cyan-400">
                synthex.social
              </span>
            </div>

            {/* Tagline */}
            <p data-hero-content className="text-lg sm:text-xl text-gray-400 mb-6 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              The world's first <span className="text-white font-medium">fully autonomous AI marketing agency</span>.
              Powered by advanced AI that creates, optimizes, and scales your social media presence 24/7.
            </p>

            {/* Key Differentiator */}
            <div data-hero-content className="mb-10 p-4 bg-gradient-to-r from-cyan-500/10 to-transparent border-l-2 border-cyan-400 rounded-r-lg max-w-lg mx-auto lg:mx-0">
              <p className="text-white font-medium mb-1">From just $249/month</p>
              <p className="text-gray-400 text-sm">Use your own API keys to dramatically reduce costs. Custom enterprise rates available.</p>
            </div>

            {/* CTA Buttons */}
            <div data-hero-content className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-semibold shadow-xl shadow-cyan-500/30 px-8 py-6 text-base rounded-xl transition-all hover:shadow-cyan-500/50 hover:scale-105"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-cyan-500/30 hover:border-cyan-400/50 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400 px-8 py-6 text-base rounded-xl backdrop-blur-sm"
                >
                  Watch Demo
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div data-hero-content className="flex flex-wrap gap-6 justify-center lg:justify-start text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-500" />
                <span>Use your own API keys</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-500" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-500" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
