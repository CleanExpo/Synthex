'use client';

/**
 * Help Search Bar
 * Search input for help articles
 */

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from '@/components/icons';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <Card variant="glass" className="mb-8">
      <CardContent className="p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Search for help articles, tutorials, or FAQs..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="pl-10 bg-gray-800/50 border-white/10 text-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}
