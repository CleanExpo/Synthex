import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Sparkles, TrendingUp, Users, Calendar, BarChart3, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-card border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold gradient-text">Synthex</span>
            </div>
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
              <Link href="/login">
                <Button variant="ghost" className="text-gray-300 hover:text-white">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="gradient-primary text-white">
                  Get Started <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-6xl font-bold text-white mb-6 animate-slide-up">
            AI-Powered Social Media
            <br />
            <span className="gradient-text">Automation Platform</span>
          </h1>
          <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto animate-fade-in">
            Analyze viral patterns, generate personalized content, and schedule posts across all platforms. 
            Let AI handle your social media while you focus on growing your business.
          </p>
          <div className="flex justify-center space-x-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link href="/signup">
              <Button size="lg" className="gradient-primary text-white px-8 py-6 text-lg">
                Start Free Trial
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="bg-white/10 border-white/20 text-white px-8 py-6 text-lg hover:bg-white/20">
                Watch Demo
              </Button>
            </Link>
          </div>
          <div className="mt-10 flex justify-center space-x-8 text-gray-400">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>10,000+ Users</span>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>3x Engagement</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>AI-Powered</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12">
            Everything You Need to <span className="gradient-text">Dominate Social Media</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="glass-card p-6 hover:scale-105 transition-transform">
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Viral Pattern Analysis</h3>
              <p className="text-gray-400">
                AI analyzes top-performing content across platforms to identify engagement patterns and viral triggers.
              </p>
            </Card>

            <Card className="glass-card p-6 hover:scale-105 transition-transform">
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Persona Learning</h3>
              <p className="text-gray-400">
                Upload your content and let AI learn your unique voice, style, and brand personality.
              </p>
            </Card>

            <Card className="glass-card p-6 hover:scale-105 transition-transform">
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Content Generation</h3>
              <p className="text-gray-400">
                Generate 10-15 variations of viral-optimized content in your authentic voice.
              </p>
            </Card>

            <Card className="glass-card p-6 hover:scale-105 transition-transform">
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Smart Scheduling</h3>
              <p className="text-gray-400">
                Automatically schedule posts at optimal times for maximum engagement on each platform.
              </p>
            </Card>

            <Card className="glass-card p-6 hover:scale-105 transition-transform">
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Real-Time Analytics</h3>
              <p className="text-gray-400">
                Track performance, engagement metrics, and ROI across all your social media campaigns.
              </p>
            </Card>

            <Card className="glass-card p-6 hover:scale-105 transition-transform">
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Multi-Platform Support</h3>
              <p className="text-gray-400">
                Seamlessly manage Twitter/X, LinkedIn, Instagram, TikTok, Facebook, and more from one dashboard.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card className="glass-card p-12 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to 10x Your Social Media?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of creators and businesses automating their social media success
            </p>
            <Link href="/signup">
              <Button size="lg" className="gradient-primary text-white px-10 py-6 text-lg animate-pulse-glow">
                Start Your Free Trial
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
            <p className="text-gray-400 mt-4">No credit card required • 14-day free trial</p>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="glass-card border-t py-12 px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="w-6 h-6 text-purple-500" />
                <span className="text-xl font-bold gradient-text">Synthex</span>
              </div>
              <p className="text-gray-400">
                AI-powered social media automation for the modern creator.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/features" className="hover:text-white transition">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
                <li><Link href="/roadmap" className="hover:text-white transition">Roadmap</Link></li>
                <li><Link href="/changelog" className="hover:text-white transition">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/docs" className="hover:text-white transition">Documentation</Link></li>
                <li><Link href="/api" className="hover:text-white transition">API Reference</Link></li>
                <li><Link href="/blog" className="hover:text-white transition">Blog</Link></li>
                <li><Link href="/support" className="hover:text-white transition">Support</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white transition">About</Link></li>
                <li><Link href="/careers" className="hover:text-white transition">Careers</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Synthex. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}