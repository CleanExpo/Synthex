import { generateMetadata } from '@/lib/seo/metadata';
import { Database, Eye, Lock, Shield } from '@/components/icons';
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
    title: 'Information we collect',
    icon: Database,
    copy: 'Only what the command center needs to operate a named organisation.',
    points: [
      'Account details (name, email, organisation)',
      'Connected platform tokens when an operator authorises them',
      'Content, briefs and evidence uploaded in the workspace',
      'Usage logs needed for audit and support',
    ],
  },
  {
    title: 'How we use it',
    icon: Eye,
    copy: 'Data stays inside the operating loop: plan, approve, produce, learn.',
    points: [
      'Provide the workspace and approval trail',
      'Ground campaign work in the organisation’s evidence',
      'Send service notices, not marketing blasts',
      'Investigate incidents and prevent abuse',
    ],
  },
  {
    title: 'How it is protected',
    icon: Lock,
    copy: 'Access is org-scoped. Provider keys never sit in the product UI.',
    points: [
      'Encryption in transit and at rest',
      'Role-based access inside the organisation',
      'Audit logging of sensitive actions',
      'Least-privilege staff access for support',
    ],
  },
  {
    title: 'Your rights',
    icon: Shield,
    copy: 'Operators can ask us to access, correct or delete personal information.',
    points: [
      'Access and correction',
      'Deletion of account data, subject to legal hold',
      'Export of workspace records where available',
      'Complaint to the OAIC if we cannot resolve it',
    ],
  },
];

export const metadata = generateMetadata({
  title: 'Privacy Policy',
  description:
    'How Synthex collects, uses and protects personal information for the internal marketing command center.',
  path: '/privacy',
  keywords: ['privacy policy', 'data protection', 'Australian privacy law'],
});

export default function PrivacyPage() {
  return (
    <SiteShell>
      <PublicPageFrame>
        <PublicPageHero
          eyebrow="Legal"
          title={
            <>
              Privacy that matches the{' '}
              <PublicGradientText>approval spine</PublicGradientText>.
            </>
          }
          description="Synthex is Unite Group’s internal marketing command center. We collect what operators need to plan and approve work — not a public advertising profile."
        >
          <p className="text-sm text-sx-text-muted">Last updated: March 2026</p>
        </PublicPageHero>

        <PublicPageSection
          className="bg-sx-bg-primary"
          gradientVariant="mid"
          eyebrow="Commitments"
          title="What we will not do"
        >
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              'We do not sell personal information.',
              'We do not claim ownership of your content.',
              'We do not expose provider keys in the product UI.',
              'We do not publish or spend without a named reviewer.',
            ].map(item => (
              <li
                key={item}
                className="min-w-0 rounded-card border border-white/[0.08] bg-sx-bg-elevated px-5 py-4 text-sm leading-7 text-sx-text-secondary"
              >
                {item}
              </li>
            ))}
          </ul>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-secondary"
          eyebrow="Policy"
          title="How information moves through Synthex"
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
          title="Cookies, processors and retention"
        >
          <div className="space-y-6 rounded-card border border-white/[0.08] bg-sx-bg-elevated/80 p-8">
            <div>
              <h3 className="text-xl font-semibold text-sx-text-primary">
                Cookies and session
              </h3>
              <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
                Essential cookies keep the signed-in session. Analytics, if
                enabled for an organisation, are used to improve the product —
                not to sell ads.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-sx-text-primary">
                Processors
              </h3>
              <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
                Hosting, database and model providers process data to run the
                workspace. They are engaged as processors, not as a licence to
                train on client content for unrelated products.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-sx-text-primary">
                Retention
              </h3>
              <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
                Workspace data stays while the organisation is active. After
                deletion we may keep a short legal hold, then remove it.
              </p>
            </div>
            <p className="text-sm text-sx-text-muted">
              Synthex Pty Ltd · ABN 62 580 077 456 · Brisbane, QLD, Australia
            </p>
          </div>
        </PublicPageSection>

        <PublicPageCtaBand
          eyebrow="Privacy contact"
          title="Questions about personal information go to the same named team."
          description="Email privacy@synthex.social or write to us from the contact page."
          href="/contact"
          label="Contact Synthex"
        />
      </PublicPageFrame>
    </SiteShell>
  );
}
