'use client';

/**
 * Content Optimization Dashboard Page
 *
 * @description Split-panel editor with real-time content scoring.
 * Left panel (60%): platform/goal selectors, textarea, character counter, AI optimize button.
 * Right panel (40%): overall score, dimension bars, top suggestions, template suggestions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useContentScore } from '@/hooks/useContentScore';
import type { ScoreResult } from '@/lib/ai/content-scorer';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Lightbulb, FileText } from '@/components/icons';

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  tiktok: 2200,
  facebook: 63206,
  youtube: 5000,
  pinterest: 500,
  reddit: 40000,
  threads: 500,
};

const PLATFORMS = [
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'threads', label: 'Threads' },
] as const;

const GOALS = [
  { value: 'engagement', label: 'Engagement' },
  { value: 'reach', label: 'Reach' },
  { value: 'conversions', label: 'Conversions' },
  { value: 'brand_awareness', label: 'Brand Awareness' },
  { value: 'traffic', label: 'Traffic' },
] as const;

const DIMENSION_LABELS: Record<string, string> = {
  readability: 'Readability',
  engagement: 'Engagement',
  platformFit: 'Platform Fit',
  clarity: 'Clarity',
  emotional: 'Emotional Impact',
};

// ============================================================================
// SCORE COLOR HELPERS
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-green-500/20 border-green-500/30';
  if (score >= 40) return 'bg-yellow-500/20 border-yellow-500/30';
  return 'bg-red-500/20 border-red-500/30';
}

function getDimensionBarColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getCharCountColor(remaining: number, limit: number): string {
  const ratio = remaining / limit;
  if (remaining < 0) return 'text-red-400';
  if (ratio < 0.1) return 'text-yellow-400';
  return 'text-green-400';
}

// ============================================================================
// TEMPLATE TYPE
// ============================================================================

interface PromptTemplate {
  id: string;
  name: string;
  icon?: string | null;
  category: string;
  platforms: string[];
  structure: {
    hook: string;
    body: string;
    cta?: string;
    hashtags?: string[];
  };
  variables?: string[];
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Overall score circle display */
function ScoreCircle({ score }: { score: number }) {
  return (
    <div
      className={`
        relative flex items-center justify-center w-28 h-28 rounded-full border-4
        ${getScoreBgColor(score)}
      `}
    >
      <div className="text-center">
        <div className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</div>
        <div className="text-xs text-slate-400 mt-0.5">/ 100</div>
      </div>
    </div>
  );
}

/** Single dimension score bar */
function DimensionBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-300">{label}</span>
        <span className={`text-sm font-semibold ${getScoreColor(score)}`}>{score}</span>
      </div>
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getDimensionBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

