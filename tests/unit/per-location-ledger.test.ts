/**
 * Unit tests for lib/budget/
 *
 * Covers:
 *  - Validation: required fields throw before any DB call
 *  - Idempotency: re-commit on same coverage ID returns existing entry
 *  - Monthly cap: refuses when exceeded, allows when room
 *  - Per-contractor cap: refuses when exceeded, allows when room
 *  - canCommitMonthlyBudget + canCommitForContractor read-only checks
 *  - Pause / resume transitions
 *  - Reporting: utilisation, count, contractor list
 *  - Env-vs-opts cap resolution precedence
 *
 * @see SYN-839 (parent: SYN-834 epic)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  MONTHLY_AMOUNT_AUD_DEFAULT,
  canCommitMonthlyBudget,
  canCommitForContractor,
  commitLocation,
  pauseLocation,
  resumeLocation,
  getMonthlyBudgetUtilisation,
  getActiveLocationCount,
  getLedgerForContractor,
} from '@/lib/budget';
import type {
  BudgetLedgerRepository,
  CommitLocationInput,
  LedgerEntry,
} from '@/lib/budget/types';

// Capture log calls (we don't assert on them but want to suppress noise)
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// In-memory repository for tests
function makeMockRepo(): BudgetLedgerRepository & {
  _entries: LedgerEntry[];
  _nextId: number;
} {
  const entries: LedgerEntry[] = [];
  let nextId = 1;
  return {
    _entries: entries,
    _nextId: 0, // unused, just for visibility
    async insert(input) {
      const entry: LedgerEntry = {
        id: `ledger_${nextId++}`,
        serviceAreaCoverageId: input.serviceAreaCoverageId,
        sourceOfTruthJobId: input.sourceOfTruthJobId,
        contractorId: input.contractorId,
        postcode: input.postcode,
        suburb: input.suburb,
        monthlyAmountAud: input.monthlyAmountAud,
        openedAt: new Date().toISOString(),
        pausedAt: null,
        pausedReason: null,
        closedAt: null,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      entries.push(entry);
      return entry;
    },
    async findActiveByCoverage(coverageId) {
      return (
        entries.find(
          e => e.serviceAreaCoverageId === coverageId && e.status === 'active'
        ) ?? null
      );
    },
    async sumActiveMonthlyAud() {
      return entries
        .filter(e => e.status === 'active')
        .reduce((sum, e) => sum + e.monthlyAmountAud, 0);
    },
    async countActive() {
      return entries.filter(e => e.status === 'active').length;
    },
    async sumActiveMonthlyAudForContractor(contractorId) {
      return entries
        .filter(e => e.status === 'active' && e.contractorId === contractorId)
        .reduce((sum, e) => sum + e.monthlyAmountAud, 0);
    },
    async findByContractor(contractorId) {
      return entries
        .filter(e => e.contractorId === contractorId)
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    },
    async pause(coverageId, reason) {
      const entry = entries.find(
        e => e.serviceAreaCoverageId === coverageId && e.status === 'active'
      );
      if (!entry) return null;
      entry.status = 'paused';
      entry.pausedAt = new Date().toISOString();
      entry.pausedReason = reason;
      return entry;
    },
    async resume(coverageId) {
      const entry = entries.find(
        e => e.serviceAreaCoverageId === coverageId && e.status === 'paused'
      );
      if (!entry) return null;
      entry.status = 'active';
      entry.pausedAt = null;
      entry.pausedReason = null;
      return entry;
    },
  };
}

const VALID_INPUT: CommitLocationInput = {
  serviceAreaCoverageId: 'coverage_001',
  sourceOfTruthJobId: 'nrpg_onboarding_job_001',
  contractorId: 'contractor_a',
  postcode: '4000',
  suburb: 'Brisbane City',
};

beforeEach(() => {
  delete process.env.NRPG_LOCATION_BUDGET_CAP_AUD;
  delete process.env.NRPG_PER_CONTRACTOR_BUDGET_CAP_AUD;
});

// ═══════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

describe('MONTHLY_AMOUNT_AUD_DEFAULT', () => {
  it('is $55 per CEO direction 2026-04-29', () => {
    expect(MONTHLY_AMOUNT_AUD_DEFAULT).toBe(55);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('commitLocation — validation', () => {
  it('throws on missing input', async () => {
    await expect(
      // @ts-expect-error testing runtime guard
      commitLocation(null, { repository: makeMockRepo() })
    ).rejects.toThrow(/input required/);
  });

  it('throws on missing serviceAreaCoverageId', async () => {
    await expect(
      commitLocation(
        { ...VALID_INPUT, serviceAreaCoverageId: '' },
        { repository: makeMockRepo() }
      )
    ).rejects.toThrow(/serviceAreaCoverageId required/);
  });

  it('throws on missing sourceOfTruthJobId (Q3.2.4 H8)', async () => {
    await expect(
      commitLocation(
        { ...VALID_INPUT, sourceOfTruthJobId: '' },
        { repository: makeMockRepo() }
      )
    ).rejects.toThrow(/sourceOfTruthJobId required/);
  });

  it('throws on missing contractorId', async () => {
    await expect(
      commitLocation(
        { ...VALID_INPUT, contractorId: '' },
        { repository: makeMockRepo() }
      )
    ).rejects.toThrow(/contractorId required/);
  });

  it('throws on missing suburb/postcode', async () => {
    await expect(
      commitLocation(
        { ...VALID_INPUT, suburb: '' },
        { repository: makeMockRepo() }
      )
    ).rejects.toThrow(/suburb \+ postcode required/);
  });

  it('throws on monthlyAmountAud <= 0', async () => {
    await expect(
      commitLocation(
        { ...VALID_INPUT, monthlyAmountAud: 0 },
        { repository: makeMockRepo() }
      )
    ).rejects.toThrow(/monthlyAmountAud/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  COMMIT — HAPPY PATH + IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════════════

describe('commitLocation — happy path', () => {
  it('commits a new entry with default $55', async () => {
    const repo = makeMockRepo();
    const result = await commitLocation(VALID_INPUT, { repository: repo });
    expect(result.committed).toBe(true);
    expect(result.inserted).toBe(true);
    expect(result.entry?.monthlyAmountAud).toBe(55);
    expect(result.entry?.status).toBe('active');
    expect(repo._entries).toHaveLength(1);
  });

  it('respects monthlyAmountAud override', async () => {
    const repo = makeMockRepo();
    const result = await commitLocation(
      { ...VALID_INPUT, monthlyAmountAud: 75 },
      { repository: repo }
    );
    expect(result.entry?.monthlyAmountAud).toBe(75);
  });

  it('idempotent on same serviceAreaCoverageId — returns existing without double-charge', async () => {
    const repo = makeMockRepo();
    const a = await commitLocation(VALID_INPUT, { repository: repo });
    const b = await commitLocation(VALID_INPUT, { repository: repo });
    expect(a.inserted).toBe(true);
    expect(b.inserted).toBe(false);
    expect(b.committed).toBe(true);
    expect(repo._entries).toHaveLength(1);
    // Cap utilisation should not double
    const util = await getMonthlyBudgetUtilisation({ repository: repo });
    expect(util.totalCommittedAud).toBe(55);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  CAP ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════

describe('commitLocation — monthly cap', () => {
  it('refuses when monthly cap would be exceeded', async () => {
    const repo = makeMockRepo();
    // Pre-fill close to cap
    for (let i = 0; i < 18; i++) {
      await commitLocation(
        {
          ...VALID_INPUT,
          serviceAreaCoverageId: `coverage_pre_${i}`,
        },
        { repository: repo, monthlyCapAud: 1000 }
      );
    } // 18 × $55 = $990 committed
    const result = await commitLocation(
      { ...VALID_INPUT, serviceAreaCoverageId: 'coverage_overflow' },
      { repository: repo, monthlyCapAud: 1000 }
    );
    expect(result.committed).toBe(false);
    expect(result.reason).toMatch(/monthly cap exceeded/);
    expect(result.remainingMonthlyAud).toBeLessThan(55);
  });

  it('allows commits up to the cap', async () => {
    const repo = makeMockRepo();
    // Allow a single $55 commit with a $100 cap
    const result = await commitLocation(VALID_INPUT, {
      repository: repo,
      monthlyCapAud: 100,
    });
    expect(result.committed).toBe(true);
    expect(result.remainingMonthlyAud).toBe(45);
  });

  it('reads cap from NRPG_LOCATION_BUDGET_CAP_AUD env', async () => {
    process.env.NRPG_LOCATION_BUDGET_CAP_AUD = '50'; // < $55 default
    const repo = makeMockRepo();
    const result = await commitLocation(VALID_INPUT, { repository: repo });
    expect(result.committed).toBe(false);
    expect(result.reason).toMatch(/monthly cap exceeded/);
  });

  it('opts.monthlyCapAud overrides env', async () => {
    process.env.NRPG_LOCATION_BUDGET_CAP_AUD = '50';
    const repo = makeMockRepo();
    const result = await commitLocation(VALID_INPUT, {
      repository: repo,
      monthlyCapAud: 1000,
    });
    expect(result.committed).toBe(true);
  });
});

describe('commitLocation — per-contractor cap', () => {
  it('refuses when per-contractor cap would be exceeded', async () => {
    const repo = makeMockRepo();
    // Pre-fill contractor_a with $200 worth of locations (4 × $55 = $220 > $200 cap)
    for (let i = 0; i < 4; i++) {
      await commitLocation(
        {
          ...VALID_INPUT,
          serviceAreaCoverageId: `coverage_a_${i}`,
        },
        { repository: repo, perContractorCapAud: 220 }
      );
    } // contractor_a now at $220
    const result = await commitLocation(
      { ...VALID_INPUT, serviceAreaCoverageId: 'coverage_a_overflow' },
      { repository: repo, perContractorCapAud: 220 }
    );
    expect(result.committed).toBe(false);
    expect(result.reason).toMatch(/per-contractor cap exceeded/);
  });

  it('allows other contractors when one hits cap', async () => {
    const repo = makeMockRepo();
    // contractor_a fills cap
    for (let i = 0; i < 2; i++) {
      await commitLocation(
        {
          ...VALID_INPUT,
          serviceAreaCoverageId: `coverage_a_${i}`,
          contractorId: 'contractor_a',
        },
        { repository: repo, perContractorCapAud: 110 }
      );
    }
    // contractor_b should still be able to commit
    const result = await commitLocation(
      {
        ...VALID_INPUT,
        serviceAreaCoverageId: 'coverage_b_1',
        contractorId: 'contractor_b',
      },
      { repository: repo, perContractorCapAud: 110 }
    );
    expect(result.committed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  HEADROOM CHECKS (read-only)
// ═══════════════════════════════════════════════════════════════════════════

describe('canCommitMonthlyBudget', () => {
  it('returns ok=true with remaining headroom', async () => {
    const repo = makeMockRepo();
    const r = await canCommitMonthlyBudget(55, {
      repository: repo,
      monthlyCapAud: 1000,
    });
    expect(r.ok).toBe(true);
    expect(r.remainingAud).toBe(1000);
  });

  it('returns ok=false when amount exceeds remaining', async () => {
    const repo = makeMockRepo();
    await commitLocation(VALID_INPUT, { repository: repo, monthlyCapAud: 100 });
    const r = await canCommitMonthlyBudget(55, {
      repository: repo,
      monthlyCapAud: 100,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/monthly cap exceeded/);
  });

  it('rejects amountAud <= 0', async () => {
    const repo = makeMockRepo();
    const r = await canCommitMonthlyBudget(0, { repository: repo });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/amountAud must be > 0/);
  });
});

describe('canCommitForContractor', () => {
  it('returns ok=true with per-contractor headroom', async () => {
    const repo = makeMockRepo();
    const r = await canCommitForContractor('contractor_a', 55, {
      repository: repo,
      perContractorCapAud: 1000,
    });
    expect(r.ok).toBe(true);
    expect(r.remainingAud).toBe(1000);
  });

  it('returns ok=false when contractor cap exceeded', async () => {
    const repo = makeMockRepo();
    await commitLocation(VALID_INPUT, {
      repository: repo,
      perContractorCapAud: 60,
    });
    const r = await canCommitForContractor('contractor_a', 55, {
      repository: repo,
      perContractorCapAud: 60,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/per-contractor cap exceeded/);
  });

  it('rejects empty contractorId', async () => {
    const repo = makeMockRepo();
    const r = await canCommitForContractor('', 55, { repository: repo });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/contractorId required/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  PAUSE / RESUME
// ═══════════════════════════════════════════════════════════════════════════

describe('pauseLocation + resumeLocation', () => {
  it('pause moves entry to paused status + frees cap', async () => {
    const repo = makeMockRepo();
    await commitLocation(VALID_INPUT, { repository: repo });
    const utilBefore = await getMonthlyBudgetUtilisation({ repository: repo });
    expect(utilBefore.totalCommittedAud).toBe(55);

    const paused = await pauseLocation(
      VALID_INPUT.serviceAreaCoverageId,
      'test reason',
      { repository: repo }
    );
    expect(paused?.status).toBe('paused');
    expect(paused?.pausedReason).toBe('test reason');

    const utilAfter = await getMonthlyBudgetUtilisation({ repository: repo });
    expect(utilAfter.totalCommittedAud).toBe(0);
  });

  it('pause returns null if no active entry exists', async () => {
    const repo = makeMockRepo();
    const result = await pauseLocation('nonexistent_coverage', 'reason', {
      repository: repo,
    });
    expect(result).toBeNull();
  });

  it('pause throws on empty inputs', async () => {
    const repo = makeMockRepo();
    await expect(
      pauseLocation('', 'reason', { repository: repo })
    ).rejects.toThrow(/serviceAreaCoverageId required/);
    await expect(
      pauseLocation('coverage_001', '', { repository: repo })
    ).rejects.toThrow(/reason required/);
  });

  it('resume reverts paused entry to active', async () => {
    const repo = makeMockRepo();
    await commitLocation(VALID_INPUT, { repository: repo });
    await pauseLocation(VALID_INPUT.serviceAreaCoverageId, 'reason', {
      repository: repo,
    });
    const resumed = await resumeLocation(VALID_INPUT.serviceAreaCoverageId, {
      repository: repo,
    });
    expect(resumed?.status).toBe('active');
    expect(resumed?.pausedAt).toBeNull();

    const util = await getMonthlyBudgetUtilisation({ repository: repo });
    expect(util.totalCommittedAud).toBe(55);
  });

  it('resume returns null if no paused entry exists', async () => {
    const repo = makeMockRepo();
    const result = await resumeLocation('nonexistent_coverage', {
      repository: repo,
    });
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  REPORTING
// ═══════════════════════════════════════════════════════════════════════════

describe('getMonthlyBudgetUtilisation', () => {
  it('reports 0 utilisation when no entries', async () => {
    const repo = makeMockRepo();
    const util = await getMonthlyBudgetUtilisation({
      repository: repo,
      monthlyCapAud: 1000,
    });
    expect(util.totalCommittedAud).toBe(0);
    expect(util.utilisationPct).toBe(0);
    expect(util.activeLocationCount).toBe(0);
    expect(util.capAud).toBe(1000);
  });

  it('reports utilisation pct correctly', async () => {
    const repo = makeMockRepo();
    for (let i = 0; i < 4; i++) {
      await commitLocation(
        { ...VALID_INPUT, serviceAreaCoverageId: `c_${i}` },
        { repository: repo, monthlyCapAud: 1000 }
      );
    } // 4 × $55 = $220 / $1000 = 22%
    const util = await getMonthlyBudgetUtilisation({
      repository: repo,
      monthlyCapAud: 1000,
    });
    expect(util.totalCommittedAud).toBe(220);
    expect(util.utilisationPct).toBe(22);
    expect(util.activeLocationCount).toBe(4);
  });

  it('paused entries do not count toward utilisation', async () => {
    const repo = makeMockRepo();
    await commitLocation(
      { ...VALID_INPUT, serviceAreaCoverageId: 'c_1' },
      { repository: repo, monthlyCapAud: 1000 }
    );
    await commitLocation(
      { ...VALID_INPUT, serviceAreaCoverageId: 'c_2' },
      { repository: repo, monthlyCapAud: 1000 }
    );
    await pauseLocation('c_1', 'test', { repository: repo });
    const util = await getMonthlyBudgetUtilisation({
      repository: repo,
      monthlyCapAud: 1000,
    });
    expect(util.totalCommittedAud).toBe(55); // only c_2 is active
    expect(util.activeLocationCount).toBe(1);
  });
});

describe('getActiveLocationCount + getLedgerForContractor', () => {
  it('counts active locations only', async () => {
    const repo = makeMockRepo();
    await commitLocation(
      { ...VALID_INPUT, serviceAreaCoverageId: 'c_1' },
      { repository: repo }
    );
    await commitLocation(
      { ...VALID_INPUT, serviceAreaCoverageId: 'c_2' },
      { repository: repo }
    );
    await pauseLocation('c_1', 'reason', { repository: repo });
    expect(await getActiveLocationCount({ repository: repo })).toBe(1);
  });

  it('lists all entries for a contractor newest-first', async () => {
    const repo = makeMockRepo();
    await commitLocation(
      {
        ...VALID_INPUT,
        serviceAreaCoverageId: 'c_a1',
        contractorId: 'contractor_a',
      },
      { repository: repo }
    );
    // wait a tick to ensure different openedAt
    await new Promise(r => setTimeout(r, 5));
    await commitLocation(
      {
        ...VALID_INPUT,
        serviceAreaCoverageId: 'c_a2',
        contractorId: 'contractor_a',
      },
      { repository: repo }
    );
    await commitLocation(
      {
        ...VALID_INPUT,
        serviceAreaCoverageId: 'c_b1',
        contractorId: 'contractor_b',
      },
      { repository: repo }
    );
    const entries = await getLedgerForContractor('contractor_a', {
      repository: repo,
    });
    expect(entries).toHaveLength(2);
    expect(entries[0].serviceAreaCoverageId).toBe('c_a2'); // newest
  });

  it('throws on empty contractorId', async () => {
    const repo = makeMockRepo();
    await expect(
      getLedgerForContractor('', { repository: repo })
    ).rejects.toThrow(/contractorId required/);
  });
});
