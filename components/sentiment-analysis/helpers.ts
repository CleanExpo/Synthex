import { Smile, Frown, Meh } from '@/components/icons';
import React from 'react';

export function getSentimentIcon(sentiment: string) {
  switch (sentiment) {
    case 'positive': return React.createElement(Smile, { className: 'h-5 w-5 text-green-400' });
    case 'negative': return React.createElement(Frown, { className: 'h-5 w-5 text-red-400' });
    default: return React.createElement(Meh, { className: 'h-5 w-5 text-yellow-400' });
  }
}

export function getSentimentColor(score: number) {
  if (score > 0.3) return 'text-green-400';
  if (score < -0.3) return 'text-red-400';
  return 'text-yellow-400';
}

export function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    default: return 'bg-green-500';
  }
}

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(0,0,0,0.8)',
  border: '1px solid rgba(6, 182, 212, 0.3)',
  borderRadius: '8px',
};
