import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  SafetyStrip,
  SiteShell,
  pilotPlans,
} from '@/components/landing/public-v2';

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
              Pricing follows responsibility, not generic post volume.
            </h1>
            <p className="mt-6 text-lg leading-8 text-white/60">
              Synthex is built for businesses that need real research, real
              approvals and accountable campaign production. Public launch tiers
              will follow after the controlled pilot gates are proven.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#08090b] px-5 pb-20">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
          {pilotPlans.map(plan => (
            <div
              key={plan.name}
              className={`border p-6 ${
                plan.tone === 'primary'
                  ? 'border-orange-300/45 bg-orange-300/[0.08]'
                  : 'border-white/[0.08] bg-[#0d0f12]'
              }`}
            >
              <p className="text-sm font-semibold text-white">{plan.name}</p>
              <p className="mt-5 text-3xl font-semibold tracking-tight text-white">
                {plan.price}
              </p>
              <p className="mt-3 min-h-12 text-sm leading-6 text-white/55">
                {plan.description}
              </p>
              <ul className="mt-7 space-y-3">
                {plan.features.map(feature => (
                  <li key={feature} className="flex gap-3 text-sm leading-6 text-white/60">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                variant={plan.tone === 'primary' ? 'premium-primary' : 'glass-secondary'}
                size="xl"
                className="mt-8 w-full"
              >
                <Link href={plan.href}>
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
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
