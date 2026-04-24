import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';
import { NavBar } from '@/components/landing/nav-bar';
import { FooterSection } from '@/components/landing/footer-section';

export const revalidate = 3600;

export const metadata: Metadata = genMeta({
  title: '9 Social Media Platforms, 1 Dashboard | Synthex',
  description:
    'Manage Instagram, Facebook, TikTok, YouTube, LinkedIn, Pinterest, Reddit, Threads, and X from one AI-powered dashboard. Publish everywhere, manage nothing.',
  path: '/features/platforms',
  keywords: [
    'social media management 9 platforms',
    'multi-platform social media tool',
    'social media dashboard Australia',
    'publish to all social media at once',
    'Instagram Facebook TikTok management',
  ],
});

const PLATFORMS = [
  {
    name: 'Instagram',
    icon: '/icons/3d/platforms/instagram.svg',
    description:
      'Feed posts, Reels, and Stories. AI captions with hashtag optimisation for the Explore algorithm.',
    users: '2.3B users',
  },
  {
    name: 'Facebook',
    icon: '/icons/3d/platforms/facebook.svg',
    description:
      'Page posts and community content. Engagement-first copy designed for the Facebook feed.',
    users: '3.0B users',
  },
  {
    name: 'TikTok',
    icon: '/icons/3d/platforms/tiktok.svg',
    description:
      'Short-form hooks, trending sounds guidance, and captions tuned for the FYP algorithm.',
    users: '1.5B users',
  },
  {
    name: 'YouTube',
    icon: '/icons/3d/platforms/youtube.svg',
    description:
      'SEO-optimised descriptions, keyword-rich titles, and chapter timestamps for long-form content.',
    users: '2.7B users',
  },
  {
    name: 'X (Twitter)',
    icon: '/icons/3d/platforms/twitter.svg',
    description:
      'Punchy single posts and thread formats. Under 280 characters with maximum impact.',
    users: '550M users',
  },
  {
    name: 'LinkedIn',
    icon: '/icons/3d/platforms/linkedin.svg',
    description:
      'Professional posts with hook, insight, and CTA structure. B2B tone with personal authority.',
    users: '1.0B users',
  },
  {
    name: 'Pinterest',
    icon: '/icons/3d/platforms/pinterest.svg',
    description:
      'Search-optimised pin descriptions. Ideal for product-forward businesses and visual content.',
    users: '482M users',
  },
  {
    name: 'Reddit',
    icon: '/icons/3d/platforms/reddit.svg',
    description:
      'Community-aware posts that contribute value. Synthex adapts tone for subreddit culture.',
    users: '850M users',
  },
  {
    name: 'Threads',
    icon: '/icons/3d/platforms/threads.svg',
    description:
      "Conversational content for Meta's fast-growing platform. Short, punchy, shareable.",
    users: '175M users',
  },
];

export default function PlatformsPage() {
  return (
    <div className="min-h-screen bg-charcoal-900 text-white overflow-hidden">
      <NavBar />

      {/* Hero */}
      <section className="relative pt-40 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-orange-400">
              9 platforms · 1 dashboard
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white leading-[1.05] mb-6">
            Every platform.{' '}
            <em className="text-orange-500 not-italic">One place.</em>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto leading-relaxed mb-10">
            Stop switching between apps. Synthex connects all 9 major social
            platforms and publishes platform-native content to each — from a
            single AI-powered dashboard.
          </p>
          <div className="flex items-center gap-2 justify-center mb-10 flex-wrap">
            {PLATFORMS.map(({ name, icon }) => (
              <Image
                key={name}
                src={icon}
                alt={name}
                width={32}
                height={32}
                className="opacity-70 hover:opacity-100 transition-opacity"
                title={name}
              />
            ))}
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-orange-500 hover:bg-orange-400 text-charcoal-900 font-bold rounded-full transition-all text-sm"
          >
            Connect all 9 platforms free →
          </Link>
        </div>
      </section>

      {/* Platform grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-12">
            Platform-specific AI content
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLATFORMS.map(({ name, icon, description, users }) => (
              <div
                key={name}
                className="bg-charcoal-800/60 border border-white/[0.06] rounded-2xl p-6 hover:border-orange-500/20 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Image
                    src={icon}
                    alt={name}
                    width={28}
                    height={28}
                    className="opacity-80"
                  />
                  <div>
                    <p className="text-sm font-bold text-white">{name}</p>
                    <p className="text-[10px] text-white/30">{users}</p>
                  </div>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-y border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '9', label: 'Platforms supported' },
              { value: '< 3s', label: 'Content generation time' },
              { value: '1', label: 'Dashboard for everything' },
              { value: '∞', label: 'Scheduling capacity' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-4xl font-black text-orange-500 mb-1">
                  {value}
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-4">
            Publish to all 9 platforms today
          </h2>
          <p className="text-white/50 mb-8">
            No card required. Takes 60 seconds to set up.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-10 py-4 bg-orange-500 hover:bg-orange-400 text-charcoal-900 font-bold rounded-full transition-all text-base"
          >
            Start free →
          </Link>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-white/30">
            <Link
              href="/features/ai-content"
              className="hover:text-orange-400 transition-colors"
            >
              AI Content →
            </Link>
            <Link
              href="/agencies"
              className="hover:text-orange-400 transition-colors"
            >
              For agencies →
            </Link>
            <Link
              href="/compare/hootsuite"
              className="hover:text-orange-400 transition-colors"
            >
              vs Hootsuite →
            </Link>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
