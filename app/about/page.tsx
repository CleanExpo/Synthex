import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Lock,
  Search,
  Shield,
  Sparkles,
  Target,
  Users,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  PublicGovernanceStrip,
  PublicGradientText,
  PublicPageFrame,
  PublicPageHero,
  PublicPageSection,
} from '@/components/landing/premium';
import { PublicPageCard } from '@/components/landing/premium/public-page-card';
import { SiteShell } from '@/components/landing/public-v2';

export const metadata: Metadata = {
  title: 'About Synthex | Synthex',
  description:
    'Synthex is a controlled pilot marketing command center for turning business context, research and ideas into approval-gated campaign production.',
};

const identityCards = [
  {
    icon: BrainCircuit,
    title: 'Agency thinking',
    copy: 'Synthex is designed to behave like a senior marketing team: research first, then plan, then produce only what is approved.',
  },
  {
    icon: Search,
    title: 'Grounded decisions',
    copy: 'Business context, product notes, audience signals, search, social and prior outcomes are linked before recommendations are made.',
  },
  {
    icon: Shield,
    title: 'Controlled output',
    copy: 'Evidence, brand, consent, licensing, publishing and spend gates stay visible so production does not outrun approval.',
  },
];

const operatingPrinciples = [
  'Start with the business context, not a blank prompt.',
  'Keep every campaign step easy for a human to review.',
  'Use AI to compress research and production time, not remove accountability.',
  'Treat provider integrations as gated capabilities, not automatic publishing rights.',
];

const buildCards = [
  {
    icon: Target,
    title: 'What it plans',
    copy: 'Campaign angles, audiences, offers, lead magnets, email paths, website ideas, thumbnails, posts and video storyboards.',
  },
  {
    icon: Users,
    title: 'Who it serves',
    copy: 'Operators and business owners who need agency-grade support without turning every idea into a long manual process.',
  },
  {
    icon: Lock,
    title: 'What stays blocked',
    copy: 'Public publishing, client claims, paid media and provider spend stay blocked until the approval state is explicit.',
  },
];

export default function AboutPage() {
  return (
    <SiteShell>
      <PublicPageFrame>
        <PublicPageHero
          eyebrow="About Synthex"
          title={
            <>
              A marketing command center for{' '}
              <PublicGradientText>
                controlled campaign creation
              </PublicGradientText>
              .
            </>
          }
          description="Synthex turns rough business ideas into clear campaign cards, research packets and production-ready briefs. It is currently a controlled pilot product, not a public self-serve platform."
        />

        <PublicPageSection className="bg-sx-bg-primary" gradientVariant="mid">
          <div className="grid gap-6 rounded-card border border-white/[0.08] bg-sx-bg-elevated/80 p-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div>
              <Sparkles className="h-8 w-8 text-sx-accent" />
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-sx-text-primary text-balance md:text-5xl">
                Built for operators who need clarity before production.
              </h2>
            </div>
            <div>
              <p className="text-base leading-8 text-sx-text-secondary">
                The goal is simple: give business owners the feel of a capable
                marketing team while keeping decisions, approvals and risks easy
                to see.
              </p>
              <p className="mt-4 text-sm leading-7 text-sx-text-muted">
                Synthex is an internal-grade command center being proven through
                controlled pilots — evidence-backed planning, approval-gated
                execution and learning loops that compound over time.
              </p>
            </div>
          </div>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-secondary"
          eyebrow="Identity"
          title="How Synthex thinks about marketing work"
        >
          <div className="grid gap-4 md:grid-cols-3">
            {identityCards.map((item, index) => (
              <PublicPageCard key={item.title} {...item} index={index} />
            ))}
          </div>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-primary"
          gradientVariant="lower"
          eyebrow="Operating model"
          title="Less noise. More useful decisions."
        >
          <div className="grid gap-3 lg:max-w-3xl lg:ml-auto">
            {operatingPrinciples.map(principle => (
              <div
                key={principle}
                className="flex gap-3 rounded-card border border-white/[0.08] bg-sx-bg-elevated/80 p-4 text-sm leading-7 text-sx-text-secondary"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sx-success" />
                <span>{principle}</span>
              </div>
            ))}
          </div>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-secondary"
          eyebrow="Scope"
          title="What Synthex plans, serves and keeps gated"
        >
          <div className="grid gap-4 md:grid-cols-3">
            {buildCards.map((item, index) => (
              <PublicPageCard key={item.title} {...item} index={index} />
            ))}
          </div>
        </PublicPageSection>

        <PublicPageSection className="bg-sx-bg-primary">
          <div className="flex flex-col gap-5 rounded-card border border-white/[0.08] bg-sx-bg-elevated/80 p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
                Pilot access
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary text-balance md:text-5xl">
                Start with one campaign path.
              </h2>
            </div>
            <Button
              asChild
              variant="premium-primary"
              size="xl"
              className="shrink-0"
            >
              <Link href="/contact">
                Request access
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </PublicPageSection>

        <PublicGovernanceStrip />
      </PublicPageFrame>
    </SiteShell>
  );
}
