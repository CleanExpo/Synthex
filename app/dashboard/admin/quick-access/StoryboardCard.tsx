'use client';

/**
 * Per-item visual frame for the Quick Access Storyboard.
 *
 * External URLs (http://...) render as a copy-to-clipboard button — clicking
 * copies the URL for the user to paste into their real browser. This sidesteps
 * the preview iframe sandbox which whitelists localhost URLs only.
 *
 * Internal URLs (starting with /) render as a regular anchor.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { QuickAccessItem, ItemStatus, ItemKind } from '@/lib/quick-access/items';

// ── Status treatment (the colour-coded visual language) ─────────────────────

const STATUS_THEME: Record<
  ItemStatus,
  { border: string; bg: string; accent: string; ring: string }
> = {
  'approval-needed': {
    border: 'border-l-orange-500',
    bg: 'bg-orange-500/5',
    accent: 'text-orange-700 dark:text-orange-400',
    ring: 'hover:ring-orange-500/30',
  },
  'changes-required': {
    border: 'border-l-amber-500 border-dashed',
    bg: 'bg-amber-500/5',
    accent: 'text-amber-700 dark:text-amber-400',
    ring: 'hover:ring-amber-500/30',
  },
  'human-action': {
    border: 'border-l-sky-500',
    bg: 'bg-sky-500/5',
    accent: 'text-sky-700 dark:text-sky-400',
    ring: 'hover:ring-sky-500/30',
  },
  reference: {
    border: 'border-l-slate-500',
    bg: 'bg-slate-500/5',
    accent: 'text-slate-700 dark:text-slate-400',
    ring: 'hover:ring-slate-500/30',
  },
  'live-link': {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/5',
    accent: 'text-emerald-700 dark:text-emerald-400',
    ring: 'hover:ring-emerald-500/30',
  },
};

// ── Kind icon (single character glyph + visual block) ───────────────────────

const KIND_ICON: Record<ItemKind, { glyph: string; label: string }> = {
  'launch-package': { glyph: '🚀', label: 'launch' },
  copy: { glyph: '✍', label: 'copy' },
  storyboard: { glyph: '🎬', label: 'storyboard' },
  curriculum: { glyph: '🎓', label: 'curriculum' },
  evidence: { glyph: '📊', label: 'evidence' },
  runbook: { glyph: '📅', label: 'runbook' },
  discipline: { glyph: '📐', label: 'discipline' },
  verification: { glyph: '⚠', label: 'verify' },
  setup: { glyph: '⚙', label: 'setup' },
  recording: { glyph: '🎥', label: 'record' },
  handoff: { glyph: '📋', label: 'handoff' },
  debug: { glyph: '🐛', label: 'debug' },
  authoring: { glyph: '✒', label: 'authoring' },
  link: { glyph: '🔗', label: 'link' },
};

const BRAND_LABEL: Record<string, string> = {
  ra: 'RA',
  dr: 'DR',
  nrpg: 'NRPG',
  carsi: 'CARSI',
  synthex: 'SYNTHEX',
  portfolio: 'PORTFOLIO',
};

// ── Component ────────────────────────────────────────────────────────────────

interface StoryboardCardProps {
  item: QuickAccessItem;
}

export function StoryboardCard({ item }: StoryboardCardProps) {
  const theme = STATUS_THEME[item.status];
  const icon = KIND_ICON[item.kind];

  const linearUrl = item.linearTicket
    ? `https://linear.app/unite-group/issue/${item.linearTicket}`
    : null;
  const primaryHref = item.externalUrl ?? linearUrl ?? null;
  const isExternalHref = primaryHref?.startsWith('http') ?? false;
  const isInternalHref = primaryHref?.startsWith('/') ?? false;

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopy = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!primaryHref) return;
    try {
      // Try the modern clipboard API first
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(primaryHref);
      } else {
        // Fallback: legacy execCommand path for sandboxed contexts
        const textarea = document.createElement('textarea');
        textarea.value = primaryHref;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setCopyError(null);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : 'Copy failed');
      setTimeout(() => setCopyError(null), 3000);
    }
  };

  // ── Content (shared between anchor / button / div wrappers) ──────────────

  const cardClassName =
    'group flex flex-col gap-2 border-l-4 ring-2 ring-transparent transition-all ' +
    theme.border +
    ' ' +
    theme.bg +
    ' ' +
    theme.ring +
    (item.highlight ? ' shadow-md' : '') +
    (primaryHref ? ' cursor-pointer' : '');

  const innerContent = (
    <CardContent className="flex flex-col gap-2 p-4">
      {/* Top row · icon + brand · highlight star */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-base"
            aria-hidden="true"
          >
            {icon.glyph}
          </span>
          <span className={'text-[10px] uppercase tracking-wider ' + theme.accent}>
            {icon.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {item.brandSlug && BRAND_LABEL[item.brandSlug] && (
            <Badge variant="outline" className="font-mono text-[9px]">
              {BRAND_LABEL[item.brandSlug]}
            </Badge>
          )}
          {item.highlight && (
            <span className="text-amber-500" aria-label="highlighted">★</span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold leading-tight">{item.title}</h3>

      {/* Summary */}
      <p className="text-xs leading-relaxed text-muted-foreground">{item.summary}</p>

      {/* Bottom row · time cost · linear · badges */}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {typeof item.timeCostMin === 'number' && (
          <span className={'text-[10px] font-medium ' + theme.accent}>
            ⏱ {item.timeCostMin} min
          </span>
        )}
        {item.linearTicket && (
          <Badge variant="secondary" className="font-mono text-[9px]">
            {item.linearTicket}
          </Badge>
        )}
        {item.badges?.map(b => (
          <span
            key={b}
            className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground"
          >
            {b}
          </span>
        ))}
      </div>

      {/* URL footer · only for items with a primaryHref · always visible so the
          user can scan or right-click the URL even if click navigation is
          blocked by the preview iframe sandbox */}
      {primaryHref && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
          <code className="truncate font-mono text-[9px] text-muted-foreground" title={primaryHref}>
            {primaryHref}
          </code>
          <span
            className={
              'shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium transition-colors ' +
              (copied
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                : copyError
                ? 'bg-destructive/20 text-destructive'
                : isExternalHref
                ? 'bg-muted ' + theme.accent
                : 'bg-muted ' + theme.accent)
            }
          >
            {copied
              ? '✓ copied'
              : copyError
              ? '✗ ' + copyError
              : isExternalHref
              ? '↗ click to copy URL'
              : '→ open'}
          </span>
        </div>
      )}
    </CardContent>
  );

  // ── Wrapper selection based on URL type ───────────────────────────────────

  if (isExternalHref) {
    // External URL · render as a button that copies to clipboard
    return (
      <button
        type="button"
        onClick={handleCopy}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') handleCopy(e);
        }}
        className="block w-full text-left"
        aria-label={`Copy URL: ${primaryHref}`}
      >
        <Card className={cardClassName}>{innerContent}</Card>
      </button>
    );
  }

  if (isInternalHref) {
    // Internal route · regular anchor (works inside the preview iframe)
    return (
      <a href={primaryHref ?? undefined} className="block">
        <Card className={cardClassName}>{innerContent}</Card>
      </a>
    );
  }

  // No href · plain card
  return <Card className={cardClassName}>{innerContent}</Card>;
}
