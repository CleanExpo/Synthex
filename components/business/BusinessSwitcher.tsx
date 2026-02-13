'use client';

import { useState } from 'react';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Building, ChevronDown, Globe, Plus } from '@/components/icons';
import Link from 'next/link';

export function BusinessSwitcher() {
  const { businesses, activeBusiness, activeOrganizationId, isOwner, switchBusiness } = useActiveBusiness();
  const [isSwitching, setIsSwitching] = useState(false);

  if (!isOwner) {
    return null;
  }

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
        <Button
          variant="outline"
          className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10 text-white hover:bg-cyan-500/10 hover:border-cyan-500/20 transition-all"
          disabled={isSwitching}
        >
          <Building className="mr-2 h-4 w-4 text-cyan-400" />
          <span className="max-w-[200px] truncate">{displayName}</span>
          <ChevronDown className={`ml-2 h-4 w-4 text-gray-400 transition-transform ${isSwitching ? 'animate-spin' : ''}`} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-[280px] bg-gray-950 border border-cyan-500/10 backdrop-blur-xl"
      >
        <DropdownMenuLabel className="text-gray-400 text-xs font-medium uppercase tracking-wider">
          Switch Business
        </DropdownMenuLabel>

        <DropdownMenuItem
          onClick={() => handleSwitch(null)}
          className="cursor-pointer hover:bg-cyan-500/10 focus:bg-cyan-500/10 text-white"
        >
          <Globe className="mr-2 h-4 w-4 text-cyan-400" />
          <span className="flex-1">All Businesses</span>
          {activeOrganizationId === null && (
            <div className="h-2 w-2 rounded-full bg-cyan-400" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-cyan-500/10" />

        {businesses.map((business) => (
          <DropdownMenuItem
            key={business.organizationId}
            onClick={() => handleSwitch(business.organizationId)}
            className="cursor-pointer hover:bg-cyan-500/10 focus:bg-cyan-500/10 text-white"
          >
            <div className="flex items-center flex-1 min-w-0">
              <div
                className={`mr-2 h-2 w-2 rounded-full flex-shrink-0 ${
                  business.isActive ? 'bg-green-500' : 'bg-gray-500'
                }`}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate text-sm">
                  {business.displayName || business.organizationName}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  @{business.organizationSlug}
                </span>
              </div>
            </div>
            {activeOrganizationId === business.organizationId && (
              <div className="h-2 w-2 rounded-full bg-cyan-400 flex-shrink-0 ml-2" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="bg-cyan-500/10" />

        <DropdownMenuItem asChild className="cursor-pointer hover:bg-cyan-500/10 focus:bg-cyan-500/10">
          <Link href="/dashboard/businesses" className="text-cyan-400 hover:text-cyan-300">
            <Plus className="mr-2 h-4 w-4" />
            Add Business
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
