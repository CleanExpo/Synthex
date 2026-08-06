import type { Metadata } from 'next';
import {
  ArrowRight,
  Calculator,
  Check,
  FileText,
  Minus,
  X,
} from '@/components/icons';
import { ReportVolumePicker } from './report-volume-picker';
import {
  CRAWL_DATE,
  FIRST_MONTH_BONUS_REPORTS,
  INCLUDED_REPORTS_PER_MONTH,
  MONTHLY_PLAN_PRICE_AUD,
  PRICING_SOURCE_URL,
  REPORT_PACKS,
  TRIAL_DAYS,
  TRIAL_QUICK_FILL_CREDITS,
  TRIAL_REPORT_CREDITS,
} from './plan-data';

/*
 * ============================================================================
 * RestoreAssist pricing page — /restoreassist/pricing
 * ----------------------------------------------------------------------------
 * PRICING PROVENANCE: every figure is transcribed from the live pricing page
 * (see plan-data.ts, crawled 06/08/2026). Two internal records disagree with the
 * live page — a hypothesised per-seat model in the verification-gate registry
 * (VG-52/VG-53, both [placeholder]) and a stale yearly plan in the launch
 * storyboard. The live page wins, because the launch stop-condition is that
 * published pricing must match the site. Details in plan-data.ts.
 *
 * COPY STATUS: authored against the RestoreAssist brand voice
 * (packages/brand-config/src/brands/ra.ts) — no verbatim marketing copy existed.
 * Prose is gated by __tests__/landing/restoreassist/pricing/page.test.tsx, which
 * fails the build on first-person business language, brand-forbidden words, the
 * banned-claim list, and Synthex token leakage. If a phrase must change, change
 * it — but the guard test is the reason this page cannot silently drift.
 *
 * DELIBERATE DIVERGENCE FROM THE BENCHMARK (xero.com/au/pricing): Xero leads
 * with a countdown-flavoured "80% off your first 3 months" banner. That is
 * ruled out here — the RestoreAssist brand rule is "never write copy that
 * creates urgency: the tradie reading this already has it". The self-selection
 * job Xero does with four tiers is done here with a report-volume picker,
 * because the live product has one paid plan and the real question is volume,
 * not tier.
 *
 * AID RULE (ceo-foundation.md): RestoreAssist records, captures, organises,
 * pre-fills and compiles. It does not assess, decide, verify, approve, scope,
 * estimate or sign off — the technician and their company do. Copy on this page
 * must keep that line intact.
 *
 * BRAND TOKENS: var(--ra-*), scoped to .ra-pricing-page in app/globals.css.
 * No Synthex tokens, no raw hex.
 * ============================================================================
 */

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's '%s | SYNTHEX' template — this is a
  // RestoreAssist surface, and brandprint forbids blending two brands in one
  // output. Without this the browser tab reads "... | SYNTHEX".
  title: {
    absolute: 'RestoreAssist pricing | $99 a month, 50 reports, GST included',
  },
  description:
    'RestoreAssist pricing in plain Australian dollars: a 15-day free trial with 50 report credits and no credit card, one paid plan at $99 a month including GST, and report packs if a month runs long.',
  alternates: { canonical: '/restoreassist/pricing' },
  openGraph: {
    title: 'RestoreAssist pricing — $99 a month, 50 reports, GST included',
    description:
      'A 15-day free trial with no credit card, one paid plan at $99 a month including GST, and report packs for the months that run long.',
    url: '/restoreassist/pricing',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const TRIAL_CTA_URL =
  'https://restoreassist.app/?utm_source=synthex&utm_medium=referral&utm_campaign=ra_pricing&utm_content=trial';

interface ComparisonRow {
  feature: string;
  trial: string | boolean;
  monthly: string | boolean;
}

/** Transcribed from the live pricing page — see plan-data.ts for provenance. */
const comparisonRows: ComparisonRow[] = [
  {
    feature: 'Inspection report credits',
    trial: `${TRIAL_REPORT_CREDITS} over ${TRIAL_DAYS} days`,
    monthly: `${INCLUDED_REPORTS_PER_MONTH} every month`,
  },
  {
    feature:
      'Quick Fill — pre-fills repeat fields from details already captured',
    trial: `${TRIAL_QUICK_FILL_CREDITS} credits`,
    monthly: 'No limit',
  },
  {
    feature: 'Report types',
    trial: 'Basic',
    monthly: 'Basic, Enhanced and Optimised',
  },
  { feature: 'IICRC S500 compliant reports', trial: true, monthly: true },
  { feature: 'PDF and Excel export', trial: true, monthly: true },
  { feature: 'Email support', trial: true, monthly: true },
  { feature: 'PDF upload and processing', trial: false, monthly: true },
  { feature: 'Integrations', trial: false, monthly: 'All of them' },
  { feature: 'Priority processing', trial: false, monthly: true },
  {
    feature: 'Full profile and pricing configuration',
    trial: false,
    monthly: true,
  },
  {
    feature: 'Credit card to start',
    trial: 'Not needed',
    monthly: 'Needed',
  },
];

const faqs = [
  {
    question: `What happens when the ${TRIAL_DAYS} days are up?`,
    answer: `Nothing is charged automatically, because starting the trial does not ask for a card. Moving to the paid plan is a separate decision, made at the point the trial ends.`,
  },
  {
    question: 'What is the bring-your-own AI key, and what does it add?',
    answer:
      'Report generation runs on an Anthropic or OpenAI account in the business name, added in Settings after signup. That provider bills directly for what gets used, at their published rates — the amount is not marked up and does not pass through RestoreAssist. It is the one cost on this page that is not fixed, which is why it is set out in full rather than buried.',
  },
  {
    question: 'What happens in a month that runs longer than expected?',
    answer: `The plan includes ${INCLUDED_REPORTS_PER_MONTH} reports a month. A report pack tops that up for the month it is needed — ${REPORT_PACKS.map(
      pack => `${pack.reports} reports for $${pack.priceAud}`
    ).join(', ')}. Packs are added to a subscription as required.`,
  },
  {
    question: 'Are the prices GST inclusive?',
    answer:
      'Yes. Every figure on this page is Australian dollars with GST included, and a tax invoice is issued monthly.',
  },
  {
    question: 'Can the plan be cancelled?',
    answer:
      'Yes — the monthly plan can be cancelled at any time. There is no lock-in period on it.',
  },
];

function PricingFaqSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function ComparisonCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <>
        <Check className="h-5 w-5 text-[var(--ra-earth)]" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <X className="h-5 w-5 text-[var(--ra-n500)]" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <span className="text-sm font-medium">{value}</span>;
}

