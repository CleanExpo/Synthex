import type { Metadata } from 'next';
import Link from 'next/link';
import { PAGE_METADATA } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = PAGE_METADATA.features;
import {
  TrendingUp,
  Users,
  Calendar,
  Globe,
  Share2,
  Clock,
  ArrowRight,
  CheckCircle2,
} from '@/components/icons';
import { Icon3D } from '@/components/icons/Icon3D';
import {
  TwitterXIcon,
  LinkedInIcon,
  InstagramIcon,
  TikTokIcon,
  FacebookIcon,
  YouTubeIcon,
  PinterestIcon,
  ThreadsIcon,
  RedditIcon,
} from '@/components/icons/platform-icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import GlowCard from '@/components/landing/glow-card';
import {
  ContainerStagger,
  ContainerAnimated,
} from '@/components/landing/hero-video';
import { VideoSchemaScript } from '@/components/schema/VideoSchemaScript';

// Feature video metadata — used for both the embed section and JSON-LD schema
const FEATURE_VIDEOS = [
  {
    videoId: 'HbBBX0zYug4',
    title: 'Content Generator',
    description: 'AI-powered post creation in your voice',
    uploadDate: '2026-02-17',
    duration: 'PT3M',
  },
  {
    videoId: 'zS2cnmYxpf8',
    title: 'Analytics Dashboard',
    description: 'Real-time metrics across all platforms',
    uploadDate: '2026-02-17',
    duration: 'PT2M',
  },
  {
    videoId: 'r6ybAyj50qs',
    title: 'Smart Scheduler',
    description: 'Optimal posting times per platform',
    uploadDate: '2026-02-17',
    duration: 'PT2M',
  },
  {
    videoId: 'vCf79xJPbdI',
    title: 'Viral Pattern Analytics',
    description: 'Discover what drives engagement',
    uploadDate: '2026-02-17',
    duration: 'PT2M',
  },
];

