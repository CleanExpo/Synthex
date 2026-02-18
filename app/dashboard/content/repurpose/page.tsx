'use client';

/**
 * Content Repurposer Dashboard Page
 *
 * @description Two-phase UI for repurposing long-form content into multiple
 * short-form derivative formats.
 * Phase 1 (input): source content textarea, source type dropdown, output format checkboxes.
 * Phase 2 (results): format result cards with content preview, metadata, and copy button.
 */

import { useState } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Repeat,
  Copy,
  Check,
  ArrowLeft,
  Loader2,
  FileText,
  Video,
  Layers,
  Lightbulb,
  Quote,
  ListTodo,
} from '@/components/icons';
import type { RepurposedContent, OutputFormat, SourceType } from '@/lib/ai/content-repurposer';

// ============================================================================
// CONSTANTS
// ============================================================================

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: 'blog', label: 'Blog Post' },
  { value: 'article', label: 'Article' },
  { value: 'video_transcript', label: 'Video Transcript' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'newsletter', label: 'Newsletter' },
];

const OUTPUT_FORMATS: { value: OutputFormat; label: string; icon: React.ElementType }[] = [
  { value: 'thread', label: 'Twitter Thread', icon: FileText },
  { value: 'video_script', label: 'Video Script', icon: Video },
  { value: 'carousel_outline', label: 'Carousel Outline', icon: Layers },
  { value: 'key_takeaways', label: 'Key Takeaways', icon: Lightbulb },
  { value: 'summary', label: 'Summary', icon: FileText },
  { value: 'quote_graphics', label: 'Quote Graphics', icon: Quote },
];

const FORMAT_COLORS: Record<OutputFormat, string> = {
  thread: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  video_script: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  carousel_outline: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  key_takeaways: 'bg-green-500/20 text-green-400 border-green-500/30',
  summary: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  quote_graphics: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
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

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function FormatBadge({ format }: { format: OutputFormat }) {
  const colorClass = FORMAT_COLORS[format];
  const formatInfo = OUTPUT_FORMATS.find((f) => f.value === format);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
    >
      {formatInfo?.label ?? format}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <div
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs font-bold ${getScoreBgColor(score)} ${getScoreColor(score)}`}
    >
      {score}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silent fail
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleCopy}
      className="flex-shrink-0 text-xs bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 mr-1 text-green-400" />
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3 mr-1" />
          Copy
        </>
      )}
    </Button>
  );
}

function ResultCard({ result }: { result: RepurposedContent }) {
  const { wordCount, characterCount, itemCount } = result.metadata;
  const formatInfo = OUTPUT_FORMATS.find((f) => f.value === result.format);
  const Icon = formatInfo?.icon ?? FileText;

  return (
    <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Icon className="w-4 h-4 text-cyan-400" />
            <FormatBadge format={result.format} />
          </CardTitle>
          <div className="flex items-center gap-2">
            {result.score !== undefined && <ScoreBadge score={result.score} />}
            <CopyButton text={result.content} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Content preview */}
        <div className="whitespace-pre-wrap text-sm text-slate-300 bg-white/5 rounded-md px-3 py-2 max-h-64 overflow-y-auto leading-relaxed">
          {result.content}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{wordCount.toLocaleString()} words</span>
          <span>{characterCount.toLocaleString()} characters</span>
          {itemCount !== undefined && (
            <span className="text-cyan-400">{itemCount} items</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function RepurposePage() {
  const [content, setContent] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('blog');
  const [selectedFormats, setSelectedFormats] = useState<OutputFormat[]>([]);
  const [results, setResults] = useState<RepurposedContent[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'input' | 'results'>('input');

  const toggleFormat = (value: OutputFormat) => {
    setSelectedFormats((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    );
  };

  const selectAll = () => setSelectedFormats(OUTPUT_FORMATS.map((f) => f.value));
  const clearAll = () => setSelectedFormats([]);

  const handleGenerate = async () => {
    if (content.trim().length < 100 || selectedFormats.length === 0 || isGenerating) return;
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/content/repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceContent: content,
          sourceType,
          outputFormats: selectedFormats,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Request failed (${response.status})`);
      }

      const data = await response.json();
      if (data?.success && Array.isArray(data?.results)) {
        setResults(data.results as RepurposedContent[]);
        setPhase('results');
      } else {
        throw new Error('Unexpected response format from server.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartOver = () => {
    setPhase('input');
    setResults(null);
    setError(null);
  };

  const canGenerate = content.trim().length >= 100 && selectedFormats.length > 0;

  // ============================================================================
  // PHASE 2: RESULTS
  // ============================================================================

  if (phase === 'results' && results) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Content Repurposer"
            description={`Generated ${results.length} format${results.length !== 1 ? 's' : ''} from your content.`}
          />
          <Button
            variant="ghost"
            onClick={handleStartOver}
            className="flex-shrink-0 text-slate-300 hover:text-white hover:bg-white/5 border border-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Start Over
          </Button>
        </div>

        {/* Result cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {results.map((result) => (
            <ResultCard key={result.format} result={result} />
          ))}
        </div>
      </div>
    );
  }

  // ============================================================================
  // PHASE 1: INPUT
  // ============================================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Repurposer"
        description="Transform long-form content into multiple short-form formats for different channels."
      />

      {/* Input card */}
      <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Repeat className="w-5 h-5 text-cyan-400" />
            Source Content & Output Formats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* 1. Source type dropdown */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Source Type
            </label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
              className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-slate-900 text-white">
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Source content textarea */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Source Content
              <span className="ml-2 text-cyan-400 normal-case font-normal">
                (min 100 characters)
              </span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your blog post, article, video transcript, podcast notes, or newsletter content here..."
              rows={10}
              className="w-full px-4 py-3 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30 min-h-[200px]"
            />
            <div className="flex justify-end text-xs text-slate-500">
              {content.length.toLocaleString()} characters
              {content.length < 100 && content.length > 0 && (
                <span className="ml-2 text-yellow-500">
                  ({100 - content.length} more needed)
                </span>
              )}
            </div>
          </div>

          {/* 3. Output format checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Output Formats
                {selectedFormats.length > 0 && (
                  <span className="ml-2 text-cyan-400 normal-case font-normal">
                    ({selectedFormats.length} selected)
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Select All
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OUTPUT_FORMATS.map((format) => {
                const isSelected = selectedFormats.includes(format.value);
                const Icon = format.icon;
                return (
                  <label
                    key={format.value}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFormat(format.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-white/30 bg-white/5'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">{format.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="px-4 py-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 4. Generate button */}
          <div className="flex flex-col sm:flex-row sm:justify-end">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="w-full sm:w-auto bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Repurposing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Repurpose Content
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