export default function RestoreAssistPricingPage() {
  return (
    <main className="ra-pricing-page bg-[var(--ra-n50)] font-sans text-[var(--ra-navy)]">
      <PricingFaqSchema />

      {/* ================= 1 · HERO ================= */}
      <section className="bg-[var(--ra-navy)] px-6 py-20 text-[var(--ra-n50)] sm:py-28">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--ra-tan)]">
            Pricing
          </p>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl">
            Work out what this costs before handing over an email address.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--ra-n100)]">
            One paid plan. ${MONTHLY_PLAN_PRICE_AUD} a month, GST included,{' '}
            {INCLUDED_REPORTS_PER_MONTH} inspection reports. The {TRIAL_DAYS}
            -day trial needs no credit card. Every number is on this page,
            including the running cost most pricing pages leave out.
          </p>
        </div>
      </section>

      {/* ================= 2 · THE TWO PLANS ================= */}
      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {/* Trial */}
          <div className="flex flex-col rounded-[12px] border border-[var(--ra-n100)] bg-[var(--ra-white)] p-8">
            <h2 className="text-2xl font-bold">Free trial</h2>
            <p className="mt-2 text-base text-[var(--ra-n500)]">
              Enough room to run real jobs through it, not a demo dataset.
            </p>
            <p className="mt-6 font-mono text-5xl font-extrabold">$0</p>
            <p className="mt-2 text-sm text-[var(--ra-n500)]">
              {TRIAL_REPORT_CREDITS} report credits across {TRIAL_DAYS} days
            </p>
            <ul className="mt-7 flex-1 space-y-3">
              {[
                `${TRIAL_DAYS} days, no credit card`,
                `${TRIAL_REPORT_CREDITS} inspection report credits`,
                `${TRIAL_QUICK_FILL_CREDITS} Quick Fill credits`,
                'Basic report type',
                'IICRC S500 compliant reports',
                'PDF and Excel export',
                'Email support',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-base">
                  <Check
                    className="mt-1 h-4 w-4 shrink-0 text-[var(--ra-earth)]"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <a
              href={TRIAL_CTA_URL}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-[8px] border border-[var(--ra-navy)] px-6 py-3 text-base font-semibold text-[var(--ra-navy)] transition-opacity hover:opacity-80"
            >
              Start the trial
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          {/* Monthly — carries the single tan CTA on this screen, per the RA
              design rule that cta-primary appears at most once per surface. */}
          <div className="flex flex-col rounded-[12px] border-2 border-[var(--ra-navy)] bg-[var(--ra-white)] p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">Monthly</h2>
              <span className="rounded-[4px] bg-[var(--ra-n100)] px-2 py-1 font-mono text-xs font-medium text-[var(--ra-navy)]">
                Most chosen
              </span>
            </div>
            <p className="mt-2 text-base text-[var(--ra-n500)]">
              For a business writing up jobs every week of the month.
            </p>
            <p className="mt-6 font-mono text-5xl font-extrabold">
              ${MONTHLY_PLAN_PRICE_AUD}
              <span className="align-middle text-xl font-bold text-[var(--ra-n500)]">
                /month
              </span>
            </p>
            <p className="mt-2 text-sm text-[var(--ra-n500)]">
              AUD, GST included. {INCLUDED_REPORTS_PER_MONTH} reports a month.
              Cancel any time.
            </p>
            <ul className="mt-7 flex-1 space-y-3">
              {[
                `${INCLUDED_REPORTS_PER_MONTH} inspection reports a month`,
                `First month adds ${FIRST_MONTH_BONUS_REPORTS} reports on top`,
                'Quick Fill with no limit',
                'Basic, Enhanced and Optimised report types',
                'PDF upload and processing',
                'All integrations, priority processing',
                'Full profile and pricing configuration',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-base">
                  <Check
                    className="mt-1 h-4 w-4 shrink-0 text-[var(--ra-earth)]"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <a
              href={TRIAL_CTA_URL}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-[8px] bg-[var(--ra-tan)] px-6 py-3 text-base font-semibold text-[var(--ra-navy)] transition-opacity hover:opacity-90"
            >
              Start on the trial first
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <p className="mt-3 text-center text-xs text-[var(--ra-n500)]">
              The trial comes first either way — the card is only asked for
              after it ends.
            </p>
          </div>
        </div>
      </section>

      {/* ================= 3 · VOLUME PICKER ================= */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <Calculator
              className="h-6 w-6 text-[var(--ra-earth)]"
              aria-hidden="true"
            />
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              Check the number against a real month.
            </h2>
          </div>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--ra-n500)]">
            The plan includes fifty reports a month. Some months run longer than
            that. This works out what those months actually cost, and says so
            plainly when the answer is that nothing needs adding.
          </p>
          <div className="mt-10">
            <ReportVolumePicker />
          </div>
        </div>
      </section>

      {/* ================= 4 · REPORT PACKS ================= */}
      <section className="bg-[var(--ra-white)] px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Report packs, for the months that run long.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--ra-n500)]">
            A pack tops up the monthly allowance. The rate per report improves
            as the pack gets bigger, and the arithmetic is printed here so it
            does not have to be worked out on a calculator.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {REPORT_PACKS.map(pack => (
              <div
                key={pack.reports}
                className="rounded-[12px] border border-[var(--ra-n100)] bg-[var(--ra-n50)] p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <FileText
                    className="h-6 w-6 text-[var(--ra-earth)]"
                    aria-hidden="true"
                  />
                  {pack.badge ? (
                    <span className="rounded-[4px] bg-[var(--ra-n100)] px-2 py-1 font-mono text-xs font-medium">
                      {pack.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 font-mono text-3xl font-extrabold">
                  ${pack.priceAud}
                </p>
                <p className="mt-1 text-base font-semibold">
                  {pack.reports} extra reports
                </p>
                <p className="mt-2 font-mono text-sm text-[var(--ra-n500)]">
                  ${(pack.priceAud / pack.reports).toFixed(2)} per report
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 5 · THE RUNNING COST ================= */}
      <section className="bg-[var(--ra-navy)] px-6 py-20 text-[var(--ra-n50)]">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--ra-tan)]">
            The part that is not a fixed price
          </p>
          <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
            Report generation runs on your own AI key.
          </h2>
          <div className="mt-6 space-y-5 text-lg leading-relaxed text-[var(--ra-n100)]">
            <p>
              Writing a report draws on an AI provider — either Anthropic or
              OpenAI. RestoreAssist does not resell that. The account is opened
              in the business name, the key is pasted into Settings after
              signup, and that provider bills directly for what gets used.
            </p>
            <p>
              Two things follow from that. The usage is billed at the
              provider&apos;s own rates with nothing added on top. And the job
              data goes to an account the business controls, not one held on its
              behalf.
            </p>
            <p>
              It is a separate usage-based amount on top of the $
              {MONTHLY_PLAN_PRICE_AUD}, and it moves with how much gets written.
              It is set out here rather than in the fine print because a number
              that moves belongs in front of a buyer, not behind an asterisk.
            </p>
          </div>
        </div>
      </section>

      {/* ================= 6 · COMPARISON TABLE ================= */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Trial and paid plan, side by side.
          </h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Feature comparison between the RestoreAssist free trial and the
                monthly plan
              </caption>
              <thead>
                <tr className="border-b-2 border-[var(--ra-navy)]">
                  <th scope="col" className="py-4 pr-4 text-base font-bold">
                    Feature
                  </th>
                  <th
                    scope="col"
                    className="w-40 py-4 pr-4 text-base font-bold"
                  >
                    Free trial
                  </th>
                  <th scope="col" className="w-48 py-4 text-base font-bold">
                    Monthly · ${MONTHLY_PLAN_PRICE_AUD}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(row => (
                  <tr
                    key={row.feature}
                    className="border-b border-[var(--ra-n100)]"
                  >
                    <th
                      scope="row"
                      className="py-4 pr-4 text-base font-normal leading-relaxed"
                    >
                      {row.feature}
                    </th>
                    <td className="py-4 pr-4">
                      <ComparisonCell value={row.trial} />
                    </td>
                    <td className="py-4">
                      <ComparisonCell value={row.monthly} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ================= 7 · WHERE THE LINE SITS ================= */}
      <section className="bg-[var(--ra-white)] px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            What the money buys, and what it does not.
          </h2>
          <div className="mt-8 space-y-4">
            {[
              {
                included: true,
                text: 'Site photos, measurements and damage details captured on the phone, on the job.',
              },
              {
                included: true,
                text: 'Repeat fields pre-filled from details already entered, so the same information is not typed twice.',
              },
              {
                included: true,
                text: 'Findings organised into the report sections, with IICRC S500 references compiled into the output.',
              },
              {
                included: true,
                text: 'A finished report exported to PDF or Excel, ready to send.',
              },
              {
                included: false,
                text: 'The inspection itself. A technician attends and inspects — that does not change.',
              },
              {
                included: false,
                text: 'The decision. The technician and the company review the report, adjust what needs adjusting, and sign it off. RestoreAssist records and compiles; it does not judge the job.',
              },
            ].map(item => (
              <div key={item.text} className="flex items-start gap-4">
                {item.included ? (
                  <Check
                    className="mt-1 h-5 w-5 shrink-0 text-[var(--ra-earth)]"
                    aria-hidden="true"
                  />
                ) : (
                  <Minus
                    className="mt-1 h-5 w-5 shrink-0 text-[var(--ra-n500)]"
                    aria-hidden="true"
                  />
                )}
                <p className="text-lg leading-relaxed text-[var(--ra-n500)]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 8 · FAQ ================= */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Questions worth asking first.
          </h2>
          <dl className="mt-10 divide-y divide-[var(--ra-n100)]">
            {faqs.map(faq => (
              <div key={faq.question} className="py-6">
                <dt className="text-xl font-bold">{faq.question}</dt>
                <dd className="mt-3 text-lg leading-relaxed text-[var(--ra-n500)]">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ================= 9 · CLOSE ================= */}
      <section className="bg-[var(--ra-navy)] px-6 py-20 text-[var(--ra-n50)]">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Put it on the next job and judge the report yourself.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--ra-n100)]">
            {TRIAL_REPORT_CREDITS} report credits over {TRIAL_DAYS} days is
            enough to run a real water-damage job from the site photos through
            to the finished report — and to decide, on your own evidence,
            whether what comes out the other end is worth $
            {MONTHLY_PLAN_PRICE_AUD} a month.
          </p>
          <div className="mt-9 flex justify-center">
            <a
              href={TRIAL_CTA_URL}
              className="inline-flex items-center gap-2 rounded-[8px] bg-[var(--ra-tan)] px-8 py-4 text-base font-semibold text-[var(--ra-navy)] transition-opacity hover:opacity-90"
            >
              Start the {TRIAL_DAYS}-day trial
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>
          <p className="mt-8 font-mono text-xs leading-relaxed text-[var(--ra-n500)]">
            Prices in AUD, GST included. Tax invoices issued monthly. Pricing as
            published at {PRICING_SOURCE_URL} on {CRAWL_DATE}.
          </p>
          <p className="mt-4 font-mono text-xs text-[var(--ra-n500)]">
            Built in Brisbane for Australian tradies.
          </p>
        </div>
      </section>
    </main>
  );
}
