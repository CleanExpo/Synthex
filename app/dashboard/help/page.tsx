'use client';

/**
 * Help Center Page
 * Documentation, FAQs, and support resources.
 * All content is static (imported constants) — no API calls needed.
 */

import { useState } from 'react';
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

  const filteredFAQs = filterFAQs(FAQS, searchQuery, selectedCategory);

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
