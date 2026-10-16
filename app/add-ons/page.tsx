import type { Metadata } from 'next';
import Link from 'next/link';
import { Layers } from '@/components/icons';
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
  title: 'Add-ons',
  description:
    'Services that extend Synthex, each scoped with you before any work starts.',
  path: '/add-ons',
});

// One entry per page under app/add-ons/. Scope and pricing live on each
// add-on's own page; this index only names it.
const addOns = [
  {
    href: '/add-ons/mcp-app-development',
    title: 'MCP App Development',
    copy: 'Build and operate your business as an MCP App inside Claude and ChatGPT.',
  },
];

export default function AddOnsIndexPage() {
  return (
    <SiteShell>
      <RouteIdentity route="/add-ons" />
      <PublicPageFrame>
        <PublicPageHero
          eyebrow="Add-ons"
          title="Synthex add-ons"
          description="Services that extend Synthex, each scoped with you before any work starts."
        />

        <PublicPageSection className="bg-sx-bg-primary" gradientVariant="mid">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {addOns.map(item => (
              <Link key={item.href} href={item.href} className="group block">
                <PublicPageCard
                  icon={Layers}
                  eyebrow="Add-on"
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
