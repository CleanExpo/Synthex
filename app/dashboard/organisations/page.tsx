'use client';

/**
 * Multi-Client Console — Consolidated Child-Organisation View (Item #4)
 *
 * @description Read-only console listing the caller-org's child (sub-account)
 * organisations via Organization.parentOrgId. Org-scoped: the data comes from
 * `GET /api/organisations/children`, which resolves the parent from the
 * authenticated session — a caller only ever sees children of their OWN org.
 *
 * Distinct from /dashboard/businesses (BusinessOwnership model) and
 * /dashboard/clients (the Supabase agency-client list, #471).
 */

import { useApi } from '@/hooks/use-api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Globe,
  Users,
  Megaphone,
  Link2,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from '@/components/icons';

interface ChildOrgStats {
  campaigns: number;
  platformConnections: number;
  teamSize: number;
}

interface ChildOrg {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  website: string | null;
  logo: string | null;
  industry: string | null;
  status: string;
  plan: string;
  stats: ChildOrgStats;
}

interface ChildrenResponse {
  children: ChildOrg[];
}

function statusTone(status: string): string {
  switch (status) {
    case 'active':
      return 'text-emerald-300 border-emerald-500/20';
    case 'suspended':
      return 'text-red-300 border-red-500/20';
    case 'pending':
      return 'text-amber-300 border-amber-500/20';
    default:
      return 'text-white/50 border-white/[0.06]';
  }
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-white/50">
      <Icon className="w-3.5 h-3.5 text-white/30" />
      <span className="font-mono tabular-nums text-white/70">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function ChildOrgCard({ org }: { org: ChildOrg }) {
  return (
    <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-sm bg-orange-500/10 border-[0.5px] border-orange-500/20 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-orange-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-light text-white truncate">{org.name}</p>
            <p className="text-xs text-white/40 truncate">
              {org.industry || org.slug}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={statusTone(org.status)}>
          {org.status}
        </Badge>
      </div>

      {org.description && (
        <p className="text-xs text-white/50 line-clamp-2 mb-3">
          {org.description}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatItem icon={Megaphone} label="campaigns" value={org.stats.campaigns} />
        <StatItem icon={Link2} label="connected" value={org.stats.platformConnections} />
        <StatItem icon={Users} label="team" value={org.stats.teamSize} />
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
        <span className="text-xs uppercase tracking-[0.2em] text-white/30">
          {org.plan}
        </span>
        {org.website && (
          <a
            href={org.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70"
          >
            <Globe className="w-3.5 h-3.5" />
            Website
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 h-[180px]"
        >
          <div className="h-9 w-9 bg-white/[0.05] rounded-sm mb-3" />
          <div className="h-3 w-3/4 bg-white/[0.05] rounded-sm mb-2" />
          <div className="h-3 w-1/2 bg-white/[0.05] rounded-sm" />
        </div>
      ))}
    </div>
  );
}

export default function OrganisationsConsolePage() {
  const { data, isLoading, error, refetch } =
    useApi<ChildrenResponse>('/api/organisations/children');

  const children = data?.children ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          eyebrow="Workspace"
          title="Organisations"
          description="A consolidated view of every sub-account in your workspace"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
          className="border-white/10"
          aria-label="Refresh organisations"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="border-[0.5px] border-red-500/20 bg-red-500/[0.05] rounded-sm p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <h3 className="text-base font-light text-white">
                Failed to load organisations
              </h3>
              <p className="text-red-400">{error.message}</p>
            </div>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="mt-4 border-white/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      ) : children.length === 0 ? (
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-10 text-center">
          <Building2 className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/60">No sub-accounts yet</p>
          <p className="text-xs text-white/40 mt-2 max-w-md mx-auto">
            Child organisations linked to your workspace appear here. Once a
            sub-account is created under your organisation, you&apos;ll see its
            campaigns, connections, and team at a glance.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map(org => (
            <ChildOrgCard key={org.id} org={org} />
          ))}
        </div>
      )}
    </div>
  );
}
