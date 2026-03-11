'use client';

/**
 * NominationEditor — Display and edit an AI-generated award nomination (Phase 94)
 *
 * @module components/awards/NominationEditor
 */

import { useState } from 'react';
import { Copy, RefreshCw, Check } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface NominationEditorProps {
  awardName: string;
  nominationDraft: string;
  isAiGenerated?: boolean;
  isRegenerating?: boolean;
  onRegenerate: () => void;
  onChange?: (text: string) => void;
}

export function NominationEditor({
  awardName,
  nominationDraft,
  isAiGenerated = false,
  isRegenerating = false,
  onRegenerate,
  onChange,
}: NominationEditorProps) {
  const [text, setText]       = useState(nominationDraft);
  const [copied, setCopied]   = useState(false);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleChange(val: string) {
    setText(val);
    onChange?.(val);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-white">{awardName}</h3>
          <p className="text-xs text-slate-400">
            {isAiGenerated ? 'AI-generated nomination' : 'Template-based nomination'}
            {' · '}
            <span className="text-slate-500">{wordCount} words</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
              copied
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60'
            )}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
              isRegenerating
                ? 'opacity-50 cursor-not-allowed bg-slate-700/40 text-slate-500'
                : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
            )}
          >
            <RefreshCw className={cn('h-3 w-3', isRegenerating && 'animate-spin')} />
            {isRegenerating ? 'Generating…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={12}
        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 resize-y focus:outline-none focus:ring-1 focus:ring-purple-500/50 font-mono leading-relaxed"
        placeholder="Nomination text will appear here…"
      />
    </div>
  );
}
