import type { Metadata } from 'next';
import { SiteShell } from '@/components/landing/public-v2';
import {
  AudienceLanes,
  EnterpriseFeatures,
  FeatureBento,
  FinalCta,
  HeroSection,
  LandingFaq,
  PageAmbient,
  OperatorProblem,
  ProductWalkthrough,
  SecurityConfidence,
  SocialProof,
  TrustStrip,
  WorkflowTimeline,
} from '@/components/landing/premium';
import { HomeStructuredData } from '@/components/seo/StructuredData';
import { generateMetadata as buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Free Marketing Opportunity Map',
  description:
    'Turn your website and public evidence into three ranked growth directions. No login. No auto-publish. Start with a free Synthex Opportunity Map.',
  path: '/',
  keywords: [
    'marketing opportunity map',
    'evidence-backed campaign planning',
    'marketing approval software',
    'AI marketing operating system',
    'campaign planning software',
  ],
});

export default function SynthexHomePage() {
  return (
    <>
      <HomeStructuredData />
      <SiteShell>
        <PageAmbient />
        <div className="relative">
          <HeroSection />
          <TrustStrip />
          <OperatorProblem />
          <AudienceLanes />
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
