import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ListTodo, Mail, Shield } from '@/components/icons';
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
import { RouteIdentity } from '@/components/system/RouteIdentity';

/**
 * Kept at its old address so existing links still land somewhere useful.
 * Synthex is Unite-Group's in-house marketing agency (FD-8): it has no price
 * list and no self-serve sign-up. Enquiries go to the Unite-Group CRM through
 * the Opportunity Map handoff (app/api/opportunity-map/handoff/route.ts).
 */
export const metadata: Metadata = {
  title: 'Work with Synthex | Synthex',
  description:
    "Synthex is Unite-Group's in-house marketing agency. Start with a free Opportunity Map and the Unite-Group team will pick it up from there.",
};

const faqs = [
  {
    question: 'Can I sign up to Synthex myself?',
    answer:
      "No. Synthex is Unite-Group's in-house marketing agency, run by the Unite-Group team. Logins are for that team only.",
  },
  {
    question: 'How do I talk to the team?',
    answer:
      'Build a free Opportunity Map and choose to be contacted about it. Your details and the map go to the Unite-Group team together, so the first conversation starts from what the map found.',
  },
];

const steps = [
  {
    icon: ListTodo,
    eyebrow: 'Step one',
    title: 'Build the free map',
    copy: 'Give the Opportunity Map your website and a little context. It returns ranked growth directions with the evidence behind them.',
    points: ['No login', 'No auto-publish', 'Takes a few minutes'],
  },
  {
    icon: Mail,
    eyebrow: 'Step two',
    title: 'Ask to be contacted',
    copy: 'If the map is useful, tick the consent box. The map and your contact details go to the Unite-Group team.',
    points: [
      'You choose whether to share',
      'One hand-off, no repeat discovery',
    ],
  },
  {
    icon: Shield,
    eyebrow: 'Step three',
    title: 'The team takes it from there',
    copy: 'Unite-Group operators run the marketing work in Synthex, with human approval before anything is published.',
    points: ['Approval before publishing', 'Evidence kept with each decision'],
  },
];

function WorkWithUsFaqSchema() {
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

export default function WorkWithUsPage() {
  return (
    <SiteShell>
      <RouteIdentity route="/pricing" />
      <WorkWithUsFaqSchema />
      <PublicPageFrame>
        <PublicPageHero
          eyebrow="Work with Synthex"
          title={
            <>
              Synthex is Unite-Group&apos;s{' '}
              <PublicGradientText>in-house marketing agency</PublicGradientText>
              .
            </>
          }
          description="There is nothing to buy and no account to create. Talk to the Unite-Group team, starting with a free Opportunity Map."
        />

        <PublicPageSection
          className="bg-sx-bg-primary"
          gradientVariant="mid"
          eyebrow="How to talk to us"
          title="Three steps from a map to a conversation."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {steps.map((step, index) => (
              <PublicPageCard key={step.title} {...step} index={index} />
            ))}
          </div>
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
        </PublicPageSection>

        <PublicGovernanceStrip />

        <PublicPageFaq title="Common questions" items={faqs} />
      </PublicPageFrame>
    </SiteShell>
  );
}
