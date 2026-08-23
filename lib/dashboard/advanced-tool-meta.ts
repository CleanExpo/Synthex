/**
 * Advanced tool metadata — resolve section, siblings, and breadcrumbs from pathname.
 * Single source of truth alongside sidebar-nav.ts.
 */

import {
  ADVANCED_HUB,
  ADVANCED_NAV_ITEMS,
  ADVANCED_NAV_SECTIONS,
  isSidebarPathActive,
  type AdvancedNavSectionDef,
  type SidebarNavItemDef,
} from './sidebar-nav';

export interface AdvancedToolContext {
  isAdvanced: boolean;
  isHub: boolean;
  tool: SidebarNavItemDef | null;
  section: AdvancedNavSectionDef | null;
  siblings: SidebarNavItemDef[];
  sectionIndex: number;
  toolIndex: number;
}

const RECENT_TOOLS_KEY = 'synthex-advanced-recent-tools';
const MAX_RECENT = 6;

/** Longest-prefix match so nested routes (e.g. /seo/audit) inherit SEO context. */
export function resolveAdvancedTool(pathname: string): AdvancedToolContext {
  if (pathname === ADVANCED_HUB.href) {
    return {
      isAdvanced: true,
      isHub: true,
      tool: null,
      section: null,
      siblings: [],
      sectionIndex: -1,
      toolIndex: -1,
    };
  }

  let tool: SidebarNavItemDef | null = null;
  let section: AdvancedNavSectionDef | null = null;
  let sectionIndex = -1;
  let toolIndex = -1;
  let bestLen = 0;

  ADVANCED_NAV_SECTIONS.forEach((sec, si) => {
    sec.items.forEach((item, ti) => {
      if (
        isSidebarPathActive(pathname, item.href) &&
        item.href.length > bestLen
      ) {
        tool = item;
        section = sec;
        sectionIndex = si;
        toolIndex = ti;
        bestLen = item.href.length;
      }
    });
  });

  const isAdvanced = tool !== null;

  const siblings =
    sectionIndex >= 0 ? ADVANCED_NAV_SECTIONS[sectionIndex].items : [];

  return {
    isAdvanced,
    isHub: false,
    tool,
    section,
    siblings,
    sectionIndex,
    toolIndex,
  };
}

export function getAdvancedBreadcrumbs(pathname: string): Array<{
  label: string;
  href?: string;
  current?: boolean;
}> {
  const ctx = resolveAdvancedTool(pathname);

  if (ctx.isHub) {
    return [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Power Tools', current: true },
    ];
  }

  if (!ctx.isAdvanced || !ctx.tool || !ctx.section) {
    return [];
  }

  const crumbs: Array<{ label: string; href?: string; current?: boolean }> = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Power Tools', href: ADVANCED_HUB.href },
    {
      label: ctx.section.label,
      href: `${ADVANCED_HUB.href}#${ctx.section.id}`,
    },
  ];

  const baseSegments = ctx.tool.href.split('/').filter(Boolean).length;
  const pathSegments = pathname.split('/').filter(Boolean);
  const hasNested = pathSegments.length > baseSegments;

  if (!hasNested) {
    crumbs.push({ label: ctx.tool.label, current: true });
    return crumbs;
  }

  crumbs.push({ label: ctx.tool.label, href: ctx.tool.href });

  let href = ctx.tool.href;
  for (let i = baseSegments; i < pathSegments.length; i++) {
    href += `/${pathSegments[i]}`;
    const isLast = i === pathSegments.length - 1;
    crumbs.push({
      label: humaniseSegment(pathSegments[i]),
      href: isLast ? undefined : href,
      current: isLast,
    });
  }

  return crumbs;
}

function humaniseSegment(segment: string): string {
  return decodeURIComponent(segment)
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function readRecentAdvancedTools(): SidebarNavItemDef[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_TOOLS_KEY);
    if (!raw) return [];
    const hrefs = JSON.parse(raw) as string[];
    return hrefs
      .map(href => ADVANCED_NAV_ITEMS.find(item => item.href === href))
      .filter((item): item is SidebarNavItemDef => Boolean(item));
  } catch {
    return [];
  }
}

export function recordAdvancedToolVisit(href: string): void {
  if (typeof window === 'undefined') return;
  if (!ADVANCED_NAV_ITEMS.some(item => item.href === href)) return;
  try {
    const existing = readRecentAdvancedTools().map(i => i.href);
    const next = [href, ...existing.filter(h => h !== href)].slice(
      0,
      MAX_RECENT
    );
    localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

export const ADVANCED_TOOL_COUNT = ADVANCED_NAV_ITEMS.length;
export const ADVANCED_SECTION_COUNT = ADVANCED_NAV_SECTIONS.length;

export function getNewAdvancedTools(): SidebarNavItemDef[] {
  return ADVANCED_NAV_ITEMS.filter(item => item.isNew);
}

export function getAdjacentAdvancedTools(
  sectionIndex: number,
  toolIndex: number
): { prev: SidebarNavItemDef | null; next: SidebarNavItemDef | null } {
  if (sectionIndex < 0 || toolIndex < 0) {
    return { prev: null, next: null };
  }
  const section = ADVANCED_NAV_SECTIONS[sectionIndex];
  if (!section) return { prev: null, next: null };
  return {
    prev: toolIndex > 0 ? section.items[toolIndex - 1] : null,
    next:
      toolIndex < section.items.length - 1
        ? section.items[toolIndex + 1]
        : null,
  };
}
