import type { Metadata } from 'next';
import { SiteShell } from '@/components/landing/public-v2';
import { OpportunityMapExperience } from '@/components/opportunity-map/OpportunityMapExperience';

export const metadata: Metadata = {
  title: 'Free Synthex Marketing Opportunity Map',
  description:
    'Turn your website, social links and rough context into three evidence-backed growth directions and one clear next move.',
  alternates: { canonical: '/opportunity-map' },
  openGraph: {
    title: 'Free Synthex Marketing Opportunity Map',
    description:
      'See the evidence, assumptions and three ranked growth directions before deciding what to build.',
    url: '/opportunity-map',
    type: 'website',
  },
};

export default function OpportunityMapPage() {
  return (
    <SiteShell>
      <OpportunityMapExperience />
    </SiteShell>
  );
}
