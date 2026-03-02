'use client';

/**
 * Multi-format Content Generator
 *
 * Generates platform-optimized content for multiple social channels
 * simultaneously from a single topic input. Calls /api/ai-content/generate
 * once per selected platform and streams results into individual cards as
 * each response resolves.
 */

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layers, Copy, Check, Loader2, Calendar } from '@/components/icons';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Platform {
  readonly id: string;
  readonly label: string;
  readonly charLimit: number;
  readonly color: string;
  readonly dotColor: string;
}

interface PlatformResult {
  platformId: string;
  content: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
}

type Tone = 'casual' | 'professional' | 'humorous' | 'educational';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS: Platform[] = [
  { id: 'twitter',   label: 'Twitter / X',  charLimit: 280,   color: 'border-sky-500/30 bg-sky-500/5',       dotColor: 'bg-sky-400' },
  { id: 'linkedin',  label: 'LinkedIn',      charLimit: 3000,  color: 'border-blue-500/30 bg-blue-500/5',     dotColor: 'bg-blue-400' },
  { id: 'instagram', label: 'Instagram',     charLimit: 2200,  color: 'border-pink-500/30 bg-pink-500/5',     dotColor: 'bg-pink-400' },
  { id: 'tiktok',    label: 'TikTok',        charLimit: 2200,  color: 'border-rose-500/30 bg-rose-500/5',     dotColor: 'bg-rose-400' },
  { id: 'facebook',  label: 'Facebook',      charLimit: 63206, color: 'border-indigo-500/30 bg-indigo-500/5', dotColor: 'bg-indigo-400' },
  { id: 'youtube',   label: 'YouTube',       charLimit: 5000,  color: 'border-red-500/30 bg-red-500/5',       dotColor: 'bg-red-400' },
  { id: 'pinterest', label: 'Pinterest',     charLimit: 500,   color: 'border-red-600/30 bg-red-600/5',       dotColor: 'bg-red-500' },
  { id: 'reddit',    label: 'Reddit',        charLimit: 40000, color: 'border-orange-500/30 bg-orange-500/5', dotColor: 'bg-orange-400' },
  { id: 'threads',   label: 'Threads',       charLimit: 500,   color: 'border-gray-400/30 bg-gray-400/5',     dotColor: 'bg-gray-300' },
] as const;

