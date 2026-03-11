'use client';

import { useEffect, useRef, useState } from 'react';
import type { TacticScoreResult } from '@/lib/geo/types';

interface GEOEditorPanelProps {
  onScoreUpdate: (result: TacticScoreResult | null) => void;
  onLoadingChange: (loading: boolean) => void;
  /** Optional: called when the editor content changes (for lifting state to parent) */
  onContentChange?: (content: string) => void;
  /** Optional: controlled value from parent (for accepting rewrites) */
  value?: string;
}

export function GEOEditorPanel({
  onScoreUpdate,
  onLoadingChange,
  onContentChange,
  value,
}: GEOEditorPanelProps) {
  const [content, setContent] = useState(value ?? '');
  const [isScoring, setIsScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync controlled value from parent (e.g., accepted rewrite)
  useEffect(() => {
    if (value !== undefined && value !== content) {
      setContent(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Debounced scoring (500ms)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (content.length < 50) {
      onScoreUpdate(null);
      return;
    }

    timerRef.current = setTimeout(async () => {
      onLoadingChange(true);
      setIsScoring(true);
      setError(null);
      try {
        const res = await fetch('/api/geo/tactic-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content }),
        });
        if (!res.ok) throw new Error('Scoring failed');
        const data = await res.json();
        onScoreUpdate(data.data as TacticScoreResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Scoring error');
      } finally {
        setIsScoring(false);
        onLoadingChange(false);
      }
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    setContent(newValue);
    onContentChange?.(newValue);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="text-sm font-medium text-slate-300 mb-2">Content Editor</div>

      {/* Textarea */}
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Paste your content here to score it against the 9 Princeton GEO tactics — authoritative citations, statistics, quotations, fluency, readability, technical vocabulary, uniqueness, information flow, and persuasion..."
        className="flex-1 w-full bg-white/5 border border-white/10 rounded-lg p-4 text-slate-200 text-sm resize-none focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-600 font-mono leading-relaxed min-h-[500px] transition-colors"
      />

      {/* Content too short hint */}
      {content.length > 0 && content.length < 50 && (
        <p className="text-xs text-slate-600 mt-1">
          Add at least 50 characters to start scoring ({50 - content.length} more needed)
        </p>
      )}

      {/* Footer */}
      <div className="flex items-centre gap-3 mt-2 text-xs text-slate-500">
        <span>{wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}</span>
        <span>·</span>
        {error ? (
          <span className="text-red-400">{error}</span>
        ) : isScoring ? (
          <span className="flex items-centre gap-1.5 text-amber-400">
            <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Scoring...
          </span>
        ) : content.length >= 50 ? (
          <span className="flex items-centre gap-1 text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Ready
          </span>
        ) : (
          <span>Waiting for content...</span>
        )}
      </div>
    </div>
  );
}
