'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Play, ArrowRight } from 'lucide-react';

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-card border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold gradient-text">Synthex</span>
            </Link>
            <div className="flex items-center space-x-6">
              <Link href="/features" className="text-gray-300 hover:text-white transition">
                Features
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-white transition">
                Pricing
              </Link>
              <Link href="/docs" className="text-gray-300 hover:text-white transition">
                Docs
              </Link>
              <Link href="/signup">
                <Button className="gradient-primary text-white">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Demo Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-6">
              See Synthex in Action
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Watch how Synthex transforms your social media strategy with AI-powered automation
            </p>
          </div>

          {/* Video Placeholder */}
          <div className="max-w-4xl mx-auto">
            <Card className="glass-card p-2">
              <div className="relative aspect-video bg-black/50 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                    <Play className="w-10 h-10 text-white ml-1" />
                  </div>
                  <p className="text-white text-lg mb-2">Product Demo Video</p>
                  <p className="text-gray-400">5 minute walkthrough</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Key Points */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
            <Card className="glass-card p-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">Setup in Minutes</h3>
              <p className="text-gray-400 text-sm">
                Connect your accounts and start generating content immediately
              </p>
            </Card>
            <Card className="glass-card p-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">AI Learning</h3>
              <p className="text-gray-400 text-sm">
                Watch how our AI learns your unique voice and style
              </p>
            </Card>
            <Card className="glass-card p-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">Real Results</h3>
              <p className="text-gray-400 text-sm">
                See actual engagement metrics from our users
              </p>
            </Card>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <Link href="/signup">
              <Button size="lg" className="gradient-primary text-white px-10 py-6 text-lg">
                Start Your Free Trial
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
            <p className="text-gray-400 mt-4">No credit card required</p>
          </div>
        </div>
      </section>
    </div>
  );
}