/**
 * /benchmark — public landing page (SYN-779)
 *
 * Server Component. No auth. Computes live cohort aggregates from Prisma
 * on each request with a short revalidate window so claims stay fresh
 * without hammering the DB. Every claim carries a sample-size disclosure,
 * and the methodology section is a board-required disclosure surface —
 * do not remove it.
 *
 * Canonical URL: https://synthex.social/benchmark
 *
 * Fetch strategy: `export const revalidate = 600` (10 minutes). This
 * keeps the landing page responsive without turning it into a permanent
 * cache of stale numbers. We did NOT use the authed
 * `/api/analytics/benchmarks` endpoint because it requires a Supabase
 * session (user-specific) and returns personalised comparisons. Public
 * claims are computed via `lib/analytics/public-benchmarks.ts`.
 */

import type { Metadata } from 'next';
import { getPublicBenchmarks } from '@/lib/analytics/public-benchmarks';
import { BenchmarkAnalyticsIsland } from './analytics-island';
import { BenchmarkTrialForm } from '@/components/marketing/BenchmarkTrialForm';

export const revalidate = 600; // 10 minutes

const CANONICAL_URL = 'https://synthex.social/benchmark';

const CTA_BUTTON_CLASSES =
  'inline-flex items-center justify-center px-8 py-4 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-medium text-lg shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300';

export const metadata: Metadata = {
  title:
    'Benchmark | Synthex — AI-powered local marketing, measured in real results',
  description:
    'See how Synthex client accounts perform. Every claim is grounded in anonymised aggregate data and disclosed with its sample size.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    title: 'Synthex Benchmark — measured in real results',
    description:
      'AI-powered local marketing that works. Every claim is grounded in anonymised aggregate data.',
    url: CANONICAL_URL,
    siteName: 'Synthex',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Synthex Benchmark — measured in real results',
    description:
      'AI-powered local marketing that works. Every claim is grounded in anonymised aggregate data.',
  },
  robots: { index: true, follow: true },
};

export default async function BenchmarkPage() {
  const payload = await getPublicBenchmarks();

  return (
    <main className="min-h-screen bg-surface-base text-white">
      <BenchmarkAnalyticsIsland />

      {/* Hero */}
      <section className="px-6 pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="container mx-auto max-w-5xl text-center">
          <p className="text-sm uppercase tracking-widest text-orange-400 mb-4">
            Synthex Benchmark
          </p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            AI-powered local marketing that works.
            <br />
            <span className="text-orange-400">Measured in real results.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
            Every figure on this page is drawn from anonymised aggregate data
            across active Synthex client accounts. No projections, no
            hand-picked case studies — just the cohort average, with the sample
            size disclosed next to each claim.
          </p>

          <BenchmarkTrialForm
            buttonClassName={CTA_BUTTON_CLASSES}
            formId="benchmark-trial-form-hero"
          />
        </div>
      </section>

      {/* Claims grid */}
      <section
        aria-labelledby="benchmark-claims-heading"
        className="px-6 py-16 border-t border-white/5"
      >
        <div className="container mx-auto max-w-6xl">
          <h2
            id="benchmark-claims-heading"
            className="text-3xl md:text-4xl font-bold text-center mb-4"
          >
            Our numbers, fully disclosed
          </h2>
          <p className="text-center text-gray-400 max-w-2xl mx-auto mb-12">
            {payload.cohortDescription}
          </p>

          {payload.usingFallback ? (
            <div className="max-w-2xl mx-auto text-center bg-white/5 border border-white/10 rounded-xl p-8">
              <p className="text-gray-300">
                The Synthex client cohort has not yet reached our minimum
                disclosure threshold of 25 accounts. Public claims go live once
                the cohort is large enough to anonymise reliably.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {payload.claims.map(claim => (
                <article
                  key={claim.source}
                  className="bg-white/5 border border-white/10 rounded-xl p-8 hover:border-orange-500/30 transition-colors duration-300"
                >
                  <p className="text-sm uppercase tracking-wider text-gray-400 mb-3">
                    {claim.label}
                  </p>
                  <p className="text-4xl md:text-5xl font-bold text-orange-400 mb-4">
                    {claim.value}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {claim.disclosure}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Methodology — board-required */}
      <section
        aria-labelledby="methodology-heading"
        className="px-6 py-20 border-t border-white/5 bg-white/[0.02]"
      >
        <div className="container mx-auto max-w-3xl">
          <h2
            id="methodology-heading"
            className="text-3xl md:text-4xl font-bold mb-6"
          >
            How we measure this
          </h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              Every figure on this page is computed from anonymised aggregate
              data recorded by Synthex while publishing and analysing client
              content. No individual account, post, or person is identifiable
              from the public claims.
            </p>
            <p>
              <strong className="text-white">Cohort.</strong> The cohort is
              every active Synthex client account — that is, an account with at
              least one connected platform that has not been deactivated. Test
              accounts, internal Synthex accounts, and soft-deleted accounts are
              excluded.
            </p>
            <p>
              <strong className="text-white">Period.</strong> Claims are
              computed over the rolling 90-day window ending at the time the
              page was last rendered. The page revalidates every 10 minutes, so
              figures refresh throughout the day without changing mid-visit.
            </p>
            <p>
              <strong className="text-white">Minimum sample size.</strong> We
              only publish a claim once the cohort contains at least 25 active
              client accounts. Below that threshold, the page shows a
              transparent &quot;insufficient data&quot; state rather than
              fabricated numbers.
            </p>
            <p>
              <strong className="text-white">No cherry-picking.</strong> Claims
              reflect the full cohort, not a hand-picked subset. We do not
              filter out underperforming accounts, and we do not apply
              survivorship adjustments.
            </p>
            <p>
              <strong className="text-white">Questions?</strong> Email{' '}
              <a
                href="mailto:benchmarks@synthex.social"
                className="text-orange-400 underline underline-offset-4 hover:text-orange-300"
              >
                benchmarks@synthex.social
              </a>{' '}
              and we will walk you through the exact queries behind any figure.
            </p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-6 py-20 border-t border-white/5">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to be measured?
          </h2>
          <p className="text-lg text-gray-400 mb-8">
            Start your 14-day trial and see what Synthex can do for your local
            marketing — with the same transparent measurement we use on this
            page.
          </p>
          <BenchmarkTrialForm
            buttonClassName={CTA_BUTTON_CLASSES}
            formId="benchmark-trial-form-footer"
          />
        </div>
      </section>
    </main>
  );
}
