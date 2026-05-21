import {
  evaluateCloseLoopHealth,
  evaluateMarketingAgencyOutcomeLearning,
} from '@/lib/close-loop/health';

describe('Close the Loop health evaluation', () => {
  const now = new Date('2026-05-21T00:00:00.000Z');

  it('returns green when all required pipelines recently succeeded', () => {
    const rows = [
      'build-knowledge-graph',
      'ai-advisor',
      'content-profile',
      'content-score',
    ].map((name) => ({
      function_name: name,
      status: 'success' as const,
      clients_processed: 1,
      clients_failed: 0,
      duration_ms: 100,
      created_at: '2026-05-20T00:00:00.000Z',
    }));

    expect(evaluateCloseLoopHealth(rows, now).overall).toBe('green');
  });

  it('returns red when a required pipeline has no recent evidence', () => {
    const report = evaluateCloseLoopHealth([], now);

    expect(report.overall).toBe('red');
    expect(report.pipelines.every((pipeline) => pipeline.stale)).toBe(true);
  });

  it('returns yellow when a recent pipeline partially failed', () => {
    const rows = [
      'build-knowledge-graph',
      'ai-advisor',
      'content-profile',
      'content-score',
    ].map((name) => ({
      function_name: name,
      status: name === 'ai-advisor' ? ('partial' as const) : ('success' as const),
      clients_processed: 1,
      clients_failed: name === 'ai-advisor' ? 1 : 0,
      duration_ms: 100,
      created_at: '2026-05-20T00:00:00.000Z',
    }));

    expect(evaluateCloseLoopHealth(rows, now).overall).toBe('yellow');
  });

  it('adds optional Marketing Agency outcome learning without changing pipeline health', () => {
    const rows = [
      'build-knowledge-graph',
      'ai-advisor',
      'content-profile',
      'content-score',
    ].map((name) => ({
      function_name: name,
      status: 'success' as const,
      clients_processed: 1,
      clients_failed: 0,
      duration_ms: 100,
      created_at: '2026-05-20T00:00:00.000Z',
    }));

    const learning = evaluateMarketingAgencyOutcomeLearning(
      [
        {
          eventType: 'approval_reviewed',
          recordedAt: new Date('2026-05-20T12:00:00.000Z'),
        },
      ],
      now
    );

    const report = evaluateCloseLoopHealth(rows, now, [learning]);

    expect(report.overall).toBe('green');
    expect(report.learningSignals).toEqual([
      expect.objectContaining({
        name: 'marketing-agency-outcomes',
        status: 'active',
        eventsObserved: 1,
        latestEventType: 'approval_reviewed',
      }),
    ]);
  });

  it('marks Marketing Agency outcome learning as no_data when no events exist', () => {
    expect(evaluateMarketingAgencyOutcomeLearning([], now)).toEqual({
      name: 'marketing-agency-outcomes',
      lastObservedAt: null,
      status: 'no_data',
      eventsObserved: 0,
      latestEventType: null,
      stale: true,
    });
  });

  it('marks Marketing Agency outcome learning as stale when the latest event is old', () => {
    expect(
      evaluateMarketingAgencyOutcomeLearning(
        [
          {
            eventType: 'performance_observed',
            recordedAt: new Date('2026-05-01T00:00:00.000Z'),
          },
        ],
        now
      )
    ).toEqual({
      name: 'marketing-agency-outcomes',
      lastObservedAt: '2026-05-01T00:00:00.000Z',
      status: 'stale',
      eventsObserved: 1,
      latestEventType: 'performance_observed',
      stale: true,
    });
  });
});
