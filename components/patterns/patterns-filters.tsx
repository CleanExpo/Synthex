'use client';

/**
 * Patterns Filters Component
 * Platform, time range, and search filters
 */

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from '@/components/icons';
import { platformOptions, timeRangeOptions } from './patterns-config';

interface PatternsFiltersProps {
  platform: string;
  onPlatformChange: (value: string) => void;
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function PatternsFilters({
  platform,
  onPlatformChange,
  timeRange,
  onTimeRangeChange,
  searchQuery,
  onSearchChange,
}: PatternsFiltersProps) {
  return (
    <Card variant="glass">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="platform" className="text-gray-400">Platform</Label>
            <Select value={platform} onValueChange={onPlatformChange}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {platformOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="timerange" className="text-gray-400">Time Range</Label>
            <Select value={timeRange} onValueChange={onTimeRangeChange}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                {timeRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="search" className="text-gray-400">Search Patterns</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                id="search"
                type="text"
                placeholder="Search by content or type..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
