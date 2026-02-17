import type { Metadata } from 'next';
import Link from 'next/link';
import { PAGE_METADATA } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = PAGE_METADATA.features;
import {
  Sparkles, TrendingUp, Users, Calendar, BarChart3, Zap,
  Brain, Target, Palette, Shield, Globe,
  ArrowRight, CheckCircle2
} from '@/components/icons';
import {
  TwitterXIcon, LinkedInIcon, InstagramIcon, TikTokIcon,
  FacebookIcon, YouTubeIcon, PinterestIcon, ThreadsIcon, RedditIcon
} from '@/components/icons/platform-icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';

export default function FeaturesPage() {
  return (
    <MarketingLayout currentPage="features">
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            Powerful Features for <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">Social Media Success</span>
          </h1>
          <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
            Everything you need to create viral content, grow your audience, and automate your social media presence.
          </p>
        </div>
      </section>

      {/* Video Demos Section */}
      <section className="pb-20 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">See Features In Action</h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Watch quick demos of each feature to see how Synthex can transform your social media workflow.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {[
              { title: 'Content Generator', description: 'AI-powered post creation', videoId: 'HbBBX0zYug4' },
              { title: 'Analytics Dashboard', description: 'Real-time metrics', videoId: 'zS2cnmYxpf8' },
              { title: 'Smart Scheduler', description: 'Optimal posting times', videoId: 'r6ybAyj50qs' },
              { title: 'Viral Pattern Analytics', description: 'Discover what works', videoId: 'vCf79xJPbdI' },
            ].map((video, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-cyan-500/10 bg-[#0d1f35]/60 hover:border-cyan-500/30 transition-all">
                <div className="aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${video.videoId}`}
                    title={video.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-white mb-1">{video.title}</h4>
                  <p className="text-gray-500 text-sm">{video.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="pb-20 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">Core Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-6 bg-[#0d1f35]/80 border-cyan-500/10 backdrop-blur-xl">
              <Brain className="w-12 h-12 text-cyan-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">AI Persona Learning</h3>
              <p className="text-gray-400 mb-4">
                Upload 20-30 of your best posts and watch as our AI learns your unique voice, tone, and style.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Voice & tone matching
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Style replication
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Brand consistency
                </li>
              </ul>
            </Card>

            <Card className="p-6 bg-[#0d1f35]/80 border-cyan-500/10 backdrop-blur-xl">
              <TrendingUp className="w-12 h-12 text-cyan-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Viral Pattern Analysis</h3>
              <p className="text-gray-400 mb-4">
                Real-time analysis of trending content to identify what makes posts go viral.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Hashtag optimization
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Engagement triggers
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Timing insights
                </li>
              </ul>
            </Card>

            <Card className="p-6 bg-[#0d1f35]/80 border-cyan-500/10 backdrop-blur-xl">
              <Zap className="w-12 h-12 text-cyan-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Smart Content Generation</h3>
              <p className="text-gray-400 mb-4">
                Generate 10-15 variations of viral-optimized content in seconds.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Multiple variations
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Platform-specific
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Hook optimization
                </li>
              </ul>
            </Card>

            <Card className="p-6 bg-[#0d1f35]/80 border-cyan-500/10 backdrop-blur-xl">
              <Calendar className="w-12 h-12 text-cyan-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Intelligent Scheduling</h3>
              <p className="text-gray-400 mb-4">
                Post at the perfect time for maximum engagement on each platform.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Optimal timing AI
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Bulk scheduling
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Calendar view
                </li>
              </ul>
            </Card>

            <Card className="p-6 bg-[#0d1f35]/80 border-cyan-500/10 backdrop-blur-xl">
              <BarChart3 className="w-12 h-12 text-cyan-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Advanced Analytics</h3>
              <p className="text-gray-400 mb-4">
                Track performance and ROI across all your social media channels.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Real-time metrics
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Growth tracking
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  ROI analysis
                </li>
              </ul>
            </Card>

            <Card className="p-6 bg-[#0d1f35]/80 border-cyan-500/10 backdrop-blur-xl">
              <Globe className="w-12 h-12 text-cyan-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Multi-Platform Support</h3>
              <p className="text-gray-400 mb-4">
                Manage all your social media accounts from one powerful dashboard.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  9+ platforms
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
                  Cross-posting
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2" />
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
          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
            {[
              { name: 'Twitter/X', features: '280 chars, threads, hashtags', Icon: TwitterXIcon, color: '#1DA1F2' },
              { name: 'LinkedIn', features: 'Professional tone, articles', Icon: LinkedInIcon, color: '#0A66C2' },
              { name: 'Instagram', features: 'Captions, hashtags, stories', Icon: InstagramIcon, color: '#E4405F' },
              { name: 'TikTok', features: 'Trends, sounds, hooks', Icon: TikTokIcon, color: '#FF0050' },
              { name: 'Facebook', features: 'Long-form, groups, pages', Icon: FacebookIcon, color: '#1877F2' },
              { name: 'YouTube', features: 'Titles, descriptions, tags', Icon: YouTubeIcon, color: '#FF0000' },
              { name: 'Pinterest', features: 'SEO, boards, rich pins', Icon: PinterestIcon, color: '#E60023' },
              { name: 'Reddit', features: 'Subreddits, discussions', Icon: RedditIcon, color: '#FF4500' },
              { name: 'Threads', features: 'Text posts, conversations', Icon: ThreadsIcon, color: '#FFFFFF' },
            ].map((platform) => (
              <div key={platform.name} className="text-center group">
                <div className="bg-[#0d1f35]/80 backdrop-blur-xl border border-cyan-500/10 rounded-lg p-4 mb-2 hover:border-cyan-500/30 transition-all hover:scale-105">
                  <platform.Icon size={32} color={platform.color} className="mx-auto mb-2" />
                  <h4 className="text-white font-semibold text-sm">{platform.name}</h4>
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
            <Card className="p-6 bg-[#0d1f35]/80 border-cyan-500/10 backdrop-blur-xl">
              <Target className="w-10 h-10 text-cyan-500 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">A/B Testing</h3>
              <p className="text-gray-400 text-sm">
                Test different content variations to find what resonates best with your audience.
              </p>
            </Card>
            <Card className="p-6 bg-[#0d1f35]/80 border-cyan-500/10 backdrop-blur-xl">
              <Palette className="w-10 h-10 text-cyan-500 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Brand Kit</h3>
              <p className="text-gray-400 text-sm">
                Maintain consistent branding with saved colors, fonts, and templates.
              </p>
            </Card>
            <Card className="p-6 bg-[#0d1f35]/80 border-cyan-500/10 backdrop-blur-xl">
              <Shield className="w-10 h-10 text-cyan-500 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Content Moderation</h3>
              <p className="text-gray-400 text-sm">
                AI-powered content review to ensure brand safety and compliance.
              </p>
            </Card>
            <Card className="p-6 bg-[#0d1f35]/80 border-cyan-500/10 backdrop-blur-xl">
              <Users className="w-10 h-10 text-cyan-500 mb-3" />
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
          <Card className="p-12 text-center bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 border-cyan-500/20 backdrop-blur-xl">
            <h2 className="text-3xl font-bold text-white mb-4">
              Experience the Power of AI-Driven Social Media
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Start your free trial and see results in days, not months.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-10 py-6 text-lg hover:from-cyan-600 hover:to-cyan-700">
                Start Free Trial
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
