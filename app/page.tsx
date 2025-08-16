'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  ArrowRight, Sparkles, TrendingUp, Users, Calendar, BarChart3, Zap,
  CheckCircle2, Brain, Shield, Globe, Rocket, Award, LineChart,
  MessageSquare, Hash, Clock, Target, Lightbulb, ChevronRight,
  Star, BadgeCheck, ArrowUpRight
} from 'lucide-react';
import { UserCount, EngagementBoost } from '@/components/real-stats';

// Dynamic import 3D components to avoid SSR issues
const SocialNetworkOrb = dynamic(() => import('@/components/3d/SocialNetworkOrb'), {
  ssr: false,
  loading: () => <div className="h-[500px] bg-black/50 animate-pulse rounded-lg" />
});

const FloatingPostCards = dynamic(() => import('@/components/3d/FloatingPostCard'), {
  ssr: false,
  loading: () => <div className="h-[600px] bg-black/50 animate-pulse rounded-lg" />
});

const ActivityStream3D = dynamic(() => import('@/components/3d/ActivityStream3D'), {
  ssr: false,
  loading: () => <div className="h-[500px] bg-black/50 animate-pulse rounded-lg" />
});

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation - Responsive */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-xl bg-black/50 border-b border-white/10">
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
                <Button variant="ghost" className="text-gray-300 hover:text-white text-sm lg:text-base">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 text-sm lg:text-base">
                  <span className="hidden xl:inline">Start Free Trial</span>
                  <span className="xl:hidden">Start</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Fully Responsive */}
      <section className="relative pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 overflow-hidden">
        <div className="container mx-auto">
          <div className="max-w-5xl mx-auto text-center">
            {/* Trust Badge */}
            <div className="inline-flex items-center space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6 sm:mb-8">
              <BadgeCheck className="w-3 sm:w-4 h-3 sm:h-4 text-green-400" />
              <span className="text-xs sm:text-sm text-gray-300">Trusted by 1000+ businesses worldwide</span>
            </div>
            
            <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight">
              Your Complete
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Social Media Agency
              </span>
              <br />
              In One Platform
            </h1>
            
            <p className="text-base sm:text-xl lg:text-2xl text-gray-300 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-4 sm:px-0">
              Stop paying $10,000/month for an agency. Get AI-powered viral analysis, 
              content generation, and strategic automation that delivers 
              <span className="text-white font-semibold"> 2.2x engagement boost</span> guaranteed.
            </p>

            {/* Value Props - Responsive Grid */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-3 sm:gap-4 mb-8 sm:mb-10 px-4 sm:px-0">
              <div className="flex items-center space-x-1 sm:space-x-2 text-gray-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-green-400 flex-shrink-0" />
                <span>No Agency Fees</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2 text-gray-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-green-400 flex-shrink-0" />
                <span>24/7 AI Strategy</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2 text-gray-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-green-400 flex-shrink-0" />
                <span>Viral Analysis</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2 text-gray-300 text-xs sm:text-sm">
                <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-green-400 flex-shrink-0" />
                <span>All Platforms</span>
              </div>
            </div>

            {/* CTA Buttons - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-8 sm:mb-12 px-4 sm:px-0">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg hover:from-purple-700 hover:to-blue-700 shadow-2xl shadow-purple-500/25">
                  Start Free 14-Day Trial
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link href="/demo" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/5 border-white/20 text-white px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg hover:bg-white/10 backdrop-blur-sm">
                  Watch 3-Min Demo
                </Button>
              </Link>
            </div>

            {/* Live Stats - Mobile Responsive */}
            <div className="flex justify-center flex-wrap gap-4 sm:gap-6 lg:gap-8 text-gray-400 text-xs sm:text-sm">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-green-400 rounded-full animate-pulse"></div>
                <Users className="w-4 sm:w-5 h-4 sm:h-5" />
                <UserCount />
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5 text-green-400" />
                <EngagementBoost />
              </div>
              <div className="hidden sm:flex items-center space-x-1 sm:space-x-2">
                <Brain className="w-4 sm:w-5 h-4 sm:h-5 text-purple-400" />
                <span>AI-Powered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="container mx-auto mt-20">
          <div className="relative max-w-6xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl blur-3xl opacity-20"></div>
            <Card className="relative bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl">
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-lg p-8">
                <div className="grid grid-cols-3 gap-4 h-full">
                  <div className="col-span-2 space-y-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-400">Viral Score Analysis</span>
                        <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">LIVE</span>
                      </div>
                      <div className="h-32 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                        <LineChart className="w-16 h-16 text-white/20" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <Target className="w-8 h-8 text-purple-400 mb-2" />
                        <p className="text-xs text-gray-400">Optimal Post Time</p>
                        <p className="text-lg font-semibold text-white">2:30 PM EST</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <Hash className="w-8 h-8 text-blue-400 mb-2" />
                        <p className="text-xs text-gray-400">Trending Hashtags</p>
                        <p className="text-lg font-semibold text-white">24 Active</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10 h-full">
                      <p className="text-sm text-gray-400 mb-3">AI Recommendations</p>
                      <div className="space-y-2">
                        <div className="flex items-start space-x-2">
                          <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5" />
                          <p className="text-xs text-gray-300">Use video content for 3.2x engagement</p>
                        </div>
                        <div className="flex items-start space-x-2">
                          <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5" />
                          <p className="text-xs text-gray-300">Include call-to-action in first 10 words</p>
                        </div>
                        <div className="flex items-start space-x-2">
                          <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5" />
                          <p className="text-xs text-gray-300">Optimal length: 280 characters</p>
                        </div>
                      </div>
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
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Connected to Every Platform
              </span>
            </h2>
            <p className="text-xl text-gray-200">Visualize your social media ecosystem in real-time</p>
          </div>
          <SocialNetworkOrb />
        </div>
      </section>

      {/* 3D Floating Posts Section */}
      <section className="py-20 px-6 border-t border-white/10 bg-gradient-to-b from-blue-900/10 to-black/50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              <span className="bg-gradient-to-r from-blue-400 to-pink-400 bg-clip-text text-transparent">
                Real Social Media Posts in 3D
              </span>
            </h2>
            <p className="text-xl text-gray-200">Experience engagement like never before - interact with live posts</p>
            <p className="text-sm text-gray-300 mt-2">Hover to interact • Click hearts to like • Real engagement in 3D</p>
          </div>
          <FloatingPostCards />
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 px-6 border-t border-white/10">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Replacing $120,000/Year Agencies
            </h2>
            <p className="text-gray-400">See why businesses are switching from traditional agencies to SYNTHEX</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="bg-white/5 backdrop-blur-sm border-white/10 p-6">
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-300 mb-4">
                "Replaced our $8k/month agency. Better results, fraction of the cost. 
                The AI understands our brand voice perfectly."
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"></div>
                <div>
                  <p className="text-white font-semibold">Sarah Chen</p>
                  <p className="text-xs text-gray-400">CEO, TechStart Inc.</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white/5 backdrop-blur-sm border-white/10 p-6">
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-300 mb-4">
                "3x our engagement in 30 days. The viral pattern analysis is game-changing. 
                It's like having a team of experts 24/7."
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"></div>
                <div>
                  <p className="text-white font-semibold">Marcus Johnson</p>
                  <p className="text-xs text-gray-400">Influencer, 500K followers</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white/5 backdrop-blur-sm border-white/10 p-6">
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-300 mb-4">
                "From 100 to 50K followers in 6 months. The AI-generated content 
                consistently outperforms what we created manually."
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-green-500 rounded-full"></div>
                <div>
                  <p className="text-white font-semibold">Emma Rodriguez</p>
                  <p className="text-xs text-gray-400">CMO, Fashion Brand</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Features - Agency Focus */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Your AI-Powered Social Media
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"> Agency Team</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Every tool a $10,000/month agency uses, powered by AI and available 24/7
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Strategy Analyst */}
            <Card className="group bg-gradient-to-br from-purple-900/20 to-transparent border-white/10 p-8 hover:border-purple-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center mb-6">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Strategy Analyst</h3>
              <p className="text-gray-400 mb-4">
                Analyzes millions of posts to identify viral patterns and optimal strategies for your niche.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Viral pattern recognition
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Competitor analysis
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Trend forecasting
                </li>
              </ul>
            </Card>

            {/* Content Creator */}
            <Card className="group bg-gradient-to-br from-blue-900/20 to-transparent border-white/10 p-8 hover:border-blue-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center mb-6">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Content Creator</h3>
              <p className="text-gray-400 mb-4">
                Generates authentic, on-brand content that maintains your voice while maximizing engagement.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Brand voice learning
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  10+ variations per post
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Platform optimization
                </li>
              </ul>
            </Card>

            {/* Campaign Manager */}
            <Card className="group bg-gradient-to-br from-pink-900/20 to-transparent border-white/10 p-8 hover:border-pink-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 flex items-center justify-center mb-6">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Campaign Manager</h3>
              <p className="text-gray-400 mb-4">
                Schedules and manages campaigns across all platforms with perfect timing for each audience.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Optimal time scheduling
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Multi-platform sync
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  A/B testing
                </li>
              </ul>
            </Card>

            {/* Analytics Expert */}
            <Card className="group bg-gradient-to-br from-green-900/20 to-transparent border-white/10 p-8 hover:border-green-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center mb-6">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Analytics Expert</h3>
              <p className="text-gray-400 mb-4">
                Provides deep insights and actionable recommendations based on real-time performance data.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Real-time tracking
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  ROI measurement
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Custom reports
                </li>
              </ul>
            </Card>

            {/* Growth Hacker */}
            <Card className="group bg-gradient-to-br from-orange-900/20 to-transparent border-white/10 p-8 hover:border-orange-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center mb-6">
                <Rocket className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Growth Hacker</h3>
              <p className="text-gray-400 mb-4">
                Implements advanced growth strategies and optimizations to accelerate your follower growth.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Hashtag research
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Engagement tactics
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Audience targeting
                </li>
              </ul>
            </Card>

            {/* Compliance Officer */}
            <Card className="group bg-gradient-to-br from-red-900/20 to-transparent border-white/10 p-8 hover:border-red-500/50 transition-all">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center mb-6">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Compliance Officer</h3>
              <p className="text-gray-400 mb-4">
                Ensures all content follows platform guidelines and best practices to maximize reach.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Platform compliance
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Content moderation
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                  Brand safety
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Platform Support */}
      <section className="py-20 px-6 border-t border-white/10">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              One Platform. All Networks.
            </h2>
            <p className="text-xl text-gray-400">
              Manage your entire social media presence from a single dashboard
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 max-w-4xl mx-auto">
            {[
              { name: 'Twitter/X', icon: '𝕏' },
              { name: 'LinkedIn', icon: 'in' },
              { name: 'Instagram', icon: '📷' },
              { name: 'TikTok', icon: '♪' },
              { name: 'Facebook', icon: 'f' },
              { name: 'YouTube', icon: '▶' }
            ].map((platform) => (
              <Card key={platform.name} className="bg-white/5 backdrop-blur-sm border-white/10 p-6 text-center hover:bg-white/10 transition-all group">
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{platform.icon}</div>
                <p className="text-sm text-gray-300">{platform.name}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 backdrop-blur-xl border-white/10 p-12 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-white mb-4">
                Save $120,000+ Per Year
              </h2>
              <p className="text-xl text-gray-300">
                See how much you'll save compared to a traditional agency
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white mb-4">Traditional Agency</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-300">
                    <span>Monthly Retainer</span>
                    <span className="text-red-400">$10,000</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Setup Fee</span>
                    <span className="text-red-400">$5,000</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Additional Services</span>
                    <span className="text-red-400">$2,000+</span>
                  </div>
                  <div className="border-t border-white/20 pt-3 flex justify-between text-white font-bold">
                    <span>Annual Cost</span>
                    <span className="text-red-400">$144,000+</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white mb-4">SYNTHEX Platform</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-300">
                    <span>Monthly Subscription</span>
                    <span className="text-green-400">$297</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Setup Fee</span>
                    <span className="text-green-400">$0</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>All Features Included</span>
                    <span className="text-green-400">✓</span>
                  </div>
                  <div className="border-t border-white/20 pt-3 flex justify-between text-white font-bold">
                    <span>Annual Cost</span>
                    <span className="text-green-400">$3,564</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-12 text-center">
              <div className="inline-flex items-center space-x-2 px-6 py-3 rounded-full bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30">
                <Award className="w-5 h-5 text-green-400" />
                <span className="text-xl font-bold text-green-400">You Save $140,436/Year</span>
              </div>
              <p className="mt-4 text-gray-400">Plus get better results with AI that never sleeps</p>
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
            <p className="text-xl text-gray-300 mb-8">
              Join 1000+ businesses getting agency-level results at 97% less cost
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
              <Link href="/signup">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-10 py-6 text-lg hover:from-purple-700 hover:to-blue-700 shadow-2xl shadow-purple-500/25">
                  Start Your Free Trial Now
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="bg-white/5 border-white/20 text-white px-10 py-6 text-lg hover:bg-white/10 backdrop-blur-sm">
                  Schedule a Demo
                </Button>
              </Link>
            </div>
            
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>24/7 support</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/50 backdrop-blur-xl border-t border-white/10 py-16 px-6">
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
              <p className="text-gray-400 mb-4">
                Your complete social media agency powered by artificial intelligence.
              </p>
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">
                  <a href="mailto:support@synthex.social" className="hover:text-white transition">
                    support@synthex.social
                  </a>
                </p>
                <p className="text-gray-400 text-sm">1-800-SYNTHEX</p>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/features" className="hover:text-white transition">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
                <li><Link href="/case-studies" className="hover:text-white transition">Case Studies</Link></li>
                <li><Link href="/integrations" className="hover:text-white transition">Integrations</Link></li>
                <li><Link href="/roadmap" className="hover:text-white transition">Roadmap</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/docs" className="hover:text-white transition">Documentation</Link></li>
                <li><Link href="/api" className="hover:text-white transition">API Reference</Link></li>
                <li><Link href="/blog" className="hover:text-white transition">Blog</Link></li>
                <li><Link href="/academy" className="hover:text-white transition">Academy</Link></li>
                <li><Link href="/support" className="hover:text-white transition">Support Center</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
                <li><Link href="/careers" className="hover:text-white transition">Careers</Link></li>
                <li><Link href="/partners" className="hover:text-white transition">Partners</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm mb-4 md:mb-0">
              © 2025 SYNTHEX. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="https://twitter.com/synthexai" className="text-gray-400 hover:text-white transition">
                Twitter
              </a>
              <a href="https://linkedin.com/company/synthex" className="text-gray-400 hover:text-white transition">
                LinkedIn
              </a>
              <a href="https://github.com/synthex" className="text-gray-400 hover:text-white transition">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
