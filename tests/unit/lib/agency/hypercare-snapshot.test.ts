import {
  buildHyperCareSnapshot,
  isHyperCareSnapshot,
} from '@/lib/agency/hypercare-snapshot';

describe('buildHyperCareSnapshot', () => {
  it('summarises 24h gate failures and surfaces breaches', () => {
    const snapshot = buildHyperCareSnapshot(
      [
        { pass: true, reasons: [] },
        { pass: false, reasons: ['missing source', 'stale citation'] },
        { pass: false, reasons: ['missing source'] },
      ],
      new Date('2026-08-05T06:00:00.000Z')
    );

    expect(snapshot).toMatchObject({
      dayEnding: '2026-08-05',
      windowHours: 24,
      totalRuns: 3,
      passedRuns: 1,
      failedRuns: 2,
      breachSurfaced: true,
      failureReasons: [
        { reason: 'missing source', count: 2 },
        { reason: 'stale citation', count: 1 },
      ],
    });
  });

  it('marks breachSurfaced false when all gates pass', () => {
    const snapshot = buildHyperCareSnapshot(
      [{ pass: true, reasons: [] }],
      new Date('2026-08-05T06:00:00.000Z')
    );

    expect(snapshot.breachSurfaced).toBe(false);
    expect(snapshot.failedRuns).toBe(0);
  });

  it('recognises valid stored snapshots', () => {
    expect(
      isHyperCareSnapshot({
        dayEnding: '2026-08-05',
        generatedAt: '2026-08-05T06:00:00.000Z',
        windowHours: 24,
        totalRuns: 0,
        passedRuns: 0,
        failedRuns: 0,
        breachSurfaced: false,
        failureReasons: [],
      })
    ).toBe(true);
    expect(isHyperCareSnapshot({ totalRuns: 1 })).toBe(false);
  });
});
