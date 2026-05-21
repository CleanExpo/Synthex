import { evaluateCloseLoopHealth } from '@/lib/close-loop/health';

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
});