/** Template suggestion card */
function TemplateSuggestionCard({
  template,
  onUse,
}: {
  template: PromptTemplate;
  onUse: (template: PromptTemplate) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      <span className="text-2xl flex-shrink-0">{template.icon ?? '📄'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{template.name}</p>
        <p className="text-xs text-slate-400 capitalize">{template.category}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onUse(template)}
        className="flex-shrink-0 text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/20"
      >
        Use
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ContentOptimizePage() {
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState<string>('linkedin');
  const [goal, setGoal] = useState<string>('engagement');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Real-time scoring via debounced hook
  const { score, isLoading: isScoring } = useContentScore({
    content,
    platform,
    goal,
    debounceMs: 600,
    enabled: content.trim().length > 0,
  });

  // Character count helpers
  const limit = PLATFORM_LIMITS[platform] ?? 2200;
  const charCount = content.length;
  const remaining = limit - charCount;

  // Fetch matching templates when platform changes
  const fetchTemplates = useCallback(async (selectedPlatform: string) => {
    setTemplatesLoading(true);
    try {
      const url = `/api/templates?category=marketing&platform=${selectedPlatform}&limit=3`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        setTemplates([]);
        return;
      }
      const data = await response.json();
      if (data?.success && Array.isArray(data?.templates)) {
        setTemplates((data.templates as PromptTemplate[]).slice(0, 3));
      } else {
        setTemplates([]);
      }
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates(platform);
  }, [platform, fetchTemplates]);

  // "Use template" pre-fills textarea
  const handleUseTemplate = useCallback((template: PromptTemplate) => {
    const { hook, body, cta, hashtags } = template.structure;
    const variables = template.variables ?? [];

    // Build content string from template structure, replacing variables with placeholders
    let assembled = hook;
    if (body) assembled += `\n\n${body}`;
    if (cta) assembled += `\n\n${cta}`;
    if (hashtags && hashtags.length > 0) {
      assembled += `\n\n${hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}`;
    }

    // Replace {{variable}} placeholders
    const filled = variables.reduce((acc, variable) => {
      return acc.replace(
        new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`, 'g'),
        `[${variable}]`
      );
    }, assembled);

    setContent(filled);
  }, []);

  // "Optimize with AI" button
  const handleOptimize = useCallback(async () => {
    if (!content.trim() || isOptimizing) return;
    setIsOptimizing(true);
    try {
      const response = await fetch('/api/ai-content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, platform, goal }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.success && typeof data?.optimized === 'string') {
        setContent(data.optimized);
      }
    } catch {
      // Silent fail — user's original content stays intact
    } finally {
      setIsOptimizing(false);
    }
  }, [content, platform, goal, isOptimizing]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Optimizer"
        description="Write, score, and optimize your content for maximum impact across any platform."
        actions={
          <Button
            onClick={handleOptimize}
            disabled={!content.trim() || isOptimizing}
            className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {isOptimizing ? 'Optimizing...' : 'Optimize with AI'}
          </Button>
        }
      />

      {/* Split-panel layout */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ============================================================
            LEFT PANEL — Editor (60%)
        ============================================================ */}
        <div className="w-full lg:w-[60%] space-y-4">
          <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Content Editor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Selectors row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Platform selector */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value} className="bg-slate-900 text-white">
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Goal selector */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Goal
                  </label>
                  <select
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
                  >
                    {GOALS.map((g) => (
                      <option key={g.value} value={g.value} className="bg-slate-900 text-white">
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Content
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`Write your ${platform} content here...`}
                  rows={8}
                  className="w-full px-4 py-3 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30 min-h-[160px]"
                />
              </div>

              {/* Character counter */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {charCount.toLocaleString()} / {limit.toLocaleString()} characters
                </span>
                <span className={`font-semibold ${getCharCountColor(remaining, limit)}`}>
                  {remaining >= 0
                    ? `${remaining.toLocaleString()} remaining`
                    : `${Math.abs(remaining).toLocaleString()} over limit`}
                </span>
              </div>

              {/* Mobile-only optimize button */}
              <div className="lg:hidden">
                <Button
                  onClick={handleOptimize}
                  disabled={!content.trim() || isOptimizing}
                  className="w-full bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isOptimizing ? 'Optimizing...' : 'Optimize with AI'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ============================================================
            RIGHT PANEL — Scoring (40%)
        ============================================================ */}
        <div className="w-full lg:w-[40%] space-y-4">

          {/* Overall score card */}
          <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                Content Score
                {isScoring && (
                  <span className="text-xs text-slate-400 font-normal ml-2 animate-pulse">
                    Analyzing...
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {score ? (
                <>
                  {/* Score circle */}
                  <div className="flex justify-center">
                    <ScoreCircle score={score.overall} />
                  </div>

                  {/* Dimension bars */}
                  <div className="space-y-3">
                    {(Object.keys(DIMENSION_LABELS) as Array<keyof ScoreResult['dimensions']>).map(
                      (dim) => (
                        <DimensionBar
                          key={dim}
                          label={DIMENSION_LABELS[dim]}
                          score={score.dimensions[dim].score}
                        />
                      )
                    )}
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-slate-500 text-sm">
                  {content.trim().length === 0
                    ? 'Start typing to see your content score'
                    : isScoring
                    ? 'Analyzing your content...'
                    : 'Score will appear here'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top suggestions card */}
          {score && score.topSuggestions.length > 0 && (
            <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  Top Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {score.topSuggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                      <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Suggested templates card */}
          <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Suggested Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 bg-white/5 rounded-lg" />
                  ))}
                </div>
              ) : templates.length > 0 ? (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <TemplateSuggestionCard
                      key={template.id}
                      template={template}
                      onUse={handleUseTemplate}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">
                  No templates available for {platform}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
