'use client';

/**
 * Brand Builder — Brand Identity Card Component (Phase 91)
 *
 * Displays a BrandIdentity record with entity type badge, scores,
 * sameAs platform status, and JSON-LD viewer.
 *
 * @module components/brand/BrandIdentityCard
 */

import { useState } from 'react';
import { Building2, Globe, CheckCircle, XCircle, Eye, EyeOff } from '@/components/icons';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SameAsPlatform {
  key: string;
  label: string;
  url: string | null;
}

interface BrandIdentityRecord {
  id: string;
  entityType: string;
  canonicalName: string;
  canonicalUrl: string;
  description?: string | null;
  logoUrl?: string | null;
  wikidataUrl?: string | null;
  wikipediaUrl?: string | null;
  linkedinUrl?: string | null;
  crunchbaseUrl?: string | null;
  youtubeUrl?: string | null;
  twitterUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  wikidataQId?: string | null;
  kgmid?: string | null;
  kgConfidence?: number | null;
  consistencyScore?: number | null;
  entityGraph?: Record<string, unknown> | null;
  updatedAt: string;
}

interface BrandIdentityCardProps {
  identity: BrandIdentityRecord;
  onReaudit?: () => void;
  onCheckWikidata?: () => void;
  onCheckKG?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entityTypeBadgeClass(entityType: string): string {
  switch (entityType) {
    case 'organization':    return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'person':          return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'local-business':  return 'bg-green-500/20 text-green-300 border-green-500/30';
    default:                return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }
}

function entityTypeLabel(entityType: string): string {
  switch (entityType) {
    case 'organization':   return 'Organisation';
    case 'person':         return 'Person';
    case 'local-business': return 'Local Business';
    default:               return entityType;
  }
}

function scoreColour(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-gray-500';
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrandIdentityCard({
  identity,
  onReaudit,
  onCheckWikidata,
  onCheckKG,
}: BrandIdentityCardProps) {
  const [showJsonLd, setShowJsonLd] = useState(false);

  const sameAsPlatforms: SameAsPlatform[] = [
    { key: 'wikidata',   label: 'Wikidata',     url: identity.wikidataUrl ?? null },
    { key: 'wikipedia',  label: 'Wikipedia',    url: identity.wikipediaUrl ?? null },
    { key: 'linkedin',   label: 'LinkedIn',     url: identity.linkedinUrl ?? null },
    { key: 'crunchbase', label: 'Crunchbase',   url: identity.crunchbaseUrl ?? null },
    { key: 'youtube',    label: 'YouTube',      url: identity.youtubeUrl ?? null },
    { key: 'twitter',    label: 'Twitter/X',    url: identity.twitterUrl ?? null },
    { key: 'facebook',   label: 'Facebook',     url: identity.facebookUrl ?? null },
    { key: 'instagram',  label: 'Instagram',    url: identity.instagramUrl ?? null },
  ];

  const kgPercent = identity.kgConfidence !== null && identity.kgConfidence !== undefined
    ? Math.round(identity.kgConfidence * 100)
    : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{identity.canonicalName}</h3>
            <a
              href={identity.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
            >
              <Globe className="w-3 h-3" />
              {identity.canonicalUrl}
            </a>
          </div>
        </div>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full border font-medium',
          entityTypeBadgeClass(identity.entityType)
        )}>
          {entityTypeLabel(identity.entityType)}
        </span>
      </div>

      {/* Score Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/[0.03] rounded-lg p-3 text-center">
          <div className={cn('text-xl font-bold', scoreColour(identity.consistencyScore))}>
            {identity.consistencyScore !== null && identity.consistencyScore !== undefined
              ? `${identity.consistencyScore}`
              : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Consistency</div>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 text-center">
          <div className={cn('text-xl font-bold', scoreColour(kgPercent))}>
            {kgPercent !== null ? `${kgPercent}%` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">KG Confidence</div>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 text-center">
          <div className={cn('text-xl font-bold', identity.wikidataQId ? 'text-green-400' : 'text-gray-500')}>
            {identity.wikidataQId ?? '—'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Wikidata Q-ID</div>
        </div>
      </div>

      {/* sameAs Platform Grid */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">sameAs Status</p>
        <div className="grid grid-cols-4 gap-2">
          {sameAsPlatforms.map(platform => (
            <div
              key={platform.key}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs',
                platform.url
                  ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                  : 'bg-white/[0.03] border border-white/[0.06] text-gray-500'
              )}
            >
              {platform.url ? (
                <CheckCircle className="w-3 h-3 shrink-0" />
              ) : (
                <XCircle className="w-3 h-3 shrink-0" />
              )}
              <span className="truncate">{platform.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* JSON-LD Viewer */}
      {identity.entityGraph && (
        <div>
          <button
            onClick={() => setShowJsonLd(!showJsonLd)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            {showJsonLd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showJsonLd ? 'Hide JSON-LD' : 'View JSON-LD Entity Graph'}
          </button>
          {showJsonLd && (
            <pre className="mt-2 p-3 bg-black/40 rounded-lg text-xs text-green-300 overflow-auto max-h-64 border border-white/10">
              {JSON.stringify(identity.entityGraph, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {onReaudit && (
          <button
            onClick={onReaudit}
            className="px-3 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-lg transition-colors"
          >
            Re-audit Consistency
          </button>
        )}
        {onCheckWikidata && (
          <button
            onClick={onCheckWikidata}
            className="px-3 py-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 rounded-lg transition-colors"
          >
            Check Wikidata
          </button>
        )}
        {onCheckKG && (
          <button
            onClick={onCheckKG}
            className="px-3 py-1.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 rounded-lg transition-colors"
          >
            Check Knowledge Graph
          </button>
        )}
      </div>
    </div>
  );
}
