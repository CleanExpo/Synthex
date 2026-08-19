import {
  buildTier2Snapshot,
  isTier2Snapshot,
} from '@/lib/agency/tier2-snapshot';

describe('buildTier2Snapshot', () => {
  it('summarises 30-day gate failures by reason', () => {
    const snapshot = buildTier2Snapshot(
      [
        { pass: true, reasons: [] },
        { pass: false, reasons: ['missing source', 'stale citation'] },
        { pass: false, reasons: ['missing source'] },
      ],
      new Date('2026-08-01T07:00:00.000Z')
    );

    expect(snapshot).toMatchObject({
      monthEnding: '2026-08-01',
      totalRuns: 3,
      passedRuns: 1,
      failedRuns: 2,
      failureReasons: [
        { reason: 'missing source', count: 2 },
        { reason: 'stale citation', count: 1 },
      ],
    });
  });

  it('recognises valid stored snapshots', () => {
    expect(
      isTier2Snapshot({
        monthEnding: '2026-08-01',
        generatedAt: '2026-08-01T07:00:00.000Z',
        totalRuns: 0,
        passedRuns: 0,
        failedRuns: 0,
        failureReasons: [],
      })
    ).toBe(true);
    expect(isTier2Snapshot({ totalRuns: 1 })).toBe(false);
  });
});
