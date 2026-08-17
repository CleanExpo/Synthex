import { generateMetadata } from '@/lib/seo/metadata';
import {
  AlertCircle,
  CheckCircle,
  Scale,
  Shield,
  XCircle,
} from '@/components/icons';
import {
  PublicGradientText,
  PublicPageCtaBand,
  PublicPageFrame,
  PublicPageHero,
  PublicPageSection,
} from '@/components/landing/premium';
import { PublicPageCard } from '@/components/landing/premium/public-page-card';
import { SiteShell } from '@/components/landing/public-v2';

const sections = [
  {
    title: 'Acceptable use',
    icon: CheckCircle,
    copy: 'Use Synthex for lawful organisation marketing work.',
    points: [
      'Keep account details accurate',
      'Respect platform terms when channels are connected',
      'Treat generated drafts as work product, not auto-publish',
      'Stay inside the approval gates configured for your org',
    ],
  },
  {
    title: 'Prohibited activities',
    icon: XCircle,
    copy: 'The command center is not a bypass for law, consent or licensing.',
    points: [
      'No unlawful, misleading or harmful content',
      'No sharing of credentials or resale of access',
      'No attempts to extract provider keys or reverse the system',
      'No using Synthex to spam or harass',
    ],
  },
  {
    title: 'Your rights in the workspace',
    icon: Shield,
    copy: 'Content you create remains yours. Synthex processes it to run the product.',
    points: [
      'Ownership of your briefs, assets and evidence',
      'Export where the product supports it',
      'Access limited to your organisation’s scope',
      'Australian Consumer Law rights that cannot be excluded',
    ],
  },
  {
    title: 'Our commitments',
    icon: Scale,
    copy: 'Controlled pilot access — not a public self-serve SaaS menu.',
    points: [
      'Human approval before public publishing',
      'Spend and provider calls stay gated',
      'Security and privacy practices described on /security',
      'Notice of material term changes',
    ],
  },
];

const clauses = [
  {
    title: '1. Access',
    copy: 'Access is granted to named operators of an organisation. You must keep credentials confidential and tell us if an account is compromised.',
  },
  {
    title: '2. Pilot and production',
    copy: 'Synthex may be provided as a controlled pilot. Production, publishing and paid media remain blocked until the configured approval path is complete.',
  },
  {
    title: '3. Content licence',
    copy: 'You retain ownership of content you submit. You grant Synthex a limited licence to process that content solely to provide the workspace.',
  },
  {
    title: '4. Availability',
    copy: 'We aim for a reliable service and will announce planned maintenance when we can. Third-party platform outages are outside our control.',
  },
  {
    title: '5. Liability',
    copy: 'Nothing in these terms limits rights under the Australian Consumer Law that cannot be excluded. Other liability is limited to the fees paid for the service in the previous 12 months, where the law allows.',
  },
  {
    title: '6. Governing law',
    copy: 'These terms are governed by the laws of Queensland, Australia. Disputes should start with good-faith contact to legal@synthex.social.',
  },
];

export const metadata = generateMetadata({
  title: 'Terms of Service',
  description:
    'Terms for using Synthex, Unite Group’s internal marketing command center.',
  path: '/terms',
  keywords: ['terms of service', 'terms and conditions', 'user agreement'],
});

export default function TermsPage() {
  return (
    <SiteShell>
      <PublicPageFrame>
        <PublicPageHero
          eyebrow="Legal"
          title={
            <>
              Terms for a{' '}
              <PublicGradientText>controlled command center</PublicGradientText>
              .
            </>
          }
          description="By using Synthex you agree to these terms. They exist so publishing, spend and claims stay behind a named reviewer — not so we can hide a surprise SaaS bill."
        >
          <p className="text-sm text-sx-text-muted">Effective: March 2026</p>
        </PublicPageHero>

        <PublicPageSection className="bg-sx-bg-primary" gradientVariant="mid">
          <div className="flex gap-4 rounded-2xl border border-sx-accent/25 bg-sx-opportunity-surface p-6">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-sx-accent" />
            <p className="text-sm leading-7 text-sx-text-secondary">
              If you disagree with these terms, do not use the service.
              Questions: legal@synthex.social.
            </p>
          </div>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-secondary"
          eyebrow="Summary"
          title="The rules in four cards"
        >
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
            {sections.map((section, index) => (
              <PublicPageCard key={section.title} {...section} index={index} />
            ))}
          </div>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-primary"
          gradientVariant="lower"
          eyebrow="Detail"
          title="Service terms"
        >
          <div className="space-y-5">
            {clauses.map(clause => (
              <article
                key={clause.title}
                className="rounded-2xl border border-white/[0.08] bg-sx-bg-elevated p-6"
              >
                <h3 className="text-lg font-semibold text-sx-text-primary">
                  {clause.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-sx-text-secondary">
                  {clause.copy}
                </p>
              </article>
            ))}
          </div>
        </PublicPageSection>

        <PublicPageCtaBand
          eyebrow="Legal contact"
          title="Need a clause explained before a pilot?"
          description="Synthex Pty Ltd · ABN 62 580 077 456 · Brisbane, QLD, Australia"
          href="/contact"
          label="Contact Synthex"
        />
      </PublicPageFrame>
    </SiteShell>
  );
}
