'use client';

import { useState, useEffect } from 'react';
import { Play, X } from '@/components/icons';
import { cn } from '@/lib/utils';
import {
  EDUCATIONAL_VIDEOS,
  type EducationalVideo,
} from '@/lib/remotion/educational-content';

interface HelpVideoProps {
  videoId: string;
  className?: string;
}

export function HelpVideo({ videoId, className }: HelpVideoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const video: EducationalVideo | undefined = EDUCATIONAL_VIDEOS.find(
    v => v.id === videoId
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  if (!video) return null;

  const hasYouTube = Boolean(video.youtubeVideoId);

  return (
    <>
      {/* Trigger pill */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5',
          'text-xs text-amber-400 hover:text-amber-300',
          'border border-amber-500/20 hover:border-amber-500/40',
          'bg-amber-500/5 hover:bg-amber-500/10',
          'rounded-full transition-all duration-200',
          !prefersReducedMotion && 'hover:scale-105',
          className
        )}
        aria-label={`Watch tutorial: ${video.title}`}
      >
        <Play className="h-3 w-3 fill-current" />
        Watch Tutorial
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center p-4',
            'bg-black/80 backdrop-blur-xl',
            !prefersReducedMotion && 'animate-in fade-in duration-200'
          )}
          onClick={e => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={video.title}
        >
          <div
            className={cn(
              'relative w-full max-w-4xl',
              'bg-white/[0.02] border border-white/[0.08] rounded-lg shadow-2xl overflow-hidden',
              !prefersReducedMotion && 'animate-in zoom-in-95 duration-200'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <p className="text-sm font-medium text-white truncate pr-4">
                {video.title}
              </p>
              <button
                onClick={() => setIsOpen(false)}
                className="shrink-0 p-1.5 rounded-sm text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
                aria-label="Close tutorial"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Video */}
            <div className="aspect-video bg-black">
              {hasYouTube ? (
                <iframe
                  src={`https://www.youtube.com/embed/${video.youtubeVideoId}?autoplay=1&rel=0`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                  title={video.title}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  <p className="text-sm">
                    Video rendering in progress — check back soon.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
