'use client';

import { useState, useMemo } from 'react';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building, ChevronDown, Globe, Plus, Check } from '@/components/icons';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * BusinessSwitcher — sidebar-integrated brand picker.
 *
 * Visual contract (matches the rest of the sidebar):
 *  - Amber accent (matches active-state highlight in NavGroup / QuickActionsGroup)
 *  - No floating-button look (flat, integrated with sidebar background)
 *  - Workspace umbrella support: "unite-group" (or any org with no parent) shown
 *    as the workspace header, child orgs indented underneath
 *
 * Falls back gracefully when there's no parent/child structure (treats every
 * org as a flat list — current default for non-Unite-Group users).
 */

const WORKSPACE_PARENT_SLUG = 'unite-group';

export function BusinessSwitcher() {
  const {
    businesses,
    activeBusiness,
    activeOrganizationId,
    isOwner,
    switchBusiness,
  } = useActiveBusiness();
  const [isSwitching, setIsSwitching] = useState(false);

  // Group businesses by workspace structure: parent on top, children indented.
  // Detection is slug-based so it works without changes to the API contract
  // (parent metadata isn't returned by /api/businesses today).
  const grouped = useMemo(() => {
    if (!businesses.length)
      return { parent: null, children: [], standalone: [] };

    const parent =
      businesses.find(b => b.organizationSlug === WORKSPACE_PARENT_SLUG) ??
      null;

    const standalone = parent
      ? businesses.filter(b => b.organizationSlug !== WORKSPACE_PARENT_SLUG)
      : [];

    return {
      parent,
      children: standalone,
      standalone: parent ? [] : businesses,
    };
  }, [businesses]);

  if (!isOwner) return null;

  const handleSwitch = async (orgId: string | null) => {
    try {
      setIsSwitching(true);
      await switchBusiness(orgId);
    } catch (error) {
      console.error('Failed to switch business:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  const displayName = activeBusiness
    ? activeBusiness.displayName || activeBusiness.organizationName
    : 'All Businesses';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isSwitching}
          className={cn(
            'group w-full flex items-center gap-2 px-2.5 py-2 rounded-sm transition-colors',
            'text-left text-xs text-white/70 hover:text-white',
            'hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50',
            'disabled:opacity-60 disabled:cursor-wait'
          )}
        >
          <Building className="h-3.5 w-3.5 flex-shrink-0 text-amber-500/80" />
          <span className="flex-1 truncate">{displayName}</span>
          <ChevronDown
            className={cn(
              'h-3 w-3 flex-shrink-0 text-white/40 transition-transform',
              isSwitching && 'animate-spin',
              'group-hover:text-white/70'
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="w-[260px] bg-[#0a0a12] border border-white/[0.08] rounded-sm p-1 shadow-2xl"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[10px] tracking-[0.18em] uppercase text-white/40 font-normal">
          Switch Business
        </DropdownMenuLabel>

        {/* All Businesses (rollup view) */}
        <DropdownMenuItem
          onClick={() => handleSwitch(null)}
          className={cn(
            'cursor-pointer rounded-sm px-2 py-1.5 text-xs',
            'text-white/70 hover:text-white hover:bg-white/[0.04]',
            'focus:bg-white/[0.04] focus:text-white',
            activeOrganizationId === null &&
              'text-amber-500 bg-amber-500/[0.06]'
          )}
        >
          <Globe className="mr-2 h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1">All Businesses</span>
          {activeOrganizationId === null && (
            <Check className="h-3 w-3 flex-shrink-0 text-amber-500" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 bg-white/[0.06]" />

        {/* Workspace umbrella + children (when present) */}
        {grouped.parent && (
          <>
            <BusinessRow
              business={grouped.parent}
              activeOrganizationId={activeOrganizationId}
              onSwitch={handleSwitch}
              isParent
            />
            {grouped.children.length > 0 && (
              <>
                <DropdownMenuLabel className="px-2 pt-2 pb-1 text-[10px] tracking-[0.18em] uppercase text-white/30 font-normal">
                  Brands
                </DropdownMenuLabel>
                {grouped.children.map(business => (
                  <BusinessRow
                    key={business.organizationId}
                    business={business}
                    activeOrganizationId={activeOrganizationId}
                    onSwitch={handleSwitch}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* Flat list fallback when no umbrella parent exists */}
        {!grouped.parent &&
          grouped.standalone.map(business => (
            <BusinessRow
              key={business.organizationId}
              business={business}
              activeOrganizationId={activeOrganizationId}
              onSwitch={handleSwitch}
            />
          ))}

        <DropdownMenuSeparator className="my-1 bg-white/[0.06]" />

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-sm px-2 py-1.5 text-xs text-white/50 hover:text-amber-500 hover:bg-white/[0.04] focus:bg-white/[0.04]"
        >
          <Link href="/dashboard/businesses">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add business
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Single business row ────────────────────────────────────────────────────

interface BusinessRowBusiness {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  displayName: string | null;
  isActive: boolean;
}

function BusinessRow({
  business,
  activeOrganizationId,
  onSwitch,
  isParent = false,
}: {
  business: BusinessRowBusiness;
  activeOrganizationId: string | null;
  onSwitch: (orgId: string) => void;
  isParent?: boolean;
}) {
  const isActive = activeOrganizationId === business.organizationId;
  return (
    <DropdownMenuItem
      onClick={() => onSwitch(business.organizationId)}
      className={cn(
        'cursor-pointer rounded-sm px-2 py-1.5 text-xs',
        'text-white/70 hover:text-white hover:bg-white/[0.04]',
        'focus:bg-white/[0.04] focus:text-white',
        isActive && 'text-amber-500 bg-amber-500/[0.06]',
        !isParent && 'pl-4' // indent children
      )}
    >
      <span
        className={cn(
          'mr-2 h-1.5 w-1.5 rounded-full flex-shrink-0',
          business.isActive ? 'bg-emerald-500' : 'bg-white/20'
        )}
      />
      <span className="flex-1 truncate" title={business.organizationName}>
        {business.displayName || business.organizationName}
      </span>
      {isActive && (
        <Check className="h-3 w-3 flex-shrink-0 text-amber-500 ml-2" />
      )}
    </DropdownMenuItem>
  );
}
