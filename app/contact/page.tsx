import { generateMetadata } from '@/lib/seo/metadata';
import {
  Clock,
  Mail,
  MessageCircle,
  Shield,
  Sparkles,
} from '@/components/icons';
import {
  PublicGovernanceStrip,
  PublicGradientText,
  PublicPageCtaBand,
  PublicPageFrame,
  PublicPageHero,
  PublicPageSection,
} from '@/components/landing/premium';
import { PublicPageCard } from '@/components/landing/premium/public-page-card';
import { SiteShell } from '@/components/landing/public-v2';
import { ContactForm } from './ContactForm';

export const metadata = generateMetadata({
  title: 'Contact | Synthex',
  description:
    'Request pilot access, share a campaign idea or ask a question. Synthex returns a controlled planning path before anything is produced.',
  path: '/contact',
  keywords: [
    'contact Synthex',
    'pilot access',
    'campaign planning',
    'marketing command center',
  ],
});

const requestCards = [
  {
    icon: MessageCircle,
    title: 'Pilot access',
    copy: 'Use this when you want Synthex to plan the first campaign path for your business.',
  },
  {
    icon: Sparkles,
    title: 'Campaign idea',
    copy: 'Send the rough idea, offer, audience and channels. We will turn it into clear campaign cards.',
  },
  {
    icon: Shield,
    title: 'Approval gates',
    copy: 'Production, publishing and ad spend stay controlled until the right checks are complete.',
  },
];

export default function ContactPage() {
  return (
    <SiteShell>
      <PublicPageFrame>
        <PublicPageHero
          eyebrow="Request access"
          title={
            <>
              Send the idea. Get the{' '}
              <PublicGradientText>next clear step</PublicGradientText>.
            </>
          }
          description="Use one form for pilot access, campaign planning or a direct question. Synthex starts with the business context and returns a controlled path before anything is produced."
        />

        <PublicPageSection
          className="bg-sx-bg-primary"
          gradientVariant="mid"
          contained={false}
        >
          <div className="mx-auto grid max-w-container gap-10 px-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div className="min-w-0 space-y-6 lg:sticky lg:top-28">
              <div className="rounded-card border border-white/[0.08] bg-sx-bg-elevated p-6">
                <h2 className="text-xl font-semibold text-sx-text-primary">
                  What to include
                </h2>
                <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
                  Business context, offer, audience, channels and the decision
                  you need help with. The more specific the intake, the faster
                  we can return a useful campaign path.
                </p>
              </div>
              <div className="space-y-3">
                <a
                  href="mailto:support@synthex.social"
                  className="flex items-center gap-3 text-sm text-sx-text-secondary transition-colors hover:text-sx-text-primary"
                >
                  <Mail className="h-4 w-4 text-sx-accent" />
                  support@synthex.social
                </a>
                <p className="flex items-center gap-3 text-sm text-sx-text-muted">
                  <Clock className="h-4 w-4 text-sx-accent" />
                  Response target: one business day
                </p>
              </div>
            </div>
            <div className="min-w-0">
              <ContactForm />
            </div>
          </div>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-secondary"
          eyebrow="How we respond"
          title="One intake path. Three common requests."
        >
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
            {requestCards.map((item, index) => (
              <PublicPageCard key={item.title} {...item} index={index} />
            ))}
          </div>
        </PublicPageSection>

        <PublicPageCtaBand
          eyebrow="Not ready to request access?"
          title="Review the pilot path first."
          href="/pricing"
          label="View pilot access"
        />

        <PublicGovernanceStrip />
      </PublicPageFrame>
    </SiteShell>
  );
}
