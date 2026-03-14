'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInfiniteScroll, useInfiniteScrollTrigger } from '@/hooks/useInfiniteScroll';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, ChevronUp } from '@/components/icons';
import { staggerContainer, staggerItem } from '@/lib/animations';

interface FeedItem {
  id: string;
  content: any;
  timestamp: Date;
  [key: string]: any;
}

interface InfiniteScrollFeedProps<T extends FeedItem> {
  loadMore: (page: number, pageSize: number) => Promise<T[]>;
  renderItem: (item: T, index: number) => React.ReactNode;
  pageSize?: number;
  className?: string;
  emptyMessage?: string;
  errorMessage?: string;
  showScrollToTop?: boolean;
  gap?: number;
}

export function InfiniteScrollFeed<T extends FeedItem>({
  loadMore,
  renderItem,
  pageSize = 20,
  className = '',
  emptyMessage = 'No items to display',
  errorMessage = 'Failed to load items',
  showScrollToTop = true,
  gap = 4
}: InfiniteScrollFeedProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const {
    items,
    loading,
    error,
    hasMore,
    loadMoreItems,
    reset,
    isLoadingMore,
    totalLoaded
  } = useInfiniteScroll<T>({
    pageSize,
    loadMore
  });
  
  const triggerRef = useInfiniteScrollTrigger(loadMoreItems, {
    enabled: hasMore && !isLoadingMore,
    rootMargin: '200px'
  });
  
  // Show/hide scroll to top button — rAF-throttled for performance
  useEffect(() => {
    let rafId: number | null = null;
    const handleScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          if (containerRef.current) {
            setShowScrollButton(containerRef.current.scrollTop > 500);
          }
          rafId = null;
        });
      }
    };

    const container = containerRef.current;
    container?.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container?.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  
  const scrollToTop = () => {
    containerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  
  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className={`space-y-${gap}`}>
      {[...Array(3)].map((_, i) => (
        <Card key={`skeleton-${i}`} variant="glass" className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
  
  // Error state
  if (error && items.length === 0) {
    return (
      <Card variant="glass" className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-lg font-semibold text-white mb-2">Error Loading Feed</p>
        <p className="text-gray-400 mb-4">{errorMessage}</p>
        <Button onClick={reset} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </Card>
    );
  }
  
  // Empty state
  if (!loading && items.length === 0) {
    return (
      <Card variant="glass" className="p-8 text-center">
        <p className="text-gray-400">{emptyMessage}</p>
      </Card>
    );
  }
  
  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Items list */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className={`space-y-${gap}`}
      >
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              variants={staggerItem}
              layout
              layoutId={item.id}
            >
              {renderItem(item, index)}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      
      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="mt-4">
          <LoadingSkeleton />
        </div>
      )}
      
      {/* Infinite scroll trigger */}
      {hasMore && !isLoadingMore && (
        <div ref={triggerRef as any} className="h-20 flex items-center justify-center">
          <span className="text-sm text-gray-400">Loading more...</span>
        </div>
      )}
      
      {/* End of feed message */}
      {!hasMore && items.length > 0 && (
        <div className="text-center py-8">
          <p className="text-gray-400">
            You've reached the end • {totalLoaded} items loaded
          </p>
        </div>
      )}
      
      {/* Scroll to top button */}
      {showScrollToTop && showScrollButton && (
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          onClick={scrollToTop}
          className="fixed bottom-20 right-6 z-30 p-3 bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-full shadow-lg"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronUp className="h-5 w-5 text-white" />
        </motion.button>
      )}
      
      {/* Initial loading */}
      {loading && items.length === 0 && <LoadingSkeleton />}
    </div>
  );
}

// Virtual scrolling feed for very large lists
export function VirtualScrollFeed<T>({
  items,
  renderItem,
  itemHeight = 100,
  containerHeight = 600,
  className = ''
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight)
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };
  
  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Optimized image component for feeds
export function FeedImage({ 
  src, 
  alt, 
  className = '' 
}: { 
  src: string; 
  alt: string; 
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  if (error) {
    return (
      <div className={`bg-white/5 flex items-center justify-center ${className}`}>
        <AlertCircle className="h-8 w-8 text-gray-400" />
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      {!loaded && (
        <Skeleton className="absolute inset-0" />
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  );
}