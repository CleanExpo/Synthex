import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SiteShell } from '@/components/landing/public-v2';
import {
  EnterpriseFeatures,
  FeatureBento,
  FinalCta,
  HeroProductMock,
  LandingFaq,
  ProductWalkthrough,
  SecurityConfidence,
  SocialProof,
  TrustStrip,
  WorkflowTimeline,
} from '@/components/landing/premium';
import { HomeStructuredData } from '@/components/seo/StructuredData';
import { generateMetadata as buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Synthex | AI Marketing Operating System',
  description:
    'Turn voice notes and meetings into evidence-backed campaign plans, creative assets and approval-ready workflows. The marketing command center for agencies and in-house teams.',
  path: '/',
  keywords: [
    'AI Marketing Platform',
    'AI Marketing Operating System',
    'Marketing Workflow Automation',
    'Marketing Approval Software',
    'Campaign Planning Software',
    'Marketing Command Center',
    'Agency Marketing Platform',
    'Campaign Approval Workflow',
    'Enterprise Marketing Software',
    'Content Operations Platform',
  ],
});

export default function SynthexHomePage() {
  return (
    <>
      <HomeStructuredData />
      <SiteShell>
        <section
          className="relative overflow-hidden pt-28"
          style={{ background: 'var(--sx-gradient-hero)' }}
          aria-labelledby="hero-heading"
        >
          <div
            className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:56px_56px]"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-container gap-9 px-5 pb-16 pt-10 lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-12 lg:pt-14">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-btn border border-sx-accent/25 bg-sx-accent/[0.08] px-3 py-2 text-xs uppercase tracking-[0.22em] text-sx-accent">
                Controlled pilot · evidence-backed
              </div>
              <h1
                id="hero-heading"
                className="max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight text-sx-text-primary sm:text-5xl md:text-6xl lg:text-7xl"
              >
                Marketing plans that teams actually approve.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-sx-text-secondary md:text-lg md:leading-8">
                Capture voice notes, meetings and ideas. Synthex transforms them
                into evidence-backed campaign plans, creative assets and
                approval-ready workflows — the AI marketing workspace for
                operators who need clarity before production.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row md:mt-9">
                <Button asChild variant="premium-primary" size="xl">
                  <Link href="/contact">
                    Request pilot access
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="glass-secondary" size="xl">
                  <Link href="/features">Explore the platform</Link>
                </Button>
              </div>
            </div>
            <HeroProductMock />
          </div>
        </section>

        <TrustStrip />
        <WorkflowTimeline />
        <FeatureBento />
        <ProductWalkthrough />
        <EnterpriseFeatures />
        <SocialProof />
        <SecurityConfidence />
        <LandingFaq />
        <FinalCta />
      </SiteShell>
    </>
  );
}