export default function FeaturesPage() {
  return (
    <MarketingLayout currentPage="features">
      {/* VideoObject JSON-LD — server-side schema for all 4 feature demos */}
      {FEATURE_VIDEOS.map(v => (
        <VideoSchemaScript key={v.videoId} {...v} />
      ))}

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest mb-4">
            Platform Features
          </p>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Every Feature You Need to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-400">
              Grow Faster
            </span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto">
            Synthex gives you the AI tools, analytics, and automation to build a
            powerful social media presence — without burning out.
          </p>
        </div>
      </section>

      {/* Video Demos Section */}
      <section className="pb-20 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest text-center mb-3">
            See It in Action
          </p>
          <h2 className="text-3xl font-bold text-center text-white mb-4">
            Watch the Features Work
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Quick demos of each core feature — see how Synthex transforms your
            social media workflow in minutes, not months.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURE_VIDEOS.map((video, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-orange-500/30 transition-colors"
              >
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
                  <h4 className="font-semibold text-white mb-1">
                    {video.title}
                  </h4>
                  <p className="text-gray-400 text-sm">{video.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest text-center mb-3">
            Core Features
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-4">
            Built for Serious Content Creators
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Six powerful capabilities that work together to take your content
            from idea to impact.
          </p>
          <ContainerStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* 1. AI Persona Learning */}
            <ContainerAnimated animation="bottom">
              <GlowCard className="p-6 h-full">
                <div className="bg-orange-500/10 rounded-lg p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Icon3D name="brain" category="features" size={32} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  AI That Sounds Like You
                </h3>
                <p className="text-gray-400 mb-4">
                  Upload 20–30 of your best posts. Our AI analyses your unique
                  voice, tone, and style — then writes content that&apos;s
                  indistinguishable from your best work.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Learns from real examples — not templates
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Analyses sentence structure, vocabulary, emoji usage, and
                    formatting
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Improves accuracy with every post you approve or edit
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Supports multiple personas (one per brand or client)
                  </li>
                </ul>
              </GlowCard>
            </ContainerAnimated>

            {/* 2. Viral Pattern Analysis */}
            <ContainerAnimated animation="bottom">
              <GlowCard className="p-6 h-full">
                <div className="bg-orange-500/10 rounded-lg p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  Know What Works Before You Post
                </h3>
                <p className="text-gray-400 mb-4">
                  Real-time analysis of trending topics, hashtags, and content
                  formats across all platforms — so you&apos;re always ahead of
                  the curve.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Tracks trending hashtags and topics per platform in
                    real-time
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Identifies which content formats are driving the highest
                    engagement right now
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Optimal posting time recommendations based on your
                    audience&apos;s behaviour
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Competitor content tracking — see what&apos;s performing in
                    your space
                  </li>
                </ul>
              </GlowCard>
            </ContainerAnimated>

            {/* 3. Smart Content Generation */}
            <ContainerAnimated animation="bottom">
              <GlowCard className="p-6 h-full">
                <div className="bg-orange-500/10 rounded-lg p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Icon3D name="sparkles" category="features" size={32} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  10–15 On-Brand Variations in Seconds
                </h3>
                <p className="text-gray-400 mb-4">
                  Describe what you want to say, and Synthex generates multiple
                  polished, platform-optimised variations — all in your voice.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Platform-specific formatting (TikTok captions vs LinkedIn
                    articles vs Twitter threads)
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Hook optimisation — AI tests multiple opening lines for
                    maximum stop-scroll impact
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Hashtag suggestions drawn from your viral pattern data
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Image prompt generation for visual content
                  </li>
                </ul>
              </GlowCard>
            </ContainerAnimated>

            {/* 4. Intelligent Scheduling */}
            <ContainerAnimated animation="bottom">
              <GlowCard className="p-6 h-full">
                <div className="bg-orange-500/10 rounded-lg p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  Post at the Perfect Moment
                </h3>
                <p className="text-gray-400 mb-4">
                  AI-optimised scheduling based on when your specific audience
                  is most active. Bulk schedule weeks of content in minutes.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Audience activity analysis per platform
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Drag-and-drop content calendar
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Bulk import and schedule via CSV or paste
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Auto-requeue evergreen content + cross-platform simultaneous
                    publishing
                  </li>
                </ul>
              </GlowCard>
            </ContainerAnimated>

            {/* 5. Advanced Analytics */}
            <ContainerAnimated animation="bottom">
              <GlowCard className="p-6 h-full">
                <div className="bg-orange-500/10 rounded-lg p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Icon3D name="bar-chart" category="features" size={32} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  See What&apos;s Actually Working
                </h3>
                <p className="text-gray-400 mb-4">
                  Real-time performance metrics across all platforms in one
                  dashboard. Track reach, engagement, follower growth, and
                  content ROI.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Unified analytics across all 9 platforms
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Post-level performance breakdown
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Follower growth tracking and attribution
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Content ROI calculator + exportable PDF reports (white-label
                    on Agency plan)
                  </li>
                </ul>
              </GlowCard>
            </ContainerAnimated>

            {/* 6. Multi-Platform Publishing */}
            <ContainerAnimated animation="bottom">
              <GlowCard className="p-6 h-full">
                <div className="bg-orange-500/10 rounded-lg p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  One Dashboard, 9 Platforms
                </h3>
                <p className="text-gray-400 mb-4">
                  Manage Instagram, TikTok, Twitter/X, LinkedIn, Facebook,
                  YouTube, Pinterest, Reddit, and Threads — all without
                  switching tabs.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Platform-native formatting (images, video specs, character
                    limits auto-applied)
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Unified content inbox — all comments and DMs in one place
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Team collaboration with role-based permissions
                  </li>
                  <li className="flex items-start text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 mt-0.5 shrink-0" />
                    Client workspace isolation (Agency plan)
                  </li>
                </ul>
              </GlowCard>
            </ContainerAnimated>
          </ContainerStagger>
        </div>
      </section>

      {/* Platform Grid */}
      <section className="py-20 md:py-28 px-6 bg-white/[0.02] backdrop-blur-xl border-y border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest text-center mb-3">
            Supported Platforms
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-4">
            9 Platforms. One Workflow.
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Synthex handles the platform-specific nuances so you don&apos;t have
            to. Every post is optimised for the platform it lands on.
          </p>
          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: 'Instagram',
                description: 'Photo posts, Reels, Stories, carousels',
                Icon: InstagramIcon,
                color: '#E4405F',
              },
              {
                name: 'TikTok',
                description:
                  'Video scripts, trending sounds, caption optimisation',
                Icon: TikTokIcon,
                color: '#FF0050',
              },
              {
                name: 'Twitter / X',
                description: 'Threads, single tweets, engagement timing',
                Icon: TwitterXIcon,
                color: '#1DA1F2',
              },
              {
                name: 'LinkedIn',
                description:
                  'Professional articles, thought leadership, B2B reach',
                Icon: LinkedInIcon,
                color: '#0A66C2',
              },
              {
                name: 'Facebook',
                description: 'Posts, groups, event promotion',
                Icon: FacebookIcon,
                color: '#1877F2',
              },
              {
                name: 'YouTube',
                description:
                  'Video descriptions, titles, chapters, community posts',
                Icon: YouTubeIcon,
                color: '#FF0000',
              },
              {
                name: 'Pinterest',
                description:
                  'Pin descriptions, board strategy, seasonal content',
                Icon: PinterestIcon,
                color: '#E60023',
              },
              {
                name: 'Reddit',
                description: 'Community-native posts, discussion starters',
                Icon: RedditIcon,
                color: '#FF4500',
              },
              {
                name: 'Threads',
                description:
                  'Short-form conversational content, Meta integration',
                Icon: ThreadsIcon,
                color: '#FFFFFF',
              },
            ].map(platform => (
              <div key={platform.name} className="text-center group">
                <GlowCard className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3 hover:border-orange-500/30 transition-colors hover:scale-105 duration-200">
                  <platform.Icon
                    size={32}
                    color={platform.color}
                    className="mx-auto mb-2"
                  />
                  <h4 className="text-white font-semibold text-sm">
                    {platform.name}
                  </h4>
                </GlowCard>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {platform.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advanced Capabilities */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest text-center mb-3">
            Advanced Capabilities
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-4">
            Power Tools for Teams and Agencies
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Go beyond posting. A/B test your content, enforce brand consistency,
            and collaborate with your team — all in one place.
          </p>
          <ContainerStagger className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <ContainerAnimated animation="bottom">
              <GlowCard className="p-6 h-full">
                <div className="bg-orange-500/10 rounded-lg p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  A/B Testing
                </h3>
                <p className="text-gray-400 text-sm">
                  Test different content variations to find what resonates best
                  with your audience. Let the data pick your winners.
                </p>
              </GlowCard>
            </ContainerAnimated>
            <ContainerAnimated animation="bottom">
              <GlowCard className="p-6 h-full">
                <div className="bg-orange-500/10 rounded-lg p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Icon3D name="sparkles" category="features" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Brand Kit
                </h3>
                <p className="text-gray-400 text-sm">
                  Maintain consistent branding with saved colours, fonts, and
                  templates. Every piece of content stays on-brand
                  automatically.
                </p>
              </GlowCard>
            </ContainerAnimated>
            <ContainerAnimated animation="bottom">
              <GlowCard className="p-6 h-full">
                <div className="bg-orange-500/10 rounded-lg p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Content Moderation
                </h3>
                <p className="text-gray-400 text-sm">
                  AI-powered content review to ensure brand safety and
                  compliance before anything goes live.
                </p>
              </GlowCard>
            </ContainerAnimated>
            <ContainerAnimated animation="bottom">
              <GlowCard className="p-6 h-full">
                <div className="bg-orange-500/10 rounded-lg p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Team Collaboration
                </h3>
                <p className="text-gray-400 text-sm">
                  Work together with approval workflows and role-based
                  permissions. Keep clients separate with isolated workspaces.
                </p>
              </GlowCard>
            </ContainerAnimated>
          </ContainerStagger>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-12 text-center bg-gradient-to-r from-orange-500/10 to-orange-600/10 border-orange-500/20 backdrop-blur-xl">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Experience the Power of AI-Driven Social Media
            </h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Start your free trial and see results in days, not months. No
              credit card required.
            </p>
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-10 py-6 text-lg hover:from-orange-600 hover:to-orange-700"
              >
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
