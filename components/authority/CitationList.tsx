'use client';

import { useState } from 'react';
import { Copy, Check } from '@/components/icons';
import type { GeneratedCitation } from '@/lib/authority/types';

interface CitationListProps {
  citations: GeneratedCitation[];
}

const SOURCE_COLORS: Record<string, string> = {
  government: 'bg-emerald-500/20 text-emerald-300',
  academic: 'bg-blue-500/20 text-blue-300',
  industry: 'bg-purple-500/20 text-purple-300',
  web: 'bg-slate-500/20 text-slate-300',
};

export function CitationList({ citations }: CitationListProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = async () => {
    const block = citations.map((c, i) => `[${i + 1}] ${c.citationText}`).join('\n');
    await navigator.clipboard.writeText(block);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  if (citations.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        No citations generated yet. Analyse content to generate citations.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={copyAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 transition-colors"
        >
          {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copiedAll ? 'Copied!' : 'Copy All'}
        </button>
      </div>

      {citations.map((citation, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
          <span className="text-xs text-slate-500 shrink-0 mt-0.5 font-mono">[{i + 1}]</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-300">{citation.citationText}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-1.5 py-0.5 rounded ${SOURCE_COLORS[citation.sourceType] ?? SOURCE_COLORS.web}`}>
                {citation.sourceType}
              </span>
              <span className="text-xs text-slate-500">{Math.round(citation.confidence * 100)}% confidence</span>
            </div>
          </div>
          <button
            onClick={() => copy(citation.citationText, i)}
            className="shrink-0 p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-slate-300 transition-colors"
          >
            {copiedIndex === i ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      ))}
    </div>
  );
}
