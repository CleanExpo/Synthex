'use client';

import { useEffect, useState } from 'react';
import { Loader2, GitBranch, AlertCircle } from '@/components/icons';
import type { RepoAnalysisSummary } from '@/lib/mission-control/types';

type RepoRow = {
  fullName: string;
  description: string | null;
  private: boolean;
};

export function RepoContext({
  missionId,
  analysis,
  onAnalyzed,
}: {
  missionId: string;
  analysis: RepoAnalysisSummary | null;
  onAnalyzed: (mission: unknown) => void;
}) {
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [lastRepo, setLastRepo] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [manual, setManual] = useState('');
  const [configured, setConfigured] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/mission-control/repos', {
          credentials: 'include',
        });
        const data = await res.json();
        if (cancelled) return;
        setConfigured(Boolean(data.configured));
        setRepos(data.repos ?? []);
        setLastRepo(data.lastRepoFullName ?? null);
        if (data.lastRepoFullName) setSelected(data.lastRepoFullName);
        if (data.message && !data.configured) setLoadError(data.message);
      } catch {
        if (!cancelled) setLoadError('Could not load repositories.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const analyze = async () => {
    const repoFullName = (manual.trim() || selected).trim();
    if (!repoFullName.includes('/')) {
      setActionError('Choose a repo or type owner/name.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch('/api/mission-control/analyze-repo', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId, repoFullName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Analysis failed');
      }
      onAnalyzed(data.mission);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setBusy(false);
    }
  };

  if (analysis) {
    return (
      <div className="border-[0.5px] border-white/6 bg-white/1 rounded-sm p-5 space-y-3">
        <p className="text-xs uppercase tracking-[0.22em] text-white/30">
          Repo context
        </p>
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-candy-orange" />
          <p className="text-sm text-white font-light">{analysis.fullName}</p>
        </div>
        <p className="text-xs text-white/40 leading-relaxed">
          {analysis.description || 'No description'} ·{' '}
          {analysis.language || 'n/a'} · {analysis.openIssueCount} open issues
        </p>
        {analysis.topPaths.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {analysis.topPaths.slice(0, 10).map(p => (
              <span
                key={p}
                className="text-xs text-white/40 border-[0.5px] border-white/8 px-2 py-0.5 rounded-sm"
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-[0.5px] border-white/6 bg-white/1 rounded-sm p-5 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-white/30 mb-1">
          GitHub analysis
        </p>
        <h3 className="text-lg font-light text-white">Select a repository</h3>
        <p className="text-sm text-white/40 mt-1">
          We scan structure and recent PRs so tickets land in the right modules.
          {lastRepo ? ` Last used: ${lastRepo}.` : ''}
        </p>
      </div>

      {!configured && (
        <div className="flex gap-2 text-xs text-amber-200/80 border-[0.5px] border-amber-500/20 bg-amber-500/5 px-3 py-2 rounded-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {loadError ||
              'Add GITHUB_TOKEN on the server, or type owner/repo if public APIs allow.'}
          </span>
        </div>
      )}

      {repos.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.18em] text-white/35">
            Your repos
          </label>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full bg-black/30 border-[0.5px] border-white/10 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-candy-orange/40"
          >
            <option value="">Select…</option>
            {repos.map(r => (
              <option key={r.fullName} value={r.fullName}>
                {r.fullName}
                {r.private ? ' (private)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.18em] text-white/35">
          Or type owner/repo
        </label>
        <input
          value={manual}
          onChange={e => setManual(e.target.value)}
          placeholder="acme/synthex"
          className="w-full bg-black/30 border-[0.5px] border-white/10 rounded-sm px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-candy-orange/40"
        />
      </div>

      {actionError && (
        <p className="text-xs text-red-300/90 border-[0.5px] border-red-500/20 bg-red-500/5 px-3 py-2 rounded-sm">
          {actionError}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={analyze}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium tracking-wide rounded-sm bg-candy-orange text-charcoal-950 hover:bg-candy-orange-hover disabled:opacity-50 transition-colors"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? 'Analysing…' : 'Analyse repository'}
        </button>
      </div>
    </div>
  );
}
