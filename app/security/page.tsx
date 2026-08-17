import { generateMetadata } from '@/lib/seo/metadata';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  CheckCircle,
  CheckCircle2,
  Database,
  Eye,
  Globe,
  Key,
  Lock,
  Mail,
  Server,
  Shield,
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
  { value: 'SOC 2 Type II', label: 'Certified' },
  { value: '256-bit', label: 'Encryption' },
  { value: '99.99%', label: 'Uptime SLA' },
  { value: 'GDPR', label: 'Compliant' },
];

const securityFeatures = [
  {
    icon: Lock,
    title: 'End-to-End Encryption',
    copy: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256) to ensure your content and credentials remain secure.',
  },
  {
    icon: Shield,
    title: 'SOC 2 Type II Compliance',
    copy: 'Our infrastructure and processes undergo regular third-party audits to meet the highest security standards.',
  },
  {
    icon: CheckCircle,
    title: 'GDPR & Privacy Compliant',
    copy: 'Full compliance with GDPR, CCPA, and international data protection regulations. Your data, your rights.',
  },
  {
    icon: Server,
    title: '99.99% Uptime Guarantee',
    copy: 'Enterprise-grade infrastructure with redundancy, failover, and 24/7 monitoring to keep your marketing running.',
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
    copy: 'You own your data. Export, delete, or modify your information at any time through your account settings.',
  },
  {
    icon: Eye,
    title: 'Transparent Processing',
    copy: 'Clear documentation of how we process, store, and use your data. No hidden practices.',
  },
  {
    icon: Lock,
    title: 'Secure Storage',
    copy: 'Data stored in SOC 2 certified data centres with encrypted backups and strict access controls.',
  },
];

const infrastructureDetails = [
  {
    icon: Globe,
    title: 'Hosting Platform',
    provider: 'Vercel (AWS)',
    copy: 'SOC 2, ISO 27001, PCI DSS',
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
  'Multi-factor authentication (MFA) available',
  'Comprehensive audit logging for all actions',
  'Automatic session expiration and renewal',
  'IP-based anomaly detection',
  'Rate limiting and brute-force protection',
];

const certifications = [
  {
    icon: Award,
    name: 'SOC 2 Type II',
    description: 'Service Organization Control',
    status: 'Certified',
  },
  {
    icon: Shield,
    name: 'GDPR',
    description: 'General Data Protection Regulation',
    status: 'Compliant',
  },
  {
    icon: CheckCircle2,
    name: 'CCPA',
    description: 'California Consumer Privacy Act',
    status: 'Compliant',
  },
  {
    icon: Award,
    name: 'ISO 27001',
    description: 'Information Security Management',
    status: 'In Progress',
  },
];

export const metadata = generateMetadata({
  title: 'Security',
  description:
    'How Synthex protects your data — encryption, access controls, compliance, and security practices.',
  path: '/security',
  keywords: ['security', 'data security', 'encryption', 'compliance', 'SOC 2'],
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
          eyebrow="Enterprise-grade"
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
          description="Built on industry-leading platforms with multiple layers of security and redundancy."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {infrastructureDetails.map(detail => (
              <article
                key={detail.title}
                className="min-w-0 rounded-2xl border border-white/[0.08] bg-sx-bg-elevated p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn border border-sx-accent/20 bg-sx-accent/[0.08]">
                    <detail.icon className="h-5 w-5 text-sx-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-sx-text-primary">
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
                  className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/[0.08] bg-sx-bg-elevated px-4 py-3.5 text-sm text-sx-text-secondary"
                >
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-sx-accent" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-sx-bg-elevated p-10">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sx-accent/10 via-transparent to-sx-intelligence/10" />
              <Key className="relative mx-auto h-40 w-40 text-sx-accent/25" />
            </div>
          </div>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-secondary"
          eyebrow="Compliance"
          title="Certifications and standards"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {certifications.map(cert => (
              <article
                key={cert.name}
                className="h-full min-w-0 rounded-2xl border border-white/[0.08] bg-sx-bg-elevated p-6 text-center"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-sx-accent/20 bg-sx-accent/[0.08]">
                  <cert.icon className="h-7 w-7 text-sx-accent" />
                </div>
                <h3 className="text-lg font-semibold text-sx-text-primary">
                  {cert.name}
                </h3>
                <p className="mt-1 text-sm text-sx-text-muted">
                  {cert.description}
                </p>
                <span className="mt-4 inline-flex rounded-full border border-sx-accent/20 bg-sx-accent/[0.08] px-3 py-1 text-xs font-medium text-sx-accent">
                  {cert.status}
                </span>
              </article>
            ))}
          </div>
        </PublicPageSection>

        <PublicPageSection className="bg-sx-bg-primary" gradientVariant="cta">
          <div className="rounded-2xl border border-white/[0.08] bg-sx-bg-elevated p-8 md:p-10">
            <div className="mx-auto max-w-2xl text-center">
              <Mail className="mx-auto h-10 w-10 text-sx-accent" />
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-sx-text-primary">
                Responsible disclosure
              </h2>
              <p className="mt-4 text-sm leading-7 text-sx-text-secondary">
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
