'use client';

/**
 * Brand Builder Dashboard (Phase 91)
 *
 * Four tabs:
 * - Identity — create/edit brand profile + entity graph
 * - Consistency — platform consistency matrix + Wikidata + KG
 * - Mentions — chronological mention feed
 * - Calendar — 90-day publishing schedule
 *
 * @module app/dashboard/brand/page
 */

import { useState, useCallback , Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Building2, Plus, AlertCircle, Loader2 } from '@/components/icons';
import { BrandIdentityCard } from '@/components/brand/BrandIdentityCard';
import { ConsistencyAuditPanel } from '@/components/brand/ConsistencyAuditPanel';
import { BrandMentionsFeed } from '@/components/brand/BrandMentionsFeed';
import { WikidataStatusCard } from '@/components/brand/WikidataStatusCard';
import { KnowledgePanelStatus } from '@/components/brand/KnowledgePanelStatus';
import { BrandCalendarView } from '@/components/brand/BrandCalendarView';
import { cn } from '@/lib/utils';
import { useMutation } from '@/hooks/use-api';
import type { ConsistencyReport, WikidataCheckResult, KGCheckResult } from '@/lib/brand/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandIdentityRecord {
  id: string;
  entityType: string;
  canonicalName: string;
  canonicalUrl: string;
  description?: string | null;
  logoUrl?: string | null;
  wikidataUrl?: string | null;
  wikipediaUrl?: string | null;
  linkedinUrl?: string | null;
  crunchbaseUrl?: string | null;
  youtubeUrl?: string | null;
  twitterUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  wikidataQId?: string | null;
  kgmid?: string | null;
  kgConfidence?: number | null;
  consistencyScore?: number | null;
  consistencyReport?: ConsistencyReport | null;
  entityGraph?: Record<string, unknown> | null;
  updatedAt: string;
}

interface IdentitiesResponse {
  identities: BrandIdentityRecord[];
}

// ---------------------------------------------------------------------------
// SWR fetcher
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'identity' | 'consistency' | 'mentions' | 'calendar';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'identity',    label: 'Identity' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'mentions',    label: 'Mentions' },
  { id: 'calendar',    label: 'Calendar' },
];

// ---------------------------------------------------------------------------
// Brand Identity Form
// ---------------------------------------------------------------------------

interface BrandFormData {
  entityType: 'organization' | 'person' | 'local-business';
  canonicalName: string;
  canonicalUrl: string;
  description: string;
  wikidataUrl: string;
  wikipediaUrl: string;
  linkedinUrl: string;
  crunchbaseUrl: string;
  youtubeUrl: string;
  twitterUrl: string;
  facebookUrl: string;
  instagramUrl: string;
}

const EMPTY_FORM: BrandFormData = {
  entityType:   'organization',
  canonicalName: '',
  canonicalUrl:  '',
  description:   '',
  wikidataUrl:   '',
  wikipediaUrl:  '',
  linkedinUrl:   '',
  crunchbaseUrl: '',
  youtubeUrl:    '',
  twitterUrl:    '',
  facebookUrl:   '',
  instagramUrl:  '',
};

interface SaveBrandResponse {
  identity: BrandIdentityRecord;
  entityGraph: Record<string, unknown>;
}

function BrandIdentityForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState<BrandFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { mutate: saveBrand, isLoading: saving } = useMutation<SaveBrandResponse, BrandFormData>(
    async (data) => {
      const body = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== '')
      );
      const res = await fetch('/api/brand/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to save brand identity');
      }
      return res.json();
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await saveBrand(form);
      onSuccess();
      setForm(EMPTY_FORM);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const field = (
    key: keyof BrandFormData,
    label: string,
    placeholder: string,
    required = false
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {key === 'entityType' ? (
        <select
          value={form.entityType}
          onChange={e => setForm(f => ({ ...f, entityType: e.target.value as BrandFormData['entityType'] }))}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="organization">Organisation</option>
          <option value="person">Person</option>
          <option value="local-business">Local Business</option>
        </select>
      ) : key === 'description' ? (
        <textarea
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
        />
      ) : (
        <input
          type="text"
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          required={required}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white/[0.03] border border-white/10 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white">Create Brand Profile</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('entityType',    'Entity Type',     '', true)}
        {field('canonicalName', 'Brand Name',      'Synthex AI', true)}
        {field('canonicalUrl',  'Website URL',     'https://synthex.ai', true)}
        {field('description',   'Description',     'What your brand does…')}
      </div>

      <div>
        <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">sameAs URLs (optional)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('wikidataUrl',   'Wikidata',    'https://www.wikidata.org/wiki/Q...')}
          {field('wikipediaUrl',  'Wikipedia',   'https://en.wikipedia.org/wiki/...')}
          {field('linkedinUrl',   'LinkedIn',    'https://www.linkedin.com/company/...')}
          {field('crunchbaseUrl', 'Crunchbase',  'https://www.crunchbase.com/organization/...')}
          {field('twitterUrl',    'Twitter/X',   'https://twitter.com/...')}
          {field('youtubeUrl',    'YouTube',     'https://www.youtube.com/@...')}
          {field('facebookUrl',   'Facebook',    'https://www.facebook.com/...')}
          {field('instagramUrl',  'Instagram',   'https://www.instagram.com/...')}
        </div>
      </div>

      {formError && (
        <div className="flex items-center gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {formError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={saving || !form.canonicalName || !form.canonicalUrl}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Save Brand Profile
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

function BrandBuilderPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && TABS.some(t => t.id === tabParam) ? tabParam : 'identity'
  );
  const [showForm, setShowForm] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [consistencyReport, setConsistencyReport] = useState<ConsistencyReport | null>(null);
  const [consistencyLoading, setConsistencyLoading] = useState(false);
  const [wikidataResult, setWikidataResult] = useState<WikidataCheckResult | null>(null);
  const [wikidataLoading, setWikidataLoading] = useState(false);
  const [kgResult, setKgResult] = useState<KGCheckResult | null>(null);
  const [kgLoading, setKgLoading] = useState(false);

  // Fetch identities
  const { data, error, isLoading, mutate } = useSWR<IdentitiesResponse>(
    '/api/brand/identity',
    fetchJson,
    { revalidateOnFocus: false }
  );

  const identities = data?.identities ?? [];
  const selectedBrand = identities.find(b => b.id === selectedBrandId) ?? identities[0] ?? null;

  // Keep selectedBrandId in sync
  const effectiveBrandId = selectedBrandId ?? identities[0]?.id ?? null;

  const handleFormSuccess = useCallback(async () => {
    setShowForm(false);
    await mutate();
  }, [mutate]);

  const runConsistencyAudit = useCallback(async () => {
    if (!effectiveBrandId) return;
    setConsistencyLoading(true);
    try {
      const res = await fetch('/api/brand/consistency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ brandId: effectiveBrandId }),
      });
      if (res.ok) {
        const report: ConsistencyReport = await res.json();
        setConsistencyReport(report);
      }
    } catch {
      // Silently handle
    } finally {
      setConsistencyLoading(false);
    }
  }, [effectiveBrandId]);

  const checkWikidata = useCallback(async () => {
    if (!effectiveBrandId) return;
    setWikidataLoading(true);
    try {
      const res = await fetch(`/api/brand/wikidata?brandId=${effectiveBrandId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const result: WikidataCheckResult = await res.json();
        setWikidataResult(result);
      }
    } catch {
      // Silently handle
    } finally {
      setWikidataLoading(false);
    }
  }, [effectiveBrandId]);

  const checkKG = useCallback(async () => {
    if (!effectiveBrandId) return;
    setKgLoading(true);
    try {
      const res = await fetch(`/api/brand/kg-check?brandId=${effectiveBrandId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const result: KGCheckResult = await res.json();
        setKgResult(result);
      }
    } catch {
      // Silently handle
    } finally {
      setKgLoading(false);
    }
  }, [effectiveBrandId]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Brand Builder</h1>
            <p className="text-sm text-gray-400">Entity graph, sameAs management, and Knowledge Panel signals</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Brand
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <BrandIdentityForm onSuccess={handleFormSuccess} />
      )}

      {/* Tabs */}
      <div className="border-b border-white/10">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'text-white border-blue-500'
                  : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-white/20'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 text-gray-500 mx-auto animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">Failed to load brand identities.</p>
        </div>
      )}

      {/* Brand selector (if multiple brands) */}
      {!isLoading && identities.length > 1 && activeTab !== 'identity' && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Brand:</label>
          <select
            value={selectedBrandId ?? identities[0]?.id ?? ''}
            onChange={e => setSelectedBrandId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {identities.map(b => (
              <option key={b.id} value={b.id}>{b.canonicalName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tab Content */}
      {!isLoading && !error && (
        <>
          {/* ── Identity Tab ── */}
          {activeTab === 'identity' && (
            <div className="space-y-4">
              {identities.length === 0 && !showForm && (
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-10 text-center">
                  <Building2 className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-300">No brand profiles yet</p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">
                    Create your first brand profile to generate an entity graph and start tracking your Knowledge Panel signals.
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Brand Profile
                  </button>
                </div>
              )}
              {identities.map(identity => (
                <BrandIdentityCard
                  key={identity.id}
                  identity={{
                    ...identity,
                    entityGraph: identity.entityGraph ?? null,
                  }}
                  onReaudit={() => {
                    setSelectedBrandId(identity.id);
                    setActiveTab('consistency');
                    runConsistencyAudit();
                  }}
                  onCheckWikidata={() => {
                    setSelectedBrandId(identity.id);
                    setActiveTab('consistency');
                    checkWikidata();
                  }}
                  onCheckKG={() => {
                    setSelectedBrandId(identity.id);
                    setActiveTab('consistency');
                    checkKG();
                  }}
                />
              ))}
            </div>
          )}

          {/* ── Consistency Tab ── */}
          {activeTab === 'consistency' && (
            <div className="space-y-6">
              {!effectiveBrandId ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Create a brand profile first to run consistency audits.
                </div>
              ) : (
                <>
                  <ConsistencyAuditPanel
                    report={consistencyReport}
                    loading={consistencyLoading}
                    onRunAudit={runConsistencyAudit}
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <WikidataStatusCard
                      result={wikidataResult}
                      loading={wikidataLoading}
                      onCheck={checkWikidata}
                    />
                    <KnowledgePanelStatus
                      result={kgResult}
                      loading={kgLoading}
                      onCheck={checkKG}
                      hasApiKey={true}  // The API handles gracefully if key missing
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Mentions Tab ── */}
          {activeTab === 'mentions' && (
            <>
              {!effectiveBrandId ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Create a brand profile first to monitor mentions.
                </div>
              ) : (
                <BrandMentionsFeed brandId={effectiveBrandId} />
              )}
            </>
          )}

          {/* ── Calendar Tab ── */}
          {activeTab === 'calendar' && (
            <>
              {!effectiveBrandId ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Create a brand profile first to generate a calendar.
                </div>
              ) : (
                <BrandCalendarView brandId={effectiveBrandId} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function BrandBuilderPage() {
  return (
    <Suspense>
      <BrandBuilderPageContent />
    </Suspense>
  );
}
