import {
  pathAfterBrandConfirm,
  PATH_AFTER_FINISH,
} from '@/lib/onboarding/journey';
import { SEASONAL_BRIEF_ENABLED } from '@/lib/constants/onboarding';

describe('onboarding journey paths', () => {
  it('sends finish setup to the optional 90-day plan', () => {
    expect(PATH_AFTER_FINISH).toBe('/onboarding/goals');
  });

  it('places market outlook after brand confirm when the flag is on', () => {
    if (SEASONAL_BRIEF_ENABLED) {
      expect(pathAfterBrandConfirm()).toBe('/onboarding/season-brief');
    } else {
      expect(pathAfterBrandConfirm()).toBe('/onboarding/connect');
    }
  });
});
