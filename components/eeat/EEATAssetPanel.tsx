'use client';

/**
 * EEATAssetPanel — Phase 90 component
 *
 * Displays an EEATAssetPlan with collapsible asset cards.
 * Each card shows the template content with a "Copy" button.
 * Quick wins (high priority) are highlighted at the top.
 *
 * @module components/eeat/EEATAssetPanel
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { EEATAssetPlan, EEATAsset, EEATAssetPriority } from '@/lib/eeat/audit-types';

// ─── Priority badge ───────────────────────────────────────────────────────────

function priorityClass(priority: EEATAssetPriority): string {
  switch (priority) {
    case 'high':   return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    case 'medium': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    case 'low':    return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
  }
}

function typeLabel(type: EEATAsset['type']): string {
  switch (type) {
    case 'author-bio':          return 'Author Bio';
    case 'credential-checklist': return 'Credentials';
    case 'schema-template':     return 'Schema';
    case 'trust-signal':        return 'Trust Signal';
    case 'citation-template':   return 'Citation';
  }
}

// ─── AssetCard ────────────────────────────────────────────────────────────────

function AssetCard({ asset }: { asset: EEATAsset }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(asset.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access may be denied — silent fail
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Card header — always visible */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        {/* Priority badge */}
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 capitalize', priorityClass(asset.priority))}>
          {asset.priority}
        </span>
        {/* Type badge */}
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 flex-shrink-0">
          {typeLabel(asset.type)}
        </span>
        {/* Title */}
        <span className="text-sm font-medium text-white flex-1 text-left truncate">{asset.title}</span>
        {/* Chevron */}
        <span className={cn('text-slate-500 text-xs transition-transform flex-shrink-0', open && 'rotate-180')}>
          ▼
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-3">
          <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words bg-black/20 rounded-lg p-3 font-mono leading-relaxed max-h-64 overflow-y-auto">
            {asset.content}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
              copied
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white'
            )}
          >
            {copied ? '✓ Copied!' : 'Copy Template'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── EEATAssetPanel ───────────────────────────────────────────────────────────

interface EEATAssetPanelProps {
  plan: EEATAssetPlan;
  currentScore?: number;
  className?: string;
}

export function EEATAssetPanel({ plan, currentScore, className }: EEATAssetPanelProps) {
  const { assets, totalImpact, quickWins } = plan;
  const estimatedScore = currentScore !== undefined
    ? Math.min(100, currentScore + totalImpact)
    : undefined;

  if (assets.length === 0) {
    return (
      <div className={cn('bg-white/5 border border-white/10 rounded-xl p-6 text-center space-y-2', className)}>
        <p className="text-emerald-400 font-medium">All E-E-A-T signals detected</p>
        <p className="text-sm text-slate-500">No additional assets needed. Your content has strong E-E-A-T signals.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            {assets.length} asset{assets.length !== 1 ? 's' : ''} ready to implement
          </p>
          {estimatedScore !== undefined && (
            <p className="text-xs text-slate-400 mt-0.5">
              Implementing all assets could improve your score to ~{estimatedScore}
            </p>
          )}
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-medium">
          +{totalImpact} estimated pts
        </span>
      </div>

      {/* Quick wins section */}
      {quickWins.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-1">
            Quick Wins
          </p>
          {quickWins.map((asset, i) => (
            <AssetCard key={`qw-${i}`} asset={asset} />
          ))}
        </div>
      )}

      {/* All assets */}
      <div className="space-y-2">
        {quickWins.length > 0 && (
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-1">
            All Assets
          </p>
        )}
        {assets.map((asset, i) => (
          <AssetCard key={`a-${i}`} asset={asset} />
        ))}
      </div>
    </div>
  );
}
