import type { Metadata } from 'next';
import Link from 'next/link';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';
import { NavBar } from '@/components/landing/nav-bar';
import { FooterSection } from '@/components/landing/footer-section';

export const revalidate = 3600;

export const metadata: Metadata = genMeta({
  title: 'Synthex and Hootsuite: what Synthex does | Synthex',
  description:
    'Considering Synthex alongside Hootsuite? Synthex drafts platform-native content in your brand voice, routes every post for approval, and schedules it to your connected platforms.',
  path: '/compare/hootsuite',
  keywords: [
    'Synthex vs Hootsuite',
    'Hootsuite alternative Australia',
    'AI social media content',
    'brand voice content',
  ],
});

// Synthex's own features only. This page makes no claims about Hootsuite:
// there is no dated, reviewable source for its capabilities in the repo.
const FEATURES = [
  {
    feature: 'Content creation',
    synthex: 'AI drafts platform-native content for you to review',
  },
  {
    feature: 'Brand voice',
    synthex: 'Learns your brand from your website URL',
  },
  {
    feature: 'Platforms',
    synthex: 'Publishing to the platforms you connect',
  },
  {
    feature: 'AI capabilities',
    synthex: 'Content generation, scoring and brand DNA extraction',
  },
  {
    feature: 'Analytics',
    synthex: 'Content scoring with SEO and brand signals',
  },
  {
    feature: 'Scheduling',
    synthex: 'Scheduling with an approval step before anything publishes',
  },
];

const FAQS = [
  {
    q: 'How do I get started if I already use another scheduling tool?',
    a: 'Paste your website URL, connect your platforms, and Synthex drafts your first post — no library migration required.',
  },
  {
    q: 'Does Synthex publish without my approval?',
    a: 'No. Every post waits for your approval before it is published.',
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
            Considering Synthex{' '}
            <em className="text-orange-500 not-italic">alongside Hootsuite?</em>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto leading-relaxed mb-10">
            Here is what Synthex does: it drafts platform-native content in your
            brand voice, routes every post for your approval, and schedules it
            to your connected platforms.
          </p>
          <Link
            href="/opportunity-map"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-orange-500 hover:bg-orange-400 text-charcoal-900 font-bold rounded-full transition-all text-sm"
          >
            Talk to us
          </Link>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-12">
            What Synthex does
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-white/50 w-1/3">
                    Feature
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-orange-400">
                    ✦ Synthex
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map(({ feature, synthex }) => (
                  <tr
                    key={feature}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <td className="py-4 px-4 text-sm font-medium text-white/70">
                      {feature}
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-white/70">{synthex}</span>
                    </td>
                  </tr>
                ))}
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
            See what Synthex drafts for you
          </h2>
          <p className="text-white/50 mb-8">
            Start with your website URL and approve your first draft.
          </p>
          <Link
            href="/opportunity-map"
            className="inline-flex items-center justify-center px-10 py-4 bg-orange-500 hover:bg-orange-400 text-charcoal-900 font-bold rounded-full transition-all text-base"
          >
            Talk to us →
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
              Platforms →
            </Link>
            <Link
              href="/opportunity-map"
              className="hover:text-orange-400 transition-colors"
            >
              Talk to us →
            </Link>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
