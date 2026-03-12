'use client';

/**
 * Awards & Directories Dashboard (Phase 94)
 *
 * 4 tabs:
 *  - Awards — tracked award nominations with AI generation
 *  - Directories — tracked directory listings
 *  - Deadlines — sorted upcoming deadlines within 90 days
 *  - Templates — browse and add from curated award + directory templates
 *
 * URL: /dashboard/awards?tab=awards|directories|deadlines|templates
 *
 * @module app/dashboard/awards/page
 */

import { useEffect, useState , Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Award, Globe, Calendar, Sparkles, Plus, X } from '@/components/icons';
import { AwardCard } from '@/components/awards/AwardCard';
import { DirectoryCard } from '@/components/awards/DirectoryCard';
import { NominationEditor } from '@/components/awards/NominationEditor';
import { SubmissionDeadlineList } from '@/components/awards/SubmissionDeadlineList';
import { AwardTemplateGrid } from '@/components/awards/AwardTemplateGrid';
import { DirectoryTemplateGrid } from '@/components/awards/DirectoryTemplateGrid';
import { useUser } from '@/hooks/use-user';
import type { AwardStatus, DirectoryStatus, SubmissionSummary } from '@/lib/awards/types';
import type { AwardTemplate } from '@/lib/awards/award-database';
import type { DirectoryTemplate } from '@/lib/awards/directory-database';

// ─── Types ────────────────────────────────────────────────────────────────────

type AwardsTab = 'awards' | 'directories' | 'deadlines' | 'templates';
const VALID_TABS: AwardsTab[] = ['awards', 'directories', 'deadlines', 'templates'];

// ─── SWR fetcher ──────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error('Fetch failed');
    return r.json();
  });

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs font-medium text-slate-300 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Award add form ───────────────────────────────────────────────────────────

interface AddAwardFormProps {
  orgId: string;
  prefill?: Partial<AwardTemplate>;
  onSaved: () => void;
  onCancel: () => void;
}

function AddAwardForm({ orgId, prefill, onSaved, onCancel }: AddAwardFormProps) {
  const [name,      setName]      = useState(prefill?.name ?? '');
  const [organizer, setOrganizer] = useState(prefill?.organizer ?? '');
  const [category,  setCategory]  = useState(prefill?.category ?? '');
  const [deadline,  setDeadline]  = useState('');
  const [entryFee,  setEntryFee]  = useState(prefill?.entryFee ?? '');
  const [priority,  setPriority]  = useState<'low' | 'medium' | 'high'>('medium');
  const [submissionUrl, setUrl]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [error,  setError]        = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !organizer || !category) { setError('Name, organiser, and category are required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/awards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orgId, name, organizer, category, deadline: deadline || undefined, entryFee: entryFee || undefined, priority, submissionUrl: submissionUrl || undefined }),
      });
      if (!res.ok) throw new Error('Failed to create award');
      onSaved();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50';

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">Add Award</h3>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-300"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input className={inputCls} placeholder="Award name *" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder="Organiser *" value={organizer} onChange={(e) => setOrganizer(e.target.value)} />
        <input className={inputCls} placeholder="Category *" value={category} onChange={(e) => setCategory(e.target.value)} />
        <input className={inputCls} placeholder="Entry fee (e.g. Free)" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
        <input className={inputCls} placeholder="Submission URL" value={submissionUrl} onChange={(e) => setUrl(e.target.value)} />
        <input className={inputCls} type="date" placeholder="Deadline" value={deadline} onChange={(e) => setDeadline(e.target.value ? new Date(e.target.value).toISOString() : '')} />
        <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
          {saving ? 'Saving…' : 'Save Award'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-sm rounded-lg transition-colors">Cancel</button>
      </div>
    </form>
  );
}

// ─── Directory add form ───────────────────────────────────────────────────────

interface AddDirectoryFormProps {
  orgId: string;
  prefill?: Partial<DirectoryTemplate>;
  onSaved: () => void;
  onCancel: () => void;
}

