import { normalizeSlotDay } from '@/hooks/use-optimal-times';

describe('normalizeSlotDay', () => {
  it('maps API weekday numbers to names the picker can compare', () => {
    expect(normalizeSlotDay(1)).toBe('Monday');
    expect(normalizeSlotDay(0)).toBe('Sunday');
    expect(normalizeSlotDay('Tuesday')).toBe('Tuesday');
    expect(normalizeSlotDay('3')).toBe('Wednesday');
  });
});
