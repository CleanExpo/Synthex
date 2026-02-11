'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Reverence Sidebar Component
 *
 * Sticky sidebar displaying key statistics for research reports.
 * Part of the Authority Curator skill for Research Report Linkable Assets.
 *
 * @module components/research/ReverenceSidebar
 */

export interface KeyStat {
  /** Main statistic value (e.g., "73%", "$47,000", "12 months") */
  value: string | number;
  /** Label describing the statistic */
  label: string;
  /** Source attribution (e.g., "AFCA 2024", "ICA 2024") */
  source?: string;
  /** Trend indicator for the statistic */
  trend?: 'up' | 'down' | 'stable';
}

export interface CitationFormat {
  apa: string;
  harvard: string;
  mla?: string;
}

export interface ReverenceSidebarProps {
  /** Array of key statistics to display */
  keyStats: KeyStat[];
  /** Social share buttons to show */
  shareButtons?: ('linkedin' | 'twitter' | 'email')[];
  /** Pre-formatted citations for the research */
  citations: CitationFormat;
  /** Report title for sharing and citations */
  reportTitle: string;
  /** Report URL for sharing and citations */
  reportUrl: string;
  /** Download options available */
  downloadOptions?: ('pdf' | 'csv')[];
  /** PDF download URL */
  pdfUrl?: string;
  /** CSV data download URL */
  csvUrl?: string;
  /** Additional className for styling */
  className?: string;
}

const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'stable' }> = ({ trend }) => {
  if (trend === 'up') {
    return (
      <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    );
  }
  if (trend === 'down') {
    return (
      <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
    </svg>
  );
};

const ShareIcon: React.FC<{ platform: 'linkedin' | 'twitter' | 'email' }> = ({ platform }) => {
  switch (platform) {
    case 'linkedin':
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      );
    case 'twitter':
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    case 'email':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
  }
};

export function ReverenceSidebar({
  keyStats,
  shareButtons = ['linkedin', 'twitter', 'email'],
  citations,
  reportTitle,
  reportUrl,
  downloadOptions = ['pdf', 'csv'],
  pdfUrl,
  csvUrl,
  className,
}: ReverenceSidebarProps) {
  const [copiedFormat, setCopiedFormat] = React.useState<string | null>(null);

  const handleCopyCitation = async (format: 'apa' | 'harvard' | 'mla') => {
    const text = citations[format];
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (error) {
      console.error('Failed to copy citation:', error);
    }
  };

  const handleShare = (platform: 'linkedin' | 'twitter' | 'email') => {
    const encodedTitle = encodeURIComponent(reportTitle);
    const encodedUrl = encodeURIComponent(reportUrl);

    let shareUrl: string;
    switch (platform) {
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodedTitle}&body=Check out this research: ${reportUrl}`;
        break;
    }

    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <aside className={cn('sticky top-24 w-full max-w-xs', className)}>
      <Card variant="glass-primary" className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
            Key Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Stats */}
          {keyStats.map((stat, index) => (
            <div
              key={index}
              className="border-b border-white/10 pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-white">{stat.value}</span>
                {stat.trend && <TrendIcon trend={stat.trend} />}
              </div>
              <p className="mt-1 text-sm text-gray-300">{stat.label}</p>
              {stat.source && (
                <p className="mt-1 text-xs text-gray-500">Source: {stat.source}</p>
              )}
            </div>
          ))}

          {/* Social Share */}
          <div className="border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Share Research
            </p>
            <div className="flex gap-2">
              {shareButtons.map((platform) => (
                <Button
                  key={platform}
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare(platform)}
                  className="flex-1 border-white/10 bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/40"
                >
                  <ShareIcon platform={platform} />
                </Button>
              ))}
            </div>
          </div>

          {/* Cite This Research */}
          <div className="border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              📋 Cite This Research
            </p>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyCitation('apa')}
                className="w-full justify-start border-white/10 bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/40 text-xs"
              >
                {copiedFormat === 'apa' ? '✓ Copied!' : 'Copy APA Citation'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyCitation('harvard')}
                className="w-full justify-start border-white/10 bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/40 text-xs"
              >
                {copiedFormat === 'harvard' ? '✓ Copied!' : 'Copy Harvard Citation'}
              </Button>
            </div>
          </div>

          {/* Download Options */}
          {downloadOptions.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                ⬇️ Download Report
              </p>
              <div className="flex gap-2">
                {downloadOptions.includes('pdf') && pdfUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1 border-white/10 bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/40"
                  >
                    <a href={pdfUrl} download>PDF</a>
                  </Button>
                )}
                {downloadOptions.includes('csv') && csvUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1 border-white/10 bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/40"
                  >
                    <a href={csvUrl} download>CSV Data</a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

export default ReverenceSidebar;
