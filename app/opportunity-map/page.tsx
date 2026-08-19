import type { Metadata } from 'next';
import { SiteShell } from '@/components/landing/public-v2';
import { PageAmbient } from '@/components/landing/premium';
import { OpportunityMapExperience } from '@/components/opportunity-map/OpportunityMapExperience';
import { generateMetadata as buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Free Marketing Opportunity Map',
  description:
    'Turn your website, social links and rough context into three evidence-backed growth directions and one clear next move. No login. No auto-publish.',
  path: '/opportunity-map',
  keywords: [
    'marketing opportunity map',
    'free marketing audit',
    'evidence-backed campaign planning',
  ],
});

export default function OpportunityMapPage() {
  return (
    <SiteShell>
      <PageAmbient />
      <div className="relative">
        <OpportunityMapExperience />
      </div>
    </SiteShell>
  );
}
