import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ImageIcon,
  ListTodo,
  Shield,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SafetyStrip, SiteShell } from '@/components/landing/public-v2';

export const metadata: Metadata = {
  title: 'Pilot Access | Synthex',
  description:
    'Synthex pilot access for evidence-backed marketing command workflows, campaign planning, Gen Media and approval-gated execution.',
};

const faqs = [
  {
    question: 'Why does this page not show cheap self-serve SaaS tiers?',
    answer:
      'Synthex is currently being prepared as a controlled marketing command system. Pricing is scoped around business context, approvals, provider gates and production responsibility.',
  },
  {
    question: 'Can Synthex publish directly to social platforms?',
    answer:
      'Publishing remains approval-gated. Drafts, boards and creative packets can be prepared in sandbox, but public output requires the configured approval path.',
  },
  {
    question: 'What is included in ideation?',
    answer:
      'Ideation covers campaign angles, website direction, lead magnets, thumbnails, brand planning and email campaign concepts before production begins.',
  },
  {
    question: 'What happens before paid media or Gen Media production?',
    answer:
      'The system checks evidence, consent, licensing, brand fit, provider readiness and human approval before any production or spend path is opened.',
  },
];

const pilotSteps = [
  {
    icon: ListTodo,
    title: 'Plan first',
    price: 'Pilot scoping',
    copy: 'Synthex starts by turning your business context, ideas and channels into a clear campaign card set.',
    points: [
      'Business and product intake',
      'Campaign angles and channel plan',
      'Risks, gates and next decisions',
    ],
  },
  {
    icon: ImageIcon,
    title: 'Produce only what is approved',
    price: 'Metered production',
    copy: 'Move selected cards into website, lead magnet, thumbnail, email, post or video production.',
    points: [
      'Storyboard and asset briefs',
      'Provider-gated media work',
      'Human approval before output',
    ],
  },
  {
    icon: Shield,
    title: 'Scale when the gates are proven',
    price: 'Scoped retainer',
    copy: 'Recurring support opens after the approval, publishing and reporting path is working cleanly.',
    points: [
      'Monthly ideation package',
      'Performance review',
      'Next campaign cards',
    ],
  },
];

function PricingFAQSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function PricingPage() {
  return (
    <SiteShell>
      <PricingFAQSchema />
      <section className="bg-[#08090b] px-5 pb-14 pt-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              Pilot access
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">
              Start small. Approve clearly. Scale only what works.
            </h1>
            <p className="mt-6 text-lg leading-8 text-white/60">
              Pilot access is not a confusing SaaS menu. It is a controlled
              path: plan the campaign, approve the assets, then move into
              production with clear gates.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#08090b] px-5 pb-20">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
          {pilotSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article
                key={step.title}
                className="border border-white/[0.08] bg-[#0d0f12] p-6"
              >
                <div className="mb-6 flex items-center justify-between">
                  <Icon className="h-7 w-7 text-orange-300" />
                  <span className="text-xs text-white/35">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-xs uppercase tracking-[0.22em] text-orange-300/80">
                  {step.price}
                </p>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                  {step.title}
                </h2>
                <p className="mt-4 text-sm leading-6 text-white/55">
                  {step.copy}
                </p>
                <ul className="mt-7 space-y-3">
                  {step.points.map(point => (
                    <li
                      key={point}
                      className="flex gap-3 text-sm leading-6 text-white/60"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <div className="mx-auto mt-8 max-w-xl">
          <Button asChild variant="premium-primary" size="xl" className="w-full">
            <Link href="/contact">
              Request pilot access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <SafetyStrip />

      <section className="bg-[#0d0f12] px-5 py-20 md:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Pilot questions
          </h2>
          <div className="mt-8 space-y-4">
            {faqs.map(faq => (
              <div key={faq.question} className="border border-white/[0.08] bg-[#08090b] p-5">
                <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-white/56">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
