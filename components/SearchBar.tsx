'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Filter, Loader2 } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/useToast';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: 'content' | 'user' | 'campaign' | 'template' | 'analytics';
  url: string;
  tags?: string[];
  date?: Date;
}

interface SearchFilters {
  type?: string[];
  dateRange?: { from: Date; to: Date };
  tags?: string[];
}

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string, filters?: SearchFilters) => void;
  suggestions?: string[];
  className?: string;
  showFilters?: boolean;
  autoFocus?: boolean;
}

export function SearchBar({
  placeholder = 'Search content, campaigns, users...',
  onSearch,
  suggestions = [],
  className = '',
  showFilters = true,
  autoFocus = false,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  // Perform search when debounced query changes
  const performSearch = useCallback(
    async (searchQuery: string, searchFilters: SearchFilters) => {
      setIsLoading(true);
      setShowResults(true);

      try {
        // Simulate API call - replace with actual search endpoint
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(searchFilters),
          }
        );

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        setResults(data.results || []);

        if (onSearch) {
          onSearch(searchQuery, searchFilters);
        }
      } catch (error) {
        console.error('Search error:', error);
        // Mock results for demo
        setResults(getMockResults(searchQuery));
      } finally {
        setIsLoading(false);
      }
    },
    [onSearch]
  );

  useEffect(() => {
    if (debouncedQuery.length > 2) {
      performSearch(debouncedQuery, filters);
    } else {
      setResults([]);
    }
  }, [debouncedQuery, filters, performSearch]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getMockResults = (searchQuery: string): SearchResult[] => {
    return [
      {
        id: '1',
        title: `Campaign: ${searchQuery}`,
        description: 'Active marketing campaign with high engagement',
        type: 'campaign',
        url: '/dashboard/campaigns/1',
        tags: ['active', 'high-roi'],
        date: new Date(),
      },
      {
        id: '2',
        title: `Content: ${searchQuery} Strategy`,
        description: 'Viral content strategy document',
        type: 'content',
        url: '/dashboard/content/2',
        tags: ['viral', 'trending'],
      },
      {
        id: '3',
        title: `Analytics: ${searchQuery} Performance`,
        description: 'Performance metrics and insights',
        type: 'analytics',
        url: '/dashboard/analytics/3',
        tags: ['metrics', 'insights'],
      },
    ];
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    setShowResults(false);
    setQuery('');
    toast.success(`Opening ${result.title}`);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const toggleFilter = (type: string) => {
    const currentTypes = filters.type || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];

    setFilters({ ...filters, type: newTypes });
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      content: '📝',
      user: '👤',
      campaign: '📢',
      template: '📋',
      analytics: '📊',
    };
    return icons[type as keyof typeof icons] || '📄';
  };

  const getTypeColor = (type: string) => {
    const colors = {
      content: 'bg-blue-500/20 text-blue-400',
      user: 'bg-green-500/20 text-green-400',
      campaign: 'bg-orange-500/20 text-orange-400',
      template: 'bg-yellow-500/20 text-yellow-400',
      analytics: 'bg-orange-500/20 text-orange-400',
    };
    return (
      colors[type as keyof typeof colors] || 'bg-gray-500/20 text-gray-300'
    );
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length > 2 && setShowResults(true)}
          autoFocus={autoFocus}
          className="pl-10 pr-20 glass-input"
        />

        {/* Action Buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
          )}

          {query && (
            <button
              onClick={clearSearch}
              className="p-2 hover:bg-white/10 rounded transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
            >
              <X className="h-4 w-4 text-gray-300" />
            </button>
          )}

          {showFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`p-1 hover:bg-white/10 rounded transition-colors ${
                Object.keys(filters).length > 0
                  ? 'text-orange-400'
                  : 'text-gray-300'
              }`}
            >
              <Filter className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="mt-2 p-3 bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-lg">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-300 mb-2">Filter by type:</p>
              <div className="flex flex-wrap gap-2">
                {['content', 'campaign', 'user', 'template', 'analytics'].map(
                  type => (
                    <Badge
                      key={type}
                      variant={
                        filters.type?.includes(type) ? 'default' : 'outline'
                      }
                      className="cursor-pointer"
                      onClick={() => toggleFilter(type)}
                    >
                      {getTypeIcon(type)} {type}
                    </Badge>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full z-50 bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl max-h-96 overflow-y-auto">
          <div className="p-2">
            {results.map((result, index) => (
              <div
                key={result.id}
                onClick={() => handleResultClick(result)}
                className="p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getTypeIcon(result.type)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-white">{result.title}</h4>
                      <Badge className={`text-xs ${getTypeColor(result.type)}`}>
                        {result.type}
                      </Badge>
                    </div>
                    {result.description && (
                      <p className="text-sm text-gray-300 mb-2">
                        {result.description}
                      </p>
                    )}
                    {result.tags && (
                      <div className="flex gap-1">
                        {result.tags.map(tag => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showResults &&
        query.length > 2 &&
        results.length === 0 &&
        !isLoading && (
          <div className="absolute top-full mt-2 w-full z-50 bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl p-8 text-center">
            <p className="text-gray-300">No results found for "{query}"</p>
            <p className="text-sm text-gray-500 mt-2">
              Try adjusting your filters or search terms
            </p>
          </div>
        )}
    </div>
  );
}

// Global search command palette
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('openGlobalSearch', handleOpen);
    return () => window.removeEventListener('openGlobalSearch', handleOpen);
  }, []);

  const handleSelect = (url: string) => {
    router.push(url);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type to search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => handleSelect('/dashboard/content/new')}>
            📝 Create New Content
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect('/dashboard/campaigns/new')}
          >
            📢 Start Campaign
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/dashboard/analytics')}>
            📊 View Analytics
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Recent">
          <CommandItem onSelect={() => handleSelect('/dashboard')}>
            🏠 Dashboard
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/dashboard/settings')}>
            ⚙️ Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
