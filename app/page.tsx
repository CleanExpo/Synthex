'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Sparkles, CheckCircle2, Zap, BarChart3, Globe, Bot, Play, Pause
} from 'lucide-react';
import { useState } from 'react';

// Synthex Logo Component
function SynthexLogo({ className = "w-10 h-10" }: { className?: string }) {
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
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400/30 rounded-full animate-float"
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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a1628] text-white overflow-hidden">
      {/* Deep Navy Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f172a] to-[#0a1628]" />

      {/* Subtle Grid Pattern */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />

      {/* Floating Particles */}
      <FloatingParticles />

      {/* Glow Effects */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Navigation */}
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

      {/* Hero Section */}
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
                  <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/20">
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
                <div className="inline-flex">
                  <span className="px-8 py-5 bg-white text-[#0a1628] text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black uppercase rounded-2xl tracking-tight shadow-2xl shadow-white/10">
                    AI Marketing
                  </span>
                </div>
                <div className="inline-flex">
                  <span className="px-8 py-5 bg-gradient-to-r from-cyan-500 to-cyan-400 text-[#0a1628] text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black uppercase rounded-2xl tracking-tight shadow-2xl shadow-cyan-500/30">
                    Agency
                  </span>
                </div>
              </div>

              {/* Brand Domain */}
              <div className="mb-8">
                <span className="text-2xl sm:text-3xl font-light tracking-wide text-cyan-400">
                  synthex.social
                </span>
              </div>

              {/* Tagline */}
              <p className="text-lg sm:text-xl text-gray-400 mb-6 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                The world's first <span className="text-white font-medium">fully autonomous AI marketing agency</span>.
                Powered by advanced AI that creates, optimizes, and scales your social media presence 24/7.
              </p>

              {/* Key Differentiator */}
              <div className="mb-10 p-4 bg-gradient-to-r from-cyan-500/10 to-transparent border-l-2 border-cyan-400 rounded-r-lg max-w-lg mx-auto lg:mx-0">
                <p className="text-white font-medium mb-1">From just $199/month</p>
                <p className="text-gray-400 text-sm">Use your own API keys to dramatically reduce costs. Custom enterprise rates available.</p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
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
              <div className="flex flex-wrap gap-6 justify-center lg:justify-start text-sm text-gray-500">
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

      {/* Features Section */}
      <section className="relative py-32 z-10">
        <div className="container mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-20">
            <span className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm font-medium mb-6">
              Powered by AI
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Everything you need to <span className="text-cyan-400">dominate</span> social
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Our AI handles every aspect of your social media marketing, from content creation to performance optimization.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Bot, title: 'AI Content Creation', desc: 'Generate engaging posts, captions, and visuals automatically' },
              { icon: Zap, title: 'Smart Scheduling', desc: 'AI determines optimal posting times for maximum engagement' },
              { icon: BarChart3, title: 'Performance Analytics', desc: 'Real-time insights and AI-powered recommendations' },
              { icon: Globe, title: 'Multi-Platform', desc: 'Manage all your social accounts from one dashboard' },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-8 bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl hover:border-cyan-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10"
              >
                <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Explainer Section */}
      <section className="relative py-32 z-10">
        <div className="container mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm font-medium mb-6">
              See It In Action
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Watch how <span className="text-cyan-400">Synthex</span> works
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              See our AI in action as it creates, optimizes, and publishes content across all your social platforms.
            </p>
          </div>

          {/* Video Grid */}
          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Main Explainer Video */}
            <div className="lg:col-span-2">
              <div className="relative group rounded-2xl overflow-hidden border border-cyan-500/20 bg-[#0f172a]/80">
                {/* Video Placeholder with Image */}
                <div className="relative aspect-video">
                  <Image
                    src="/images/hero-robot.png"
                    alt="Synthex AI Marketing Platform Demo"
                    fill
                    className="object-cover opacity-80"
                  />
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0a1628]/40 group-hover:bg-[#0a1628]/30 transition-colors">
                    <button
                      className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center shadow-xl shadow-cyan-500/30 group-hover:scale-110 transition-transform"
                      aria-label="Play video"
                    >
                      <Play className="w-8 h-8 text-white ml-1" />
                    </button>
                  </div>
                  {/* Video Duration Badge */}
                  <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/70 rounded-full text-sm text-white">
                    2:30
                  </div>
                </div>
                {/* Video Info */}
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Complete Platform Overview
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Discover how Synthex transforms your social media marketing with AI-powered automation.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature Videos */}
            {[
              {
                title: 'AI Content Generation',
                description: 'Watch AI create engaging posts in seconds',
                duration: '1:15',
              },
              {
                title: 'Smart Scheduling',
                description: 'See how AI finds the perfect posting times',
                duration: '0:45',
              },
            ].map((video, i) => (
              <div key={i} className="relative group rounded-2xl overflow-hidden border border-cyan-500/10 bg-[#0f172a]/60 hover:border-cyan-500/30 transition-all">
                {/* Video Placeholder */}
                <div className="relative aspect-video bg-gradient-to-br from-cyan-500/10 to-cyan-600/5">
                  {/* Animated Background */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full bg-cyan-500/20 animate-pulse" />
                  </div>
                  {/* Play Button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-110 transition-transform"
                      aria-label={`Play ${video.title}`}
                    >
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    </button>
                  </div>
                  {/* Duration */}
                  <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
                    {video.duration}
                  </div>
                </div>
                {/* Info */}
                <div className="p-4">
                  <h4 className="font-semibold text-white mb-1">{video.title}</h4>
                  <p className="text-gray-500 text-sm">{video.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-20 z-10 border-y border-cyan-500/10">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '10K+', label: 'Active Users' },
              { value: '50M+', label: 'Posts Created' },
              { value: '99.9%', label: 'Uptime' },
              { value: '4.9/5', label: 'User Rating' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl sm:text-5xl font-bold text-cyan-400 mb-2">{stat.value}</div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 z-10">
        <div className="container mx-auto px-6">
          <div className="relative overflow-hidden bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 border border-cyan-500/20 rounded-3xl p-12 sm:p-16 text-center">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-500/5" />

            <div className="relative z-10">
              <SynthexLogo className="w-16 h-16 mx-auto mb-8" />
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
                Ready to transform your marketing?
              </h2>
              <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
                Join thousands of businesses using Synthex to automate their social media success.
              </p>
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-semibold shadow-xl shadow-cyan-500/30 px-10 py-6 text-lg rounded-xl transition-all hover:shadow-cyan-500/50"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-16 px-6 border-t border-cyan-500/10">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center space-x-3 mb-6">
                <SynthexLogo className="w-10 h-10" />
                <span className="text-xl font-bold">SYNTHEX</span>
              </Link>
              <p className="text-gray-500 text-sm mb-4">
                The world's first fully autonomous AI marketing agency.
              </p>
              <p className="text-cyan-400 font-medium">synthex.social</p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold mb-4 text-white">Product</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><Link href="/features" className="hover:text-cyan-400 transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-cyan-400 transition-colors">Pricing</Link></li>
                <li><Link href="/integrations" className="hover:text-cyan-400 transition-colors">Integrations</Link></li>
                <li><Link href="/changelog" className="hover:text-cyan-400 transition-colors">Changelog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><Link href="/about" className="hover:text-cyan-400 transition-colors">About</Link></li>
                <li><Link href="/blog" className="hover:text-cyan-400 transition-colors">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-cyan-400 transition-colors">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-cyan-400 transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-white">Legal</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-cyan-400 transition-colors">Terms of Service</Link></li>
                <li><Link href="/security" className="hover:text-cyan-400 transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-600">
              © 2026 SYNTHEX. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-gray-500 hover:text-cyan-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
              </a>
              <a href="#" className="text-gray-500 hover:text-cyan-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </a>
              <a href="#" className="text-gray-500 hover:text-cyan-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Styles */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-20px) translateX(-10px);
            opacity: 0.6;
          }
        }

        @keyframes disperse {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 0.6;
          }
          100% {
            transform: translate(-100px, -50px) scale(0);
            opacity: 0;
          }
        }

        .animate-float {
          animation: float 8s ease-in-out infinite;
        }

        .animate-disperse {
          animation: disperse 4s ease-out infinite;
        }
      `}</style>
    </div>
  );
}
