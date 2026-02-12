'use client';

/**
 * Category Grid
 * Help categories with article links
 */

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from '@/components/icons';
import type { HelpCategory } from './types';

interface CategoryGridProps {
  categories: HelpCategory[];
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string | null) => void;
}

export function CategoryGrid({
  categories,
  selectedCategory,
  onCategorySelect,
}: CategoryGridProps) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-white mb-4">Browse by Category</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategory === category.id;
          return (
            <Card
              key={category.id}
              variant="glass"
              className={`hover:scale-105 transition-transform cursor-pointer ${
                isSelected ? 'ring-2 ring-cyan-500' : ''
              }`}
              onClick={() => onCategorySelect(isSelected ? null : category.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg bg-gray-800/50 ${category.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {category.articles} articles
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-3">{category.title}</CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {category.links.map((link, index) => (
                    <li key={index}>
                      <Link
                        href={link.href}
                        className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                      >
                        <ChevronRight className="w-3 h-3" />
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
