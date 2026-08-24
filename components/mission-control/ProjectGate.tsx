'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Building2, Plus, AlertCircle } from '@/components/icons';
import type { LinearProjectSummary } from '@/lib/mission-control/types';

export function ProjectGate({
  missionId,
  selectedProjectId,
  onSelected,
}: {
  missionId: string;
  selectedProjectId: string | null;
  onSelected: (mission: unknown) => void;
}) {
  const [projects, setProjects] = useState<LinearProjectSummary[]>([]);
  const [configured, setConfigured] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(selectedProjectId ?? '');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/mission-control/projects', {
      credentials: 'include',
    });
    const data = await res.json();
    setConfigured(Boolean(data.configured));
    setProjects(data.projects ?? []);
    setMessage(data.message ?? null);
  }, []);

  useEffect(() => {
    load().catch(() => setMessage('Failed to load Linear projects.'));
  }, [load]);

  const select = async () => {
    if (!projectId) {
      setError('Select a Linear project to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/mission-control/select-project', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      onSelected(data.mission);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Select failed');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (name.trim().length < 2) {
      setError('Project name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/mission-control/projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      await load();
      setProjectId(data.project.id);
      setCreating(false);
      setName('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  if (selectedProjectId) {
    return (
      <div className="border-[0.5px] border-white/6 bg-white/1 rounded-sm p-5">
        <p className="text-xs uppercase tracking-[0.22em] text-white/30 mb-1">
          Linear project
        </p>
        <p className="text-sm text-white/70">Project bound to this mission.</p>
      </div>
    );
  }

  return (
    <div className="border-[0.5px] border-white/6 bg-white/1 rounded-sm p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 flex items-center justify-center border-[0.5px] border-white/10 rounded-sm">
          <Building2 className="h-4 w-4 text-white/50" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-white/30 mb-1">
            Project gate
          </p>
          <h3 className="text-lg font-light text-white">
            Select a Linear project
          </h3>
          <p className="text-sm text-white/40 mt-1">
            Tickets are never drafted until a project is selected. If none
            exist, create one first.
          </p>
        </div>
      </div>

      {!configured && (
        <div className="flex gap-2 text-xs text-amber-200/80 border-[0.5px] border-amber-500/20 bg-amber-500/5 px-3 py-2 rounded-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{message || 'Connect LINEAR_API_KEY to continue.'}</span>
        </div>
      )}

      {configured && projects.length === 0 && !creating && (
        <div className="border-[0.5px] border-dashed border-white/10 px-4 py-6 text-center space-y-3">
          <p className="text-sm text-white/50">
            No Linear projects found. Create a project before drafting tickets.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs border-[0.5px] border-white/15 text-white/70 hover:text-white rounded-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Linear project
          </button>
        </div>
      )}

      {projects.length > 0 && !creating && (
        <div className="space-y-3">
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="w-full bg-black/30 border-[0.5px] border-white/10 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-candy-orange/40"
          >
            <option value="">Select project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.state ? ` · ${p.state}` : ''}
              </option>
            ))}
          </select>
          {projectId && (
            <p className="text-xs text-white/35">
              {projects.find(p => p.id === projectId)?.description ||
                'No description'}
            </p>
          )}
          <div className="flex flex-wrap gap-2 justify-between">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white/70"
            >
              <Plus className="h-3.5 w-3.5" />
              New project
            </button>
            <button
              type="button"
              onClick={select}
              disabled={busy || !projectId}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium tracking-wide rounded-sm bg-candy-orange text-charcoal-950 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Use this project
            </button>
          </div>
        </div>
      )}

      {creating && (
        <div className="space-y-3 border-[0.5px] border-white/8 p-4 rounded-sm">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Project name"
            className="w-full bg-black/30 border-[0.5px] border-white/10 rounded-sm px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-candy-orange/40"
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            rows={2}
            className="w-full bg-black/30 border-[0.5px] border-white/10 rounded-sm px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-candy-orange/40"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-3 py-2 text-xs text-white/45"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-sm bg-candy-orange text-charcoal-950 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create project
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-300/90 border-[0.5px] border-red-500/20 bg-red-500/5 px-3 py-2 rounded-sm">
          {error}
        </p>
      )}
    </div>
  );
}
