import { SEASONAL_BRIEF_ENABLED } from '@/lib/constants/onboarding';

/** After the brand snapshot is accepted or the review is saved. */
export function pathAfterBrandConfirm(): string {
  return SEASONAL_BRIEF_ENABLED
    ? '/onboarding/season-brief'
    : '/onboarding/connect';
}

/** After Finish setup — optional 90-day plan, then Home. */
export const PATH_AFTER_FINISH = '/onboarding/goals';
