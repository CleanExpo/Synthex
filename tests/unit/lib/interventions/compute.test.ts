/**
 * Unit tests — lib/interventions/compute.ts
 *
 * Tests the full intervention computation engine:
 * - Baseline calculation from rolling 30-day window
 * - Cooldown enforcement (7-day window)
 * - Tier selection based on decline magnitude
 * - Staged activation (observation vs live dispatch)
 * - Batch processing with error isolation
 *
 * SYN-615/620
 */

// ── Email renderer mock (always mock before import) ───────────────────────────

const mockSendValueProofEmail = jest.fn().mockResolvedValue(undefined);
const mockGetOrgContactEmail = jest.fn().mockResolvedValue('owner@example.com');

jest.mock('@/lib/interventions/email-renderer', () => ({
  sendValueProofEmail: (...args: unknown[]) => mockSendValueProofEmail(...args),
  getOrgContactEmail: (...args: unknown[]) => mockGetOrgContactEmail(...args),
}));

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockInterventionConfigFindMany = jest.fn();
const mockOrgFindMany = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockHealthScoreFindFirst = jest.fn();
const mockHealthScoreFindMany = jest.fn();
const mockHealthInterventionFindMany = jest.fn();
const mockHealthInterventionCreate = jest.fn().mockResolvedValue({ id: 'int_001' });
const mockFounderOutreachCreate = jest.fn().mockResolvedValue({ id: 'foq_001' });

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    interventionConfig: { findMany: (...a: unknown[]) => mockInterventionConfigFindMany(...a) },
    organization: {
      findMany: (...a: unknown[]) => mockOrgFindMany(...a),
      findUnique: (...a: unknown[]) => mockOrgFindUnique(...a),
    },
    clientHealthScore: {
      findFirst: (...a: unknown[]) => mockHealthScoreFindFirst(...a),
      findMany: (...a: unknown[]) => mockHealthScoreFindMany(...a),
    },
    healthIntervention: {
      findMany: (...a: unknown[]) => mockHealthInterventionFindMany(...a),
      create: (...a: unknown[]) => mockHealthInterventionCreate(...a),
    },
    founderOutreachQueue: {
      create: (...a: unknown[]) => mockFounderOutreachCreate(...a),
    },
  },
  default: {
    interventionConfig: { findMany: (...a: unknown[]) => mockInterventionConfigFindMany(...a) },
    organization: {
      findMany: (...a: unknown[]) => mockOrgFindMany(...a),
      findUnique: (...a: unknown[]) => mockOrgFindUnique(...a),
    },
    clientHealthScore: {
      findFirst: (...a: unknown[]) => mockHealthScoreFindFirst(...a),
      findMany: (...a: unknown[]) => mockHealthScoreFindMany(...a),
    },
    healthIntervention: {
      findMany: (...a: unknown[]) => mockHealthInterventionFindMany(...a),
      create: (...a: unknown[]) => mockHealthInterventionCreate(...a),
    },
    founderOutreachQueue: {
      create: (...a: unknown[]) => mockFounderOutreachCreate(...a),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { runInterventions } from '@/lib/interventions/compute';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAST_DATE = new Date('2020-01-01'); // activation has passed → live mode
const FUTURE_DATE = new Date('2099-01-01'); // not yet active → observation mode

/** Standard 6-dimension config — all thresholds at 10/20/30 */
function makeConfig(overrides: Partial<Record<string, unknown>> = {}) {
  const dimensions = [
    'content_consistency',
    'engagement_trajectory',
    'review_responsiveness',
    'authority_momentum',
    'advisor_engagement',
    'platform_usage',
  ];
  return dimensions.map(dim => ({
    dimension: dim,
    tier1Threshold: 10,
    tier2Threshold: 20,
    tier3Threshold: 30,
    tier1ActiveFrom: PAST_DATE,
    tier2ActiveFrom: PAST_DATE,
    tier3ActiveFrom: PAST_DATE,
    ...overrides,
  }));
}

/** Dimension scores where a single dimension has a known current score */
function makeScores(dimension: string, currentScore: number) {
  const dims: Record<string, { score: number; description: string } | null> = {
    content_consistency: { score: 80, description: 'ok' },
    engagement_trajectory: { score: 80, description: 'ok' },
    review_responsiveness: { score: 80, description: 'ok' },
    authority_momentum: { score: 80, description: 'ok' },
    advisor_engagement: { score: 80, description: 'ok' },
    platform_usage: { score: 80, description: 'ok' },
  };
  dims[dimension] = { score: currentScore, description: 'test' };
  return dims;
}

/** 4 baseline weeks where a single dimension scored `baselineScore` */
function makeHistory(dimension: string, baselineScore: number) {
  const make = (score: number) => ({
    dimensions: {
      content_consistency: { score: 80, description: 'ok' },
      engagement_trajectory: { score: 80, description: 'ok' },
      review_responsiveness: { score: 80, description: 'ok' },
      authority_momentum: { score: 80, description: 'ok' },
      advisor_engagement: { score: 80, description: 'ok' },
      platform_usage: { score: 80, description: 'ok' },
      [dimension]: { score, description: 'baseline' },
    },
    weekStart: new Date('2026-03-01'),
  });
  // latest + 4 history weeks — getBaselines skips index 0 (latest)
  return [make(baselineScore - 5), make(baselineScore), make(baselineScore), make(baselineScore), make(baselineScore)];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runInterventions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // resetMocks:true clears ALL implementations — restore anything needed across tests
    mockGetOrgContactEmail.mockResolvedValue('owner@example.com');
    mockSendValueProofEmail.mockResolvedValue(undefined);
    mockHealthInterventionCreate.mockResolvedValue({ id: 'int_001' });
    mockFounderOutreachCreate.mockResolvedValue({ id: 'foq_001' });
    mockOrgFindUnique.mockResolvedValue({ name: 'Test Org' });
  });

  // ── Empty / no data ─────────────────────────────────────────────────────────

  it('returns zero counts when there are no active orgs', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig());
    mockOrgFindMany.mockResolvedValue([]);

    const result = await runInterventions();

    expect(result.processed).toBe(0);
    expect(result.candidatesFound).toBe(0);
    expect(result.dispatched).toBe(0);
    expect(result.observed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('skips an org that has no health score yet', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig());
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    mockHealthScoreFindFirst.mockResolvedValue(null); // no scores
    mockHealthInterventionFindMany.mockResolvedValue([]);
    mockHealthScoreFindMany.mockResolvedValue([]);

    const result = await runInterventions();

    expect(result.candidatesFound).toBe(0);
    expect(result.dispatched).toBe(0);
  });

  it('skips an org with fewer than 2 weeks of history (no baseline)', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig());
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    mockHealthScoreFindFirst.mockResolvedValue({
      dimensions: makeScores('content_consistency', 60),
    });
    mockHealthInterventionFindMany.mockResolvedValue([]);
    // Only 1 week of history — baseline map will be empty
    mockHealthScoreFindMany.mockResolvedValue([
      { dimensions: makeScores('content_consistency', 80), weekStart: new Date() },
    ]);

    const result = await runInterventions();

    expect(result.candidatesFound).toBe(0);
  });

  // ── Threshold logic ─────────────────────────────────────────────────────────

  it('does not trigger when decline is below Tier 1 threshold', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig()); // tier1Threshold=10
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    // baseline ≈ 80, current = 75 → decline = 5 < 10
    mockHealthScoreFindFirst.mockResolvedValue({
      dimensions: makeScores('content_consistency', 75),
    });
    mockHealthInterventionFindMany.mockResolvedValue([]);
    mockHealthScoreFindMany.mockResolvedValue(makeHistory('content_consistency', 80));

    const result = await runInterventions();

    expect(result.candidatesFound).toBe(0);
    expect(mockHealthInterventionCreate).not.toHaveBeenCalled();
  });

  it('triggers Tier 1 when decline meets Tier 1 threshold (>= 10)', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig()); // tier1=10
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    // baseline ≈ 80, current = 68 → decline = 12 ≥ 10, < 20
    mockHealthScoreFindFirst.mockResolvedValue({
      dimensions: makeScores('content_consistency', 68),
    });
    mockHealthInterventionFindMany.mockResolvedValue([]);
    mockHealthScoreFindMany.mockResolvedValue(makeHistory('content_consistency', 80));

    const result = await runInterventions();

    expect(result.candidatesFound).toBeGreaterThanOrEqual(1);
    const createCall = mockHealthInterventionCreate.mock.calls[0][0].data;
    expect(createCall.interventionTier).toBe(1);
    expect(createCall.channel).toBe('in_app');
  });

  it('triggers Tier 2 when decline meets Tier 2 threshold (>= 20)', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig()); // tier2=20
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    // decline = 25 ≥ 20, < 30
    mockHealthScoreFindFirst.mockResolvedValue({
      dimensions: makeScores('content_consistency', 55),
    });
    mockHealthInterventionFindMany.mockResolvedValue([]);
    mockHealthScoreFindMany.mockResolvedValue(makeHistory('content_consistency', 80));

    const result = await runInterventions();

    const createCall = mockHealthInterventionCreate.mock.calls[0][0].data;
    expect(createCall.interventionTier).toBe(2);
    expect(createCall.channel).toBe('email');
    // value proof email should have been sent
    expect(mockSendValueProofEmail).toHaveBeenCalled();
  });

  it('triggers Tier 3 when decline meets Tier 3 threshold (>= 30)', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig()); // tier3=30
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    // decline = 35 ≥ 30
    mockHealthScoreFindFirst.mockResolvedValue({
      dimensions: makeScores('content_consistency', 45),
    });
    mockHealthInterventionFindMany.mockResolvedValue([]);
    mockHealthScoreFindMany.mockResolvedValue(makeHistory('content_consistency', 80));
    mockHealthScoreFindMany.mockResolvedValueOnce(makeHistory('content_consistency', 80));

    const result = await runInterventions();

    const createCall = mockHealthInterventionCreate.mock.calls[0][0].data;
    expect(createCall.interventionTier).toBe(3);
    expect(createCall.channel).toBe('founder_queue');
    expect(mockFounderOutreachCreate).toHaveBeenCalled();
  });

  it('does not trigger when current score equals baseline (no decline)', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig());
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    mockHealthScoreFindFirst.mockResolvedValue({
      dimensions: makeScores('content_consistency', 80),
    });
    mockHealthInterventionFindMany.mockResolvedValue([]);
    mockHealthScoreFindMany.mockResolvedValue(makeHistory('content_consistency', 80));

    const result = await runInterventions();

    expect(result.candidatesFound).toBe(0);
  });

  it('does not trigger when score has improved above baseline', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig());
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    // current 95 > baseline 80 → improvement, not decline
    mockHealthScoreFindFirst.mockResolvedValue({
      dimensions: makeScores('content_consistency', 95),
    });
    mockHealthInterventionFindMany.mockResolvedValue([]);
    mockHealthScoreFindMany.mockResolvedValue(makeHistory('content_consistency', 80));

    const result = await runInterventions();

    expect(result.candidatesFound).toBe(0);
    expect(mockHealthInterventionCreate).not.toHaveBeenCalled();
  });

  // ── Staged activation ───────────────────────────────────────────────────────

  it('logs in observation mode when tier activation date is in the future', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(
      makeConfig({ tier1ActiveFrom: FUTURE_DATE })
    );
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    mockHealthScoreFindFirst.mockResolvedValue({
      dimensions: makeScores('content_consistency', 68), // decline=12 → Tier 1
    });
    mockHealthInterventionFindMany.mockResolvedValue([]);
    mockHealthScoreFindMany.mockResolvedValue(makeHistory('content_consistency', 80));

    const result = await runInterventions();

    // Should be logged but counted as observed, not dispatched
    expect(result.observed).toBeGreaterThanOrEqual(1);
    expect(result.dispatched).toBe(0);

    const createCall = mockHealthInterventionCreate.mock.calls[0][0].data;
    expect(createCall.observationMode).toBe(true);
    expect(createCall.actuallySentAt).toBeNull();
  });

  it('dispatches live when tier activation date has passed', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(
      makeConfig({ tier1ActiveFrom: PAST_DATE })
    );
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    mockHealthScoreFindFirst.mockResolvedValue({
      dimensions: makeScores('content_consistency', 68), // decline=12 → Tier 1
    });
    mockHealthInterventionFindMany.mockResolvedValue([]);
    mockHealthScoreFindMany.mockResolvedValue(makeHistory('content_consistency', 80));

    const result = await runInterventions();

    expect(result.dispatched).toBeGreaterThanOrEqual(1);
    expect(result.observed).toBe(0);

    const createCall = mockHealthInterventionCreate.mock.calls[0][0].data;
    expect(createCall.observationMode).toBe(false);
    expect(createCall.actuallySentAt).not.toBeNull();
  });

  // ── Cooldown ────────────────────────────────────────────────────────────────

  it('skips a dimension that is within the 7-day cooldown window', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig());
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    mockHealthScoreFindFirst.mockResolvedValue({
      dimensions: makeScores('content_consistency', 68), // would trigger
    });
    // Return cooldown record for content_consistency
    mockHealthInterventionFindMany.mockResolvedValue([
      { dimension: 'content_consistency' },
    ]);
    mockHealthScoreFindMany.mockResolvedValue(makeHistory('content_consistency', 80));

    const result = await runInterventions();

    expect(result.candidatesFound).toBe(0);
    expect(mockHealthInterventionCreate).not.toHaveBeenCalled();
  });

  it('fires for a dimension not in cooldown even when another dimension is cooling down', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig());
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);

    // Both content_consistency and engagement_trajectory are in decline
    const dims = {
      content_consistency: { score: 68, description: 'ok' },    // decline=12
      engagement_trajectory: { score: 68, description: 'ok' },  // decline=12
      review_responsiveness: { score: 80, description: 'ok' },
      authority_momentum: { score: 80, description: 'ok' },
      advisor_engagement: { score: 80, description: 'ok' },
      platform_usage: { score: 80, description: 'ok' },
    };
    mockHealthScoreFindFirst.mockResolvedValue({ dimensions: dims });

    // content_consistency is cooling down, engagement_trajectory is not
    mockHealthInterventionFindMany.mockResolvedValue([
      { dimension: 'content_consistency' },
    ]);

    const baseHistory = [
      { dimensions: { ...dims, content_consistency: { score: 80, description: 'baseline' }, engagement_trajectory: { score: 80, description: 'baseline' } }, weekStart: new Date() },
      { dimensions: { ...dims, content_consistency: { score: 80, description: 'baseline' }, engagement_trajectory: { score: 80, description: 'baseline' } }, weekStart: new Date() },
      { dimensions: { ...dims, content_consistency: { score: 80, description: 'baseline' }, engagement_trajectory: { score: 80, description: 'baseline' } }, weekStart: new Date() },
      { dimensions: { ...dims, content_consistency: { score: 80, description: 'baseline' }, engagement_trajectory: { score: 80, description: 'baseline' } }, weekStart: new Date() },
      { dimensions: { ...dims, content_consistency: { score: 80, description: 'baseline' }, engagement_trajectory: { score: 80, description: 'baseline' } }, weekStart: new Date() },
    ];
    mockHealthScoreFindMany.mockResolvedValue(baseHistory);

    const result = await runInterventions();

    // Only engagement_trajectory should fire — content_consistency is cooling down
    expect(result.candidatesFound).toBe(1);
    const createCall = mockHealthInterventionCreate.mock.calls[0][0].data;
    expect(createCall.dimension).toBe('engagement_trajectory');
  });

  // ── Error isolation ─────────────────────────────────────────────────────────

  it('captures per-org errors without stopping other orgs from processing', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig());
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }, { id: 'org_2' }]);

    // org_1 throws, org_2 succeeds with no candidates
    mockHealthScoreFindFirst
      .mockRejectedValueOnce(new Error('DB timeout'))  // org_1
      .mockResolvedValueOnce(null);                     // org_2 → no score → 0 candidates
    mockHealthInterventionFindMany.mockResolvedValue([]);
    mockHealthScoreFindMany.mockResolvedValue([]);

    const result = await runInterventions();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].organizationId).toBe('org_1');
    expect(result.errors[0].error).toContain('DB timeout');
    expect(result.processed).toBe(1); // org_2 succeeded
  });

  // ── Intervention log fields ─────────────────────────────────────────────────

  it('logs the correct fields to health_interventions on dispatch', async () => {
    mockInterventionConfigFindMany.mockResolvedValue(makeConfig());
    mockOrgFindMany.mockResolvedValue([{ id: 'org_1' }]);
    mockHealthScoreFindFirst.mockResolvedValue({
      dimensions: makeScores('content_consistency', 68), // decline=12 → Tier 1
    });
    mockHealthInterventionFindMany.mockResolvedValue([]);
    mockHealthScoreFindMany.mockResolvedValue(makeHistory('content_consistency', 80));

    await runInterventions();

    expect(mockHealthInterventionCreate).toHaveBeenCalledTimes(1);
    const data = mockHealthInterventionCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org_1',
      dimension: 'content_consistency',
      interventionTier: 1,
      channel: 'in_app',
      observationMode: false,
    });
    expect(data.declineMagnitude).toBeLessThan(0); // stored as negative
    expect(data.currentScore).toBe(68);
    expect(data.wouldHaveSentAt).toBeInstanceOf(Date);
    expect(data.actuallySentAt).toBeInstanceOf(Date);
  });
});
