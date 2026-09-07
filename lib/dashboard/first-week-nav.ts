import { BASIC_NAV_ITEMS } from '@/lib/dashboard/sidebar-nav';

/** Competing rooms — keep the code, keep them out of first-week nav. */
export const FIRST_WEEK_HIDDEN_PATHS = [
  '/dashboard/mission-control',
  '/dashboard/creative-suite',
  '/dashboard/campaign-concept-studio',
  '/dashboard/ad-studio',
  '/dashboard/marketing-lab',
  '/dashboard/sandbox',
  '/dashboard/autonomous',
  '/dashboard/intentscape',
  '/dashboard/profile-analyser',
  '/dashboard/seo',
  '/dashboard/geo',
  '/dashboard/authority',
  '/dashboard/roi',
  '/dashboard/revenue',
  '/dashboard/marketing-agency',
  '/dashboard/webhooks',
  '/dashboard/unified',
  '/dashboard/schedule',
  '/dashboard/content/library',
  '/dashboard/reference-library',
] as const;

export function isFirstWeekHiddenPath(pathname: string): boolean {
  return FIRST_WEEK_HIDDEN_PATHS.some(
    path => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function firstWeekNavHrefs(): string[] {
  return BASIC_NAV_ITEMS.map(item => item.href);
}
