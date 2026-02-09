'use client';

import { Suspense } from 'react';
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
import { HowItWorks } from '@/components/landing/how-it-works';
import { Testimonials } from '@/components/landing/testimonials';

// Premium 3D Fallback Component
const Premium3DFallback = ({ height = "500px", label = "3D Visualization" }: { height?: string; label?: string }) => (
  <div className={`h-[${height}] relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-[#0f0720] to-slate-950 border border-white/[0.08]`}
    style={{ height }}>
    {/* Animated gradient background */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(139,92,246,0.15),transparent)]" />

    {/* Floating orb placeholder */}
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
      <div className="relative">
        {/* Outer glow */}
        <div className="absolute -inset-8 bg-gradient-to-r from-purple-500/30 to-blue-500/30 rounded-full blur-2xl animate-pulse" />
        {/* Main orb */}
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/40 via-fuchsia-500/30 to-blue-500/40 shadow-[0_0_60px_rgba(139,92,246,0.4)] animate-float">
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/10 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Globe className="w-10 h-10 text-white/50" />
          </div>
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-sm text-slate-400 font-medium">{label}</p>
        <p className="text-xs text-slate-500">Loading interactive experience...</p>
      </div>
    </div>

    {/* Floating platform icons */}
    <div className="absolute top-8 left-8 w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center animate-float" style={{ animationDelay: '0s' }}>
      <span className="text-lg">𝕏</span>
    </div>
    <div className="absolute top-16 right-12 w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center animate-float" style={{ animationDelay: '0.5s' }}>
      <span className="text-lg">📷</span>
    </div>
    <div className="absolute bottom-12 left-16 w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center animate-float" style={{ animationDelay: '1s' }}>
      <span className="text-lg">in</span>
    </div>
    <div className="absolute bottom-20 right-8 w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center animate-float" style={{ animationDelay: '1.5s' }}>
      <span className="text-lg">♪</span>
    </div>
  </div>
);