const TONES: { value: Tone; label: string }[] = [
  { value: 'casual',       label: 'Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'humorous',     label: 'Humorous' },
  { value: 'educational',  label: 'Educational' },
];

const PLATFORM_MAP = new Map<string, Platform>(PLATFORMS.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// CopyButton — isolated copy-state per card
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy — please select and copy manually');
    }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-8 px-2.5 text-zinc-400 hover:text-white hover:bg-zinc-700/60 border border-zinc-700/50 rounded-md transition-colors"
      aria-label="Copy content"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// PlatformResultCard
// ---------------------------------------------------------------------------

interface PlatformResultCardProps {
  result: PlatformResult;
}

function PlatformResultCard({ result }: PlatformResultCardProps) {
  const platform = PLATFORM_MAP.get(result.platformId);
  const charCount = result.content.length;
  const charLimit = platform?.charLimit ?? Infinity;
  const isOverLimit = charCount > charLimit;
  const usagePercent = charLimit === Infinity ? 0 : Math.min((charCount / charLimit) * 100, 100);

  return (
    <Card className={`border ${platform?.color ?? 'border-zinc-800/50 bg-zinc-900/50'} bg-zinc-900/50`}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {platform && (
              <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${platform.dotColor}`} />
            )}
            <CardTitle className="text-sm font-semibold text-white truncate">
              {platform?.label ?? result.platformId}
            </CardTitle>
          </div>

          {result.status === 'loading' && (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400 flex-shrink-0" />
          )}
          {result.status === 'success' && (
            <CopyButton text={result.content} />
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {result.status === 'pending' && (
          <div className="h-24 rounded-md bg-zinc-800/40 border border-zinc-700/30 animate-pulse" />
        )}

        {result.status === 'loading' && (
          <div className="space-y-2">
            <div className="h-3 rounded bg-zinc-800/60 animate-pulse w-full" />
            <div className="h-3 rounded bg-zinc-800/60 animate-pulse w-4/5" />
            <div className="h-3 rounded bg-zinc-800/60 animate-pulse w-3/5" />
          </div>
        )}

        {result.status === 'error' && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            {result.error ?? 'Generation failed for this platform.'}
          </p>
        )}

        {result.status === 'success' && (
          <>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
              {result.content}
            </p>

            {/* Character count bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className={isOverLimit ? 'text-red-400' : 'text-zinc-500'}>
                  {charCount.toLocaleString()}
                  {charLimit !== Infinity && ` / ${charLimit.toLocaleString()} chars`}
                </span>
                {isOverLimit && (
                  <span className="text-red-400 font-medium">
                    {(charCount - charLimit).toLocaleString()} over limit
                  </span>
                )}
              </div>
              {charLimit !== Infinity && (
                <div className="h-1 w-full rounded-full bg-zinc-800">
                  <div
                    className={`h-1 rounded-full transition-all ${isOverLimit ? 'bg-red-500' : 'bg-violet-500'}`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function MultiFormatPage() {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<Tone>('casual');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(PLATFORMS.map((p) => p.id))
  );
  const [results, setResults] = useState<PlatformResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // ------------------------------------------------------------------
  // Platform checkbox toggle
  // ------------------------------------------------------------------

  const togglePlatform = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ------------------------------------------------------------------
  // Generation — fan out one request per platform
  // ------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      toast.error('Please enter a topic before generating');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('Select at least one platform');
      return;
    }

    const platforms = PLATFORMS.filter((p) => selectedIds.has(p.id));

    // Initialise all cards in loading state
    setResults(
      platforms.map((p) => ({
        platformId: p.id,
        content: '',
        status: 'loading',
      }))
    );
    setIsGenerating(true);

    // Fire all requests concurrently; update individual cards as they settle
    const promises = platforms.map(async (platform) => {
      try {
        const response = await fetch('/api/content/generate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: platform.id,
            topic: trimmedTopic,
            tone,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `HTTP ${response.status}`);
        }

        const data = await response.json() as {
          success?: boolean;
          content?: string;
          data?: { content?: string };
          error?: string;
        };

        // Support both flat `{ content }` and nested `{ data: { content } }` shapes
        const content =
          data.content ??
          data.data?.content ??
          '';

        if (!content) throw new Error('No content returned from API');

        setResults((prev) =>
          prev.map((r) =>
            r.platformId === platform.id
              ? { ...r, content, status: 'success' }
              : r
          )
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unexpected error';

        setResults((prev) =>
          prev.map((r) =>
            r.platformId === platform.id
              ? { ...r, status: 'error', error: message }
              : r
          )
        );
      }
    });

    await Promise.allSettled(promises);
    setIsGenerating(false);

    // Surface summary toast after all settle
    setResults((current) => {
      const successCount = current.filter((r) => r.status === 'success').length;
      const errorCount   = current.filter((r) => r.status === 'error').length;

      if (successCount > 0 && errorCount === 0) {
        toast.success(`Generated content for ${successCount} platform${successCount !== 1 ? 's' : ''}`);
      } else if (successCount > 0) {
        toast.success(`Generated for ${successCount} platform${successCount !== 1 ? 's' : ''}. ${errorCount} failed.`);
      } else {
        toast.error('All platforms failed to generate. Please try again.');
      }

      return current;
    });
  }, [topic, tone, selectedIds]);

  const hasResults = results.length > 0;
  const canGenerate = topic.trim().length > 0 && selectedIds.size > 0 && !isGenerating;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Multi-format Generator"
        description="Enter a topic and generate tailored content for every platform at once."
        actions={
          hasResults ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResults([])}
              className="text-zinc-400 hover:text-white border border-zinc-700/50 hover:bg-zinc-800/50"
            >
              Clear results
            </Button>
          ) : undefined
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Input card                                                          */}
      {/* ------------------------------------------------------------------ */}
      <Card className="bg-zinc-900/50 border border-zinc-800/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-400" />
            Content settings
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Topic */}
          <div className="space-y-1.5">
            <label
              htmlFor="topic-input"
              className="text-xs font-medium text-zinc-400 uppercase tracking-wide"
            >
              Topic
            </label>
            <input
              id="topic-input"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canGenerate) handleGenerate();
              }}
              placeholder="e.g. 5 productivity habits that changed my life"
              className="w-full h-10 rounded-md px-3 text-sm text-white placeholder:text-zinc-600 bg-zinc-800/50 border border-zinc-700/50 focus:outline-none focus:ring-1 focus:ring-violet-500/60 focus:border-violet-500/40 transition-colors"
            />
          </div>

          {/* Platform selection */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Platforms
              <span className="ml-2 normal-case font-normal text-violet-400">
                {selectedIds.size} selected
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => {
                const active = selectedIds.has(platform.id);
                return (
                  <label
                    key={platform.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer select-none transition-colors ${
                      active
                        ? 'bg-violet-600/20 border-violet-500/50 text-white'
                        : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => togglePlatform(platform.id)}
                      className="sr-only"
                    />
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${active ? platform.dotColor : 'bg-zinc-600'}`}
                    />
                    {platform.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <label
              htmlFor="tone-select"
              className="text-xs font-medium text-zinc-400 uppercase tracking-wide"
            >
              Tone
            </label>
            <select
              id="tone-select"
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="h-10 rounded-md px-3 text-sm text-white bg-zinc-800/50 border border-zinc-700/50 focus:outline-none focus:ring-1 focus:ring-violet-500/60 focus:border-violet-500/40 transition-colors appearance-none cursor-pointer"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value} className="bg-zinc-900">
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Generate button */}
          <div className="flex justify-end pt-1">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40 disabled:cursor-not-allowed px-5"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Generate content
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Results grid                                                        */}
      {/* ------------------------------------------------------------------ */}
      {hasResults && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">
            Results
            {isGenerating && (
              <span className="ml-2 text-violet-400">
                — generating
                <span className="inline-flex ml-1 gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                </span>
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((result) => (
              <PlatformResultCard key={result.platformId} result={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
