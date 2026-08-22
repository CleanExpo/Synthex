'use client';

import Link from 'next/link';
import { Layers, ChevronRight } from '@/components/icons';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import { getAdvancedBreadcrumbs } from '@/lib/dashboard/advanced-tool-meta';
import type {
  AdvancedNavSectionDef,
  SidebarNavItemDef,
} from '@/lib/dashboard/sidebar-nav';
import { ADVANCED_HUB } from '@/lib/dashboard/sidebar-nav';
import { cn } from '@/lib/utils';

interface AdvancedContextBarProps {
  pathname: string;
  tool: SidebarNavItemDef;
  section: AdvancedNavSectionDef;
  className?: string;
}

/** Slim wayfinding strip for every advanced tool page. */
export function AdvancedContextBar({
  pathname,
  tool,
  section,
  className,
}: AdvancedContextBarProps) {
  const crumbs = getAdvancedBreadcrumbs(pathname);

  return (
    <div
      className={cn(
        'rounded-sm border-[0.5px] border-white/6 bg-white/2 px-4 py-3 space-y-3',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-orange-500/20 bg-orange-500/10 text-orange-400 shrink-0">
            <Layers className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">
              Advanced · {section.label}
            </p>
            <p className="text-sm font-light text-white truncate">
              {tool.label}
            </p>
          </div>
        </div>
        <Link
          href={ADVANCED_HUB.href}
          className="text-xs text-orange-400/80 hover:text-orange-400 transition-colors shrink-0 inline-flex items-center gap-1"
        >
          All power tools
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {tool.description && (
        <p className="text-xs text-white/40 leading-relaxed max-w-3xl">
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
