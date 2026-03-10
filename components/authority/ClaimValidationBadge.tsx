'use client';

import { useState } from 'react';
import { CheckCircle, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from '@/components/icons';
import type { ValidatedClaim } from '@/lib/authority/types';

interface ClaimValidationBadgeProps {
  claim: ValidatedClaim;
}

export function ClaimValidationBadge({ claim }: ClaimValidationBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-white/10 rounded-lg bg-white/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/5 transition-colors"
      >
        {claim.verified ? (
          <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-300 line-clamp-2">{claim.text}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-medium ${claim.verified ? 'text-emerald-400' : 'text-amber-400'}`}>
              {claim.verified ? 'Verified' : 'Unverified'}
            </span>
            <span className="text-xs text-slate-500">{Math.round(claim.confidence * 100)}% confidence</span>
            <span className="text-xs text-slate-500 capitalize">{claim.type}</span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        )}
      </button>

      {expanded && claim.sources.length > 0 && (
        <div className="border-t border-white/10 p-3 space-y-2">
          {claim.sources.slice(0, 3).map((source, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs text-slate-500 shrink-0 mt-0.5">{i + 1}.</span>
              <div className="min-w-0">
                <p className="text-xs text-slate-300 truncate">{source.title}</p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  onClick={e => e.stopPropagation()}
                >
                  {source.sourceName} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
