'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Sparkles, TrendingUp, Users, Calendar, BarChart3, Zap, Brain, Palette, Target } from '@/components/icons';
import { useEffect } from 'react';

export default function EnhancedHomePage() {
  useEffect(() => {
    // Load design animations
    const script = document.createElement('script');
    script.src = '/design-animations.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-cyan-900/20 to-gray-900 relative overflow-hidden">
      {/* Animated Blob Background */}
      <div className="blob-background">
        <div className="fixed inset-0 opacity-30">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-96 h-96 bg-amber-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Enhanced Navigation with Liquid Glass */}
      <nav className="fixed top-0 w-full z-50 liquid-glass border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-cyan-400" />
              <span className="text-2xl font-bold gradient-text-cyan heading-serif">Synthex</span>
            </div>
            <div className="flex items-center space-x-6">
              <Link href="/features" className="text-gray-300 hover:text-cyan-400 transition body-text">
                Features
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-cyan-400 transition body-text">
                Pricing
              </Link>
              <Link href="/docs" className="text-gray-300 hover:text-cyan-400 transition body-text">
                Docs
              </Link>
              <Link href="/login">
                <Button variant="ghost" className="text-gray-300 hover:text-white ios-glass">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-cyan-500 to-amber-500 text-white shadow-beautiful-md hover:shadow-beautiful-lg transition-all">
                  Get Started <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Sequence Animations */}
      <section className="pt-32 pb-20 px-6 relative">
        <div className="container mx-auto text-center">
          <h1 className="text-7xl font-bold text-white mb-6 heading-serif letter-tight" data-sequence data-sequence-animation="slide-up">
            <span className="word-animation">AI-Powered Social Media</span>
            <br />
            <span className="gradient-text-mixed letter-animation">Automation Platform</span>
          </h1>
          <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto body-text-light" data-sequence data-sequence-delay="200" data-sequence-animation="fade-in">
            Analyze viral patterns, generate personalized content, and schedule posts across all platforms. 
            Let AI handle your social media while you focus on growing your business.
          </p>
          <div className="flex justify-center space-x-4 stagger-children">
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-8 py-6 text-lg shadow-beautiful-lg shadow-hover-lift btn-ripple">
                Start Free Trial
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="liquid-glass border-cyan-400/20 text-white px-8 py-6 text-lg hover:bg-cyan-400/10 shadow-beautiful-md">
                Watch Demo
              </Button>
            </Link>
          </div>
          <div className="mt-10 flex justify-center space-x-8 text-gray-400 sequence-fade-in" style={{ animationDelay: '600ms' }}>
            <div className="flex items-center space-x-2 card-frame px-4 py-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span>10,000+ Users</span>
            </div>
            <div className="flex items-center space-x-2 card-frame px-4 py-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <span>3x Engagement</span>
            </div>
            <div className="flex items-center space-x-2 card-frame px-4 py-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <span>AI-Powered</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <h2 className="text-5xl font-bold text-center text-white mb-12 heading-serif letter-tight scroll-reveal">
            Everything You Need to <span className="gradient-text-amber">Dominate Social Media</span>
          </h2>
          
          <div className="bento-grid bento-grid-3">
            {/* Featured Large Card */}
            <Card className="bento-item-featured liquid-glass p-8 scroll-reveal shadow-beautiful-xl shadow-hover-lift">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center mb-6 shadow-glow-cyan">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 heading-sans">AI Pattern Recognition</h3>
              <p className="text-gray-300 body-text mb-4">
                Our advanced AI analyzes millions of posts to identify viral patterns, trending topics, and engagement triggers specific to your niche.
              </p>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                  <span>Real-time trend analysis</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                  <span>Competitor monitoring</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                  <span>Hashtag optimization</span>
                </li>
              </ul>
            </Card>

            {/* Regular Cards */}
            <Card className="bento-item liquid-glass p-6 scroll-reveal shadow-beautiful-lg shadow-hover-lift stagger-child">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-4 shadow-glow-amber">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 heading-sans">Persona Learning</h3>
              <p className="text-gray-400 body-text">
                Upload your content and let AI learn your unique voice, style, and brand personality.
              </p>
            </Card>

            <Card className="bento-item liquid-glass p-6 scroll-reveal shadow-beautiful-lg shadow-hover-lift stagger-child">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center mb-4">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 heading-sans">Content Generation</h3>
              <p className="text-gray-400 body-text">
                Generate 10-15 variations of viral-optimized content in your authentic voice.
              </p>
            </Card>

            <Card className="bento-item-wide liquid-glass p-6 scroll-reveal shadow-beautiful-lg shadow-hover-lift">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-400 to-amber-400 flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2 heading-sans">Platform Optimization</h3>
                  <p className="text-gray-400 body-text mb-3">
                    Each platform has unique algorithms and best practices. Synthex optimizes your content for maximum reach on every platform.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Twitter/X</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">Instagram</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-teal-500/20 text-cyan-400 border border-teal-500/30">TikTok</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">LinkedIn</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bento-item liquid-glass p-6 scroll-reveal shadow-beautiful-lg shadow-hover-lift">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 heading-sans">Smart Scheduling</h3>
              <p className="text-gray-400 body-text">
                Post at optimal times for maximum engagement on each platform.
              </p>
            </Card>

            <Card className="bento-item liquid-glass p-6 scroll-reveal shadow-beautiful-lg shadow-hover-lift">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 heading-sans">Real-Time Analytics</h3>
              <p className="text-gray-400 body-text">
                Track performance and ROI across all campaigns.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Modern Skeuomorphism CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card className="modern-skeu p-16 text-center scroll-reveal">
            <h2 className="text-5xl font-bold text-white mb-6 heading-serif letter-tight">
              Ready to <span className="gradient-text-mixed">10x Your Social Media?</span>
            </h2>
            <p className="text-xl text-gray-300 mb-10 body-text-light max-w-2xl mx-auto">
              Join thousands of creators and businesses automating their social media success with AI
            </p>
            <div className="flex justify-center space-x-4">
              <Link href="/signup">
                <Button size="lg" className="bg-gradient-to-r from-cyan-500 via-teal-500 to-amber-500 text-white px-12 py-7 text-lg shadow-beautiful-xl shadow-hover-lift" data-magnetic>
                  Start Your Free Trial
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
            </div>
            <p className="text-gray-500 mt-6 body-text">No credit card required • 14-day free trial • Cancel anytime</p>
          </Card>
        </div>
      </section>

      {/* Enhanced Footer with Liquid Glass */}
      <footer className="liquid-glass border-t border-white/10 py-12 px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                <span className="text-xl font-bold gradient-text-cyan heading-serif">Synthex</span>
              </div>
              <p className="text-gray-400 body-text">
                AI-powered social media automation for the modern creator.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 heading-sans">Product</h4>
              <ul className="space-y-2 text-gray-400 body-text">
                <li><Link href="/features" className="hover:text-cyan-400 transition">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-amber-400 transition">Pricing</Link></li>
                <li><Link href="/roadmap" className="hover:text-cyan-400 transition">Roadmap</Link></li>
                <li><Link href="/changelog" className="hover:text-amber-400 transition">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 heading-sans">Resources</h4>
              <ul className="space-y-2 text-gray-400 body-text">
                <li><Link href="/docs" className="hover:text-cyan-400 transition">Documentation</Link></li>
                <li><Link href="/api-reference" className="hover:text-amber-400 transition">API Reference</Link></li>
                <li><Link href="/blog" className="hover:text-cyan-400 transition">Blog</Link></li>
                <li><Link href="/support" className="hover:text-amber-400 transition">Support</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 heading-sans">Company</h4>
              <ul className="space-y-2 text-gray-400 body-text">
                <li><Link href="/about" className="hover:text-cyan-400 transition">About</Link></li>
                <li><Link href="/careers" className="hover:text-amber-400 transition">Careers</Link></li>
                <li><Link href="/privacy" className="hover:text-cyan-400 transition">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-amber-400 transition">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-8 text-center text-gray-400 body-text">
            <p>&copy; 2025 Synthex. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}