'use client';

/**
 * Help Center Page
 * Documentation, FAQs, and support resources
 */

import { useState, useEffect } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import {
  HELP_CATEGORIES,
  FAQS,
  filterFAQs,
  SearchBar,
  QuickLinks,
  CategoryGrid,
  FAQList,
  ContactSupport,
} from '@/components/help';

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHelp = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Simulate loading help content
        await new Promise((resolve) => setTimeout(resolve, 400));
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load help content');
        setIsLoading(false);
      }
    };
    loadHelp();
  }, []);

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 400);
  };

  const filteredFAQs = filterFAQs(FAQS, searchQuery, selectedCategory);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <APIErrorCard title="Help Center Error" message={error} onRetry={handleRetry} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Help Center</h1>
        <p className="text-gray-400">
          Find answers, learn best practices, and get the most out of SYNTHEX
        </p>
      </div>

      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <QuickLinks />

      <CategoryGrid
        categories={HELP_CATEGORIES}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
      />

      <FAQList
        faqs={filteredFAQs}
        categories={HELP_CATEGORIES}
        selectedCategory={selectedCategory}
        onClearCategory={() => setSelectedCategory(null)}
      />

      <ContactSupport />
    </div>
  );
}