function AddDirectoryForm({ orgId, prefill, onSaved, onCancel }: AddDirectoryFormProps) {
  const [name,    setName]    = useState(prefill?.directoryName ?? '');
  const [url,     setUrl]     = useState(prefill?.directoryUrl  ?? '');
  const [cat,     setCat]     = useState(prefill?.category ?? '');
  const [isFree,  setIsFree]  = useState(prefill?.isFree ?? true);
  const [isAiIdx, setAiIdx]   = useState(prefill?.isAiIndexed ?? false);
  const [da,      setDa]      = useState(String(prefill?.domainAuthority ?? ''));
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !url) { setError('Name and URL are required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/directories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orgId, directoryName: name, directoryUrl: url, category: cat || undefined, isFree, isAiIndexed: isAiIdx, domainAuthority: da ? parseInt(da, 10) : undefined }),
      });
      if (!res.ok) throw new Error('Failed');
      onSaved();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50';

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">Add Directory</h3>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-300"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input className={inputCls} placeholder="Directory name *" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder="Directory URL *" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className={inputCls} placeholder="Category" value={cat} onChange={(e) => setCat(e.target.value)} />
        <input className={inputCls} placeholder="Domain Authority (0–100)" type="number" min={0} max={100} value={da} onChange={(e) => setDa(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="accent-purple-500" />
          Free submission
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={isAiIdx} onChange={(e) => setAiIdx(e.target.checked)} className="accent-purple-500" />
          AI Indexed
        </label>
      </div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
          {saving ? 'Saving…' : 'Save Directory'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-sm rounded-lg transition-colors">Cancel</button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AwardsPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user }     = useUser();

  const rawTab = searchParams.get('tab');
  const activeTab: AwardsTab = VALID_TABS.includes(rawTab as AwardsTab) ? (rawTab as AwardsTab) : 'awards';

  const orgId = (user as { organizationId?: string } | null)?.organizationId ?? 'default';

  function setTab(tab: AwardsTab) {
    router.push(`/dashboard/awards?tab=${tab}`, { scroll: false });
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: awardsData, mutate: mutateAwards } = useSWR<{ awards: Array<{ id: string; name: string; organizer: string; category: string; status: string; priority: string; deadline: string | null; submissionUrl: string | null; entryFee: string | null; isRecurring: boolean; nominationDraft: string | null }> }>(
    '/api/awards',
    fetchJson,
    { revalidateOnFocus: false }
  );

  const { data: dirsData, mutate: mutateDirs } = useSWR<{ directories: Array<{ id: string; directoryName: string; directoryUrl: string; listingUrl: string | null; category: string | null; status: string; domainAuthority: number | null; isFree: boolean; isAiIndexed: boolean; notes: string | null }> }>(
    '/api/directories',
    fetchJson,
    { revalidateOnFocus: false }
  );

  const { data: summaryData, isLoading: summaryLoading } = useSWR<{ summary: SubmissionSummary }>(
    '/api/submissions',
    fetchJson,
    { revalidateOnFocus: false }
  );

  // ── UI state ────────────────────────────────────────────────────────────────

  const [showAwardForm,     setShowAwardForm]     = useState(false);
  const [showDirForm,       setShowDirForm]       = useState(false);
  const [awardFormPrefill,  setAwardFormPrefill]  = useState<Partial<AwardTemplate> | undefined>();
  const [dirFormPrefill,    setDirFormPrefill]    = useState<Partial<DirectoryTemplate> | undefined>();
  const [nominationAwardId, setNominationAwardId] = useState<string | null>(null);
  const [isGenerating,      setIsGenerating]      = useState(false);

  const awards      = awardsData?.awards ?? [];
  const directories = dirsData?.directories ?? [];
  const summary     = summaryData?.summary;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleAwardStatusChange(id: string, status: AwardStatus) {
    await fetch(`/api/awards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    mutateAwards();
  }

  async function handleAwardDelete(id: string) {
    await fetch(`/api/awards/${id}`, { method: 'DELETE', credentials: 'include' });
    mutateAwards();
    if (nominationAwardId === id) setNominationAwardId(null);
  }

  async function handleDirStatusChange(id: string, status: DirectoryStatus) {
    await fetch(`/api/directories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    mutateDirs();
  }

  async function handleDirDelete(id: string) {
    await fetch(`/api/directories/${id}`, { method: 'DELETE', credentials: 'include' });
    mutateDirs();
  }

  async function handleGenerateNomination(awardId: string) {
    setNominationAwardId(awardId);
  }

  async function handleRegenerate(awardId: string) {
    const award = awards.find((a) => a.id === awardId);
    if (!award) return;
    setIsGenerating(true);
    try {
      await fetch(`/api/awards/${awardId}/generate-nomination`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          brand: {
            canonicalName:  user?.name ?? 'Your Company',
            description:    'An innovative marketing automation platform',
            location:       'Australia',
          },
        }),
      });
      mutateAwards();
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSelectAwardTemplate(template: AwardTemplate) {
    setAwardFormPrefill(template);
    setShowAwardForm(true);
    setTab('awards');
  }

  async function handleAddDirectoryTemplate(template: DirectoryTemplate) {
    await fetch('/api/directories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        orgId,
        directoryName:   template.directoryName,
        directoryUrl:    template.directoryUrl,
        category:        template.category,
        domainAuthority: template.domainAuthority,
        isFree:          template.isFree,
        isAiIndexed:     template.isAiIndexed,
      }),
    });
    mutateDirs();
  }

  // ── Nomination modal award ───────────────────────────────────────────────────

  const nominationAward = nominationAwardId ? awards.find((a) => a.id === nominationAwardId) : null;
  const addedDirUrls = new Set(directories.map((d) => d.directoryUrl));

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-yellow-500/20">
            <Award className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Awards &amp; Directories</h1>
            <p className="text-sm text-slate-400">Track award nominations and directory listings for E-E-A-T signals and backlinks</p>
          </div>
        </div>

        {/* Stats */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
            <StatCard label="Awards Tracked"    value={summary.totalAwards} />
            <StatCard label="Submitted"          value={summary.awardSubmitted} />
            <StatCard label="Won / Shortlisted"  value={summary.awardSuccess} />
            <StatCard label="Directories"        value={summary.totalDirectories} />
            <StatCard label="Listings Live"      value={summary.directoriesLive} />
          </div>
        )}
      </div>

      {/* Nomination editor modal */}
      {nominationAward && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-slate-300">Nomination — {nominationAward.name}</h2>
            <button onClick={() => setNominationAwardId(null)} className="text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          <NominationEditor
            awardName={nominationAward.name}
            nominationDraft={nominationAward.nominationDraft ?? '(No nomination yet — click Regenerate to generate one with AI)'}
            isAiGenerated={!!nominationAward.nominationDraft}
            isRegenerating={isGenerating}
            onRegenerate={() => handleRegenerate(nominationAward.id)}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setTab(v as AwardsTab)}>
        <TabsList className="mb-6 bg-white/5 border border-white/10 rounded-xl p-1">
          <TabsTrigger value="awards"      className="flex items-center gap-1.5 data-[state=active]:bg-white/10">
            <Award className="h-4 w-4" /> Awards
          </TabsTrigger>
          <TabsTrigger value="directories" className="flex items-center gap-1.5 data-[state=active]:bg-white/10">
            <Globe className="h-4 w-4" /> Directories
          </TabsTrigger>
          <TabsTrigger value="deadlines"   className="flex items-center gap-1.5 data-[state=active]:bg-white/10">
            <Calendar className="h-4 w-4" /> Deadlines
          </TabsTrigger>
          <TabsTrigger value="templates"   className="flex items-center gap-1.5 data-[state=active]:bg-white/10">
            <Sparkles className="h-4 w-4" /> Templates
          </TabsTrigger>
        </TabsList>

        {/* Awards Tab */}
        <TabsContent value="awards">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">{awards.length} award{awards.length !== 1 ? 's' : ''} tracked</p>
            <button
              onClick={() => { setAwardFormPrefill(undefined); setShowAwardForm(true); }}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Award
            </button>
          </div>

          {showAwardForm && (
            <AddAwardForm
              orgId={orgId}
              prefill={awardFormPrefill}
              onSaved={() => { setShowAwardForm(false); mutateAwards(); }}
              onCancel={() => setShowAwardForm(false)}
            />
          )}

          {awards.length === 0 && !showAwardForm ? (
            <div className="text-center py-16">
              <Award className="h-12 w-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No awards tracked yet</p>
              <p className="text-slate-600 text-xs mt-1">Add an award manually or browse the Templates tab to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {awards.map((award) => (
                <AwardCard
                  key={award.id}
                  id={award.id}
                  name={award.name}
                  organizer={award.organizer}
                  category={award.category}
                  status={award.status as AwardStatus}
                  priority={award.priority as 'low' | 'medium' | 'high'}
                  deadline={award.deadline}
                  submissionUrl={award.submissionUrl}
                  entryFee={award.entryFee}
                  isRecurring={award.isRecurring}
                  nominationDraft={award.nominationDraft}
                  onGenerateNomination={handleGenerateNomination}
                  onStatusChange={handleAwardStatusChange}
                  onDelete={handleAwardDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Directories Tab */}
        <TabsContent value="directories">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">{directories.length} director{directories.length !== 1 ? 'ies' : 'y'} tracked</p>
            <button
              onClick={() => { setDirFormPrefill(undefined); setShowDirForm(true); }}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Directory
            </button>
          </div>

          {showDirForm && (
            <AddDirectoryForm
              orgId={orgId}
              prefill={dirFormPrefill}
              onSaved={() => { setShowDirForm(false); mutateDirs(); }}
              onCancel={() => setShowDirForm(false)}
            />
          )}

          {directories.length === 0 && !showDirForm ? (
            <div className="text-center py-16">
              <Globe className="h-12 w-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No directories tracked yet</p>
              <p className="text-slate-600 text-xs mt-1">Browse the Templates tab to add high-DA directories in one click.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {directories.map((dir) => (
                <DirectoryCard
                  key={dir.id}
                  id={dir.id}
                  directoryName={dir.directoryName}
                  directoryUrl={dir.directoryUrl}
                  listingUrl={dir.listingUrl}
                  category={dir.category}
                  status={dir.status as DirectoryStatus}
                  domainAuthority={dir.domainAuthority}
                  isFree={dir.isFree}
                  isAiIndexed={dir.isAiIndexed}
                  notes={dir.notes}
                  onStatusChange={handleDirStatusChange}
                  onDelete={handleDirDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Deadlines Tab */}
        <TabsContent value="deadlines">
          <SubmissionDeadlineList
            deadlines={summary?.upcomingDeadlines ?? []}
            isLoading={summaryLoading}
          />
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Award className="h-4 w-4 text-yellow-400" />
                Award Templates
              </h2>
              <AwardTemplateGrid onSelect={handleSelectAwardTemplate} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-400" />
                Directory Templates
              </h2>
              <DirectoryTemplateGrid
                addedIds={addedDirUrls}
                onAdd={handleAddDirectoryTemplate}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AwardsPage() {
  return (
    <Suspense>
      <AwardsPageContent />
    </Suspense>
  );
}
