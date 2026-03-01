import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowRight, Zap, Globe, Shield, CheckCircle2,
} from '@/components/icons';
import {
  TwitterXIcon, LinkedInIcon, InstagramIcon, TikTokIcon,
  FacebookIcon, YouTubeIcon, PinterestIcon, ThreadsIcon, RedditIcon,
} from '@/components/icons/platform-icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';

export const metadata: Metadata = {
  title: 'Integrations | Synthex',
  description:
    'Connect Synthex with 9 social media platforms, AI providers, and business tools. Publish, schedule, and analyse content everywhere from one dashboard.',
  openGraph: {
    title: 'Integrations | Synthex',
    description: 'Connect Synthex with 9 social media platforms, AI providers, and business tools.',
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Platform data
// ────────────────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { name: 'YouTube', icon: YouTubeIcon, description: 'Publish videos, Shorts, and community posts directly from Synthex.', color: 'text-red-400' },
  { name: 'Instagram', icon: InstagramIcon, description: 'Schedule feed posts, Stories, and Reels with AI-optimised captions.', color: 'text-pink-400' },
  { name: 'TikTok', icon: TikTokIcon, description: 'Create and publish TikTok content with trending audio suggestions.', color: 'text-cyan-300' },
  { name: 'X (Twitter)', icon: TwitterXIcon, description: 'Thread generation, optimal posting times, and engagement tracking.', color: 'text-white' },
  { name: 'Facebook', icon: FacebookIcon, description: 'Page posts, group sharing, and audience insights in one place.', color: 'text-blue-400' },
  { name: 'LinkedIn', icon: LinkedInIcon, description: 'Professional content, article publishing, and B2B analytics.', color: 'text-sky-400' },
  { name: 'Pinterest', icon: PinterestIcon, description: 'Pin scheduling, board management, and visual content creation.', color: 'text-red-300' },
  { name: 'Threads', icon: ThreadsIcon, description: 'Cross-post from Instagram with Threads-native formatting.', color: 'text-white' },
  { name: 'Reddit', icon: RedditIcon, description: 'Community engagement, subreddit targeting, and discussion tracking.', color: 'text-orange-400' },
];

const AI_PROVIDERS = [
  { name: 'OpenRouter', description: 'Access 200+ AI models for content generation, analysis, and optimisation.' },
  { name: 'Anthropic Claude', description: 'Advanced reasoning and long-form content with Claude Sonnet and Opus.' },
  { name: 'Google AI', description: 'Gemini models for multilingual content and visual analysis.' },
  { name: 'OpenAI', description: 'GPT-4o for fast drafting, summarisation, and creative writing.' },
];

const TOOLS = [
  { name: 'Stripe', description: 'Subscription billing, usage metering, and customer portal.' },
  { name: 'Supabase', description: 'PostgreSQL database, real-time subscriptions, and auth.' },
  { name: 'SendGrid & Resend', description: 'Transactional emails, digest notifications, and onboarding sequences.' },
  { name: 'Upstash Redis', description: 'Serverless caching, rate limiting, and session management.' },
  { name: 'Sentry', description: 'Error tracking and performance monitoring across all routes.' },
  { name: 'PostHog', description: 'Product analytics, feature flags, and user behaviour insights.' },
];

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  return (
    <MarketingLayout currentPage="integrations">
      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            Connect <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">Everything</span>
          </h1>
          <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
            Synthex integrates with 9 social platforms, 4 AI providers, and the
            tools your business already uses — all from one dashboard.
          </p>
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white text-lg px-8 py-6 rounded-xl shadow-lg shadow-cyan-500/25">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Social Platforms */}
      <section className="pb-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mb-4">
              <Globe className="h-4 w-4" /> 9 Platforms
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Social Media Platforms</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Publish, schedule, and track performance across every major social
              network — no switching tabs.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {PLATFORMS.map((p) => (
              <Card
                key={p.name}
                className="bg-[#0d1f35]/60 border-cyan-500/10 hover:border-cyan-500/30 transition-all p-6 flex items-start gap-4"
              >
                <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <p.icon className={`h-5 w-5 ${p.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{p.name}</h3>
                  <p className="text-sm text-gray-400">{p.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Providers */}
      <section className="pb-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm mb-4">
              <Zap className="h-4 w-4" /> AI Models
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">AI Providers</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Bring your own API keys (BYOK) and choose the model that fits
              your budget and quality needs.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {AI_PROVIDERS.map((a) => (
              <Card
                key={a.name}
                className="bg-[#0d1f35]/60 border-purple-500/10 hover:border-purple-500/30 transition-all p-6"
              >
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-400" />
                  {a.name}
                </h3>
                <p className="text-sm text-gray-400">{a.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Business Tools */}
      <section className="pb-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-4">
              <Shield className="h-4 w-4" /> Infrastructure
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Business Tools</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Enterprise-grade infrastructure baked into every plan.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {TOOLS.map((t) => (
              <Card
                key={t.name}
                className="bg-[#0d1f35]/60 border-emerald-500/10 hover:border-emerald-500/30 transition-all p-6"
              >
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {t.name}
                </h3>
                <p className="text-sm text-gray-400">{t.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 px-6">
        <div className="container mx-auto text-center">
          <div className="p-10 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              Ready to connect everything?
            </h2>
            <p className="text-gray-400 mb-8">
              Set up your integrations in minutes and start publishing AI-powered
              content across all your channels.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-8 py-3 rounded-xl shadow-lg shadow-cyan-500/25">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/features">
                <Button variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 px-8 py-3 rounded-xl">
                  View All Features
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
