'use client';

/**
 * AutoBreadcrumbs — derives a breadcrumb trail from the current route segments
 * so every nested dashboard page gets wayfinding at near-zero per-page cost.
 *
 * Rendered once in the dashboard layout above the page content. Only shows for
 * genuinely nested pages (more than one level under /dashboard) — top-level
 * section pages already have a clear page title, so a "Dashboard / Content"
 * crumb there would just add chrome.
 */

import { usePathname } from 'next/navigation';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/breadcrumb';

/** Title-case a route slug: "marketing-agency" → "Marketing Agency". */
function humanise(segment: string): string {
  const decoded = decodeURIComponent(segment);
  return decoded
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function AutoBreadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // segments[0] === 'dashboard'. Only render when nested beyond a top-level
  // section page (i.e. /dashboard/<section>/<...>).
  if (segments.length < 3 || segments[0] !== 'dashboard') return null;

  const items: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/dashboard' }];

  let href = '/dashboard';
  for (let i = 1; i < segments.length; i++) {
    href += `/${segments[i]}`;
    const isLast = i === segments.length - 1;
    items.push({
      label: humanise(segments[i]),
      href: isLast ? undefined : href,
      current: isLast,
    });
  }

  return <Breadcrumbs items={items} className={className} />;
}

export default AutoBreadcrumbs;
