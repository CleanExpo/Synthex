'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from '@/components/icons';
// Note: ChevronsLeft and ChevronsRight use ChevronLeft/ChevronRight with double chevrons
const ChevronsLeft = ChevronLeft;
const ChevronsRight = ChevronRight;

/**
 * Pagination Component
 * Page navigation with various styles
 *
 * @task UNI-411 - Frontend Component Completeness
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  boundaryCount?: number;
  showFirstLast?: boolean;
  showPrevNext?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost' | 'glass';
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function range(start: number, end: number): number[] {
  const length = end - start + 1;
  return Array.from({ length }, (_, i) => start + i);
}

function usePagination({
  page,
  totalPages,
  siblingCount = 1,
  boundaryCount = 1,
}: {
  page: number;
  totalPages: number;
  siblingCount: number;
  boundaryCount: number;
}): (number | 'ellipsis')[] {
  const paginationRange = React.useMemo(() => {
    const totalPageNumbers = siblingCount * 2 + 3 + boundaryCount * 2;

    if (totalPageNumbers >= totalPages) {
      return range(1, totalPages);
    }

    const leftSiblingIndex = Math.max(page - siblingCount, boundaryCount + 1);
    const rightSiblingIndex = Math.min(
      page + siblingCount,
      totalPages - boundaryCount
    );

    const shouldShowLeftDots = leftSiblingIndex > boundaryCount + 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - boundaryCount - 1;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount + boundaryCount;
      const leftRange = range(1, leftItemCount);
      return [...leftRange, 'ellipsis' as const, ...range(totalPages - boundaryCount + 1, totalPages)];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount + boundaryCount;
      const rightRange = range(totalPages - rightItemCount + 1, totalPages);
      return [...range(1, boundaryCount), 'ellipsis' as const, ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = range(leftSiblingIndex, rightSiblingIndex);
      return [
        ...range(1, boundaryCount),
        'ellipsis' as const,
        ...middleRange,
        'ellipsis' as const,
        ...range(totalPages - boundaryCount + 1, totalPages),
      ];
    }

    return range(1, totalPages);
  }, [page, totalPages, siblingCount, boundaryCount]);

  return paginationRange;
}

// ============================================================================
// COMPONENTS
// ============================================================================

const PaginationContainer = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'>
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
));
PaginationContainer.displayName = 'PaginationContainer';

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentPropsWithoutRef<'ul'>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn('flex flex-row items-center gap-1', className)}
    {...props}
  />
));
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<'li'>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('', className)} {...props} />
));
PaginationItem.displayName = 'PaginationItem';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Pagination({
  page,
  totalPages,
  onPageChange,
  siblingCount = 1,
  boundaryCount = 1,
  showFirstLast = true,
  showPrevNext = true,
  size = 'md',
  variant = 'default',
  className,
}: PaginationProps) {
  const pages = usePagination({
    page,
    totalPages,
    siblingCount,
    boundaryCount,
  });

  const sizeClasses = {
    sm: 'h-8 min-w-8 text-xs',
    md: 'h-9 min-w-9 text-sm',
    lg: 'h-10 min-w-10 text-base',
  };

  const variantClasses = {
    default: 'bg-white/[0.05] hover:bg-white/[0.1]',
    outline: 'border border-white/[0.1] hover:bg-white/[0.05]',
    ghost: 'hover:bg-white/[0.05]',
    glass: 'glass hover:bg-white/[0.08]',
  };

  const activeClasses = {
    default: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    outline: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400',
    ghost: 'bg-cyan-500/20 text-cyan-400',
    glass: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  };

  const buttonClass = cn(
    'rounded-lg transition-colors text-slate-300',
    sizeClasses[size],
    variantClasses[variant]
  );

  const activeButtonClass = cn(
    'rounded-lg transition-colors',
    sizeClasses[size],
    activeClasses[variant]
  );

  if (totalPages <= 1) return null;

  return (
    <PaginationContainer className={className}>
      <PaginationContent>
        {/* First page */}
        {showFirstLast && (
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              className={buttonClass}
              onClick={() => onPageChange(1)}
              disabled={page === 1}
              aria-label="Go to first page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </PaginationItem>
        )}

        {/* Previous page */}
        {showPrevNext && (
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              className={buttonClass}
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </PaginationItem>
        )}

        {/* Page numbers */}
        {pages.map((pageNumber, index) => {
          if (pageNumber === 'ellipsis') {
            return (
              <PaginationItem key={`ellipsis-${index}`}>
                <span className={cn('flex items-center justify-center', sizeClasses[size])}>
                  <MoreHorizontal className="h-4 w-4 text-slate-500" />
                </span>
              </PaginationItem>
            );
          }

          const isActive = pageNumber === page;

          return (
            <PaginationItem key={pageNumber}>
              <Button
                variant="ghost"
                size="icon"
                className={isActive ? activeButtonClass : buttonClass}
                onClick={() => onPageChange(pageNumber)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Go to page ${pageNumber}`}
              >
                {pageNumber}
              </Button>
            </PaginationItem>
          );
        })}

        {/* Next page */}
        {showPrevNext && (
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              className={buttonClass}
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              aria-label="Go to next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </PaginationItem>
        )}

        {/* Last page */}
        {showFirstLast && (
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              className={buttonClass}
              onClick={() => onPageChange(totalPages)}
              disabled={page === totalPages}
              aria-label="Go to last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </PaginationItem>
        )}
      </PaginationContent>
    </PaginationContainer>
  );
}

// ============================================================================
// SIMPLE PAGINATION
// ============================================================================

export interface SimplePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function SimplePagination({
  page,
  totalPages,
  onPageChange,
  className,
}: SimplePaginationProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous
      </Button>

      <span className="text-sm text-slate-400">
        Page {page} of {totalPages}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

// Export primitives
export {
  PaginationContainer,
  PaginationContent,
  PaginationItem,
};

export default Pagination;