// Dynamic import visual components (SVG-based for reliability)
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
    <div className="min-h-screen bg-[#030014]">
      {/* Premium Animated Background - 2026 Design */}
      <div className="fixed inset-0">
        {/* Deep gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0f0720] to-slate-950" />

        {/* Spotlight from top - Linear/Vercel style */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />

        {/* Secondary spotlight - bottom right */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_100%_100%,rgba(59,130,246,0.15),transparent)]" />

        {/* Bottom glow */}
        <div className="absolute bottom-0 left-0 right-0 h-[50vh] bg-gradient-to-t from-violet-500/10 to-transparent" />

        {/* Grid pattern - more visible */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.15]" />

        {/* Ambient noise texture for depth */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />

        {/* Animated blobs - INCREASED opacity for visibility */}
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[128px] animate-blob" />
        <div className="absolute top-1/3 -right-32 w-[400px] h-[400px] bg-blue-600/25 rounded-full blur-[128px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-1/4 left-1/3 w-[600px] h-[600px] bg-fuchsia-600/20 rounded-full blur-[150px] animate-blob animation-delay-4000" />
      </div>

      {/* Navigation - Responsive with Premium Glass */}
      <nav className="fixed top-0 w-full z-50 glass-premium-solid border-b border-white/[0.06]">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="relative">
                <Sparkles className="w-6 sm:w-8 h-6 sm:h-8 text-purple-500" />
                <div className="absolute inset-0 w-6 sm:w-8 h-6 sm:h-8 bg-purple-500 blur-xl opacity-50"></div>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-white">SYNTHEX</span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full">
                AGENCY
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
              <Link href="/features" className="text-gray-300 hover:text-white transition font-medium text-sm lg:text-base">
                Features
              </Link>
              <Link href="/case-studies" className="text-gray-300 hover:text-white transition font-medium text-sm lg:text-base">
                Case Studies
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-white transition font-medium text-sm lg:text-base">
                Pricing
              </Link>
              <Link href="/docs" className="text-gray-300 hover:text-white transition font-medium text-sm lg:text-base">
                Resources
              </Link>
              <Link href="/login">
                <Button variant="glass" size="sm" className="text-sm lg:text-base">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="premium-primary" className="text-sm lg:text-base">
                  <span className="hidden xl:inline">Start Free Trial</span>
                  <span className="xl:hidden">Start</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Fully Responsive with Premium Effects */}
      <section className="relative pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 overflow-hidden">
        {/* Hero spotlight glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_30%,rgba(139,92,246,0.15),transparent)] pointer-events-none" />

        <div className="container mx-auto relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            {/* Trust Badge with pulsing dot */}
            <Badge variant="glass-success" size="lg" className="mb-6 sm:mb-8 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <BadgeCheck className="w-3 sm:w-4 h-3 sm:h-4 mr-2" />
              Trusted by 1000+ businesses worldwide
            </Badge>
            
            <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight">
              Your Complete
              <br />
              <span className="gradient-text-premium">
                Social Media Agency
              </span>
              <br />
              In One Platform
            </h1>
            
            <p className="text-base sm:text-xl lg:text-2xl text-slate-300 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-4 sm:px-0">
              Stop paying $10,000/month for an agency. Get AI-powered viral analysis,
              content generation, and strategic automation that delivers
              <span className="text-white font-semibold"> 2.2x engagement boost</span> guaranteed.
            </p>

            {/* Value Props - Responsive Grid */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-3 sm:gap-4 mb-8 sm:mb-10 px-4 sm:px-0">
              <div className="flex items-center space-x-1 sm:space-x-2 text-slate-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400 flex-shrink-0" />
                <span>No Agency Fees</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2 text-slate-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400 flex-shrink-0" />
                <span>24/7 AI Strategy</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2 text-slate-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400 flex-shrink-0" />
                <span>Viral Analysis</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2 text-slate-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400 flex-shrink-0" />
                <span>All Platforms</span>
              </div>
            </div>

            {/* CTA Buttons - Mobile Optimized with Premium Glass + Enhanced Glow */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-8 sm:mb-12 px-4 sm:px-0">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="xl" variant="premium-primary" className="w-full sm:w-auto shadow-[0_0_30px_rgba(139,92,246,0.4),0_0_60px_rgba(139,92,246,0.2)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5),0_0_80px_rgba(139,92,246,0.3)] transition-shadow relative overflow-hidden group">
                  <span className="relative z-10 flex items-center">
                    Start Free 14-Day Trial
                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </span>
                  {/* Shimmer effect */}
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </Button>
              </Link>
              <Link href="/demo" className="w-full sm:w-auto">
                <Button size="xl" variant="glass" className="w-full sm:w-auto border-white/20 hover:border-white/30 hover:bg-white/[0.08]">
                  Watch 3-Min Demo
                </Button>
              </Link>
            </div>

            {/* Live Stats - Mobile Responsive with better contrast */}
            <div className="flex justify-center flex-wrap gap-4 sm:gap-6 lg:gap-8 text-slate-400 text-xs sm:text-sm">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <Users className="w-4 sm:w-5 h-4 sm:h-5" />
                <UserCount />
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400" />
                <EngagementBoost />
              </div>
              <div className="hidden sm:flex items-center space-x-1 sm:space-x-2">
                <Brain className="w-4 sm:w-5 h-4 sm:h-5 text-violet-400" />
                <span>AI-Powered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Preview with Premium Glass - REDESIGNED */}
        <div className="container mx-auto mt-20 px-4 sm:px-6">
          <div className="relative max-w-6xl mx-auto">
            {/* Enhanced glow behind dashboard */}
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/40 via-fuchsia-500/30 to-blue-500/40 rounded-3xl blur-3xl opacity-40"></div>
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-xl"></div>

            <Card className="relative glass-premium-gradient rounded-2xl p-1.5 shadow-[0_0_60px_rgba(139,92,246,0.3)] border-white/[0.15]">
              {/* Window Chrome - macOS style */}
              <div className="bg-gradient-to-b from-slate-800/90 to-slate-900/95 rounded-t-xl px-4 py-3 flex items-center gap-8 border-b border-white/[0.08]">
                {/* Traffic lights */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57] shadow-[0_0_6px_rgba(255,95,87,0.5)]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[0_0_6px_rgba(255,189,46,0.5)]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#28c840] shadow-[0_0_6px_rgba(40,200,64,0.5)]"></div>
                </div>
                {/* URL Bar */}
                <div className="flex-1 max-w-md">
                  <div className="bg-slate-700/50 rounded-md px-3 py-1.5 flex items-center gap-2 border border-white/[0.08]">
                    <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center">
                      <Shield className="w-2.5 h-2.5 text-emerald-400" />
                    </div>
                    <span className="text-xs text-slate-400 font-mono">app.synthex.social/dashboard</span>
                  </div>
                </div>
                {/* User avatar */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500"></div>
                </div>
              </div>

              {/* Dashboard Content */}
              <div className="bg-gradient-to-br from-slate-900 via-[#0f0720] to-slate-950 rounded-b-xl p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                  {/* Main Chart Area */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Viral Score Analysis Card */}
                    <div className="bg-white/[0.08] rounded-xl p-5 border border-white/[0.12] backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <LineChart className="w-5 h-5 text-purple-400" />
                          <span className="text-sm font-medium text-slate-200">Viral Score Analysis</span>
                        </div>
                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                          LIVE
                        </span>
                      </div>
                      {/* Animated Bar Chart */}
                      <div className="h-32 sm:h-40 bg-gradient-to-b from-white/[0.03] to-transparent rounded-lg p-4 flex items-end justify-around gap-2">
                        {[85, 65, 90, 75, 95, 70, 88, 78, 92, 68, 87, 80].map((height, i) => (
                          <div key={i} className="flex-1 max-w-[30px] rounded-t-sm bg-gradient-to-t from-purple-500 to-fuchsia-400 opacity-80 transition-all duration-500 hover:opacity-100"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between mt-3 text-[10px] text-slate-500 px-2">
                        <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                        <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/[0.08] rounded-xl p-4 border border-white/[0.12] backdrop-blur-sm group hover:bg-white/[0.12] transition-colors">
                        <Target className="w-8 h-8 text-purple-400 mb-3 group-hover:scale-110 transition-transform" />
                        <p className="text-xs text-slate-400 mb-1">Optimal Post Time</p>
                        <p className="text-xl font-bold text-white">2:30 PM</p>
                        <p className="text-[10px] text-slate-500 mt-1">EST • Tuesday</p>
                      </div>
                      <div className="bg-white/[0.08] rounded-xl p-4 border border-white/[0.12] backdrop-blur-sm group hover:bg-white/[0.12] transition-colors">
                        <Hash className="w-8 h-8 text-cyan-400 mb-3 group-hover:scale-110 transition-transform" />
                        <p className="text-xs text-slate-400 mb-1">Trending Hashtags</p>
                        <p className="text-xl font-bold text-white">24 Active</p>
                        <p className="text-[10px] text-emerald-400 mt-1">+8 from yesterday</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Recommendations Panel */}
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-purple-500/[0.12] to-fuchsia-500/[0.08] rounded-xl p-5 border border-purple-500/20 backdrop-blur-sm h-full">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 flex items-center justify-center">
                          <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">AI Recommendations</p>
                          <p className="text-[10px] text-slate-400">Updated 2 min ago</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="bg-white/[0.06] rounded-lg p-3 border border-white/[0.08] hover:border-yellow-500/30 transition-colors cursor-pointer">
                          <div className="flex items-start space-x-2.5">
                            <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-slate-200 leading-relaxed">Use video content for 3.2x engagement</p>
                              <p className="text-[10px] text-emerald-400 mt-1">High impact</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/[0.06] rounded-lg p-3 border border-white/[0.08] hover:border-yellow-500/30 transition-colors cursor-pointer">
                          <div className="flex items-start space-x-2.5">
                            <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-slate-200 leading-relaxed">Include CTA in first 10 words</p>
                              <p className="text-[10px] text-blue-400 mt-1">Medium impact</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/[0.06] rounded-lg p-3 border border-white/[0.08] hover:border-yellow-500/30 transition-colors cursor-pointer">
                          <div className="flex items-start space-x-2.5">
                            <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-slate-200 leading-relaxed">Optimal length: 280 characters</p>
                              <p className="text-[10px] text-purple-400 mt-1">Best practice</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button className="w-full mt-4 py-2 text-xs font-medium text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 rounded-lg border border-purple-500/20 transition-colors">
                        View All Recommendations →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 3D Social Network Visualization */}
      <section className="py-20 px-6 border-t border-white/10 bg-gradient-to-b from-black/50 to-purple-900/10">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              <span className="gradient-text-premium">
                Connected to Every Platform
              </span>
            </h2>
            <p className="text-xl text-slate-300">Visualize your social media ecosystem in real-time</p>
          </div>
          <SocialNetworkOrb />
        </div>
      </section>

      {/* 3D Floating Posts Section */}
      <section className="py-20 px-6 border-t border-white/10 bg-gradient-to-b from-blue-900/10 to-black/50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              <span className="gradient-text-premium">
                Real Social Media Posts in 3D
              </span>
            </h2>
            <p className="text-xl text-slate-300">Experience engagement like never before - interact with live posts</p>
            <p className="text-sm text-slate-400 mt-2">Hover to interact • Click hearts to like • Real engagement in 3D</p>
          </div>
          <FloatingPostCards />
        </div>
      </section>

      {/* Real-Time Activity Stream Section */}
      <section className="py-20 px-6 border-t border-white/10 bg-gradient-to-b from-black/50 to-violet-900/10">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              <span className="gradient-text-premium">
                Real-Time Activity Stream
              </span>
            </h2>
            <p className="text-xl text-slate-300">Watch engagement happen live across all your connected platforms</p>
          </div>
          <ActivityStream3D />
        </div>
      </section>

      {/* Social Proof Section - Enhanced */}
      <Testimonials />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Core Features - Agency Focus */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Your AI-Powered Social Media
              <span className="gradient-text-premium"> Agency Team</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Every tool a $10,000/month agency uses, powered by AI and available 24/7
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Strategy Analyst */}
            <Card variant="glass-primary" className="group p-8 hover:border-purple-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/25">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Strategy Analyst</h3>
              <p className="text-slate-300 mb-4">
                Analyzes millions of posts to identify viral patterns and optimal strategies for your niche.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Viral pattern recognition
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Competitor analysis
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Trend forecasting
                </li>
              </ul>
            </Card>

            {/* Content Creator */}
            <Card variant="glass-secondary" className="group p-8 hover:border-blue-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/25">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Content Creator</h3>
              <p className="text-slate-300 mb-4">
                Generates authentic, on-brand content that maintains your voice while maximizing engagement.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Brand voice learning
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  10+ variations per post
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Platform optimization
                </li>
              </ul>
            </Card>

            {/* Campaign Manager */}
            <Card variant="glass" className="group p-8 hover:border-pink-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 flex items-center justify-center mb-6 shadow-lg shadow-pink-500/25">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Campaign Manager</h3>
              <p className="text-slate-300 mb-4">
                Schedules and manages campaigns across all platforms with perfect timing for each audience.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Optimal time scheduling
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Multi-platform sync
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  A/B testing
                </li>
              </ul>
            </Card>

            {/* Analytics Expert */}
            <Card variant="glass-success" className="group p-8 hover:border-green-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/25">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Analytics Expert</h3>
              <p className="text-slate-300 mb-4">
                Provides deep insights and actionable recommendations based on real-time performance data.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Real-time tracking
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  ROI measurement
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Custom reports
                </li>
              </ul>
            </Card>

            {/* Growth Hacker */}
            <Card variant="glass-warning" className="group p-8 hover:border-orange-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center mb-6 shadow-lg shadow-amber-500/25">
                <Rocket className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Growth Hacker</h3>
              <p className="text-slate-300 mb-4">
                Implements advanced growth strategies and optimizations to accelerate your follower growth.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Hashtag research
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Engagement tactics
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Audience targeting
                </li>
              </ul>
            </Card>

            {/* Compliance Officer */}
            <Card variant="glass-destructive" className="group p-8 hover:border-red-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 flex items-center justify-center mb-6 shadow-lg shadow-red-500/25">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Compliance Officer</h3>
              <p className="text-slate-300 mb-4">
                Ensures all content follows platform guidelines and best practices to maximize reach.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Platform compliance
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Content moderation
                </li>
                <li className="flex items-center text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Brand safety
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Platform Support - Enhanced with SVG icons */}
      <section className="py-20 lg:py-28 px-6 border-t border-white/10 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-transparent" />

        <div className="container mx-auto relative">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-sm font-medium text-cyan-300 mb-6">
              <Globe className="w-4 h-4" />
              Universal Integration
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              One Platform. <span className="gradient-text-premium">All Networks.</span>
            </h2>
            <p className="text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto">
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
          <p className="text-center text-sm text-slate-500 mt-8">
            + Threads, Pinterest, Reddit, and more coming soon
          </p>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card variant="gradient-primary" className="p-12 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-white mb-4">
                Save $120,000+ Per Year
              </h2>
              <p className="text-xl text-white/70">
                See how much you'll save compared to a traditional agency
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white mb-4">Traditional Agency</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-slate-300">
                    <span>Monthly Retainer</span>
                    <span className="text-red-400">$10,000</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Setup Fee</span>
                    <span className="text-red-400">$5,000</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Additional Services</span>
                    <span className="text-red-400">$2,000+</span>
                  </div>
                  <Separator variant="glass" className="my-3" />
                  <div className="flex justify-between text-white font-bold">
                    <span>Annual Cost</span>
                    <span className="text-red-400">$144,000+</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white mb-4">SYNTHEX Platform</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-slate-300">
                    <span>Monthly Subscription</span>
                    <span className="text-emerald-400">$297</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Setup Fee</span>
                    <span className="text-emerald-400">$0</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>All Features Included</span>
                    <span className="text-emerald-400">✓</span>
                  </div>
                  <Separator variant="glass-success" className="my-3" />
                  <div className="flex justify-between text-white font-bold">
                    <span>Annual Cost</span>
                    <span className="text-emerald-400">$3,564</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-12 text-center">
              <Badge variant="glass-success" size="lg" className="px-6 py-3">
                <Award className="w-5 h-5 mr-2" />
                <span className="text-xl font-bold">You Save $140,436/Year</span>
              </Badge>
              <p className="mt-4 text-slate-400">Plus get better results with AI that never sleeps</p>
            </div>
          </Card>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-6 border-t border-white/10">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl font-bold text-white mb-6">
              Stop Overpaying for Social Media Management
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Join 1000+ businesses getting agency-level results at 97% less cost
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
              <Link href="/signup">
                <Button size="xl" variant="premium-primary" className="shadow-2xl shadow-purple-500/25">
                  Start Your Free Trial Now
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="xl" variant="glass">
                  Schedule a Demo
                </Button>
              </Link>
            </div>
            
            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
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

      {/* Footer with Premium Glass */}
      <footer className="glass-premium-solid border-t border-white/[0.06] py-16 px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="relative">
                  <Sparkles className="w-8 h-8 text-purple-500" />
                  <div className="absolute inset-0 w-8 h-8 bg-purple-500 blur-xl opacity-50"></div>
                </div>
                <span className="text-2xl font-bold text-white">SYNTHEX</span>
              </div>
              <p className="text-slate-400 mb-4">
                Your complete social media agency powered by artificial intelligence.
              </p>
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">
                  <a href="mailto:support@synthex.social" className="hover:text-white transition">
                    support@synthex.social
                  </a>
                </p>
                <p className="text-slate-400 text-sm">1-800-SYNTHEX</p>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/features" className="hover:text-white transition">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
                <li><Link href="/case-studies" className="hover:text-white transition">Case Studies</Link></li>
                <li><Link href="/integrations" className="hover:text-white transition">Integrations</Link></li>
                <li><Link href="/roadmap" className="hover:text-white transition">Roadmap</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/docs" className="hover:text-white transition">Documentation</Link></li>
                <li><Link href="/api" className="hover:text-white transition">API Reference</Link></li>
                <li><Link href="/blog" className="hover:text-white transition">Blog</Link></li>
                <li><Link href="/academy" className="hover:text-white transition">Academy</Link></li>
                <li><Link href="/support" className="hover:text-white transition">Support Center</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
                <li><Link href="/careers" className="hover:text-white transition">Careers</Link></li>
                <li><Link href="/partners" className="hover:text-white transition">Partners</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          
          <Separator variant="glass" className="mb-8" />
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-500 text-sm mb-4 md:mb-0">
              © 2025 SYNTHEX. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="https://twitter.com/synthexai" className="text-slate-500 hover:text-white transition">
                Twitter
              </a>
              <a href="https://linkedin.com/company/synthex" className="text-slate-500 hover:text-white transition">
                LinkedIn
              </a>
              <a href="https://github.com/synthex" className="text-slate-500 hover:text-white transition">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
