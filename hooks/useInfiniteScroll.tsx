'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { notify } from '@/lib/notifications';

interface UseInfiniteScrollOptions<T> {
  initialData?: T[];
  pageSize?: number;
  loadMore: (page: number, pageSize: number) => Promise<T[]>;
  onError?: (error: any) => void;
  threshold?: number; // Distance from bottom to trigger load (in pixels)
  enabled?: boolean;
}

interface UseInfiniteScrollReturn<T> {
  items: T[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMoreItems: () => void;
  reset: () => void;
  page: number;
  isLoadingMore: boolean;
  totalLoaded: number;
}

export function useInfiniteScroll<T>({
  initialData = [],
  pageSize = 20,
  loadMore,
  onError,
  threshold = 200,
  enabled = true
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);
  
  // Load more items
  const loadMoreItems = useCallback(async () => {
    if (loadingRef.current || !hasMore || !enabled) return;
    
    loadingRef.current = true;
    setIsLoadingMore(true);
    setError(null);
    
    try {
      const newItems = await loadMore(page, pageSize);
      
      if (newItems.length === 0 || newItems.length < pageSize) {
        setHasMore(false);
        if (newItems.length === 0) {
          notify.info('No more items to load');
        }
      }
      
      setItems(prev => [...prev, ...newItems]);
      setPage(prev => prev + 1);
    } catch (err) {
      const error = err as Error;
      setError(error);
      setHasMore(false);
      
      if (onError) {
        onError(error);
      } else {
        notify.error('Failed to load more items');
      }
    } finally {
      loadingRef.current = false;
      setIsLoadingMore(false);
      setLoading(false);
    }
  }, [page, pageSize, loadMore, hasMore, enabled, onError]);
  
  // Reset the infinite scroll
  const reset = useCallback(() => {
    setItems(initialData);
    setPage(1);
    setLoading(false);
    setIsLoadingMore(false);
    setError(null);
    setHasMore(true);
    loadingRef.current = false;
  }, [initialData]);
  
  // Initial load
  useEffect(() => {
    if (items.length === 0 && hasMore && enabled) {
      setLoading(true);
      loadMoreItems();
    }
  }, []);
  
  return {
    items,
    loading,
    error,
    hasMore,
    loadMoreItems,
    reset,
    page,
    isLoadingMore,
    totalLoaded: items.length
  };
}

// Intersection Observer Hook for triggering infinite scroll
export function useInfiniteScrollTrigger(
  callback: () => void,
  options?: {
    threshold?: number;
    rootMargin?: string;
    enabled?: boolean;
  }
) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    if (options?.enabled === false) return;
    
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback();
        }
      });
    };
    
    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold: options?.threshold || 0.1,
      rootMargin: options?.rootMargin || '100px'
    });
    
    if (triggerRef.current) {
      observerRef.current.observe(triggerRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [callback, options?.enabled, options?.threshold, options?.rootMargin]);
  
  return triggerRef;
}

// Virtual scrolling hook for large lists
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex
  };
}

// Paginated data hook
export function usePagination<T>({
  data,
  pageSize = 10,
  initialPage = 1
}: {
  data: T[];
  pageSize?: number;
  initialPage?: number;
}) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  
  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, data.length);
  const currentData = data.slice(startIndex, endIndex);
  
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };
  
  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);
  const firstPage = () => goToPage(1);
  const lastPage = () => goToPage(totalPages);
  
  return {
    currentData,
    currentPage,
    totalPages,
    pageSize,
    totalItems: data.length,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage
  };
}