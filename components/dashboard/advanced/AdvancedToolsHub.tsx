'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search, X } from '@/components/icons';
import {
  ADVANCED_HUB,
  ADVANCED_NAV_SECTIONS,
  type AdvancedNavSectionDef,
  type SidebarNavItemDef,
} from '@/lib/dashboard/sidebar-nav';
import {
  ADVANCED_SECTION_COUNT,
  ADVANCED_TOOL_COUNT,
  getNewAdvancedTools,
  readRecentAdvancedTools,
  recordAdvancedToolVisit,
} from '@/lib/dashboard/advanced-tool-meta';
import {
  DashboardAtmosphere,
  DashboardEyebrow,
  DashboardPanel,
} from '@/components/dashboard/DashboardAtmosphere';
import { PageHeader } from '@/components/dashboard/page-header';
import { SIDEBAR_ICONS } from '@/lib/dashboard/sidebar-icons';
import { cn } from '@/lib/utils';

function ToolCard({
  item,
  compact,
}: {
  item: SidebarNavItemDef;
  compact?: boolean;
}) {
  const Icon = SIDEBAR_ICONS[item.iconKey] ?? SIDEBAR_ICONS.FileText;

  return (
    <Link
      href={item.href}
      onClick={() => recordAdvancedToolVisit(item.href)}
      className={cn(
        'group flex flex-col gap-3 rounded-sm border-[0.5px] border-white/6 bg-white/1.5 transition-colors',
        'hover:border-orange-500/25 hover:bg-orange-500/4',
        compact ? 'p-3' : 'p-4 h-full'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/8 bg-white/3 text-orange-400/90 group-hover:border-orange-500/30">
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
        {item.description && !compact && (
          <p className="text-xs text-white/40 mt-1 leading-relaxed line-clamp-2">
            {item.description}
          </p>
        )}
      </div>
    </Link>
  );
}

function WorkflowOverviewCard({
  section,
  onJump,
}: {
  section: AdvancedNavSectionDef;
  onJump: (id: string) => void;
}) {
  const Icon = SIDEBAR_ICONS[section.iconKey] ?? SIDEBAR_ICONS.Layers;
  return (
    <button
      type="button"
      onClick={() => onJump(section.id)}
      className="group text-left rounded-sm border-[0.5px] border-white/6 bg-white/2 p-4 hover:border-orange-500/30 hover:bg-orange-500/5 transition-colors"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/8 bg-white/3 text-orange-400/90 mb-3 group-hover:border-orange-500/30">
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm font-light text-white">{section.label}</p>
      <p className="text-xs text-white/40 mt-1 line-clamp-2 leading-relaxed">
        {section.description}
      </p>
      <p className="text-xs text-white/25 mt-2 tabular-nums">
        {section.items.length} tools
      </p>
    </button>
  );
}

function SectionJumpNav({
  activeId,
  onJump,
}: {
  activeId: string | null;
  onJump: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Advanced sections"
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
    >
      {ADVANCED_NAV_SECTIONS.map(section => (
        <button
          key={section.id}
          type="button"
          onClick={() => onJump(section.id)}
          className={cn(
            'shrink-0 rounded-sm border-[0.5px] px-3 py-1.5 text-xs transition-colors',
            activeId === section.id
              ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
              : 'border-white/8 bg-white/2 text-white/45 hover:text-white/70 hover:border-white/15'
          )}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

/** Full-width Power Tools catalogue — search, recents, section jump, tool grid. */
export function AdvancedToolsHub() {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<SidebarNavItemDef[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const newTools = getNewAdvancedTools();

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(`advanced-section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
      window.history.replaceState(null, '', `${ADVANCED_HUB.href}#${id}`);
    }
  }, []);

  useEffect(() => {
    setRecent(readRecentAdvancedTools());
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      requestAnimationFrame(() => scrollToSection(hash));
    }
  }, [scrollToSection]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return ADVANCED_NAV_SECTIONS;
    return ADVANCED_NAV_SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(
        item =>
          item.label.toLowerCase().includes(normalizedQuery) ||
          item.description?.toLowerCase().includes(normalizedQuery) ||
          section.label.toLowerCase().includes(normalizedQuery)
      ),
    })).filter(section => section.items.length > 0);
  }, [normalizedQuery]);

  useEffect(() => {
    if (normalizedQuery) return undefined;
    const observer = new IntersectionObserver(
      entries => {
        const hit = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!hit?.target.id) return;
        const id = hit.target.id.replace('advanced-section-', '');
        setActiveSection(id);
      },
      { rootMargin: '-15% 0px -60% 0px', threshold: [0.15, 0.4, 0.7] }
    );
    for (const section of ADVANCED_NAV_SECTIONS) {
      const el = document.getElementById(`advanced-section-${section.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [normalizedQuery]);

  const resultCount = filteredSections.reduce(
    (sum, s) => sum + s.items.length,
    0
  );

  return (
    <DashboardAtmosphere className="w-full max-w-none space-y-8 pt-2">
      <PageHeader
        eyebrow="Advanced"
        title="Power tools"
        description={`${ADVANCED_TOOL_COUNT} tools across ${ADVANCED_SECTION_COUNT} workflows — everything beyond daily create → schedule → measure.`}
      />

      {!normalizedQuery && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {ADVANCED_NAV_SECTIONS.map(section => (
            <WorkflowOverviewCard
              key={section.id}
              section={section}
              onJump={scrollToSection}
            />
          ))}
        </div>
      )}

      <DashboardPanel className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35 pointer-events-none" />
            <input
              ref={searchRef}
              id="advanced-tool-search"
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search tools, workflows, or keywords…"
              className="w-full rounded-sm border-[0.5px] border-white/8 bg-white/3 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20"
              aria-label="Search power tools"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/70"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline text-xs text-white/25 border border-white/10 rounded-sm px-1.5 py-0.5">
                /
              </kbd>
            )}
          </div>
          <p className="text-xs text-white/35 tabular-nums shrink-0">
            {normalizedQuery
              ? `${resultCount} match${resultCount === 1 ? '' : 'es'}`
              : `${ADVANCED_TOOL_COUNT} tools`}
          </p>
        </div>
        {!normalizedQuery && (
          <SectionJumpNav activeId={activeSection} onJump={scrollToSection} />
        )}
      </DashboardPanel>

      {newTools.length > 0 && !normalizedQuery && (
        <section className="space-y-3">
          <DashboardEyebrow>New this release</DashboardEyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {newTools.map(item => (
              <ToolCard key={item.href} item={item} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && !normalizedQuery && (
        <section className="space-y-3">
          <DashboardEyebrow>Recently opened</DashboardEyebrow>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {recent.map(item => (
              <ToolCard key={item.href} item={item} compact />
            ))}
          </div>
        </section>
      )}

      {filteredSections.length === 0 ? (
        <DashboardPanel className="text-center py-12">
          <p className="text-sm text-white/50">No tools match your search.</p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-3 text-xs text-orange-400/80 hover:text-orange-400"
          >
            Clear search
          </button>
        </DashboardPanel>
      ) : (
        filteredSections.map(section => {
          const SectionIcon =
            SIDEBAR_ICONS[section.iconKey] ?? SIDEBAR_ICONS.Layers;
          return (
            <section
              key={section.id}
              id={`advanced-section-${section.id}`}
              className="scroll-mt-24 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-white/6 pb-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-white/8 bg-white/3 text-orange-400/90 shrink-0">
                    <SectionIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <DashboardEyebrow>{section.label}</DashboardEyebrow>
                    <h2 className="text-xl font-light text-white tracking-tight">
                      {section.label}
                    </h2>
                    <p className="text-sm text-white/40 mt-1 max-w-2xl">
                      {section.description}
                    </p>
                  </div>
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
          );
        })
      )}

      <DashboardPanel className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-orange-500/8 to-transparent pointer-events-none"
        />
        <DashboardEyebrow>Mission Control</DashboardEyebrow>
        <p className="text-base font-extralight text-white tracking-tight max-w-2xl">
          Daily work stays on Mission Control. Advanced tools are for depth —
          SEO audits, autopilot, agency delivery, and creative production.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex mt-4 text-xs text-orange-400/80 hover:text-orange-400 transition-colors"
        >
          Back to Mission Control
        </Link>
      </DashboardPanel>
    </DashboardAtmosphere>
  );
}
