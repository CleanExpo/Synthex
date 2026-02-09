'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowRight, Sparkles, TrendingUp, Users, Calendar, BarChart3, Zap,
  CheckCircle2, Brain, Shield, Globe, Rocket, Award, LineChart,
  MessageSquare, Hash, Clock, Target, Lightbulb, ChevronRight,
  Star, BadgeCheck, ArrowUpRight
} from '@/components/icons';
import { UserCount, EngagementBoost } from '@/components/real-stats';
import {
  TwitterXIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  FacebookIcon,
  YouTubeIcon,
  PlatformCard,
} from '@/components/icons/platform-icons';

// Particle Field Component - Ambient effect for hero
const ParticleField = ({ count = 40 }: { count?: number }) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 5,
      duration: Math.random() * 10 + 10,
    }));
    setParticles(newParticles);
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-violet-500/30"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animation: `float ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
};

// Lazy load below-fold components for better initial load performance
const HowItWorks = dynamic(() => import('@/components/landing/how-it-works').then(mod => ({ default: mod.HowItWorks })), {
  ssr: true,
  loading: () => <div className="py-20 lg:py-32 px-6" aria-label="Loading how it works section" />
});

const Testimonials = dynamic(() => import('@/components/landing/testimonials').then(mod => ({ default: mod.Testimonials })), {
  ssr: true,
  loading: () => <div className="py-20 lg:py-32 px-6" aria-label="Loading testimonials section" />
});

// Premium 3D Fallback Component with Design System v4
const Premium3DFallback = ({ height = "500px", label = "3D Visualization" }: { height?: string; label?: string }) => (
  <div className="relative overflow-hidden rounded-2xl bg-black border border-white/[0.08]" style={{ height }}>
    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(139,92,246,0.15),transparent)]" />

    {/* Floating orb placeholder */}
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="absolute -inset-8 bg-gradient-to-r from-violet-500/30 to-cyan-500/30 rounded-full blur-2xl animate-pulse" />
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/40 via-fuchsia-500/30 to-cyan-500/40 shadow-[0_0_60px_rgba(139,92,246,0.4)] animate-float">
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/10 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Globe className="w-10 h-10 text-white/50" />
          </div>
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-sm text-gray-400 font-medium">{label}</p>
        <p className="text-xs text-gray-500">Loading interactive experience...</p>
      </div>
    </div>
  </div>
);

// Dynamic import visual components
const SocialNetworkOrb = dynamic(() => import('@/components/visuals/SocialNetworkSVG'), {
  ssr: false,
  loading: () => <Premium3DFallback height="500px" label="Social Network Visualization" />
});

const FloatingPostCards = dynamic(() => import('@/components/visuals/FloatingPostsSVG'), {
  ssr: false,
  loading: () => <Premium3DFallback height="600px" label="Interactive Post Gallery" />
});

