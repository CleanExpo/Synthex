'use client';

/**
 * PR AI Generator Form (Phase 93)
 *
 * Collects story details from the user and calls POST /api/pr/press-releases/generate
 * to generate an AI-powered press release. Shows a preview with a "Save as Draft"
 * action that calls POST /api/pr/press-releases.
 *
 * @module components/pr/PRGeneratorForm
 */

import { useState } from 'react';
import { Loader2, Sparkles, ChevronDown, ChevronUp, AlertCircle, Save, CheckCircle } from '@/components/icons';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedRelease {
  title: string;
  summary: string;
  body: string;
  suggestedSlug: string;
  isAIGenerated: boolean;
}

interface SavedRelease {
  id: string;
  slug: string;
  headline: string;
}

export interface PRGeneratorFormProps {
  onSaved?: (release: SavedRelease) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetchJson = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PRGeneratorForm({ onSaved }: PRGeneratorFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedRelease | null>(null);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [brandName, setBrandName] = useState('');
  const [angle, setAngle] = useState('');
  const [keyFacts, setKeyFacts] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [quoteName, setQuoteName] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [category, setCategory] = useState<string>('other');

  // ---------------------------------------------------------------------------
  // Generate handler
  // ---------------------------------------------------------------------------

  const handleGenerate = async () => {
    setError(null);
    setGenerated(null);
    setSaved(false);

    if (!brandName.trim() || !angle.trim() || !targetAudience.trim() || !quoteName.trim() || !quoteText.trim()) {
      setError('Please fill in Brand Name, Angle, Target Audience, Quote Name and Quote Text.');
      return;
    }

    const factsArray = keyFacts
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    if (factsArray.length === 0) {
      setError('Please enter at least one key fact.');
      return;
    }

    setIsGenerating(true);
    try {
      const data = (await fetchJson('/api/pr/press-releases/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: brandName.trim(),
          angle: angle.trim(),
          keyFacts: factsArray,
          targetAudience: targetAudience.trim(),
          quoteName: quoteName.trim(),
          quoteText: quoteText.trim(),
          category,
        }),
      })) as { generated: GeneratedRelease };

      setGenerated(data.generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Save handler
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!generated) return;
    setIsSaving(true);
    setError(null);

    try {
      const data = (await fetchJson('/api/pr/press-releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: generated.title,
          body: generated.body,
          slug: generated.suggestedSlug,
          status: 'draft',
          category,
        }),
      })) as { release: SavedRelease & { headline: string } };

      setSaved(true);
      setGenerated(null);
      setIsExpanded(false);
      onSaved?.(data.release);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.03] overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Generate with AI</span>
          <span className="text-xs text-gray-500">— fill in the details, we write the press release</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Expandable form */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/[0.06]">
          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Brand name */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Brand / Company Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              >
                <option value="funding">Funding</option>
                <option value="product">Product</option>
                <option value="partnership">Partnership</option>
                <option value="award">Award</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Angle */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              News Angle <span className="text-red-400">*</span>
            </label>
            <textarea
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="e.g. Series A funding round of $5M AUD to accelerate product development"
              rows={2}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
            />
          </div>

          {/* Key facts */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Key Facts <span className="text-red-400">*</span>
              <span className="ml-1 text-gray-600 font-normal">— one fact per line</span>
            </label>
            <textarea
              value={keyFacts}
              onChange={(e) => setKeyFacts(e.target.value)}
              placeholder={`$5M AUD raised in Series A\n3 lead investors: XYZ Ventures, ABC Capital\nProduct launches Q2 2026\n2,000 customers in ANZ region`}
              rows={4}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none font-mono"
            />
          </div>

          {/* Target audience */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Target Audience <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. B2B SaaS founders and tech journalists in Australia"
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quote name */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Quote — Spokesperson Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={quoteName}
                onChange={(e) => setQuoteName(e.target.value)}
                placeholder="Jane Smith, CEO"
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>

            {/* Quote text */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Quote Text <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder="This investment validates our vision for..."
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-black transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating press release...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Press Release
              </>
            )}
          </button>

          {/* Preview panel */}
          {generated && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Generated Preview
                  {!generated.isAIGenerated && (
                    <span className="ml-2 text-amber-400 normal-case font-normal">(template fallback — no AI key configured)</span>
                  )}
                </h3>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-0.5">Headline</p>
                <p className="text-sm font-semibold text-white">{generated.title}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-0.5">Summary</p>
                <p className="text-sm text-gray-300">{generated.summary}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Body</p>
                <pre className={cn(
                  'text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed',
                  'max-h-64 overflow-y-auto rounded-lg bg-black/20 p-3',
                )}>
                  {generated.body}
                </pre>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 text-xs font-semibold text-green-300 transition-colors"
                >
                  {isSaving ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-3.5 w-3.5" /> Save as Draft</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setGenerated(null)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle className="h-4 w-4" />
              Press release saved as draft successfully.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
