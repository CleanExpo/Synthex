/**
 * Unit tests for lib/bing-places/
 *
 * Mirrors the SYN-837 GBP test plan exactly so the two stay aligned.
 *
 * @see SYN-841 (parent: SYN-834 epic)
 */

import { describe, it, expect, jest } from '@jest/globals';
import { updateBingServiceArea } from '@/lib/bing-places';
import type {
  BingLocality,
  BingPlacesApiClient,
  BingPlacesAuditEntry,
  BingPlacesAuditSink,
  UpdateBingServiceAreaInput,
} from '@/lib/bing-places/types';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function makeFakeClient(initial: BingLocality[] = []): BingPlacesApiClient & {
  _puts: BingLocality[][];
  _localities: BingLocality[];
} {
  const localities: BingLocality[] = [...initial];
  const puts: BingLocality[][] = [];
  return {
    _puts: puts,
    _localities: localities,
    async getServiceArea(storeId: string) {
      return {
        storeId,
        readAt: new Date().toISOString(),
        localities: [...localities],
      };
    },
    async putServiceArea(_storeId: string, next: BingLocality[]) {
      puts.push([...next]);
      localities.length = 0;
      localities.push(...next);
      return { status: 200 };
    },
  };
}

function makeAuditCapture(): BingPlacesAuditSink & {
  _entries: BingPlacesAuditEntry[];
} {
  const entries: BingPlacesAuditEntry[] = [];
  const sink: BingPlacesAuditSink = async entry => {
    entries.push(entry);
  };
  (
    sink as BingPlacesAuditSink & { _entries: BingPlacesAuditEntry[] }
  )._entries = entries;
  return sink as BingPlacesAuditSink & { _entries: BingPlacesAuditEntry[] };
}

function inputFor(
  overrides: Partial<UpdateBingServiceAreaInput> = {}
): UpdateBingServiceAreaInput {
  return {
    storeId: 'store_dr_001',
    sourceOfTruthJobId: 'job_abc',
    contractorId: 'contractor_xyz',
    consentGranted: true,
    newLocalities: [{ name: 'Carindale' }, { name: 'Mansfield' }],
    ...overrides,
  };
}

describe('updateBingServiceArea — validation', () => {
  it('throws on missing storeId', async () => {
    await expect(
      updateBingServiceArea(inputFor({ storeId: '' }), {
        client: makeFakeClient(),
      })
    ).rejects.toThrow(/storeId required/);
  });

  it('throws on missing sourceOfTruthJobId (Q3.2.4 H8)', async () => {
    await expect(
      updateBingServiceArea(inputFor({ sourceOfTruthJobId: '' }), {
        client: makeFakeClient(),
      })
    ).rejects.toThrow(/sourceOfTruthJobId required/);
  });

  it('throws on missing contractorId', async () => {
    await expect(
      updateBingServiceArea(inputFor({ contractorId: '' }), {
        client: makeFakeClient(),
      })
    ).rejects.toThrow(/contractorId required/);
  });

  it('throws when consentGranted is false', async () => {
    await expect(
      updateBingServiceArea(inputFor({ consentGranted: false }), {
        client: makeFakeClient(),
      })
    ).rejects.toThrow(/consentGranted must be true/);
  });

  it('throws on non-array newLocalities', async () => {
    await expect(
      updateBingServiceArea(
        // @ts-expect-error — deliberately invalid
        inputFor({ newLocalities: null }),
        { client: makeFakeClient() }
      )
    ).rejects.toThrow(/newLocalities must be an array/);
  });

  it('throws on a locality with empty name', async () => {
    await expect(
      updateBingServiceArea(inputFor({ newLocalities: [{ name: '' }] }), {
        client: makeFakeClient(),
      })
    ).rejects.toThrow(/non-empty name/);
  });
});

