import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowRight,
  Zap,
  Globe,
  Shield,
  CheckCircle2,
} from '@/components/icons';
import {
  PinterestIcon,
  ThreadsIcon,
  RedditIcon,
} from '@/components/icons/platform-icons';
import { Icon3D } from '@/components/icons/Icon3D';
import MarketingLayout from '@/components/marketing/MarketingLayout';

export const metadata: Metadata = {
  title: 'Integrations | Synthex',
  description:
    'Connect Synthex with 9 social media platforms, AI providers, and business tools. Publish, schedule, and analyse content everywhere from one dashboard.',
  openGraph: {
    title: 'Integrations | Synthex',
    description:
      'Connect Synthex with 9 social media platforms, AI providers, and business tools.',
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Platform data
// ────────────────────────────────────────────────────────────────────────────

interface PlatformEntry {
  name: string;
  icon: ReactNode;
  description: string;
  color: string;
}

const PLATFORMS: PlatformEntry[] = [
  {
    name: 'YouTube',
    icon: <Icon3D name="youtube" category="platforms" size={32} />,
    description:
      'Publish videos, Shorts, and community posts directly from Synthex.',
    color: 'text-red-400',
  },
  {
    name: 'Instagram',
    icon: <Icon3D name="instagram" category="platforms" size={32} />,
    description:
      'Schedule feed posts, Stories, and Reels with AI-optimised captions.',
    color: 'text-orange-400',
  },
  {
    name: 'TikTok',
    icon: <Icon3D name="tiktok" category="platforms" size={32} />,
    description:
      'Create and publish TikTok content with trending audio suggestions.',
    color: 'text-orange-300',
  },
  {
    name: 'X (Twitter)',
    icon: <Icon3D name="twitter" category="platforms" size={32} />,
    description:
      'Thread generation, optimal posting times, and engagement tracking.',
    color: 'text-white',
  },
  {
    name: 'Facebook',
    icon: <Icon3D name="facebook" category="platforms" size={32} />,
    description:
      'Page posts, group sharing, and audience insights in one place.',
    color: 'text-blue-400',
  },
  {
    name: 'LinkedIn',
    icon: <Icon3D name="linkedin" category="platforms" size={32} />,
    description: 'Professional content, article publishing, and B2B analytics.',
    color: 'text-sky-400',
  },
  {
    name: 'Pinterest',
    icon: <PinterestIcon size={32} />,
    description:
      'Pin scheduling, board management, and visual content creation.',
    color: 'text-red-300',
  },
  {
    name: 'Threads',
    icon: <ThreadsIcon size={32} />,
    description: 'Cross-post from Instagram with Threads-native formatting.',
    color: 'text-white',
  },
  {
    name: 'Reddit',
    icon: <RedditIcon size={32} />,
    description:
      'Community engagement, subreddit targeting, and discussion tracking.',
    color: 'text-orange-400',
  },
];

const AI_PROVIDERS = [
  {
    name: 'OpenRouter',
    description:
      'Access 200+ AI models for content generation, analysis, and optimisation.',
  },
  {
    name: 'Anthropic Claude',
    description:
      'Advanced reasoning and long-form content with Claude Sonnet and Opus.',
  },
  {
    name: 'Google AI',
    description: 'Gemini models for multilingual content and visual analysis.',
  },
  {
    name: 'OpenAI',
    description:
      'GPT-4o for fast drafting, summarisation, and creative writing.',
  },
];

const TOOLS = [
  {
    name: 'Stripe',
    description: 'Subscription billing, usage metering, and customer portal.',
  },
  {
    name: 'Supabase',
    description: 'PostgreSQL database, real-time subscriptions, and auth.',
  },
  {
    name: 'SendGrid & Resend',
    description:
      'Transactional emails, digest notifications, and onboarding sequences.',
  },
  {
    name: 'Upstash Redis',
    description: 'Serverless caching, rate limiting, and session management.',
  },
  {
    name: 'Sentry',
    description: 'Error tracking and performance monitoring across all routes.',
  },
  {
    name: 'PostHog',
    description:
      'Product analytics, feature flags, and user behaviour insights.',
  },
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
            Connect{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-300">
              Everything
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
            Synthex integrates with 9 social platforms, 4 AI providers, and the
            tools your business already uses — all from one dashboard.
          </p>
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white text-lg px-8 py-6 rounded-xl shadow-lg shadow-orange-500/25">
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm mb-4">
              <Globe className="h-4 w-4" /> 9 Platforms
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              Social Media Platforms
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Publish, schedule, and track performance across every major social
              network — no switching tabs.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {PLATFORMS.map(p => (
              <Link key={p.name} href="/dashboard/integrations">
                <Card className="bg-[#0d1f35]/60 border-orange-500/10 hover:border-orange-500/30 transition-all p-6 flex items-start gap-4 h-full">
                  <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    {p.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">{p.name}</h3>
                    <p className="text-sm text-gray-400 mb-2">
                      {p.description}
                    </p>
                    <span className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
                      Connect →
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* AI Providers */}
      <section className="pb-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm mb-4">
              <Zap className="h-4 w-4" /> AI Models
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">AI Providers</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Bring your own API keys (BYOK) and choose the model that fits your
              budget and quality needs.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {AI_PROVIDERS.map(a => (
              <Card
                key={a.name}
                className="bg-[#0d1f35]/60 border-orange-500/10 hover:border-orange-500/30 transition-all p-6"
              >
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-orange-400" />
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
            <h2 className="text-3xl font-bold text-white mb-3">
              Business Tools
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Enterprise-grade infrastructure baked into every plan.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {TOOLS.map(t => (
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
          <div className="p-10 rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-500/10 border border-orange-500/20 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              Ready to connect everything?
            </h2>
            <p className="text-gray-400 mb-8">
              Set up your integrations in minutes and start publishing
              AI-powered content across all your channels.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white px-8 py-3 rounded-xl shadow-lg shadow-orange-500/25">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/features">
                <Button
                  variant="outline"
                  className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 px-8 py-3 rounded-xl"
                >
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
