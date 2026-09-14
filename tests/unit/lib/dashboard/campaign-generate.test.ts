import {
  daysInWindow,
  extractGeneratedLines,
} from '@/lib/dashboard/campaign-generate';

describe('daysInWindow', () => {
  it('counts inclusive days and caps at a week', () => {
    expect(daysInWindow('2026-09-14', '2026-09-16')).toBe(3);
    expect(daysInWindow('2026-09-01', '2026-09-20')).toBe(7);
  });
});

describe('extractGeneratedLines', () => {
  it('reads captions out of the generate-content envelope', () => {
    expect(
      extractGeneratedLines({
        success: true,
        data: {
          content: 'First tray is out.',
          variations: [
            { id: 'v1', content: 'Soup is on.', style: 'casual', score: 80 },
            'Walk in after three.',
          ],
        },
      })
    ).toEqual(['First tray is out.', 'Soup is on.', 'Walk in after three.']);
  });
});
