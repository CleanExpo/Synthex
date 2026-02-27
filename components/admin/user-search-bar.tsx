'use client';

/**
 * User Search Bar Component
 * Search input with filter and refresh buttons
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Search, Filter, RefreshCw } from '@/components/icons';

interface UserSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function UserSearchBar({
  searchTerm,
  onSearchChange,
  onRefresh,
  isLoading
}: UserSearchBarProps) {
  return (
    <div className="flex gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search users by email or ID..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-white/5 border-white/10"
        />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <Button
              disabled
              variant="outline"
              className="border-white/10 opacity-50 cursor-not-allowed"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent variant="glass-solid">Coming soon</TooltipContent>
      </Tooltip>
      <Button onClick={onRefresh} variant="outline" className="border-white/10">
        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  );
}
