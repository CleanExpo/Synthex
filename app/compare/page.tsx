import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from '@/components/icons';
import {
  PublicPageFrame,
  PublicPageHero,
  PublicPageSection,
} from '@/components/landing/premium';
import { PublicPageCard } from '@/components/landing/premium/public-page-card';
import { SiteShell } from '@/components/landing/public-v2';
import { RouteIdentity } from '@/components/system/RouteIdentity';
import { generateMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = generateMetadata({
  title: 'Compare Synthex',
  description:
    'Side-by-side comparisons of Synthex with other social media and marketing tools.',
  path: '/compare',
});

// One entry per page under app/compare/. This index only names each
// comparison; the comparison itself lives on its own page.
const comparisons = [
  {
    href: '/compare/hootsuite',
    title: 'Synthex vs Hootsuite',
    copy: 'What Synthex does, for teams considering Hootsuite.',
  },
];

export default function CompareIndexPage() {
  return (
    <SiteShell>
      <RouteIdentity route="/compare" />
      <PublicPageFrame>
        <PublicPageHero
          eyebrow="Compare"
          title="Compare Synthex"
          description="How Synthex compares with other social media and marketing tools."
        />

        <PublicPageSection className="bg-sx-bg-primary" gradientVariant="mid">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {comparisons.map(item => (
              <Link key={item.href} href={item.href} className="group block">
                <PublicPageCard
                  icon={Search}
                  eyebrow="Comparison"
                  title={item.title}
                  copy={item.copy}
                  className="transition-colors group-hover:border-sx-accent/40"
                />
              </Link>
            ))}
          </div>
        </PublicPageSection>
      </PublicPageFrame>
    </SiteShell>
  );
}
