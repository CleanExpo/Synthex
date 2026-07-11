import { detectIndustry } from '@/lib/demo/industry-classifier';

describe('classifier water-damage hyphen tolerance', () => {
  it('matches hyphenated water-damaged', () => {
    expect(detectIndustry('drying a water-damaged room')).toBe(
      'cleaning & restoration'
    );
  });
  it('still matches spaced form', () => {
    expect(detectIndustry('water damage in the kitchen')).toBe(
      'cleaning & restoration'
    );
  });
  it('unrelated prompts unaffected', () => {
    expect(detectIndustry('a law firm office in Sydney')).toBe('legal');
  });
});
