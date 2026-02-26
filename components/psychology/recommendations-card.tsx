'use client';

/**
 * Recommendations Card
 * Displays AI-generated recommendations with copy functionality
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, Sparkles, Copy, Check } from '@/components/icons';
import { toast } from 'sonner';

interface RecommendationsCardProps {
  recommendations: string[];
}

export function RecommendationsCard({ recommendations }: RecommendationsCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = recommendations.join('\n- ');
    navigator.clipboard.writeText(`Recommendations:\n- ${text}`);
    setCopied(true);
    toast.success('Recommendations copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-yellow-400" />
            Recommendations
          </span>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? (
              <Check className="w-4 h-4 mr-1" />
            ) : (
              <Copy className="w-4 h-4 mr-1" />
            )}
            Copy
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {recommendations.map((rec, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <span className="text-gray-300">{rec}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