const ActivityStream3D = dynamic(() => import('@/components/visuals/ActivityStreamSVG'), {
  ssr: false,
  loading: () => <Premium3DFallback height="500px" label="Real-Time Activity Stream" />
});

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      {/* OLED Black Background with Mesh Gradients - Design System v4 */}
      <div className="fixed inset-0">
        {/* True black base */}
        <div className="absolute inset-0 bg-black" />

        {/* Violet spotlight from top-left */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_-20%,rgba(139,92,246,0.25),transparent)]" />

        {/* Cyan spotlight from bottom-right */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_100%,rgba(6,182,212,0.15),transparent)]" />

        {/* Ruby accent glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_50%_50%,rgba(220,38,38,0.05),transparent)]" />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.08]" />

        {/* Particle effects container */}
        <ParticleField count={50} />
      </div>

      {/* Navigation - Premium Glass with Design System v4 */}
      <nav className="fixed top-0 w-full z-50 bg-black/60 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="relative">
                <Sparkles className="w-6 sm:w-8 h-6 sm:h-8 text-violet-500" />
                <div className="absolute inset-0 w-6 sm:w-8 h-6 sm:h-8 bg-violet-500 blur-xl opacity-50" />
              </div>
              <span className="text-xl sm:text-2xl font-black tracking-tight text-white">SYNTHEX</span>
              <span className="hidden sm:inline-block px-3 py-1 text-xs font-bold bg-white text-black rounded-lg uppercase tracking-wider">
                Agency
              </span>
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2 text-gray-300 hover:text-white" aria-label="Open menu">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
              <Link href="/features" className="text-gray-300 hover:text-white transition-colors font-medium text-sm lg:text-base">
                Features
              </Link>
              <Link href="/case-studies" className="text-gray-300 hover:text-white transition-colors font-medium text-sm lg:text-base">
                Case Studies
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-white transition-colors font-medium text-sm lg:text-base">
                Pricing
              </Link>
              <Link href="/docs" className="text-gray-300 hover:text-white transition-colors font-medium text-sm lg:text-base">
                Resources
              </Link>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-white/[0.06]">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-[0_0_20px_rgba(139,92,246,0.4)]">
                  <span className="hidden xl:inline">Start Free Trial</span>
                  <span className="xl:hidden">Start</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Design System v4 with Pill Headlines */}
      <section className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        {/* Hero spotlight glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_20%,rgba(139,92,246,0.2),transparent)] pointer-events-none" />

        <div className="container mx-auto relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            {/* Trust Badge with pulsing dot */}
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <BadgeCheck className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-gray-300">Trusted by 1000+ businesses worldwide</span>
            </div>

            {/* Pill-style Headlines - Inspired by Reference Image */}
            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="inline-flex">
                <span className="px-6 py-3 bg-white text-black text-3xl sm:text-5xl lg:text-6xl font-black uppercase rounded-xl tracking-tight">
                  AI Marketing
                </span>
              </div>
              <div className="inline-flex">
                <span className="px-6 py-3 bg-black text-white text-3xl sm:text-5xl lg:text-6xl font-black uppercase rounded-xl tracking-tight border-2 border-white/20">
                  Agency
                </span>
              </div>
              <div className="inline-flex">
                <span className="px-6 py-3 bg-gradient-to-r from-violet-600 to-cyan-500 text-white text-3xl sm:text-5xl lg:text-6xl font-black uppercase rounded-xl tracking-tight">
                  Platform
                </span>
              </div>
            </div>

            <p className="text-base sm:text-xl lg:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed px-4 sm:px-0">
              Stop paying $10,000/month for an agency. Get AI-powered viral analysis,
              content generation, and strategic automation that delivers
              <span className="text-white font-semibold"> 2.2x engagement boost</span> guaranteed.
            </p>

            {/* Value Props - Responsive Grid */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-3 sm:gap-4 mb-10 px-4 sm:px-0">
              <div className="flex items-center space-x-2 text-gray-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400 flex-shrink-0" />
                <span>No Agency Fees</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400 flex-shrink-0" />
                <span>24/7 AI Strategy</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400 flex-shrink-0" />
                <span>Viral Analysis</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400 flex-shrink-0" />
                <span>All Platforms</span>
              </div>
            </div>

            {/* CTA Buttons - Design System v4 */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-10 px-4 sm:px-0">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] transition-all relative overflow-hidden group py-6 text-base"
                >
                  <span className="relative z-10 flex items-center">
                    Start Free 14-Day Trial
                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </Button>
              </Link>
              <Link href="/demo" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-white/20 hover:border-white/30 bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-sm text-white py-6 text-base"
                >
                  Watch 3-Min Demo
                </Button>
              </Link>
            </div>

            {/* Live Stats - Mobile Responsive */}
            <div className="flex justify-center flex-wrap gap-4 sm:gap-6 lg:gap-8 text-gray-400 text-xs sm:text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <Users className="w-4 sm:w-5 h-4 sm:h-5" />
                <UserCount />
              </div>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400" />
                <EngagementBoost />
              </div>
              <div className="hidden sm:flex items-center space-x-2">
                <Brain className="w-4 sm:w-5 h-4 sm:h-5 text-violet-400" />
                <span>AI-Powered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Preview with Premium Glass - Design System v4 */}
        <div className="container mx-auto mt-20 px-4 sm:px-6">
          <div className="relative max-w-6xl mx-auto">
            {/* Enhanced glow behind dashboard */}
            <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/30 via-fuchsia-500/20 to-cyan-500/30 rounded-3xl blur-3xl opacity-50" />
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 rounded-2xl blur-xl" />

            <div className="relative bg-white/[0.03] rounded-2xl p-1.5 shadow-[0_0_60px_rgba(139,92,246,0.2)] border border-white/[0.1] backdrop-blur-xl">
              {/* Window Chrome - macOS style */}
              <div className="bg-black/80 rounded-t-xl px-4 py-3 flex items-center gap-8 border-b border-white/[0.08]">
                {/* Traffic lights */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57] shadow-[0_0_6px_rgba(255,95,87,0.5)]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[0_0_6px_rgba(255,189,46,0.5)]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840] shadow-[0_0_6px_rgba(40,200,64,0.5)]" />
                </div>
                {/* URL Bar */}
                <div className="flex-1 max-w-md">
                  <div className="bg-white/[0.06] rounded-md px-3 py-1.5 flex items-center gap-2 border border-white/[0.08]">
                    <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center">
                      <Shield className="w-2.5 h-2.5 text-emerald-400" />
                    </div>
                    <span className="text-xs text-gray-400 font-mono">app.synthex.social/dashboard</span>
                  </div>
                </div>
                {/* User avatar */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500" />
                </div>
              </div>

              {/* Dashboard Content */}
              <div className="bg-black rounded-b-xl p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                  {/* Main Chart Area */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Viral Score Analysis Card */}
                    <div className="bg-white/[0.03] rounded-xl p-5 border border-white/[0.08] backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <LineChart className="w-5 h-5 text-violet-400" />
                          <span className="text-sm font-medium text-gray-200">Viral Score Analysis</span>
                        </div>
                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          LIVE
                        </span>
                      </div>
                      {/* Animated Bar Chart */}
                      <div className="h-32 sm:h-40 bg-gradient-to-b from-white/[0.02] to-transparent rounded-lg p-4 flex items-end justify-around gap-2">
                        {[85, 65, 90, 75, 95, 70, 88, 78, 92, 68, 87, 80].map((height, i) => (
                          <div
                            key={i}
                            className="flex-1 max-w-[30px] rounded-t-sm bg-gradient-to-t from-violet-600 to-cyan-400 opacity-80 transition-all duration-500 hover:opacity-100"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between mt-3 text-[10px] text-gray-500 px-2">
                        <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                        <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08] backdrop-blur-sm group hover:bg-white/[0.06] transition-colors">
                        <Target className="w-8 h-8 text-violet-400 mb-3 group-hover:scale-110 transition-transform" />
                        <p className="text-xs text-gray-400 mb-1">Optimal Post Time</p>
                        <p className="text-xl font-bold text-white">2:30 PM</p>
                        <p className="text-[10px] text-gray-500 mt-1">EST - Tuesday</p>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08] backdrop-blur-sm group hover:bg-white/[0.06] transition-colors">
                        <Hash className="w-8 h-8 text-cyan-400 mb-3 group-hover:scale-110 transition-transform" />
                        <p className="text-xs text-gray-400 mb-1">Trending Hashtags</p>
                        <p className="text-xl font-bold text-white">24 Active</p>
                        <p className="text-[10px] text-emerald-400 mt-1">+8 from yesterday</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Recommendations Panel */}
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-violet-500/[0.08] to-cyan-500/[0.04] rounded-xl p-5 border border-violet-500/20 backdrop-blur-sm h-full">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 flex items-center justify-center">
                          <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">AI Recommendations</p>
                          <p className="text-[10px] text-gray-400">Updated 2 min ago</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06] hover:border-amber-500/30 transition-colors cursor-pointer">
                          <div className="flex items-start space-x-2.5">
                            <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-200 leading-relaxed">Use video content for 3.2x engagement</p>
                              <p className="text-[10px] text-emerald-400 mt-1">High impact</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06] hover:border-amber-500/30 transition-colors cursor-pointer">
                          <div className="flex items-start space-x-2.5">
                            <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-200 leading-relaxed">Include CTA in first 10 words</p>
                              <p className="text-[10px] text-cyan-400 mt-1">Medium impact</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06] hover:border-amber-500/30 transition-colors cursor-pointer">
                          <div className="flex items-start space-x-2.5">
                            <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-200 leading-relaxed">Optimal length: 280 characters</p>
                              <p className="text-[10px] text-violet-400 mt-1">Best practice</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button className="w-full mt-4 py-2 text-xs font-medium text-violet-300 hover:text-white bg-violet-500/10 hover:bg-violet-500/20 rounded-lg border border-violet-500/20 transition-colors">
                        View All Recommendations →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3D Social Network Visualization */}
      <section className="py-20 px-6 border-t border-white/[0.06] bg-gradient-to-b from-black via-violet-950/10 to-black">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 mb-6 text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 rounded-full border border-cyan-500/20">
              Platform Integration
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Connected to <span className="bg-gradient-to-r from-violet-500 to-cyan-500 bg-clip-text text-transparent">Every Platform</span>
            </h2>
            <p className="text-xl text-gray-400">Visualize your social media ecosystem in real-time</p>
          </div>
          <SocialNetworkOrb />
        </div>
      </section>

      {/* 3D Floating Posts Section */}
      <section className="py-20 px-6 border-t border-white/[0.06] bg-gradient-to-b from-black via-cyan-950/10 to-black">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 mb-6 text-xs font-bold uppercase tracking-wider text-violet-400 bg-violet-500/10 rounded-full border border-violet-500/20">
              Content Preview
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Real Social Media Posts in <span className="bg-gradient-to-r from-violet-500 to-cyan-500 bg-clip-text text-transparent">3D</span>
            </h2>
            <p className="text-xl text-gray-400">Experience engagement like never before - interact with live posts</p>
            <p className="text-sm text-gray-500 mt-2">Hover to interact - Click hearts to like - Real engagement in 3D</p>
          </div>
          <FloatingPostCards />
        </div>
      </section>

      {/* Real-Time Activity Stream Section */}
      <section className="py-20 px-6 border-t border-white/[0.06] bg-gradient-to-b from-black via-violet-950/10 to-black">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 mb-6 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              Live Analytics
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Real-Time <span className="bg-gradient-to-r from-violet-500 to-cyan-500 bg-clip-text text-transparent">Activity Stream</span>
            </h2>
            <p className="text-xl text-gray-400">Watch engagement happen live across all your connected platforms</p>
          </div>
          <ActivityStream3D />
        </div>
      </section>

      {/* Social Proof Section */}
      <Testimonials />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Core Features - Agency Focus with Design System v4 */}
      <section className="py-20 px-6 border-t border-white/[0.06]">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-2 mb-6 text-xs font-bold uppercase tracking-wider text-violet-400 bg-violet-500/10 rounded-full border border-violet-500/20">
              AI Agency Team
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Your AI-Powered Social Media
              <br />
              <span className="bg-gradient-to-r from-violet-500 to-cyan-500 bg-clip-text text-transparent">Agency Team</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Every tool a $10,000/month agency uses, powered by AI and available 24/7
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Strategy Analyst */}
            <div className="group p-6 bg-white/[0.03] rounded-2xl border border-white/[0.08] hover:border-violet-500/40 transition-all hover:bg-white/[0.06] backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-500/25 group-hover:scale-110 transition-transform">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">AI Strategy Analyst</h3>
              <p className="text-gray-400 mb-4 text-sm">
                Analyzes millions of posts to identify viral patterns and optimal strategies for your niche.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Viral pattern recognition
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Competitor analysis
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Trend forecasting
                </li>
              </ul>
            </div>

            {/* Content Creator */}
            <div className="group p-6 bg-white/[0.03] rounded-2xl border border-white/[0.08] hover:border-cyan-500/40 transition-all hover:bg-white/[0.06] backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center mb-5 shadow-lg shadow-cyan-500/25 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">AI Content Creator</h3>
              <p className="text-gray-400 mb-4 text-sm">
                Generates authentic, on-brand content that maintains your voice while maximizing engagement.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Brand voice learning
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  10+ variations per post
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Platform optimization
                </li>
              </ul>
            </div>

            {/* Campaign Manager */}
            <div className="group p-6 bg-white/[0.03] rounded-2xl border border-white/[0.08] hover:border-pink-500/40 transition-all hover:bg-white/[0.06] backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 flex items-center justify-center mb-5 shadow-lg shadow-pink-500/25 group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">AI Campaign Manager</h3>
              <p className="text-gray-400 mb-4 text-sm">
                Schedules and manages campaigns across all platforms with perfect timing for each audience.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Optimal time scheduling
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Multi-platform sync
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  A/B testing
                </li>
              </ul>
            </div>

            {/* Analytics Expert */}
            <div className="group p-6 bg-white/[0.03] rounded-2xl border border-white/[0.08] hover:border-emerald-500/40 transition-all hover:bg-white/[0.06] backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/25 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">AI Analytics Expert</h3>
              <p className="text-gray-400 mb-4 text-sm">
                Provides deep insights and actionable recommendations based on real-time performance data.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Real-time tracking
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  ROI measurement
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Custom reports
                </li>
              </ul>
            </div>

            {/* Growth Hacker */}
            <div className="group p-6 bg-white/[0.03] rounded-2xl border border-white/[0.08] hover:border-amber-500/40 transition-all hover:bg-white/[0.06] backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/25 group-hover:scale-110 transition-transform">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">AI Growth Hacker</h3>
              <p className="text-gray-400 mb-4 text-sm">
                Implements advanced growth strategies and optimizations to accelerate your follower growth.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Hashtag research
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Engagement tactics
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Audience targeting
                </li>
              </ul>
            </div>

            {/* Compliance Officer */}
            <div className="group p-6 bg-white/[0.03] rounded-2xl border border-white/[0.08] hover:border-red-500/40 transition-all hover:bg-white/[0.06] backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 flex items-center justify-center mb-5 shadow-lg shadow-red-500/25 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">AI Compliance Officer</h3>
              <p className="text-gray-400 mb-4 text-sm">
                Ensures all content follows platform guidelines and best practices to maximize reach.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Platform compliance
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Content moderation
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Brand safety
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Support - Enhanced with Design System v4 */}
      <section className="py-20 lg:py-28 px-6 border-t border-white/[0.06] relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/10 via-transparent to-transparent" />

        <div className="container mx-auto relative">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-sm font-medium text-cyan-400 mb-6">
              <Globe className="w-4 h-4" />
              Universal Integration
            </span>
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-4">
              One Platform. <span className="bg-gradient-to-r from-violet-500 to-cyan-500 bg-clip-text text-transparent">All Networks.</span>
            </h2>
            <p className="text-lg lg:text-xl text-gray-400 max-w-2xl mx-auto">
              Manage your entire social media presence from a single dashboard
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6 max-w-5xl mx-auto">
            <PlatformCard
              name="Twitter/X"
              icon={<TwitterXIcon size={28} color="#fff" />}
              color="#1DA1F2"
            />
            <PlatformCard
              name="Instagram"
              icon={<InstagramIcon size={28} />}
              color="#E4405F"
            />
            <PlatformCard
              name="LinkedIn"
              icon={<LinkedInIcon size={28} />}
              color="#0A66C2"
            />
            <PlatformCard
              name="TikTok"
              icon={<TikTokIcon size={28} />}
              color="#FF0050"
            />
            <PlatformCard
              name="Facebook"
              icon={<FacebookIcon size={28} />}
              color="#1877F2"
            />
            <PlatformCard
              name="YouTube"
              icon={<YouTubeIcon size={28} />}
              color="#FF0000"
            />
          </div>

          {/* Additional info */}
          <p className="text-center text-sm text-gray-500 mt-8">
            + Threads, Pinterest, Reddit, and more coming soon
          </p>
        </div>
      </section>

      {/* ROI Calculator - Design System v4 */}
      <section className="py-20 px-6 border-t border-white/[0.06]">
        <div className="container mx-auto">
          <div className="relative max-w-4xl mx-auto">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/10 to-cyan-500/20 rounded-3xl blur-2xl" />

            <div className="relative bg-gradient-to-br from-violet-500/10 via-black to-cyan-500/10 rounded-2xl p-8 sm:p-12 border border-white/[0.1] backdrop-blur-sm">
              <div className="text-center mb-10">
                <h2 className="text-4xl font-black text-white mb-4">
                  Save $120,000+ Per Year
                </h2>
                <p className="text-xl text-gray-400">
                  See how much you'll save compared to a traditional agency
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white mb-4">Traditional Agency</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-gray-300">
                      <span>Monthly Retainer</span>
                      <span className="text-red-400 font-semibold">$10,000</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>Setup Fee</span>
                      <span className="text-red-400 font-semibold">$5,000</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>Additional Services</span>
                      <span className="text-red-400 font-semibold">$2,000+</span>
                    </div>
                    <div className="h-px bg-white/[0.1] my-4" />
                    <div className="flex justify-between text-white font-bold text-lg">
                      <span>Annual Cost</span>
                      <span className="text-red-400">$144,000+</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white mb-4">SYNTHEX Platform</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-gray-300">
                      <span>Monthly Subscription</span>
                      <span className="text-emerald-400 font-semibold">$297</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>Setup Fee</span>
                      <span className="text-emerald-400 font-semibold">$0</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>All Features Included</span>
                      <span className="text-emerald-400 font-semibold">✓</span>
                    </div>
                    <div className="h-px bg-emerald-500/20 my-4" />
                    <div className="flex justify-between text-white font-bold text-lg">
                      <span>Annual Cost</span>
                      <span className="text-emerald-400">$3,564</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 text-center">
                <div className="inline-flex items-center gap-3 px-6 py-4 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
                  <Award className="w-6 h-6 text-emerald-400" />
                  <span className="text-2xl font-black text-white">You Save $140,436/Year</span>
                </div>
                <p className="mt-4 text-gray-400">Plus get better results with AI that never sleeps</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section - Design System v4 */}
      <section className="py-20 px-6 border-t border-white/[0.06] relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_100%,rgba(139,92,246,0.15),transparent)]" />

        <div className="container mx-auto relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* Pill-style headline */}
            <div className="inline-flex flex-col sm:flex-row gap-3 mb-8">
              <span className="px-6 py-3 bg-white text-black text-3xl sm:text-4xl lg:text-5xl font-black uppercase rounded-xl tracking-tight">
                Stop
              </span>
              <span className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white text-3xl sm:text-4xl lg:text-5xl font-black uppercase rounded-xl tracking-tight">
                Overpaying
              </span>
            </div>

            <p className="text-xl text-gray-300 mb-10">
              Join 1000+ businesses getting agency-level results at 97% less cost
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-10">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold shadow-[0_0_40px_rgba(139,92,246,0.4)] py-6 text-base"
                >
                  Start Your Free Trial Now
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 hover:border-white/30 bg-white/[0.03] hover:bg-white/[0.06] text-white py-6 text-base"
                >
                  Schedule a Demo
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>24/7 support</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer with Premium Glass - Design System v4 */}
      <footer className="bg-black/80 backdrop-blur-xl border-t border-white/[0.06] py-16 px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="relative">
                  <Sparkles className="w-8 h-8 text-violet-500" />
                  <div className="absolute inset-0 w-8 h-8 bg-violet-500 blur-xl opacity-50" />
                </div>
                <span className="text-2xl font-black text-white">SYNTHEX</span>
              </div>
              <p className="text-gray-400 mb-4">
                Your complete social media agency powered by artificial intelligence.
              </p>
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">
                  <a href="mailto:support@synthex.social" className="hover:text-white transition-colors">
                    support@synthex.social
                  </a>
                </p>
                <p className="text-gray-400 text-sm">1-800-SYNTHEX</p>
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/case-studies" className="hover:text-white transition-colors">Case Studies</Link></li>
                <li><Link href="/integrations" className="hover:text-white transition-colors">Integrations</Link></li>
                <li><Link href="/roadmap" className="hover:text-white transition-colors">Roadmap</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="/api" className="hover:text-white transition-colors">API Reference</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/academy" className="hover:text-white transition-colors">Academy</Link></li>
                <li><Link href="/support" className="hover:text-white transition-colors">Support Center</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/careers" className="hover:text-white transition-colors">Careers</Link></li>
                <li><Link href="/partners" className="hover:text-white transition-colors">Partners</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="h-px bg-white/[0.06] mb-8" />
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm mb-4 md:mb-0">
              © 2025 SYNTHEX. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="https://twitter.com/synthexai" className="text-gray-500 hover:text-white transition-colors">
                Twitter
              </a>
              <a href="https://linkedin.com/company/synthex" className="text-gray-500 hover:text-white transition-colors">
                LinkedIn
              </a>
              <a href="https://github.com/synthex" className="text-gray-500 hover:text-white transition-colors">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
