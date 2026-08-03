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
import {
  PublicGovernanceStrip,
  PublicGradientText,
  PublicPageFaq,
  PublicPageFrame,
  PublicPageHero,
  PublicPageSection,
} from '@/components/landing/premium';
import { PublicPageCard } from '@/components/landing/premium/public-page-card';
import { SiteShell } from '@/components/landing/public-v2';
import { SectionReveal } from '@/components/landing/premium/section-reveal';

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
    eyebrow: 'Pilot scoping',
    title: 'Plan first',
    copy: 'Synthex starts by turning your business context, ideas and channels into a clear campaign card set.',
    points: [
      'Business and product intake',
      'Campaign angles and channel plan',
      'Risks, gates and next decisions',
    ],
  },
  {
    icon: ImageIcon,
    eyebrow: 'Metered production',
    title: 'Produce only what is approved',
    copy: 'Move selected cards into website, lead magnet, thumbnail, email, post or video production.',
    points: [
      'Storyboard and asset briefs',
      'Provider-gated media work',
      'Human approval before output',
    ],
  },
  {
    icon: Shield,
    eyebrow: 'Scoped retainer',
    title: 'Scale when the gates are proven',
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
      <PublicPageFrame>
        <PublicPageHero
          eyebrow="Pilot access"
          title={
            <>
              Start small. Approve clearly.{' '}
              <PublicGradientText>Scale only what works</PublicGradientText>.
            </>
          }
          description="Pilot access is not a confusing SaaS menu. It is a controlled path: plan the campaign, approve the assets, then move into production with clear gates."
        />

        <PublicPageSection
          className="bg-sx-bg-primary"
          gradientVariant="mid"
          eyebrow="How pilot access works"
          title="Three phases. No surprise production."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {pilotSteps.map((step, index) => (
              <SectionReveal key={step.title} delay={index * 50}>
                <PublicPageCard {...step} index={index} />
              </SectionReveal>
            ))}
          </div>
          <SectionReveal delay={180}>
            <div className="mx-auto mt-10 max-w-md">
              <Button
                asChild
                variant="premium-primary"
                size="xl"
                className="w-full shadow-[0_0_32px_rgba(255,122,24,0.15)]"
              >
                <Link href="/opportunity-map">
                  Build the free Opportunity Map
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </SectionReveal>
        </PublicPageSection>

        <PublicGovernanceStrip />

        <PublicPageFaq title="Pilot questions" items={faqs} />
      </PublicPageFrame>
    </SiteShell>
  );
}
