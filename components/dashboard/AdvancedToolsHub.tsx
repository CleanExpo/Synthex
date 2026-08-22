'use client';

import Link from 'next/link';
import { ArrowUpRight } from '@/components/icons';
import {
  ADVANCED_NAV_SECTIONS,
  type SidebarNavItemDef,
} from '@/lib/dashboard/sidebar-nav';
import {
  DashboardAtmosphere,
  DashboardEyebrow,
  DashboardPanel,
} from '@/components/dashboard/DashboardAtmosphere';
import { PageHeader } from '@/components/dashboard/page-header';
import { SIDEBAR_ICONS } from '@/lib/dashboard/sidebar-icons';
import { cn } from '@/lib/utils';

function ToolCard({ item }: { item: SidebarNavItemDef }) {
  const Icon = SIDEBAR_ICONS[item.iconKey] ?? SIDEBAR_ICONS.FileText;

  return (
    <Link
      href={item.href}
      className="group flex flex-col gap-3 rounded-sm border-[0.5px] border-white/6 bg-white/[0.015] p-4 hover:border-orange-500/25 hover:bg-orange-500/[0.04] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/8 bg-white/[0.03] text-orange-400/90 group-hover:border-orange-500/30">
          <Icon className="h-4 w-4" />
        </span>
        <ArrowUpRight className="h-3.5 w-3.5 text-white/20 group-hover:text-orange-400/80 transition-colors shrink-0 mt-0.5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-light text-white tracking-tight">
            {item.label}
          </p>
          {item.isNew && (
            <span className="text-xs uppercase tracking-wider text-orange-400/90">
              New
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-white/40 mt-1 leading-relaxed line-clamp-2">
            {item.description}
          </p>
        )}
      </div>
    </Link>
  );
}

/** Full-width catalogue of advanced tools — grouped by workflow. */
export function AdvancedToolsHub() {
  return (
    <DashboardAtmosphere className="w-full max-w-none space-y-10 pt-2">
      <PageHeader
        eyebrow="Advanced"
        title="Power tools"
        description="Everything beyond daily create → schedule → measure. Pick a workflow — each tool opens in its own workspace."
      />

      <DashboardPanel className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-orange-500/8 to-transparent pointer-events-none"
        />
        <DashboardEyebrow>Mission Control</DashboardEyebrow>
        <p className="text-lg font-extralight text-white tracking-tight max-w-2xl">
          Goal → Linear → ship lives on the home dashboard. Use this catalogue
          when you need depth: SEO, autopilot, agency ops, or creative
          production.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex mt-4 text-xs text-orange-400/80 hover:text-orange-400 transition-colors"
        >
          Back to Mission Control
        </Link>
      </DashboardPanel>

      {ADVANCED_NAV_SECTIONS.map(section => (
        <section key={section.id} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-white/6 pb-4">
            <div>
              <DashboardEyebrow>{section.label}</DashboardEyebrow>
              <h2 className="text-xl font-light text-white tracking-tight">
                {section.label}
              </h2>
              <p className="text-sm text-white/40 mt-1 max-w-2xl">
                {section.description}
              </p>
            </div>
            <p className="text-xs text-white/30 tabular-nums shrink-0">
              {section.items.length} tools
            </p>
          </div>
          <div
            className={cn(
              'grid gap-3',
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            )}
          >
            {section.items.map(item => (
              <ToolCard key={item.href} item={item} />
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-white/25 pb-4">
        Toggle <span className="text-white/40">Advanced</span> in the sidebar to
        pin these sections while you work.
      </p>
    </DashboardAtmosphere>
  );
}
