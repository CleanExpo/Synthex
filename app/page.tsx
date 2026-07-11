import type { Metadata } from 'next';
import { SiteShell } from '@/components/landing/public-v2';
import {
  EnterpriseFeatures,
  FeatureBento,
  FinalCta,
  HeroSection,
  LandingFaq,
  LandingPageAmbient,
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
        <LandingPageAmbient />
        <div className="relative">
          <HeroSection />
          <TrustStrip />
          <WorkflowTimeline />
          <FeatureBento />
          <ProductWalkthrough />
          <EnterpriseFeatures />
          <SocialProof />
          <SecurityConfidence />
          <LandingFaq />
          <FinalCta />
        </div>
      </SiteShell>
    </>
  );
}
