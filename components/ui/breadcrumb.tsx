'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, Home, MoreHorizontal } from 'lucide-react';

/**
 * Breadcrumb Component
 * Navigation breadcrumbs with glassmorphism design
 *
 * @task UNI-411 - Frontend Component Completeness
 */

// ============================================================================
// TYPES
// ============================================================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  current?: boolean;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  homeIcon?: boolean;
  maxItems?: number;
  className?: string;
  variant?: 'default' | 'glass' | 'pills';
}

// ============================================================================
// COMPONENTS
// ============================================================================

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'> & { separator?: React.ReactNode }
>(({ className, separator, ...props }, ref) => (
  <nav
    ref={ref}
    aria-label="breadcrumb"
    className={className}
    {...props}
  />
));
Breadcrumb.displayName = 'Breadcrumb';

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<'ol'>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      'flex flex-wrap items-center gap-1.5 break-words text-sm text-slate-400',
      className
    )}
    {...props}
  />
));
BreadcrumbList.displayName = 'BreadcrumbList';

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<'li'>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn('inline-flex items-center gap-1.5', className)}
    {...props}
  />
));
BreadcrumbItem.displayName = 'BreadcrumbItem';

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & { asChild?: boolean }
>(({ asChild, className, ...props }, ref) => {
  return (
    <a
      ref={ref}
      className={cn(
        'transition-colors hover:text-slate-100',
        className
      )}
      {...props}
    />
  );
});
BreadcrumbLink.displayName = 'BreadcrumbLink';

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn('font-medium text-white', className)}
    {...props}
  />
));
BreadcrumbPage.displayName = 'BreadcrumbPage';

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<'li'>) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn('[&>svg]:size-3.5', className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
);
BreadcrumbEllipsis.displayName = 'BreadcrumbEllipsis';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Breadcrumbs({
  items,
  separator,
  homeIcon = true,
  maxItems,
  className,
  variant = 'default',
}: BreadcrumbProps) {
  const displayItems = React.useMemo(() => {
    if (!maxItems || items.length <= maxItems) {
      return items;
    }

    // Show first, ellipsis, and last (maxItems - 1) items
    const lastItems = items.slice(-(maxItems - 1));
    return [items[0], { label: '...', ellipsis: true } as BreadcrumbItem & { ellipsis?: boolean }, ...lastItems];
  }, [items, maxItems]);

  const variantClasses = {
    default: '',
    glass: 'glass px-4 py-2 rounded-lg',
    pills: 'flex gap-1',
  };

  const itemClasses = {
    default: '',
    glass: '',
    pills: 'px-3 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1]',
  };

  return (
    <Breadcrumb className={cn(variantClasses[variant], className)}>
      <BreadcrumbList>
        {displayItems.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === displayItems.length - 1;
          const isEllipsis = (item as any).ellipsis;

          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <BreadcrumbItem>
                {isEllipsis ? (
                  <BreadcrumbEllipsis />
                ) : isLast || item.current ? (
                  <BreadcrumbPage className={cn(itemClasses[variant])}>
                    {isFirst && homeIcon && !item.icon && (
                      <Home className="w-4 h-4 mr-1.5" />
                    )}
                    {item.icon && <span className="mr-1.5">{item.icon}</span>}
                    {item.label}
                  </BreadcrumbPage>
                ) : item.href ? (
                  <BreadcrumbLink
                    href={item.href}
                    className={cn(
                      'flex items-center',
                      itemClasses[variant]
                    )}
                  >
                    {isFirst && homeIcon && !item.icon && (
                      <Home className="w-4 h-4 mr-1.5" />
                    )}
                    {item.icon && <span className="mr-1.5">{item.icon}</span>}
                    {item.label}
                  </BreadcrumbLink>
                ) : (
                  <span className={cn('flex items-center', itemClasses[variant])}>
                    {isFirst && homeIcon && !item.icon && (
                      <Home className="w-4 h-4 mr-1.5" />
                    )}
                    {item.icon && <span className="mr-1.5">{item.icon}</span>}
                    {item.label}
                  </span>
                )}
              </BreadcrumbItem>

              {!isLast && (
                <BreadcrumbSeparator>
                  {separator}
                </BreadcrumbSeparator>
              )}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

// Export primitives
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem as BreadcrumbItemPrimitive,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};

export default Breadcrumbs;
