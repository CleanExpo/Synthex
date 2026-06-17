'use client';

/**
 * Clients Console — backlog #3 (CRM unification, A1).
 *
 * Surfaces the EXISTING org-scoped client store (`GET /api/clients`, backed by
 * ClientManagementService) which had no dashboard page. List + inline detail;
 * reuses the existing route (no new API — that already exists). Org-scoping is
 * handled by `useApi` keying on the active org. Spec: spec-crm-unification-003.md.
 */

import { useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type ClientStatus = 'active' | 'paused' | 'archived';

interface ClientListItem {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  industry?: string;
  timezone: string;
  status: ClientStatus;
  brandGuidelines?: {
    primaryColor?: string;
    voiceTone?: string;
    keywords?: string[];
  };
  settings?: {
    approvalRequired?: boolean;
    autoPublish?: boolean;
    defaultPlatforms?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

interface ClientsResponse {
  clients: ClientListItem[];
  total: number;
}

const STATUS_STYLES: Record<ClientStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function ClientsPage() {
  const { data, isLoading, error } = useApi<ClientsResponse>('/api/clients');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const clients = data?.clients ?? [];
  const selected = clients.find(c => c.id === selectedId) ?? clients[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Clients"
        description="Your organisation's client workspaces."
      />

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-600">
            Couldn&apos;t load clients. {error.message}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && clients.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-light text-slate-500">
              No clients yet. Client workspaces will appear here once created.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && clients.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* List */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {data?.total ?? clients.length} client
              {(data?.total ?? clients.length) === 1 ? '' : 's'}
            </p>
            {clients.map(client => {
              const isActive = selected?.id === client.id;
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setSelectedId(client.id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    isActive
                      ? 'border-slate-300 bg-slate-50'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-light text-slate-900">
                      {client.name}
                    </span>
                    <Badge
                      variant="outline"
                      className={STATUS_STYLES[client.status]}
                    >
                      {client.status}
                    </Badge>
                  </div>
                  {(client.domain || client.industry) && (
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {[client.industry, client.domain]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail */}
          {selected && (
            <Card>
              <CardContent className="space-y-5 py-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extralight text-slate-900">
                      {selected.name}
                    </h2>
                    <p className="text-xs text-slate-400">{selected.slug}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={STATUS_STYLES[selected.status]}
                  >
                    {selected.status}
                  </Badge>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Field label="Industry" value={selected.industry} />
                  <Field label="Domain" value={selected.domain} />
                  <Field label="Timezone" value={selected.timezone} />
                  <Field
                    label="Brand voice"
                    value={selected.brandGuidelines?.voiceTone}
                  />
                  <Field
                    label="Approval required"
                    value={
                      selected.settings?.approvalRequired === undefined
                        ? undefined
                        : selected.settings.approvalRequired
                          ? 'Yes'
                          : 'No'
                    }
                  />
                  <Field
                    label="Default platforms"
                    value={selected.settings?.defaultPlatforms?.join(', ')}
                  />
                </dl>

                <ClientCrmPanel clientId={selected.id} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 font-light text-slate-700">{value ?? '—'}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CRM rollup (backlog #3) — the read-only unified footprint for one client,
// from GET /api/clients/[clientId]/crm. The endpoint org-scopes every primitive,
// so this only ever shows the caller-org's contacts/leads/health/engagement/
// deliverables for the selected client.
// ---------------------------------------------------------------------------

interface CrmContact {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
}
interface CrmLead {
  id: string;
  stage: string;
  source: string | null;
}
interface CrmHealthScore {
  overallScore: number;
  riskLevel: string;
}
interface CrmEngagement {
  id: string;
  eventType: string;
}
interface CrmDeliverable {
  id: string;
  title: string;
  type: string;
  status: string;
}
interface CrmRollup {
  clientId: string;
  contacts: CrmContact[];
  leads: CrmLead[];
  healthScore: CrmHealthScore | null;
  recentEngagement: CrmEngagement[];
  deliverables: CrmDeliverable[];
}

const RISK_STYLES: Record<string, string> = {
  healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  at_risk: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

function ClientCrmPanel({ clientId }: { clientId: string }) {
  const { data, isLoading, error } = useApi<CrmRollup>(
    `/api/clients/${clientId}/crm`
  );

  if (isLoading) {
    return (
      <div className="h-24 animate-pulse rounded-lg border border-slate-100 bg-slate-50" />
    );
  }
  if (error) {
    return (
      <p className="text-xs text-red-600">
        Couldn&apos;t load CRM data. {error.message}
      </p>
    );
  }
  if (!data) return null;

  const { contacts, leads, healthScore, recentEngagement, deliverables } = data;

  return (
    <div className="space-y-4 border-t border-slate-100 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          CRM rollup
        </h3>
        {healthScore && (
          <Badge
            variant="outline"
            className={
              RISK_STYLES[healthScore.riskLevel] ??
              'bg-slate-100 text-slate-600 border-slate-200'
            }
          >
            Health {healthScore.overallScore} · {healthScore.riskLevel}
          </Badge>
        )}
      </div>

      <CrmSection
        label="Contacts"
        count={contacts.length}
        items={contacts.map(c => ({
          id: c.id,
          primary: c.name,
          secondary: [c.role, c.email].filter(Boolean).join(' · ') || undefined,
        }))}
      />
      <CrmSection
        label="Leads"
        count={leads.length}
        items={leads.map(l => ({
          id: l.id,
          primary: l.stage,
          secondary: l.source ?? undefined,
        }))}
      />
      <CrmSection
        label="Deliverables"
        count={deliverables.length}
        items={deliverables.map(d => ({
          id: d.id,
          primary: d.title,
          secondary:
            [d.type, d.status].filter(Boolean).join(' · ') || undefined,
        }))}
      />
      <CrmSection
        label="Recent engagement"
        count={recentEngagement.length}
        items={recentEngagement.map(e => ({
          id: e.id,
          primary: e.eventType,
        }))}
      />
    </div>
  );
}

function CrmSection({
  label,
  count,
  items,
}: {
  label: string;
  count: number;
  items: { id: string; primary: string; secondary?: string }[];
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">
        {label} ({count})
      </p>
      {count === 0 ? (
        <p className="mt-1 text-sm font-light text-slate-400">None yet</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.slice(0, 5).map(item => (
            <li key={item.id} className="text-sm font-light text-slate-700">
              {item.primary}
              {item.secondary && (
                <span className="text-slate-400"> — {item.secondary}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
