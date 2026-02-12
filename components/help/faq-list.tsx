'use client';

/**
 * FAQ List
 * Frequently asked questions display
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HelpCircle } from '@/components/icons';
import type { FAQ, HelpCategory } from './types';

interface FAQListProps {
  faqs: FAQ[];
  categories: HelpCategory[];
  selectedCategory: string | null;
  onClearCategory: () => void;
}

export function FAQList({
  faqs,
  categories,
  selectedCategory,
  onClearCategory,
}: FAQListProps) {
  const selectedCategoryTitle = categories.find((c) => c.id === selectedCategory)?.title;

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Frequently Asked Questions</CardTitle>
        {selectedCategory && (
          <Badge
            variant="secondary"
            className="mt-2 cursor-pointer"
            onClick={onClearCategory}
          >
            {selectedCategoryTitle} ✕
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-white/10 pb-4 last:border-0">
              <h4 className="font-medium text-white mb-2 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                {faq.question}
              </h4>
              <p className="text-sm text-gray-400 ml-6">{faq.answer}</p>
            </div>
          ))}
          {faqs.length === 0 && (
            <p className="text-gray-400 text-center py-8">
              No FAQs found. Try adjusting your search or category filter.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
