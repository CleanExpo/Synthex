/**
 * BUDGET-ENFORCER — an ENFORCED org budget during a Redis outage.
 *
 * The in-flight counters are what stop concurrent reservations from jointly
 * breaching a ceiling, and they only do that when they are SHARED. During an
 * outage the redis-client wrapper falls back to a per-instance memory cache,
 * so two app instances each see only their own reservations. Reviewer repro:
 * daily ceiling $1, no committed spend, two instances each reserving $0.75 —
 * both passed the check and $1.50 was spent.
 *
 * The fake below models that precisely: each "instance" has its own memory
 * map (what the real wrapper falls back to), plus one shared store that is
 * only reachable while Redis is up.
 */

const mockPolicyFindUnique = jest.fn();
const mockLedgerAggregate = jest.fn();

jest.mock('@/lib/prisma', () => {
  const client = {
    orgBudgetPolicy: {
      findUnique: (...a: unknown[]) => mockPolicyFindUnique(...a),
    },
    pipelineCostLedger: {
      aggregate: (...a: unknown[]) => mockLedgerAggregate(...a),
    },
  };
  return { __esModule: true, prisma: client, default: client };
});

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const shared = new Map<string, number>();
const perInstance: Record<string, Map<string, number>> = {
  A: new Map(),
  B: new Map(),
};
let instance: 'A' | 'B' = 'A';
/** Keys whose shared write fails; '*' fails every key (full outage). */
const unreachable = new Set<string>();
const isDown = (key: string) => unreachable.has('*') || unreachable.has(key);
const bump = (m: Map<string, number>, key: string, n: number) => {
  m.set(key, (m.get(key) ?? 0) + n);
  return m.get(key) as number;
};

jest.mock('@/lib/redis-client', () => {
  const client = {
    // The real wrapper's behaviour: shared when reachable, else memory.
    async get(key: string) {
      const m = isDown(key) ? perInstance[instance] : shared;
      return m.has(key) ? String(m.get(key)) : null;
    },
    async incrby(key: string, n: number) {
      return bump(isDown(key) ? perInstance[instance] : shared, key, n);
    },
    async incrbyShared(key: string, n: number) {
      if (isDown(key)) {
        return { total: bump(perInstance[instance], key, n), shared: false };
      }
      return { total: bump(shared, key, n), shared: true };
    },
    async decrby(key: string, n: number) {
      return bump(isDown(key) ? perInstance[instance] : shared, key, -n);
    },
    async expire() {
      return true;
    },
  };
  return { __esModule: true, getRedisClient: () => client };
});

import {
  OrgBudgetExceededError,
  OrgBudgetUnavailableError,
  reserveBudget,
} from '@/lib/ai/budget-enforcer';

const ORG = 'org-redis-outage';
const CTX = { organizationId: ORG, traceId: 't', userId: 'u' };

function policy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pol-1',
    organizationId: ORG,
    dailyCeilingUsd: 1,
    monthlyCeilingUsd: null,
    enforcementMode: 'enforce',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Reserve $0.75 on one instance; true when it was admitted. */
async function reserveOn(which: 'A' | 'B'): Promise<boolean | Error> {
  instance = which;
  try {
    return (await reserveBudget(CTX, 0.75)) !== null;
  } catch (error) {
    return error as Error;
  }
}

beforeEach(() => {
  shared.clear();
  perInstance.A.clear();
  perInstance.B.clear();
  unreachable.clear();
  instance = 'A';
  mockLedgerAggregate.mockResolvedValue({ _sum: { costUsd: 0 } });
  mockPolicyFindUnique.mockResolvedValue(policy());
});

describe('enforced org budget during a Redis outage', () => {
  it('two instances cannot both admit $0.75 against a $1 ceiling', async () => {
    unreachable.add('*');

    const a = await reserveOn('A');
    const b = await reserveOn('B');

    // Neither may proceed on a counter only it can see.
    expect(a).toBeInstanceOf(OrgBudgetUnavailableError);
    expect(b).toBeInstanceOf(OrgBudgetUnavailableError);
    expect((a as Error).message).toContain('budget_counter_unavailable');
  });

  it('control: with Redis healthy one instance admits and the second is refused for the ceiling', async () => {
    expect(await reserveOn('A')).toBe(true);
    expect(await reserveOn('B')).toBeInstanceOf(OrgBudgetExceededError);
  });

  it('control: a log_only policy still admits during the outage (observability only)', async () => {
    mockPolicyFindUnique.mockResolvedValue(
      policy({ enforcementMode: 'log_only' })
    );
    unreachable.add('*');

    expect(await reserveOn('A')).toBe(true);
    expect(await reserveOn('B')).toBe(true);
  });

  it('a partial outage rolls back only the increment that landed in the shared store', async () => {
    mockPolicyFindUnique.mockResolvedValue(policy({ monthlyCeilingUsd: 100 }));
    // Daily counter reachable, monthly not.
    const monthlyKeyDown = (key: string) => key.includes(':m:');
    const originalHas = unreachable.has.bind(unreachable);
    jest
      .spyOn(unreachable, 'has')
      .mockImplementation(k => originalHas(k) || monthlyKeyDown(k));

    expect(await reserveOn('A')).toBeInstanceOf(OrgBudgetUnavailableError);

    // The shared daily counter must not keep a phantom reservation.
    for (const [key, value] of shared) {
      expect({ key, value }).toEqual({ key, value: 0 });
    }
    expect(shared.size).toBeGreaterThan(0);
  });
});
