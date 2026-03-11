'use client';

/**
 * PromptGeneratorForm (Phase 96)
 *
 * Form to generate prompt templates from entity context.
 * Calls POST /api/prompts/generate (pure computation, no AI).
 * Displays generated prompts with individual "Track" + bulk "Track All" actions.
 *
 * @module components/prompts/PromptGeneratorForm
 */

import { useState } from 'react';
import { Sparkles, Plus, Check } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PromptTemplate, PromptCategory } from '@/lib/prompts/types';
import { CATEGORY_CONFIG } from '@/lib/prompts/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PromptGeneratorFormProps {
  orgId: string
  onTracked?: (count: number) => void
}

// ─── Category badge colours ───────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<PromptCategory, string> = {
  'brand-awareness':       'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'competitor-comparison': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'local-discovery':       'bg-green-500/20 text-green-300 border-green-500/30',
  'use-case':              'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'how-to':                'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'product-feature':       'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

function catColour(cat: string): string {
  return CATEGORY_COLOURS[cat as PromptCategory] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
}

// ─── Track a prompt via API ───────────────────────────────────────────────────

async function trackPrompt(
  orgId: string,
  entityName: string,
  entityType: string,
  template: PromptTemplate
): Promise<boolean> {
  try {
    const res = await fetch('/api/prompts/trackers', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId,
        entityName,
        entityType,
        promptText:     template.text,
        promptCategory: template.category,
      }),
    });
    return res.ok || res.status === 409; // 409 = already tracked, still counts
  } catch {
    return false;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PromptGeneratorForm({ orgId, onTracked }: PromptGeneratorFormProps) {
  // Form state
  const [entityName, setEntityName]   = useState('');
  const [entityType, setEntityType]   = useState('brand');
  const [topic, setTopic]             = useState('');
  const [location, setLocation]       = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Generation state
  const [generating, setGenerating]   = useState(false);
  const [genError, setGenError]       = useState<string | null>(null);
  const [templates, setTemplates]     = useState<PromptTemplate[]>([]);

  // Track state (per-template)
  const [tracked, setTracked]         = useState<Set<string>>(new Set());
  const [tracking, setTracking]       = useState<Set<string>>(new Set());
  const [trackingAll, setTrackingAll] = useState(false);

  // ── Generate ──
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!entityName.trim() || !topic.trim()) return;

    setGenerating(true);
    setGenError(null);
    setTemplates([]);
    setTracked(new Set());

    try {
      const res = await fetch('/api/prompts/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityName: entityName.trim(),
          entityType,
          topic: topic.trim(),
          location: location.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setGenError(data.error ?? 'Generation failed');
        return;
      }

      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch {
      setGenError('Network error — please try again');
    } finally {
      setGenerating(false);
    }
  }

  // ── Track single ──
  async function handleTrack(template: PromptTemplate) {
    const key = template.text;
    if (tracked.has(key) || tracking.has(key)) return;

    setTracking((prev) => new Set(prev).add(key));
    const ok = await trackPrompt(orgId, entityName, entityType, template);
    if (ok) {
      setTracked((prev) => new Set(prev).add(key));
      onTracked?.(1);
    }
    setTracking((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  // ── Track All ──
  async function handleTrackAll() {
    setTrackingAll(true);
    let count = 0;
    for (const t of filteredTemplates) {
      if (tracked.has(t.text)) continue;
      const ok = await trackPrompt(orgId, entityName, entityType, t);
      if (ok) {
        count++;
        setTracked((prev) => new Set(prev).add(t.text));
      }
    }
    if (count > 0) onTracked?.(count);
    setTrackingAll(false);
  }

  const filteredTemplates = categoryFilter === 'all'
    ? templates
    : templates.filter((t) => t.category === categoryFilter);

  const categories = [...new Set(templates.map((t) => t.category))];
  const untrackedCount = filteredTemplates.filter((t) => !tracked.has(t.text)).length;

  return (
    <div className="space-y-6">
      {/* Form */}
      <form onSubmit={handleGenerate} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Generate Prompts</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Entity Name *</label>
            <Input
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="Synthex"
              required
              className="bg-white/5 border-white/20 text-white placeholder:text-slate-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Entity Type *</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full h-9 rounded-md border border-white/20 bg-white/5 text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="brand">Brand</option>
              <option value="product">Product</option>
              <option value="service">Service</option>
              <option value="person">Person</option>
              <option value="location">Location</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Topic / Industry *</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="marketing automation"
              required
              className="bg-white/5 border-white/20 text-white placeholder:text-slate-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Location (optional)</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Sydney, Australia"
              className="bg-white/5 border-white/20 text-white placeholder:text-slate-500 text-sm"
            />
          </div>
        </div>

        {genError && <p className="text-xs text-red-400">{genError}</p>}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={generating || !entityName.trim() || !topic.trim()}
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            {generating ? (
              <>Generating…</>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Generate Prompts
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Results */}
      {templates.length > 0 && (
        <div className="space-y-4">
          {/* Filter + Track All */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCategoryFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs border transition-colors',
                  categoryFilter === 'all'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'border-white/20 text-slate-400 hover:text-slate-300'
                )}
              >
                All ({templates.length})
              </button>
              {categories.map((cat) => {
                const count = templates.filter((t) => t.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs border transition-colors',
                      categoryFilter === cat
                        ? catColour(cat)
                        : 'border-white/20 text-slate-400 hover:text-slate-300'
                    )}
                  >
                    {CATEGORY_CONFIG[cat as PromptCategory]?.label ?? cat} ({count})
                  </button>
                );
              })}
            </div>

            {untrackedCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleTrackAll}
                disabled={trackingAll}
                className="text-xs border-white/20 hover:bg-white/10 text-slate-300"
              >
                {trackingAll ? 'Tracking…' : `Track All (${untrackedCount})`}
              </Button>
            )}
          </div>

          {/* Prompt list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredTemplates.map((t) => {
              const isTracked   = tracked.has(t.text);
              const isTracking  = tracking.has(t.text);
              return (
                <div
                  key={t.text}
                  className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3 hover:border-white/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <span
                      className={cn(
                        'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border mb-1',
                        catColour(t.category)
                      )}
                    >
                      {CATEGORY_CONFIG[t.category as PromptCategory]?.label ?? t.category}
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">{t.text}</p>
                  </div>
                  <button
                    onClick={() => handleTrack(t)}
                    disabled={isTracked || isTracking}
                    className={cn(
                      'shrink-0 w-7 h-7 rounded-md border flex items-center justify-center transition-colors',
                      isTracked
                        ? 'bg-green-500/20 border-green-500/30 text-green-400 cursor-default'
                        : 'border-white/20 text-slate-400 hover:text-white hover:border-white/40'
                    )}
                    title={isTracked ? 'Tracked' : 'Track this prompt'}
                  >
                    {isTracked ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : isTracking ? (
                      <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
