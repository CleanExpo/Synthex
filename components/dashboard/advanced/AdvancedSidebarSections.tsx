'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Layers } from '@/components/icons';
import { Icon3D } from '@/components/icons/Icon3D';
import {
  ADVANCED_HUB,
  ADVANCED_NAV_SECTIONS,
  isSidebarPathActive,
} from '@/lib/dashboard/sidebar-nav';
import { SIDEBAR_ICONS } from '@/lib/dashboard/sidebar-icons';
import { cn } from '@/lib/utils';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  sidebarMenuButtonVariants,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SidebarNavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  description?: string;
  isNew?: boolean;
}

function mapNavItems(
  defs: (typeof ADVANCED_NAV_SECTIONS)[number]['items']
): SidebarNavItem[] {
  return defs.map(def => ({
    icon: SIDEBAR_ICONS[def.iconKey] ?? SIDEBAR_ICONS.FileText,
    label: def.label,
    href: def.href,
    description: def.description,
    isNew: def.isNew,
  }));
}

function AdvancedNavItemLink({ item }: { item: SidebarNavItem }) {
  const pathname = usePathname();
  const isActive = isSidebarPathActive(pathname, item.href);
  const link = (
    <Link
      href={item.href}
      className={cn(
        sidebarMenuButtonVariants({ size: 'sm' }),
        'text-white/65 hover:text-white hover:bg-white/4 rounded-sm transition-all',
        isActive &&
          'text-orange-400 bg-orange-500/10 hover:text-orange-400 hover:bg-orange-500/12'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="text-[13px] flex-1 truncate">{item.label}</span>
      {item.isNew && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
        </span>
      )}
    </Link>
  );

  if (!item.description) {
    return <SidebarMenuItem>{link}</SidebarMenuItem>;
  }

  return (
    <SidebarMenuItem>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="bg-[var(--mode-surface)] border-white/10 text-white/70 text-xs max-w-60"
        >
          <p className="text-white/85">{item.label}</p>
          <p className="text-white/45 mt-1 leading-relaxed">
            {item.description}
          </p>
        </TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  );
}

/** Collapsible advanced nav — grouped by workflow, opens section when route matches. */
export function AdvancedSidebarSections() {
  const pathname = usePathname();
  const hubActive = isSidebarPathActive(pathname, ADVANCED_HUB.href);

  const initialOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const section of ADVANCED_NAV_SECTIONS) {
      map[section.id] = section.items.some(item =>
        isSidebarPathActive(pathname, item.href)
      );
    }
    return map;
  }, [pathname]);

  const [openSections, setOpenSections] =
    useState<Record<string, boolean>>(initialOpen);

  useEffect(() => {
    setOpenSections(prev => {
      const next = { ...prev };
      for (const section of ADVANCED_NAV_SECTIONS) {
        if (
          section.items.some(item => isSidebarPathActive(pathname, item.href))
        ) {
          next[section.id] = true;
        }
      }
      return next;
    });
  }, [pathname]);

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs tracking-[0.18em] uppercase text-white/40 px-3 py-1">
          Advanced
        </SidebarGroupLabel>
        <SidebarGroupContent className="px-2 pb-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <Link
                href={ADVANCED_HUB.href}
                className={cn(
                  sidebarMenuButtonVariants({ size: 'sm' }),
                  'text-white/65 hover:text-white hover:bg-white/4 rounded-sm transition-all',
                  hubActive &&
                    'text-orange-400 bg-orange-500/10 hover:text-orange-400 hover:bg-orange-500/12'
                )}
                aria-current={hubActive ? 'page' : undefined}
                title={ADVANCED_HUB.description}
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span className="text-[13px] flex-1">{ADVANCED_HUB.label}</span>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {ADVANCED_NAV_SECTIONS.map(section => {
        const SectionIcon =
          SIDEBAR_ICONS[section.iconKey] ?? SIDEBAR_ICONS.Layers;
        const isOpen = openSections[section.id] ?? false;
        const sectionActive = section.items.some(item =>
          isSidebarPathActive(pathname, item.href)
        );

        return (
          <SidebarGroup key={section.id}>
            <SidebarGroupLabel
              className={cn(
                'flex items-center gap-2 cursor-pointer select-none text-xs tracking-[0.14em] uppercase px-3 py-1.5 transition-colors',
                sectionActive ? 'text-white/45' : 'text-white/28',
                'hover:text-white/55'
              )}
              onClick={() => toggleSection(section.id)}
              title={section.description}
            >
              <SectionIcon className="h-3 w-3 shrink-0" />
              <span className="flex-1 truncate">{section.label}</span>
              <span className="text-white/20 tabular-nums text-xs">
                {section.items.length}
              </span>
              <Icon3D
                name="chevron-down"
                category="navigation"
                size={24}
                className={cn(
                  'h-3 w-3 shrink-0 transition-transform text-white/25',
                  !isOpen && '-rotate-90'
                )}
              />
            </SidebarGroupLabel>
            {isOpen && (
              <SidebarGroupContent className="px-2 pb-1">
                <SidebarMenu>
                  {mapNavItems(section.items).map(item => (
                    <AdvancedNavItemLink key={item.href} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        );
      })}
    </>
  );
}
