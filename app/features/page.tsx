import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Sparkles, TrendingUp, Users, Calendar, BarChart3, Zap,
  Brain, Target, Palette, Shield, Globe, Smartphone,
  ArrowRight, CheckCircle2
} from '@/components/icons';

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/[0.02] backdrop-blur-xl border-b border-white/[0.08]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold gradient-text">Synthex</span>
            </Link>
            <div className="flex items-center space-x-6">
              <Link href="/features" className="text-white">
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
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            Powerful Features for <span className="gradient-text">Social Media Success</span>
          </h1>
          <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
            Everything you need to create viral content, grow your audience, and automate your social media presence.
          </p>
        </div>
      </section>

      {/* Core Features */}
      <section className="pb-20 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">Core Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card variant="glass" className="p-6">
              <Brain className="w-12 h-12 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">AI Persona Learning</h3>
              <p className="text-gray-400 mb-4">
                Upload 20-30 of your best posts and watch as our AI learns your unique voice, tone, and style.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Voice & tone matching
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Style replication
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Brand consistency
                </li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6">
              <TrendingUp className="w-12 h-12 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Viral Pattern Analysis</h3>
              <p className="text-gray-400 mb-4">
                Real-time analysis of trending content to identify what makes posts go viral.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Hashtag optimization
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Engagement triggers
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Timing insights
                </li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6">
              <Zap className="w-12 h-12 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Smart Content Generation</h3>
              <p className="text-gray-400 mb-4">
                Generate 10-15 variations of viral-optimized content in seconds.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Multiple variations
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Platform-specific
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Hook optimization
                </li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6">
              <Calendar className="w-12 h-12 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Intelligent Scheduling</h3>
              <p className="text-gray-400 mb-4">
                Post at the perfect time for maximum engagement on each platform.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Optimal timing AI
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Bulk scheduling
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Calendar view
                </li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6">
              <BarChart3 className="w-12 h-12 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Advanced Analytics</h3>
              <p className="text-gray-400 mb-4">
                Track performance and ROI across all your social media channels.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Real-time metrics
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Growth tracking
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  ROI analysis
                </li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6">
              <Globe className="w-12 h-12 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Multi-Platform Support</h3>
              <p className="text-gray-400 mb-4">
                Manage all your social media accounts from one powerful dashboard.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  8+ platforms
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Cross-posting
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  Unified inbox
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Platform Specific */}
      <section className="py-20 px-6 bg-white/[0.02] backdrop-blur-xl border-y border-white/[0.08]">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">Platform-Specific Optimization</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { name: 'Twitter/X', features: '280 chars, threads, hashtags' },
              { name: 'LinkedIn', features: 'Professional tone, articles' },
              { name: 'Instagram', features: 'Captions, hashtags, stories' },
              { name: 'TikTok', features: 'Trends, sounds, hooks' },
              { name: 'Facebook', features: 'Long-form, groups, pages' },
              { name: 'YouTube', features: 'Titles, descriptions, tags' },
              { name: 'Pinterest', features: 'SEO, boards, rich pins' },
              { name: 'Threads', features: 'Text posts, conversations' },
            ].map((platform) => (
              <div key={platform.name} className="text-center">
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-lg p-4 mb-2">
                  <Smartphone className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                  <h4 className="text-white font-semibold">{platform.name}</h4>
                </div>
                <p className="text-xs text-gray-400">{platform.features}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">Advanced Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card variant="glass" className="p-6">
              <Target className="w-10 h-10 text-purple-500 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">A/B Testing</h3>
              <p className="text-gray-400 text-sm">
                Test different content variations to find what resonates best with your audience.
              </p>
            </Card>
            <Card variant="glass" className="p-6">
              <Palette className="w-10 h-10 text-purple-500 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Brand Kit</h3>
              <p className="text-gray-400 text-sm">
                Maintain consistent branding with saved colors, fonts, and templates.
              </p>
            </Card>
            <Card variant="glass" className="p-6">
              <Shield className="w-10 h-10 text-purple-500 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Content Moderation</h3>
              <p className="text-gray-400 text-sm">
                AI-powered content review to ensure brand safety and compliance.
              </p>
            </Card>
            <Card variant="glass" className="p-6">
              <Users className="w-10 h-10 text-purple-500 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Team Collaboration</h3>
              <p className="text-gray-400 text-sm">
                Work together with approval workflows and role-based permissions.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card variant="glass-primary" className="p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Experience the Power of AI-Driven Social Media
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Start your free trial and see results in days, not months.
            </p>
            <Link href="/signup">
              <Button size="lg" className="gradient-primary text-white px-10 py-6 text-lg">
                Start Free Trial
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}