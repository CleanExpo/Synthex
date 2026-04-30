/**
 * Unite-Group Workspace Dashboard — SYN-847
 *
 * Master signin sees all Unite-Group Nexus brands as cards.
 * Click a card → switch active org and enter that brand's dashboard.
 *
 * AUTH: requires authenticated user who is either:
 *   - a member of the `unite-group` parent org (sees all children = master admin)
 *   - a member of one or more child brand orgs (sees only those children)
 *
 * Server component — fetches workspace via internal API. SWR client-side
 * refresh available via the BrandGrid client component if children data
 * needs live updates.
 *
 * @module app/unite-group/page
 */

import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Server-side data fetch ─────────────────────────────────────────────────

interface ChildBrand {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  website: string | null;
  logo: string | null;
  industry: string | null;
  status: string;
  domain: string | null;
  stats: {
    campaigns: number;
    platformConnections: number;
    teamSize: number;
  };
}

interface WorkspaceResponse {
  parent: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    website: string | null;
    logo: string | null;
    status: string;
    domain: string | null;
    isMasterAdmin: boolean;
  };
  children: ChildBrand[];
}

async function fetchWorkspace(): Promise<WorkspaceResponse | null> {
  const hdrs = await headers();
  const host = hdrs.get('host') ?? 'synthex.social';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const cookie = hdrs.get('cookie') ?? '';

  const res = await fetch(`${protocol}://${host}/api/workspaces/unite-group`, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (res.status === 401) return null; // unauthenticated
  if (res.status === 403) return null; // not a workspace member
  if (!res.ok) {
    console.error('[unite-group] workspace fetch failed', res.status);
    return null;
  }

  return res.json() as Promise<WorkspaceResponse>;
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function UniteGroupPage() {
  const data = await fetchWorkspace();

  if (!data) {
    // Not authenticated or not a workspace member — redirect to login
    redirect('/login?next=/unite-group');
  }

  const { parent, children } = data;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Header */}
        <header className="mb-12 border-b border-zinc-800 pb-8">
          <div className="flex items-baseline justify-between">
            <h1 className="text-4xl font-bold tracking-tight">{parent.name}</h1>
            {parent.isMasterAdmin && (
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                Master admin
              </span>
            )}
          </div>
          {parent.description && (
            <p className="mt-3 max-w-2xl text-zinc-400">{parent.description}</p>
          )}
          <p className="mt-2 text-sm text-zinc-500">
            {children.length} brand{children.length === 1 ? '' : 's'} under this
            workspace
          </p>
        </header>

        {/* Brand grid */}
        {children.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-zinc-400">
              No brand tenants yet. Run{' '}
              <code className="rounded bg-zinc-800 px-2 py-1 text-zinc-300">
                npx tsx scripts/seed-unite-group-workspace.ts
              </code>{' '}
              to seed the portfolio.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {children.map(brand => (
              <BrandCard key={brand.id} brand={brand} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Brand card ─────────────────────────────────────────────────────────────

function BrandCard({ brand }: { brand: ChildBrand }) {
  const statusColour =
    brand.status === 'active'
      ? 'text-emerald-400'
      : brand.status === 'suspended'
        ? 'text-amber-400'
        : 'text-zinc-500';

  return (
    <Card className="border-zinc-800 bg-zinc-900 transition hover:border-zinc-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-zinc-100">{brand.name}</CardTitle>
          <span className={`text-xs font-medium ${statusColour}`}>
            {brand.status}
          </span>
        </div>
        {brand.industry && (
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            {brand.industry.replace(/-/g, ' ')}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {brand.description && (
          <p className="line-clamp-3 text-sm text-zinc-400">
            {brand.description}
          </p>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3 text-center">
          <div>
            <div className="text-lg font-semibold text-zinc-100">
              {brand.stats.campaigns}
            </div>
            <div className="text-xs text-zinc-500">campaigns</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-100">
              {brand.stats.platformConnections}
            </div>
            <div className="text-xs text-zinc-500">channels</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-100">
              {brand.stats.teamSize}
            </div>
            <div className="text-xs text-zinc-500">team</div>
          </div>
        </div>

        {/* Action */}
        <div className="flex gap-2 pt-2">
          <Link href={`/dashboard?org=${brand.slug}`} className="flex-1">
            <Button className="w-full" variant="default">
              Open
            </Button>
          </Link>
          {brand.website && (
            <a
              href={brand.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex"
            >
              <Button variant="outline" size="icon" aria-label="Visit website">
                ↗
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
