'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Layers } from '@/components/icons';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import {
  getAdjacentAdvancedTools,
  getAdvancedBreadcrumbs,
} from '@/lib/dashboard/advanced-tool-meta';
import { ADVANCED_HUB } from '@/lib/dashboard/sidebar-nav';
import type {
  AdvancedNavSectionDef,
  SidebarNavItemDef,
} from '@/lib/dashboard/sidebar-nav';
import { SIDEBAR_ICONS } from '@/lib/dashboard/sidebar-icons';
import { cn } from '@/lib/utils';

interface AdvancedContextBarProps {
  pathname: string;
  tool: SidebarNavItemDef;
  section: AdvancedNavSectionDef;
  sectionIndex: number;
  toolIndex: number;
  className?: string;
}

/** Slim wayfinding strip for every advanced tool page. */
export function AdvancedContextBar({
  pathname,
  tool,
  section,
  sectionIndex,
  toolIndex,
  className,
}: AdvancedContextBarProps) {
  const crumbs = getAdvancedBreadcrumbs(pathname);
  const ToolIcon = SIDEBAR_ICONS[tool.iconKey] ?? SIDEBAR_ICONS.FileText;
  const SectionIcon = SIDEBAR_ICONS[section.iconKey] ?? SIDEBAR_ICONS.Layers;
  const { prev, next } = getAdjacentAdvancedTools(sectionIndex, toolIndex);

  return (
    <div
      className={cn(
        'rounded-sm border-[0.5px] border-white/6 bg-white/2 px-4 py-3 space-y-3 border-l-2 border-l-orange-500/30',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-orange-500/20 bg-orange-500/10 text-orange-400 shrink-0">
            <ToolIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <Link
              href={`${ADVANCED_HUB.href}#${section.id}`}
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-white/35 hover:text-orange-400/80 transition-colors"
            >
              <SectionIcon className="h-3 w-3 shrink-0" />
              Advanced · {section.label}
            </Link>
            <p className="text-base font-light text-white tracking-tight">
              {tool.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {prev && (
            <Link
              href={prev.href}
              className="inline-flex items-center gap-1 rounded-sm border border-white/8 bg-white/2 px-2.5 py-1.5 text-xs text-white/55 hover:text-white hover:border-white/15 transition-colors"
              title={prev.label}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline max-w-[88px] truncate">
                {prev.label}
              </span>
            </Link>
          )}
          {next && (
            <Link
              href={next.href}
              className="inline-flex items-center gap-1 rounded-sm border border-white/8 bg-white/2 px-2.5 py-1.5 text-xs text-white/55 hover:text-white hover:border-white/15 transition-colors"
              title={next.label}
            >
              <span className="hidden sm:inline max-w-[88px] truncate">
                {next.label}
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <Link
            href={ADVANCED_HUB.href}
            className="inline-flex items-center gap-1 rounded-sm border border-orange-500/25 bg-orange-500/8 px-2.5 py-1.5 text-xs text-orange-400/90 hover:text-orange-300 transition-colors"
          >
            <Layers className="h-3.5 w-3.5" />
            Hub
          </Link>
        </div>
      </div>

      {tool.description && (
        <p className="text-xs text-white/40 leading-relaxed max-w-3xl pl-12 sm:pl-0">
          {tool.description}
        </p>
      )}

      {crumbs.length > 0 && (
        <Breadcrumbs
          items={crumbs.map(c => ({
            label: c.label,
            href: c.href,
            current: c.current,
          }))}
          className="text-xs"
        />
      )}
    </div>
  );
}
