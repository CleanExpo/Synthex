'use client';

/**
 * Brand Video Studio
 *
 * Dashboard surface for the /brand-video command. Pick a STYLE (look), a brand,
 * a topic, and an optional count, then Generate — this queues a row in
 * brand_video_jobs that the worker (scripts/brand-video-worker.ts) renders out
 * of band. The style dropdown is sourced from the brand-video skill's style
 * registry (lib/brand-video/styles.ts ↔ .claude/skills/brand-video/styles.json).
 */

import { useState } from 'react';
import { Loader2, Video } from '@/components/icons';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApi } from '@/hooks/use-api';
import {
  BRAND_VIDEO_STYLES,
  DEFAULT_BRAND_VIDEO_STYLE,
} from '@/lib/brand-video/styles';

interface BrandVideoJob {
  id: string;
  brand: string;
  style: string;
  topic: string;
  count: number;
  status: string;
  output_url: string | null;
  error: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  queued: 'text-white/60 border-white/[0.12] bg-white/[0.03]',
  rendering: 'text-amber-300 border-amber-500/30 bg-amber-500/[0.06]',
  done: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.06]',
  needs_local_render: 'text-sky-300 border-sky-500/30 bg-sky-500/[0.06]',
  failed: 'text-red-300 border-red-500/30 bg-red-500/[0.06]',
};

const STYLE_LABELS: Record<string, string> = Object.fromEntries(
  BRAND_VIDEO_STYLES.map(s => [s.key, s.label])
);

export default function BrandVideoStudioPage() {
  const [brand, setBrand] = useState('');
  const [style, setStyle] = useState<string>(DEFAULT_BRAND_VIDEO_STYLE);
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: jobsData, refetch } = useApi<{ jobs: BrandVideoJob[] }>(
    '/api/brand-video/jobs',
    {
      pollingInterval: 8000,
    }
  );
  const jobs = jobsData?.jobs ?? [];

  async function handleGenerate() {
    setFormError(null);
    if (!brand.trim() || !topic.trim()) {
      setFormError('Brand and topic are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/brand-video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, style, topic, count }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      setTopic('');
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to queue job');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Create"
        title="Brand Video Studio"
        description="Pick a look, set the brand and topic, and queue a styled faceless video."
      />

      {/* Generate form */}
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Style dropdown — sourced from the brand-video style registry */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50">Style (look)</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="w-full bg-gray-900/50 border-white/10">
                <SelectValue placeholder="Choose a style" />
              </SelectTrigger>
              <SelectContent>
                {BRAND_VIDEO_STYLES.map(s => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Brand */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50">Brand</label>
            <input
              value={brand}
              onChange={e => setBrand(e.target.value)}
              placeholder="e.g. Synthex"
              className="w-full px-3 py-2 bg-gray-900/50 border-[0.5px] border-white/10 rounded-sm text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40"
            />
          </div>
        </div>

        {/* Topic */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50">Topic</label>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="What should this video be about?"
            rows={4}
            className="w-full px-3 py-2 bg-gray-900/50 border-[0.5px] border-white/10 rounded-sm text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-y"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          {/* Count */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50">Count</label>
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={e =>
                setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))
              }
              className="w-24 px-3 py-2 bg-gray-900/50 border-[0.5px] border-white/10 rounded-sm text-sm text-white focus:outline-none focus:border-amber-500/40"
            />
          </div>

          <div className="flex-1" />

          <button
            onClick={handleGenerate}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold tracking-wide rounded-sm transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Video className="h-3.5 w-3.5" />
            )}
            {submitting ? 'Queuing…' : 'Generate'}
          </button>
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}
      </div>

      {/* Recent jobs */}
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-light text-white">Recent jobs</h2>
        </div>
        {jobs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-white/40">
            No videos queued yet.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {jobs.map(job => (
              <li
                key={job.id}
                className="px-6 py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {job.brand}
                    <span className="text-white/30"> · </span>
                    <span className="text-white/50">
                      {STYLE_LABELS[job.style] ?? job.style}
                    </span>
                  </p>
                  <p className="text-xs text-white/40 truncate mt-0.5">
                    {job.topic}
                  </p>
                  {job.error && (
                    <p className="text-xs text-red-400/80 truncate mt-0.5">
                      {job.error}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {job.output_url && (
                    <a
                      href={job.output_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-amber-400 hover:text-amber-300"
                    >
                      View
                    </a>
                  )}
                  <span
                    className={`text-xs uppercase tracking-wide px-2 py-1 border-[0.5px] rounded-sm ${
                      STATUS_STYLES[job.status] ?? STATUS_STYLES.queued
                    }`}
                  >
                    {job.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
