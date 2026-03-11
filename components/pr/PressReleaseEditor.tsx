'use client';

/**
 * PR Journalist CRM — Press Release Editor Component (Phase 92)
 *
 * Two-panel layout: form fields + JSON-LD preview.
 * Actions: Save Draft, Publish, Archive.
 *
 * @module components/pr/PressReleaseEditor
 */

import { useState } from 'react';
import useSWR from 'swr';
import { FileText, Loader2, AlertCircle, Plus, Eye, Save } from '@/components/icons';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PressRelease {
  id: string;
  slug: string;
  headline: string;
  subheading?: string | null;
  body: string;
  boilerplate?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  datePublished?: string | null;
  location?: string | null;
  category?: string | null;
  keywords: string[];
  imageUrl?: string | null;
  status: string;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReleasesListResponse {
  releases: PressRelease[];
}

interface ReleaseResponse {
  release: PressRelease;
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
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft:     'bg-gray-500/20 text-gray-400 border-gray-500/30',
    published: 'bg-green-500/20 text-green-300 border-green-500/30',
    archived:  'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full border', styles[status] ?? styles.draft)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Editor panel
// ---------------------------------------------------------------------------

interface EditorPanelProps {
  release: PressRelease | null;
  onSaved: () => void;
  onClose: () => void;
}

function EditorPanel({ release, onSaved, onClose }: EditorPanelProps) {
  const [form, setForm] = useState({
    headline:     release?.headline     ?? '',
    subheading:   release?.subheading   ?? '',
    body:         release?.body         ?? '',
    boilerplate:  release?.boilerplate  ?? '',
    contactName:  release?.contactName  ?? '',
    contactEmail: release?.contactEmail ?? '',
    contactPhone: release?.contactPhone ?? '',
    location:     release?.location     ?? 'Sydney, NSW, Australia',
    keywords:     release?.keywords.join(', ') ?? '',
    category:     release?.category     ?? '',
  });
  const [showJsonLd, setShowJsonLd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build JSON-LD preview client-side
  const jsonLdPreview = {
    '@context': 'https://schema.org',
    '@type': ['NewsArticle', 'PressRelease'],
    headline: form.headline || '(headline)',
    description: form.subheading || undefined,
    articleBody: form.body ? form.body.slice(0, 200) + '...' : '(body)',
    datePublished: release?.datePublished ?? new Date().toISOString(),
    keywords: form.keywords || undefined,
    locationCreated: form.location ? { '@type': 'Place', name: form.location } : undefined,
    author: { '@type': 'Organization', name: '(your organisation)' },
    publisher: { '@type': 'Organization', name: '(your organisation)' },
  };

  const handleSave = async (status?: string) => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        status: status ?? release?.status ?? 'draft',
      };

      const url = release
        ? `/api/pr/press-releases/${release.id}`
        : '/api/pr/press-releases';
      const method = release ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Request failed');

      onSaved();
    } catch {
      setError('Failed to save press release. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      {/* Left: Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Headline *</label>
          <input
            type="text"
            value={form.headline}
            onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
            placeholder="Acme Corp Raises $5M Seed Round to Transform Australian Recruitment"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Subheading</label>
          <input
            type="text"
            value={form.subheading}
            onChange={(e) => setForm((f) => ({ ...f, subheading: e.target.value }))}
            placeholder="Sydney-based startup closes oversubscribed round"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Body (Markdown) *</label>
          <textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="SYDNEY, Australia — [date] — ..."
            rows={10}
            className={cn(inputClass, 'resize-none font-mono text-xs')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Sydney, NSW, Australia"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputClass}
            >
              <option value="">Select category</option>
              <option value="funding">Funding</option>
              <option value="product">Product</option>
              <option value="partnership">Partnership</option>
              <option value="award">Award</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Keywords (comma-separated)</label>
          <input
            type="text"
            value={form.keywords}
            onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
            placeholder="startup, funding, recruitment, AI"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Boilerplate (About section)</label>
          <textarea
            value={form.boilerplate}
            onChange={(e) => setForm((f) => ({ ...f, boilerplate: e.target.value }))}
            placeholder="About Acme Corp: ..."
            rows={3}
            className={cn(inputClass, 'resize-none')}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Contact Name</label>
            <input type="text" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Contact Email</label>
            <input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Contact Phone</label>
            <input type="tel" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} className={inputClass} />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave('draft')}
            disabled={saving || !form.headline || !form.body}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            Save Draft
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={saving || !form.headline || !form.body}
            className="flex items-center gap-1.5 flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors justify-center"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Publish
          </button>
        </div>
      </div>

      {/* Right: JSON-LD preview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-400">JSON-LD Preview</label>
          <button
            onClick={() => setShowJsonLd((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Eye className="h-3 w-3" />
            {showJsonLd ? 'Hide' : 'Show'} schema
          </button>
        </div>
        {showJsonLd && (
          <pre className="bg-gray-950 border border-white/10 rounded-xl p-4 text-xs text-green-300 overflow-auto max-h-[500px] font-mono">
            {JSON.stringify(jsonLdPreview, null, 2)}
          </pre>
        )}
        {!showJsonLd && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-gray-500 text-sm">
            Click &quot;Show schema&quot; to preview the JSON-LD structured data that will be included in the published press release page for AI engine indexing.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PressReleaseEditor() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading, error, mutate } = useSWR<ReleasesListResponse>(
    '/api/pr/press-releases',
    fetchJson
  );

  const releases = data?.releases ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading press releases...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 py-8">
        <AlertCircle className="h-5 w-5" />
        Failed to load press releases. Please try again.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">{releases.length} press releases</h3>
        <button
          onClick={() => { setSelectedId(null); setShowNew(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Press Release
        </button>
      </div>

      {/* New release editor */}
      {showNew && (
        <EditorPanel
          release={null}
          onSaved={() => { setShowNew(false); mutate(); }}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* Release list */}
      {releases.length === 0 && !showNew ? (
        <div className="text-center py-12 text-gray-500">
          No press releases yet. Create your first one.
        </div>
      ) : (
        <div className="space-y-2">
          {releases.map((release) => (
            <div key={release.id}>
              <div
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/[0.08] transition-colors cursor-pointer"
                onClick={() => setSelectedId(selectedId === release.id ? null : release.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <FileText className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    <span className="text-white text-sm font-medium truncate">{release.headline}</span>
                    <StatusBadge status={release.status} />
                  </div>
                  <div className="text-xs text-gray-500 ml-6">
                    {release.category && <span>{release.category} · </span>}
                    {new Date(release.createdAt).toLocaleDateString('en-AU')}
                    {release.keywords.length > 0 && (
                      <span> · {release.keywords.slice(0, 3).join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
