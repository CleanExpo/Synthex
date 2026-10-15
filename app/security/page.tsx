import { generateMetadata } from '@/lib/seo/metadata';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle,
  Database,
  Eye,
  Globe,
  Key,
  Lock,
  Mail,
  Server,
  Users,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  PublicGovernanceStrip,
  PublicGradientText,
  PublicPageFrame,
  PublicPageHero,
  PublicPageSection,
  PublicPageStatGrid,
} from '@/components/landing/premium';
import { PublicPageCard } from '@/components/landing/premium/public-page-card';
import { SiteShell } from '@/components/landing/public-v2';

const securityHighlights = [
  { value: 'Encrypted', label: 'Stored platform credentials' },
  { value: 'On request', label: 'Data export and deletion' },
];

const securityFeatures = [
  {
    icon: Lock,
    title: 'Encryption in transit and at rest',
    copy: 'Connections use HTTPS, and stored platform credentials are encrypted with authenticated encryption before they are saved.',
  },
  {
    icon: CheckCircle,
    title: 'Export and deletion on request',
    copy: 'You can request an export of your data or deletion of your account at any time through the contact page.',
  },
];

const dataProtectionPrinciples = [
  {
    icon: Database,
    title: 'Data Minimization',
    copy: 'We only collect data necessary to provide our services. No unnecessary tracking or profiling.',
  },
  {
    icon: Users,
    title: 'User Control',
    copy: 'You own your data. Request an export, correction or deletion of your information at any time.',
  },
  {
    icon: Eye,
    title: 'Transparent Processing',
    copy: 'Clear documentation of how we process, store, and use your data. No hidden practices.',
  },
  {
    icon: Lock,
    title: 'Secure Storage',
    copy: 'Data is held with our hosting and database providers, with backups and restricted access.',
  },
];

const infrastructureDetails = [
  {
    icon: Globe,
    title: 'Hosting Platform',
    provider: 'Vercel (AWS)',
    copy: 'Hosting and edge network',
  },
  {
    icon: Database,
    title: 'Database',
    provider: 'PostgreSQL (Supabase)',
    copy: 'Encrypted at rest, regular backups',
  },
  {
    icon: Key,
    title: 'Authentication',
    provider: 'JWT + OAuth 2.0',
    copy: 'bcrypt hashing, secure tokens',
  },
  {
    icon: Server,
    title: 'AI Processing',
    provider: 'OpenRouter API',
    copy: 'Encrypted API calls, no data retention',
  },
];

const authenticationFeatures = [
  'JWT tokens with secure httpOnly cookies',
  'OAuth 2.0 support (Google, GitHub, LinkedIn)',
  'Role-based access control (RBAC)',
  'Comprehensive audit logging for all actions',
  'Automatic session expiration and renewal',
  'Rate limiting and brute-force protection',
];

export const metadata = generateMetadata({
  title: 'Security',
  description:
    'How Synthex protects your data — encryption, access controls and security practices.',
  path: '/security',
  keywords: ['security', 'data security', 'encryption'],
});

export default function SecurityPage() {
  return (
    <SiteShell>
      <PublicPageFrame>
        <PublicPageHero
          eyebrow="Security"
          title={
            <>
              Your campaigns. Your approvals.{' '}
              <PublicGradientText>Your audit trail</PublicGradientText>.
            </>
          }
          description="Enterprise marketing software with explicit gates — no silent publishing, no exposed provider keys, no claims without evidence."
        >
          <Button asChild variant="glass-secondary" size="lg">
            <Link href="/contact">
              Contact security team
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </PublicPageHero>

        <PublicPageSection className="bg-sx-bg-primary" gradientVariant="mid">
          <PublicPageStatGrid stats={securityHighlights} />
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-secondary"
          eyebrow="Security"
          title="Security built into the operating model"
          description="Protection is not a bolt-on checkbox — it is part of how Synthex handles intake, planning, approval and production."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {securityFeatures.map((feature, index) => (
              <PublicPageCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                copy={feature.copy}
                index={index}
              />
            ))}
          </div>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-primary"
          gradientVariant="lower"
          eyebrow="Data protection"
          title="Privacy by design at every stage"
          description="We follow privacy-by-design principles to ensure your data is protected at every stage of collection, processing, and storage."
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {dataProtectionPrinciples.map((principle, index) => (
              <PublicPageCard
                key={principle.title}
                icon={principle.icon}
                title={principle.title}
                copy={principle.copy}
                index={index}
              />
            ))}
          </div>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-secondary"
          eyebrow="Infrastructure"
          title="Secure infrastructure stack"
          description="Built on established hosting and database platforms with layered security."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {infrastructureDetails.map(detail => (
              <article
                key={detail.title}
                className="min-w-0 rounded-card border border-white/[0.08] bg-sx-bg-elevated p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn border border-sx-accent/20 bg-sx-accent/[0.08]">
                    <detail.icon className="h-5 w-5 text-sx-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-sx-text-primary">
                      {detail.title}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-sx-accent">
                      {detail.provider}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-sx-text-muted">
                      {detail.copy}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-primary"
          gradientVariant="mid"
          eyebrow="Access control"
          title="Authentication and permissions"
          description="Multi-layered authentication designed to protect accounts while maintaining a clear operator experience."
        >
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="grid gap-3">
              {authenticationFeatures.map(feature => (
                <div
                  key={feature}
                  className="flex min-w-0 items-start gap-3 rounded-card border border-white/[0.08] bg-sx-bg-elevated px-4 py-3.5 text-sm text-sx-text-secondary"
                >
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-sx-accent" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <div className="relative overflow-hidden rounded-card border border-white/[0.08] bg-sx-bg-elevated p-10">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sx-accent/10 via-transparent to-sx-intelligence/10" />
              <Key className="relative mx-auto h-40 w-40 text-sx-accent/25" />
            </div>
          </div>
        </PublicPageSection>

        <PublicPageSection className="bg-sx-bg-primary" gradientVariant="cta">
          <div className="rounded-card border border-white/[0.08] bg-sx-bg-elevated p-8 md:p-10">
            <div className="mx-auto max-w-2xl text-center">
              <Mail className="mx-auto h-10 w-10 text-sx-accent" />
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-sx-text-primary text-balance md:text-5xl">
                Responsible disclosure
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-sx-text-secondary md:text-lg">
                If you discover a security vulnerability, please report it
                responsibly so we can protect our users.
              </p>
              <a
                href="mailto:security@synthex.social"
                className="mt-5 inline-block text-sm font-medium text-sx-accent hover:text-sx-accent-hover"
              >
                security@synthex.social
              </a>
              <p className="mt-6 rounded-card border border-sx-accent/20 bg-sx-accent/[0.06] px-4 py-3 text-xs leading-6 text-sx-text-secondary">
                <strong className="text-sx-text-primary">Bug bounty:</strong>{' '}
                Qualifying disclosures may be eligible for rewards depending on
                severity and impact.
              </p>
            </div>
          </div>
        </PublicPageSection>

        <PublicGovernanceStrip />
      </PublicPageFrame>
    </SiteShell>
  );
}
