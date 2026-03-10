'use client';

/**
 * Empty State Component
 * Shown when no analysis has been performed
 */

import { Card, CardContent } from '@/components/ui/card';
import { Brain } from '@/components/icons';

export function EmptyState() {
  return (
    <Card variant="glass">
      <CardContent className="py-12 text-center">
        <Brain className="w-16 h-16 mx-auto text-gray-500 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Ready to Analyze</h3>
        <p className="text-gray-400">
          Enter your content and click Analyze to get AI-powered psychology insights
        </p>
      </CardContent>
    </Card>
  );
}
