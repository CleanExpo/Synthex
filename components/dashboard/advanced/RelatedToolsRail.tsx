'use client';

import Link from 'next/link';
import { ArrowUpRight } from '@/components/icons';
import { DashboardEyebrow } from '@/components/dashboard/DashboardAtmosphere';
import { SIDEBAR_ICONS } from '@/lib/dashboard/sidebar-icons';
import type { SidebarNavItemDef } from '@/lib/dashboard/sidebar-nav';
import { cn } from '@/lib/utils';

interface RelatedToolsRailProps {
  siblings: SidebarNavItemDef[];
  currentHref: string;
  sectionLabel: string;
}

/** Sibling tools in the same workflow — quick pivot without returning to hub. */
export function RelatedToolsRail({
  siblings,
  currentHref,
  sectionLabel,
}: RelatedToolsRailProps) {
  const others = siblings.filter(item => item.href !== currentHref);
  if (others.length === 0) return null;

  return (
    <section className="border-t border-white/6 pt-6 space-y-3">
      <DashboardEyebrow>More in {sectionLabel}</DashboardEyebrow>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {others.map(item => {
          const Icon = SIDEBAR_ICONS[item.iconKey] ?? SIDEBAR_ICONS.FileText;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group shrink-0 inline-flex items-center gap-2.5 rounded-sm',
                'border-[0.5px] border-white/6 bg-white/2 px-3 py-2',
                'hover:border-orange-500/25 hover:bg-orange-500/5 transition-colors'
              )}
            >
              <Icon className="h-3.5 w-3.5 text-orange-400/80" />
              <span className="text-xs text-white/70 group-hover:text-white whitespace-nowrap">
                {item.label}
              </span>
              <ArrowUpRight className="h-3 w-3 text-white/20 group-hover:text-orange-400/70" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
