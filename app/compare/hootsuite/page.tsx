import type { Metadata } from 'next';
import Link from 'next/link';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';
import { NavBar } from '@/components/landing/nav-bar';
import { FooterSection } from '@/components/landing/footer-section';

export const revalidate = 3600;

export const metadata: Metadata = genMeta({
  title: 'Synthex vs Hootsuite — Why SMBs Switch | Synthex',
  description:
    'Compare Synthex and Hootsuite. Synthex uses AI to write, schedule, and publish content automatically — Hootsuite just schedules what you write manually.',
  path: '/compare/hootsuite',
  keywords: [
    'Synthex vs Hootsuite',
    'Hootsuite alternative Australia',
    'better than Hootsuite',
    'Hootsuite competitor',
    'AI social media vs Hootsuite',
  ],
});

const COMPARISON = [
  {
    feature: 'Content creation',
    synthex: 'AI writes platform-native content automatically',
    hootsuite: 'You write everything manually',
    synthexWins: true,
  },
  {
    feature: 'Brand voice',
    synthex: 'Learns your brand from your website URL in 60s',
    hootsuite: 'No brand voice feature — copy/paste your own content',
    synthexWins: true,
  },
  {
    feature: 'Platforms supported',
    synthex: '9 platforms including Threads, Reddit, Pinterest',
    hootsuite: '35+ platforms but requires manual content for each',
    synthexWins: false,
  },
  {
    feature: 'Setup time',
    synthex: 'Paste URL → first post ready in under 60 seconds',
    hootsuite: 'Hours of profile setup, manual content library building',
    synthexWins: true,
  },
  {
    feature: 'AI capabilities',
    synthex: 'AI content generation, scoring, brand DNA extraction',
    hootsuite: 'Limited AI — OwlyWriter generates basic captions only',
    synthexWins: true,
  },
  {
    feature: 'Pricing entry point',
    synthex: 'Free tier available, no credit card required',
    hootsuite: 'No free tier — plans start at $99/month USD',
    synthexWins: true,
  },
  {
    feature: 'Analytics',
    synthex: 'Real-time content scoring + SEO + brand signals',
    hootsuite: 'Standard post analytics, no content quality scoring',
    synthexWins: true,
  },
  {
    feature: 'Scheduling',
    synthex: 'Fully automated with AI-optimal timing',
    hootsuite: 'Manual scheduling with bulk calendar tools',
    synthexWins: true,
  },
];

const FAQS = [
  {
    q: 'What is the main difference between Synthex and Hootsuite?',
    a: 'Hootsuite is a scheduling tool — it publishes content you create manually. Synthex is an AI content platform that creates, optimises, and publishes content automatically based on your brand voice.',
  },
  {
    q: 'Is Synthex cheaper than Hootsuite?',
    a: 'Yes. Hootsuite starts at $99/month USD with no free tier. Synthex offers a free plan with no credit card required.',
  },
  {
    q: 'Can Synthex replace my Hootsuite subscription?',
    a: "For most SMBs, yes. Synthex handles everything Hootsuite does (scheduling, multi-platform publishing) plus everything Hootsuite doesn't (AI content creation, brand voice, content scoring).",
  },
  {
    q: 'How long does it take to switch from Hootsuite to Synthex?',
    a: 'Under 60 seconds. Paste your website URL, connect your platforms, and Synthex generates your first post immediately — no library migration required.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

export default function VsHootsuitePage() {
  return (
    <div className="min-h-screen bg-charcoal-900 text-white overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <NavBar />

      {/* Hero */}
      <section className="relative pt-40 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-orange-400">
              Synthex vs Hootsuite
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white leading-[1.05] mb-6">
            Hootsuite schedules.{' '}
            <em className="text-orange-500 not-italic">Synthex creates.</em>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto leading-relaxed mb-10">
            Hootsuite is a calendar for content you already made. Synthex is an
            AI that creates, optimises, and publishes content for you — across
            all 9 platforms, in your brand voice, automatically.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-orange-500 hover:bg-orange-400 text-charcoal-900 font-bold rounded-full transition-all text-sm"
          >
            Try Synthex free — no card required
          </Link>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-12">
            Feature comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-white/50 w-1/3">
                    Feature
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-orange-400 w-1/3">
                    ✦ Synthex
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-white/30 w-1/3">
                    Hootsuite
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(
                  ({ feature, synthex, hootsuite, synthexWins }) => (
                    <tr
                      key={feature}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                    >
                      <td className="py-4 px-4 text-sm font-medium text-white/70">
                        {feature}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-2">
                          {synthexWins && (
                            <span className="text-orange-500 flex-shrink-0 mt-0.5">
                              ✓
                            </span>
                          )}
                          <span className="text-sm text-white/70">
                            {synthex}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-white/40">
                        {hootsuite}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-10">
            Common questions
          </h2>
          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <div
                key={q}
                className="bg-charcoal-800/40 border border-white/[0.06] rounded-xl p-6"
              >
                <h3 className="text-base font-bold text-white mb-2">{q}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-4">
            Ready to go beyond scheduling?
          </h2>
          <p className="text-white/50 mb-8">
            Switch to the AI that creates your content, not just schedules it.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-10 py-4 bg-orange-500 hover:bg-orange-400 text-charcoal-900 font-bold rounded-full transition-all text-base"
          >
            Start with Synthex free →
          </Link>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-white/30">
            <Link
              href="/features/ai-content"
              className="hover:text-orange-400 transition-colors"
            >
              AI Content →
            </Link>
            <Link
              href="/features/platforms"
              className="hover:text-orange-400 transition-colors"
            >
              9 Platforms →
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