describe('updateBingServiceArea — happy path', () => {
  it('PUTs union(current, additions) when adding new localities', async () => {
    const client = makeFakeClient([{ name: 'Carindale' }]);
    const audit = makeAuditCapture();
    const result = await updateBingServiceArea(
      inputFor({
        newLocalities: [{ name: 'Carindale' }, { name: 'Mansfield' }],
      }),
      { client, audit }
    );

    expect(result.synced).toBe(true);
    expect(result.added.map(l => l.name)).toEqual(['Mansfield']);
    expect(result.skipped.map(l => l.name)).toEqual(['Carindale']);
    expect(client._puts).toHaveLength(1);
    expect(client._puts[0].map(l => l.name).sort()).toEqual([
      'Carindale',
      'Mansfield',
    ]);
    expect(audit._entries).toHaveLength(1);
    expect(audit._entries[0].localitiesAdded).toHaveLength(1);
    expect(audit._entries[0].syncedAt).not.toBeNull();
  });

  it('dedupes case-insensitively against current coverage', async () => {
    const client = makeFakeClient([{ name: 'CARINDALE' }]);
    const result = await updateBingServiceArea(
      inputFor({ newLocalities: [{ name: 'carindale' }] }),
      { client }
    );
    expect(result.synced).toBe(false);
    expect(result.skipped).toHaveLength(1);
    expect(client._puts).toHaveLength(0);
  });
});

describe('updateBingServiceArea — idempotency', () => {
  it('replaying the same event triggers ZERO PUTs the second time', async () => {
    const client = makeFakeClient();
    const audit = makeAuditCapture();
    const input = inputFor();

    const first = await updateBingServiceArea(input, { client, audit });
    expect(first.synced).toBe(true);
    expect(client._puts).toHaveLength(1);

    const second = await updateBingServiceArea(input, { client, audit });
    expect(second.synced).toBe(false);
    expect(second.added).toEqual([]);
    expect(client._puts).toHaveLength(1); // unchanged
    expect(audit._entries).toHaveLength(2);
    expect(audit._entries[1].syncedAt).toBeNull();
    expect(audit._entries[1].reason).toMatch(/idempotent re-play/);
  });
});

describe('updateBingServiceArea — distance sanity filter', () => {
  it('drops localities > maxDistanceKm (default 100)', async () => {
    const client = makeFakeClient();
    const result = await updateBingServiceArea(
      inputFor({
        newLocalities: [{ name: 'Brisbane CBD' }, { name: 'Cairns' }],
        contractorBaseDistanceKmByLocality: {
          'Brisbane CBD': 5,
          Cairns: 1450,
        },
      }),
      { client }
    );
    expect(result.synced).toBe(true);
    expect(result.added.map(l => l.name)).toEqual(['Brisbane CBD']);
    expect(result.droppedFarFromBase.map(l => l.name)).toEqual(['Cairns']);
  });

  it('honours opts.maxDistanceKm override', async () => {
    const client = makeFakeClient();
    const result = await updateBingServiceArea(
      inputFor({
        newLocalities: [{ name: 'Mount Cotton' }],
        contractorBaseDistanceKmByLocality: { 'Mount Cotton': 30 },
      }),
      { client, maxDistanceKm: 20 }
    );
    expect(result.synced).toBe(false);
    expect(result.reason).toMatch(/exceeded 20km/);
  });

  it('returns no-op when ALL localities dropped', async () => {
    const client = makeFakeClient();
    const result = await updateBingServiceArea(
      inputFor({
        newLocalities: [{ name: 'Cairns' }],
        contractorBaseDistanceKmByLocality: { Cairns: 1450 },
      }),
      { client }
    );
    expect(result.synced).toBe(false);
    expect(client._puts).toHaveLength(0);
    expect(result.reason).toMatch(/exceeded 100km/);
  });
});

describe('updateBingServiceArea — audit sink resilience', () => {
  it('PUT still succeeds when audit sink throws', async () => {
    const client = makeFakeClient();
    const flakyAudit: BingPlacesAuditSink = async () => {
      throw new Error('audit pipe down');
    };
    const result = await updateBingServiceArea(inputFor(), {
      client,
      audit: flakyAudit,
    });
    expect(result.synced).toBe(true);
    expect(client._puts).toHaveLength(1);
  });
});
