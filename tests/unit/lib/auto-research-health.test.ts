/**
 * SYN-1025 — research-loop health classification + Obsidian writeback proof.
 */

const mockFindFirst = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: { autoResearchRun: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
}));

const mockQueueStats = jest.fn();
jest.mock('@/lib/queue/bull-queue', () => ({
  getQueueStats: (...a: unknown[]) => mockQueueStats(...a),
}));

const mockRedisHealth = jest.fn();
jest.mock('@/lib/redis-unified', () => ({
  healthCheck: (...a: unknown[]) => mockRedisHealth(...a),
}));

const mockObsidianEnabled = jest.fn();
const mockWriteNote = jest.fn();
const mockReadNote = jest.fn();
jest.mock('@/lib/obsidian/client', () => ({
  isEnabled: (...a: unknown[]) => mockObsidianEnabled(...a),
  writeNote: (...a: unknown[]) => mockWriteNote(...a),
  readNote: (...a: unknown[]) => mockReadNote(...a),
}));

import {
  getResearchLoopHealth,
  verifyObsidianWriteback,
  worstLevel,
} from '@/lib/auto-research/health';

const ENV_KEYS = ['APIFY_API_TOKEN', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY'];
const savedEnv: Record<string, string | undefined> = {};

describe('research-loop health (SYN-1025)', () => {
  beforeEach(() => {
    ENV_KEYS.forEach(k => (savedEnv[k] = process.env[k]));
    // Baseline = all healthy
    process.env.APIFY_API_TOKEN = 'apify-x';
    process.env.ANTHROPIC_API_KEY = 'sk-x';
    delete process.env.OPENROUTER_API_KEY;
    mockRedisHealth.mockResolvedValue({ status: 'healthy', implementation: 'redis-standard' });
    mockQueueStats.mockResolvedValue({ waiting: 0, active: 0, completed: 5, failed: 0, delayed: 0 });
    mockObsidianEnabled.mockReturnValue(true);
    mockFindFirst.mockResolvedValue({
      runType: 'daily_trends',
      status: 'completed',
      completedAt: new Date('2026-06-16T03:00:00Z'),
      insightsCount: 12,
      error: null,
    });
  });

  afterEach(() => {
    ENV_KEYS.forEach(k => {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    });
    jest.clearAllMocks();
  });

  it('reports ok and feedingSecondBrain when everything is healthy', async () => {
    const h = await getResearchLoopHealth('org-1');
    expect(h.status).toBe('ok');
    expect(h.feedingSecondBrain).toBe(true);
    expect(h.checks.redis.status).toBe('ok');
    expect(h.checks.queue.status).toBe('ok');
  });

  it('fails when Redis/queue is unreachable', async () => {
    mockRedisHealth.mockRejectedValue(new Error('ECONNREFUSED'));
    mockQueueStats.mockRejectedValue(new Error('ECONNREFUSED'));
    const h = await getResearchLoopHealth('org-1');
    expect(h.checks.redis.status).toBe('fail');
    expect(h.checks.queue.status).toBe('fail');
    expect(h.status).toBe('fail');
  });

  it('warns (not fails) when the Apify token is missing', async () => {
    delete process.env.APIFY_API_TOKEN;
    const h = await getResearchLoopHealth('org-1');
    expect(h.checks.apifyToken.status).toBe('warn');
    expect(h.status).toBe('warn');
  });

  it('fails when no AI provider key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const h = await getResearchLoopHealth('org-1');
    expect(h.checks.aiProvider.status).toBe('fail');
    expect(h.status).toBe('fail');
  });

  it('warns and is not feeding the 2nd brain when Obsidian is disabled', async () => {
    mockObsidianEnabled.mockReturnValue(false);
    const h = await getResearchLoopHealth('org-1');
    expect(h.checks.obsidian.status).toBe('warn');
    expect(h.feedingSecondBrain).toBe(false);
  });

  it('warns when there are no runs yet', async () => {
    mockFindFirst.mockResolvedValue(null);
    const h = await getResearchLoopHealth('org-1');
    expect(h.checks.lastRun.status).toBe('warn');
    expect(h.feedingSecondBrain).toBe(false);
  });

  it('fails when the last run failed', async () => {
    mockFindFirst.mockResolvedValue({
      runType: 'weekly_deep',
      status: 'failed',
      completedAt: null,
      insightsCount: 0,
      error: 'apify timeout',
    });
    const h = await getResearchLoopHealth('org-1');
    expect(h.checks.lastRun.status).toBe('fail');
    expect(h.checks.lastRun.detail).toContain('apify timeout');
    expect(h.status).toBe('fail');
  });

  describe('verifyObsidianWriteback', () => {
    it('fails with no org context', async () => {
      const r = await verifyObsidianWriteback('');
      expect(r.status).toBe('fail');
      expect(mockWriteNote).not.toHaveBeenCalled();
    });

    it('warns when Obsidian is disabled', async () => {
      mockObsidianEnabled.mockReturnValue(false);
      const r = await verifyObsidianWriteback('org-1');
      expect(r.status).toBe('warn');
      expect(mockWriteNote).not.toHaveBeenCalled();
    });

    it('passes a write→read round-trip to a dedicated health note', async () => {
      mockObsidianEnabled.mockReturnValue(true);
      mockWriteNote.mockResolvedValue(undefined);
      mockReadNote.mockImplementation((_p: string) =>
        Promise.resolve(mockWriteNote.mock.calls[0]?.[1] ?? '')
      );
      const r = await verifyObsidianWriteback('org-1');
      expect(r.status).toBe('ok');
      const notePath = mockWriteNote.mock.calls[0][0];
      expect(notePath).toBe('Clients/org-1/_research-health-check.md');
    });

    it('fails when the read-back does not match', async () => {
      mockObsidianEnabled.mockReturnValue(true);
      mockWriteNote.mockResolvedValue(undefined);
      mockReadNote.mockResolvedValue('something else');
      const r = await verifyObsidianWriteback('org-1');
      expect(r.status).toBe('fail');
    });
  });

  it('worstLevel escalates fail > warn > ok', () => {
    expect(worstLevel(['ok', 'warn', 'ok'])).toBe('warn');
    expect(worstLevel(['ok', 'warn', 'fail'])).toBe('fail');
    expect(worstLevel(['ok', 'ok'])).toBe('ok');
  });
});
