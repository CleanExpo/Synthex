import type { Metadata } from 'next';
import Link from 'next/link';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';
import { NavBar } from '@/components/landing/nav-bar';
import { FooterSection } from '@/components/landing/footer-section';

export const revalidate = 3600;

export const metadata: Metadata = genMeta({
  title: 'Marketing Automation for Small Business & Agencies | Synthex',
  description:
    'Synthex automates social media for businesses across every industry. 9 platforms, AI brand voice, and zero manual posting — set up in under 60 seconds.',
  path: '/agencies',
  keywords: [
    'marketing automation for agencies',
    'social media automation Australia',
    'AI marketing platform agencies',
    'social media management for small business',
    'automated content creation',
  ],
});

const PAIN_POINTS = [
  {
    icon: '⏱️',
    title: 'Manual posting is stealing your time',
    body: "The average SMB spends 10+ hours per week on social media. That's a part-time employee you're already paying for — just with your own time.",
    stat: '10+ hrs/week wasted',
  },
  {
    icon: '🎯',
    title: 'Inconsistent brand voice across platforms',
    body: 'Writing differently for Instagram vs LinkedIn vs TikTok is exhausting. Synthex learns your brand voice once and adapts it perfectly to every platform — automatically.',
    stat: '9 platforms, 1 brand voice',
  },
  {
    icon: '📊',
    title: 'No time to analyse what works',
    body: "You post. You hope. You move on. Synthex scores every post for SEO, engagement, and brand alignment — so you always know what's working.",
    stat: 'Real-time content scores',
  },
];

const INDUSTRIES = [
  '☕ Cafes & Hospitality',
  '🔨 Tradies & Construction',
  '💇 Salons & Beauty',
  '💪 Gyms & Fitness',
  '🛍️ Retail & E-commerce',
  '🏡 Real Estate',
  '📚 Coaches & Consultants',
  '🍽️ Restaurants',
  '🏥 Healthcare & Wellness',
  '🎓 Education',
  '🐾 Pet Services',
  '🚗 Automotive',
];

const FAQS = [
  {
    q: 'How quickly can I get set up?',
    a: 'Paste your website URL and Synthex analyses your brand voice, colours, and tone in under 60 seconds. Your first AI-generated post is ready to approve immediately.',
  },
  {
    q: 'Do I need to know anything about social media?',
    a: 'No. Synthex handles platform-specific formatting, hashtags, optimal posting times, and content length — automatically. You just approve or edit before publishing.',
  },
  {
    q: 'Which platforms does Synthex support?',
    a: 'Instagram, Facebook, TikTok, YouTube, X (Twitter), LinkedIn, Pinterest, Reddit, and Threads. All 9 from one dashboard.',
  },
  {
    q: 'Can I manage multiple client accounts?',
    a: 'Yes. Synthex is fully multi-tenant — each business gets its own brand voice, posting schedule, and analytics. Perfect for agencies managing multiple clients.',
  },
  {
    q: 'Is there a free trial?',
    a: "Yes — no credit card required. Start free and upgrade when you're ready. Every plan includes a 30-day money-back guarantee.",
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

export default function AgenciesPage() {
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
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-orange-400">
              Works for every industry
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white leading-[1.05] mb-6">
            Social media on autopilot —{' '}
            <em className="text-orange-500 not-italic">
              for any business, any industry
            </em>
          </h1>

          <p className="text-lg text-white/50 max-w-2xl mx-auto leading-relaxed mb-10">
            Synthex is the AI platform that replaces manual social media posting
            for SMBs across Australia. Paste your URL, approve your first post,
            and publish to 9 platforms — in under 60 seconds.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-orange-500 hover:bg-orange-400 text-charcoal-900 font-bold rounded-full transition-all text-sm"
            >
              Start free — no card required
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-white/[0.06] border border-white/10 text-white font-medium rounded-full hover:bg-white/[0.10] transition-all text-sm"
            >
              See how it works
            </Link>
          </div>
          <p className="text-sm text-white/30 mt-3">
            30-day money-back guarantee · Cancel anytime
          </p>
        </div>
      </section>

      {/* Pain points */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-black text-center text-white mb-12">
            The social media problems every business faces
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAIN_POINTS.map(({ icon, title, body, stat }) => (
              <div
                key={title}
                className="bg-charcoal-800/60 border border-white/[0.06] rounded-2xl p-6"
              >
                <span className="text-3xl mb-4 block">{icon}</span>
                <p className="text-[10px] uppercase tracking-[0.2em] text-orange-400 font-semibold mb-2">
                  {stat}
                </p>
                <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-20 px-6 border-y border-white/[0.04]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black text-white mb-4">
            Built for every Australian business
          </h2>
          <p className="text-white/50 mb-10">
            5,000+ businesses across every industry trust Synthex to handle
            their social media.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {INDUSTRIES.map(industry => (
              <div
                key={industry}
                className="bg-charcoal-800/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white/60 hover:text-white/90 hover:border-orange-500/30 transition-all"
              >
                {industry}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-10">
            Frequently asked questions
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

      {/* Final CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-4">
            Ready to automate your social media?
          </h2>
          <p className="text-white/50 mb-8">
            Join 5,000+ Australian businesses posting to 9 platforms
            automatically.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-10 py-4 bg-orange-500 hover:bg-orange-400 text-charcoal-900 font-bold rounded-full transition-all text-base"
          >
            Start free today →
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
              All Platforms →
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
