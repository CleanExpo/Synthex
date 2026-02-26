'use client';

/**
 * Cross-Post Page
 *
 * Takes a single piece of existing content and adapts it for multiple platforms
 * simultaneously with platform-specific formatting adjustments (length, hashtags,
 * tone). Unlike multi-format (generates from a topic) and repurpose (transforms
 * long-form into posts), cross-post takes a written post and adjusts
 * formatting / character count / hashtags per platform.
 *
 * API fan-out: one concurrent POST to /api/ai-content/cross-post per selected
 * platform. Cards update individually as each response settles.
 * Schedule action: POST to /api/scheduler/posts per card.
 */

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, Copy, Check, Loader2, Globe } from '@/components/icons';
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

interface AdaptOptions {
  adjustLength: boolean;
  addHashtags: boolean;
  adjustTone: boolean;
}

interface PlatformResult {
  platformId: string;
  content: string;
  /** Signed delta: positive = characters added, negative = characters removed. */
  charDiff: number;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
  scheduled: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS: Platform[] = [
  {
    id: 'twitter',
    label: 'Twitter / X',
    charLimit: 280,
    color: 'border-sky-500/30 bg-sky-500/5',
    dotColor: 'bg-sky-400',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    charLimit: 3000,
    color: 'border-blue-500/30 bg-blue-500/5',
    dotColor: 'bg-blue-400',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    charLimit: 2200,
    color: 'border-pink-500/30 bg-pink-500/5',
    dotColor: 'bg-pink-400',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    charLimit: 2200,
    color: 'border-rose-500/30 bg-rose-500/5',
    dotColor: 'bg-rose-400',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    charLimit: 63206,
    color: 'border-indigo-500/30 bg-indigo-500/5',
    dotColor: 'bg-indigo-400',
  },
] as const;

const PLATFORM_MAP = new Map<string, Platform>(PLATFORMS.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// CopyButton — isolated copy state per card
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
      aria-label="Copy adapted content"
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
// ScheduleButton — per-card schedule action
// ---------------------------------------------------------------------------

interface ScheduleButtonProps {
  content: string;
  platformId: string;
  scheduled: boolean;
  onScheduled: () => void;
}

function ScheduleButton({
  content,
  platformId,
  scheduled,
  onScheduled,
}: ScheduleButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSchedule = useCallback(async () => {
    if (scheduled || loading) return;

    setLoading(true);
    try {
      const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const response = await fetch('/api/scheduler/posts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          platform: platformId,
          scheduledAt,
          metadata: {},
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }

      toast.success(`Scheduled for ${platformId} in 1 hour`);
      onScheduled();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Schedule failed';
      toast.error(`Could not schedule: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [content, platformId, scheduled, loading, onScheduled]);

  if (scheduled) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 px-2.5 py-1 rounded-md border border-green-500/30 bg-green-500/10">
        <Check className="h-3 w-3" />
        Scheduled
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSchedule}
      disabled={loading}
      className="h-8 px-2.5 text-zinc-400 hover:text-white hover:bg-zinc-700/60 border border-zinc-700/50 rounded-md transition-colors text-xs"
      aria-label={`Schedule post to ${platformId}`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        'Schedule'
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// CharDiffPill — shows how many characters were added or removed
// ---------------------------------------------------------------------------

function CharDiffPill({ diff }: { diff: number }) {
  if (diff === 0) return null;

  const added = diff > 0;
  const label = added
    ? `+${diff.toLocaleString()} characters added`
    : `${diff.toLocaleString()} characters removed`;

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border ${
        added
          ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
          : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      }`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PlatformAdaptationCard
// ---------------------------------------------------------------------------

interface PlatformAdaptationCardProps {
  result: PlatformResult;
  onScheduled: (platformId: string) => void;
}

function PlatformAdaptationCard({
  result,
  onScheduled,
}: PlatformAdaptationCardProps) {
  const platform = PLATFORM_MAP.get(result.platformId);
  const charCount = result.content.length;
  const charLimit = platform?.charLimit ?? Infinity;
  const isOverLimit = charCount > charLimit;
  const usagePercent =
    charLimit === Infinity ? 0 : Math.min((charCount / charLimit) * 100, 100);

  const handleScheduled = useCallback(() => {
    onScheduled(result.platformId);
  }, [onScheduled, result.platformId]);

  return (
    <Card
      className={`border ${
        platform?.color ?? 'border-zinc-800/50 bg-zinc-900/50'
      } bg-zinc-900/50`}
    >
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          {/* Platform label + dot */}
          <div className="flex items-center gap-2.5 min-w-0">
            {platform && (
              <span
                className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${platform.dotColor}`}
              />
            )}
            <CardTitle className="text-sm font-semibold text-white truncate">
              {platform?.label ?? result.platformId}
            </CardTitle>
          </div>

          {/* Spinner while loading */}
          {result.status === 'loading' && (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400 flex-shrink-0" />
          )}

          {/* Action buttons on success */}
          {result.status === 'success' && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <ScheduleButton
                content={result.content}
                platformId={result.platformId}
                scheduled={result.scheduled}
                onScheduled={handleScheduled}
              />
              <CopyButton text={result.content} />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Pending skeleton */}
        {result.status === 'pending' && (
          <div className="h-24 rounded-md bg-zinc-800/40 border border-zinc-700/30 animate-pulse" />
        )}

        {/* Loading skeleton */}
        {result.status === 'loading' && (
          <div className="space-y-2">
            <div className="h-3 rounded bg-zinc-800/60 animate-pulse w-full" />
            <div className="h-3 rounded bg-zinc-800/60 animate-pulse w-4/5" />
            <div className="h-3 rounded bg-zinc-800/60 animate-pulse w-3/5" />
          </div>
        )}

        {/* Error state */}
        {result.status === 'error' && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            {result.error ?? 'Adaptation failed for this platform.'}
          </p>
        )}

        {/* Success state */}
        {result.status === 'success' && (
          <>
            {/* Adapted content */}
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
              {result.content}
            </p>

            {/* Char diff pill */}
            <CharDiffPill diff={result.charDiff} />

            {/* Character count bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span
                  className={isOverLimit ? 'text-red-400' : 'text-zinc-500'}
                >
                  {charCount.toLocaleString()}
                  {charLimit !== Infinity &&
                    ` / ${charLimit.toLocaleString()} chars`}
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
                    className={`h-1 rounded-full transition-all ${
                      isOverLimit ? 'bg-red-500' : 'bg-violet-500'
                    }`}
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
// OptionToggle — pill-style boolean switch
// ---------------------------------------------------------------------------

interface OptionToggleProps {
  label: string;
  active: boolean;
  onToggle: () => void;
}

function OptionToggle({ label, active, onToggle }: OptionToggleProps) {
  return (
    <label
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer select-none transition-colors ${
        active
          ? 'bg-violet-600/20 border-violet-500/50 text-white'
          : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
      }`}
    >
      <input
        type="checkbox"
        checked={active}
        onChange={onToggle}
        className="sr-only"
      />
      {/* Simple toggle dot */}
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          active ? 'bg-violet-400' : 'bg-zinc-600'
        }`}
      />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function CrossPostPage() {
  // -- Input state --
  const [content, setContent] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(PLATFORMS.map((p) => p.id))
  );
  const [options, setOptions] = useState<AdaptOptions>({
    adjustLength: true,
    addHashtags: true,
    adjustTone: false,
  });

  // -- Output state --
  const [results, setResults] = useState<PlatformResult[]>([]);
  const [isAdapting, setIsAdapting] = useState(false);

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
  // Adaptation option toggle
  // ------------------------------------------------------------------

  const toggleOption = useCallback(
    (key: keyof AdaptOptions) => {
      setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    []
  );

  // ------------------------------------------------------------------
  // Mark a card as scheduled
  // ------------------------------------------------------------------

  const markScheduled = useCallback((platformId: string) => {
    setResults((prev) =>
      prev.map((r) =>
        r.platformId === platformId ? { ...r, scheduled: true } : r
      )
    );
  }, []);

  // ------------------------------------------------------------------
  // Fan-out adaptation — one request per selected platform
  // ------------------------------------------------------------------

  const handleAdapt = useCallback(async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      toast.error('Please enter some content before adapting');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('Select at least one target platform');
      return;
    }

    const platforms = PLATFORMS.filter((p) => selectedIds.has(p.id));
    const originalLength = trimmedContent.length;

    // Initialise all cards in loading state
    setResults(
      platforms.map((p) => ({
        platformId: p.id,
        content: '',
        charDiff: 0,
        status: 'loading',
        scheduled: false,
      }))
    );
    setIsAdapting(true);

    // Fire all requests concurrently; update individual cards as they settle
    const promises = platforms.map(async (platform) => {
      try {
        const response = await fetch('/api/ai-content/cross-post', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: trimmedContent,
            platform: platform.id,
            options: {
              adjustLength: options.adjustLength,
              addHashtags: options.addHashtags,
              adjustTone: options.adjustTone,
            },
          }),
        });

        if (!response.ok) {
          const body = await response
            .json()
            .catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `HTTP ${response.status}`);
        }

        const data = (await response.json()) as {
          content?: string;
          data?: { content?: string };
          error?: string;
        };

        // Support both flat { content } and nested { data: { content } }
        const adapted = data.content ?? data.data?.content ?? '';
        if (!adapted) throw new Error('No adapted content returned from API');

        const charDiff = adapted.length - originalLength;

        setResults((prev) =>
          prev.map((r) =>
            r.platformId === platform.id
              ? { ...r, content: adapted, charDiff, status: 'success' }
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
    setIsAdapting(false);

    // Summary toast after all settle
    setResults((current) => {
      const successCount = current.filter(
        (r) => r.status === 'success'
      ).length;
      const errorCount = current.filter((r) => r.status === 'error').length;

      if (successCount > 0 && errorCount === 0) {
        toast.success(
          `Adapted for ${successCount} platform${successCount !== 1 ? 's' : ''}`
        );
      } else if (successCount > 0) {
        toast.success(
          `Adapted for ${successCount} platform${successCount !== 1 ? 's' : ''}. ${errorCount} failed.`
        );
      } else {
        toast.error('All platforms failed to adapt. Please try again.');
      }

      return current;
    });
  }, [content, selectedIds, options]);

  // ------------------------------------------------------------------
  // Derived flags
  // ------------------------------------------------------------------

  const hasResults = results.length > 0;
  const canAdapt =
    content.trim().length > 0 && selectedIds.size > 0 && !isAdapting;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cross-Post"
        description="Adapt your content for multiple platforms with one click."
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

      {/* ---------------------------------------------------------------- */}
      {/* Input card — Your Content                                        */}
      {/* ---------------------------------------------------------------- */}
      <Card className="bg-zinc-900/50 border border-zinc-800/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Send className="h-4 w-4 text-violet-400" />
            Your Content
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Content textarea */}
          <div className="space-y-1.5">
            <label
              htmlFor="cross-post-content"
              className="text-xs font-medium text-zinc-400 uppercase tracking-wide"
            >
              Content to cross-post
            </label>
            <textarea
              id="cross-post-content"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or type your existing post here. The AI will adapt it for each platform's character limits, hashtag conventions, and audience norms."
              className="w-full rounded-md px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 bg-zinc-800/50 border border-zinc-700/50 focus:outline-none focus:ring-1 focus:ring-violet-500/60 focus:border-violet-500/40 transition-colors resize-y min-h-[120px]"
            />
            <p className="text-xs text-zinc-500 text-right">
              {content.length.toLocaleString()} characters
            </p>
          </div>

          {/* Platform selection */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Target platforms
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
                      className={`h-1.5 w-1.5 rounded-full ${
                        active ? platform.dotColor : 'bg-zinc-600'
                      }`}
                    />
                    {platform.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Adaptation options */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Adaptation options
            </p>
            <div className="flex flex-wrap gap-2">
              <OptionToggle
                label="Adjust length"
                active={options.adjustLength}
                onToggle={() => toggleOption('adjustLength')}
              />
              <OptionToggle
                label="Add hashtags"
                active={options.addHashtags}
                onToggle={() => toggleOption('addHashtags')}
              />
              <OptionToggle
                label="Adjust tone"
                active={options.adjustTone}
                onToggle={() => toggleOption('adjustTone')}
              />
            </div>
          </div>

          {/* Adapt & Post button */}
          <div className="flex justify-end pt-1">
            <Button
              onClick={handleAdapt}
              disabled={!canAdapt}
              className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40 disabled:cursor-not-allowed px-5"
            >
              {isAdapting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adapting...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Adapt &amp; Post
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Results grid — Platform Adaptations                              */}
      {/* ---------------------------------------------------------------- */}
      {hasResults && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">
            Platform Adaptations
            {isAdapting && (
              <span className="ml-2 text-violet-400">
                — adapting
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
              <PlatformAdaptationCard
                key={result.platformId}
                result={result}
                onScheduled={markScheduled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
