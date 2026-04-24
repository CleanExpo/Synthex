import type { Metadata } from 'next';
import Link from 'next/link';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';
import { NavBar } from '@/components/landing/nav-bar';
import { FooterSection } from '@/components/landing/footer-section';

export const revalidate = 3600;

export const metadata: Metadata = genMeta({
  title: 'AI Content Generation for Social Media | Synthex',
  description:
    'Synthex AI generates platform-native social media content in under 3 seconds. Instagram captions, LinkedIn articles, TikTok hooks — all in your brand voice.',
  path: '/features/ai-content',
  keywords: [
    'AI content generation platform',
    'AI social media content creator',
    'automated content creation',
    'AI caption generator',
    'brand voice AI',
  ],
});

const STEPS = [
  {
    n: '01',
    title: 'Paste your website URL',
    body: 'Synthex reads your website and extracts your brand voice, colours, tone, and industry — automatically. No manual setup.',
  },
  {
    n: '02',
    title: 'AI builds your Brand DNA',
    body: 'Within seconds, a complete brand profile is built: your unique tone, values, visual identity, and audience signals.',
  },
  {
    n: '03',
    title: 'Content generated across 9 platforms',
    body: 'Instagram captions, LinkedIn posts, TikTok hooks, YouTube descriptions — all formatted natively for each platform.',
  },
  {
    n: '04',
    title: 'Review, approve, publish',
    body: 'Every post goes through your approval queue. Edit, reject, or publish with one click — or set it fully autonomous.',
  },
];

const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How Synthex AI Content Generation Works',
  description:
    'Generate platform-native social media content automatically using AI.',
  step: STEPS.map((s, i) => ({
    '@type': 'HowToStep',
    position: i + 1,
    name: s.title,
    text: s.body,
  })),
};

export default function AiContentPage() {
  return (
    <div className="min-h-screen bg-charcoal-900 text-white overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />

      <NavBar />

      {/* Hero */}
      <section className="relative pt-40 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-orange-400">
              AI Content Generation
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white leading-[1.05] mb-6">
            Content that sounds like you,{' '}
            <em className="text-orange-500 not-italic">written by AI</em>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto leading-relaxed mb-10">
            Synthex learns your brand voice and generates platform-native
            content for all 9 platforms — in under 3 seconds. Your tone, your
            style, zero manual effort.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-orange-500 hover:bg-orange-400 text-charcoal-900 font-bold rounded-full transition-all text-sm"
          >
            Try it free — see your content in 3 seconds
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ n, title, body }) => (
              <div
                key={n}
                className="bg-charcoal-800/60 border border-white/[0.06] rounded-2xl p-6 relative"
              >
                <span className="text-4xl font-black text-orange-500/20 mb-4 block">
                  {n}
                </span>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform capabilities */}
      <section className="py-20 px-6 border-y border-white/[0.04]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black text-white mb-4">
            Platform-native content for every channel
          </h2>
          <p className="text-white/50 mb-10">
            Each platform has its own format, character limits, and audience
            expectations. Synthex knows them all.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              {
                platform: 'Instagram',
                format: 'Captions + hashtags optimised for Explore',
              },
              {
                platform: 'LinkedIn',
                format: 'Professional posts with hook + insight + CTA',
              },
              {
                platform: 'TikTok',
                format: 'Short-form hooks designed for the FYP algorithm',
              },
              {
                platform: 'Facebook',
                format: 'Community-focused posts with engagement prompts',
              },
              {
                platform: 'YouTube',
                format: 'SEO-optimised descriptions with timestamps',
              },
              {
                platform: 'X (Twitter)',
                format: 'Punchy threads and single posts under 280 chars',
              },
              {
                platform: 'Pinterest',
                format: 'Search-optimised pins with keyword-rich descriptions',
              },
              {
                platform: 'Reddit',
                format: 'Community-aware posts that drive genuine engagement',
              },
              {
                platform: 'Threads',
                format: "Conversational content for Meta's emerging platform",
              },
            ].map(({ platform, format }) => (
              <div
                key={platform}
                className="bg-charcoal-800/40 border border-white/[0.06] rounded-xl p-4"
              >
                <p className="text-sm font-bold text-white mb-1">{platform}</p>
                <p className="text-xs text-white/40">{format}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-4">
            See Synthex write your content
          </h2>
          <p className="text-white/50 mb-8">
            Paste your website URL and get real AI-generated content in under 3
            seconds.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-10 py-4 bg-orange-500 hover:bg-orange-400 text-charcoal-900 font-bold rounded-full transition-all text-base"
          >
            Start free →
          </Link>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-white/30">
            <Link
              href="/features/platforms"
              className="hover:text-orange-400 transition-colors"
            >
              All 9 platforms →
            </Link>
            <Link
              href="/agencies"
              className="hover:text-orange-400 transition-colors"
            >
              For agencies →
            </Link>
            <Link
              href="/pricing"
              className="hover:text-orange-400 transition-colors"
            >
              Pricing →
            </Link>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
