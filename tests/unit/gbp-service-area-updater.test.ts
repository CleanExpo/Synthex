/**
 * Unit tests for lib/gbp/
 *
 * Covers:
 *  - Validation: locationId, sourceOfTruthJobId, contractorId,
 *    consentGranted, newPlaces shape
 *  - Distance sanity filter (default 100km, configurable)
 *  - Diff: dedupe against current GBP coverage (case-insensitive)
 *  - Idempotency: re-playing same event = no PATCH
 *  - Audit sink called for both PATCH and no-op paths
 *  - Audit-sink failure does not break the PATCH
 *
 * @see SYN-837 (parent: SYN-834 epic)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { updateGbpServiceArea } from '@/lib/gbp';
import type {
  GbpApiClient,
  GbpAuditEntry,
  GbpAuditSink,
  GbpPlace,
  UpdateGbpServiceAreaInput,
} from '@/lib/gbp/types';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function makeFakeClient(initial: GbpPlace[] = []): GbpApiClient & {
  _patches: GbpPlace[][];
  _places: GbpPlace[];
} {
  const places: GbpPlace[] = [...initial];
  const patches: GbpPlace[][] = [];
  return {
    _patches: patches,
    _places: places,
    async getServiceArea(locationId: string) {
      return {
        locationId,
        readAt: new Date().toISOString(),
        places: [...places],
      };
    },
    async patchServiceArea(_locationId: string, next: GbpPlace[]) {
      patches.push([...next]);
      places.length = 0;
      places.push(...next);
      return { status: 200 };
    },
  };
}

function makeAuditCapture(): GbpAuditSink & { _entries: GbpAuditEntry[] } {
  const entries: GbpAuditEntry[] = [];
  const sink: GbpAuditSink = async entry => {
    entries.push(entry);
  };
  (sink as GbpAuditSink & { _entries: GbpAuditEntry[] })._entries = entries;
  return sink as GbpAuditSink & { _entries: GbpAuditEntry[] };
}

function inputFor(
  overrides: Partial<UpdateGbpServiceAreaInput> = {}
): UpdateGbpServiceAreaInput {
  return {
    locationId: 'locations/1234',
    sourceOfTruthJobId: 'job_abc',
    contractorId: 'contractor_xyz',
    consentGranted: true,
    newPlaces: [{ placeName: 'Carindale' }, { placeName: 'Mansfield' }],
    ...overrides,
  };
}

describe('updateGbpServiceArea — validation', () => {
  it('throws on missing locationId', async () => {
    await expect(
      updateGbpServiceArea(inputFor({ locationId: '' }), {
        client: makeFakeClient(),
      })
    ).rejects.toThrow(/locationId required/);
  });

  it('throws on missing sourceOfTruthJobId (Q3.2.4 H8)', async () => {
    await expect(
      updateGbpServiceArea(inputFor({ sourceOfTruthJobId: '' }), {
        client: makeFakeClient(),
      })
    ).rejects.toThrow(/sourceOfTruthJobId required/);
  });

  it('throws on missing contractorId', async () => {
    await expect(
      updateGbpServiceArea(inputFor({ contractorId: '' }), {
        client: makeFakeClient(),
      })
    ).rejects.toThrow(/contractorId required/);
  });

  it('throws when consentGranted is false', async () => {
    await expect(
      updateGbpServiceArea(inputFor({ consentGranted: false }), {
        client: makeFakeClient(),
      })
    ).rejects.toThrow(/consentGranted must be true/);
  });

  it('throws when consentGranted is missing', async () => {
    await expect(
      updateGbpServiceArea(
        // @ts-expect-error — deliberately invalid
        inputFor({ consentGranted: undefined }),
        { client: makeFakeClient() }
      )
    ).rejects.toThrow(/consentGranted must be true/);
  });

  it('throws on non-array newPlaces', async () => {
    await expect(
      updateGbpServiceArea(
        // @ts-expect-error — deliberately invalid
        inputFor({ newPlaces: null }),
        { client: makeFakeClient() }
      )
    ).rejects.toThrow(/newPlaces must be an array/);
  });

  it('throws on a place with empty placeName', async () => {
    await expect(
      updateGbpServiceArea(inputFor({ newPlaces: [{ placeName: '' }] }), {
        client: makeFakeClient(),
      })
    ).rejects.toThrow(/non-empty placeName/);
  });
});

describe('updateGbpServiceArea — happy path', () => {
  it('PATCHes with union(current, additions) when adding new places', async () => {
    const client = makeFakeClient([{ placeName: 'Carindale' }]);
    const audit = makeAuditCapture();
    const result = await updateGbpServiceArea(
      inputFor({
        newPlaces: [{ placeName: 'Carindale' }, { placeName: 'Mansfield' }],
      }),
      { client, audit }
    );

    expect(result.patched).toBe(true);
    expect(result.added.map(p => p.placeName)).toEqual(['Mansfield']);
    expect(result.skipped.map(p => p.placeName)).toEqual(['Carindale']);
    expect(client._patches).toHaveLength(1);
    expect(client._patches[0].map(p => p.placeName).sort()).toEqual([
      'Carindale',
      'Mansfield',
    ]);
    expect(audit._entries).toHaveLength(1);
    expect(audit._entries[0].placesAdded).toHaveLength(1);
    expect(audit._entries[0].patchedAt).not.toBeNull();
  });

  it('dedupes case-insensitively against current coverage', async () => {
    const client = makeFakeClient([{ placeName: 'CARINDALE' }]);
    const result = await updateGbpServiceArea(
      inputFor({ newPlaces: [{ placeName: 'carindale' }] }),
      { client }
    );
    expect(result.patched).toBe(false);
    expect(result.skipped).toHaveLength(1);
    expect(client._patches).toHaveLength(0);
  });
});

describe('updateGbpServiceArea — idempotency', () => {
  it('replaying the same event triggers ZERO PATCHes the second time', async () => {
    const client = makeFakeClient();
    const audit = makeAuditCapture();
    const input = inputFor();

    const first = await updateGbpServiceArea(input, { client, audit });
    expect(first.patched).toBe(true);
    expect(client._patches).toHaveLength(1);

    const second = await updateGbpServiceArea(input, { client, audit });
    expect(second.patched).toBe(false);
    expect(second.added).toEqual([]);
    expect(client._patches).toHaveLength(1); // unchanged
    expect(audit._entries).toHaveLength(2); // both calls audited
    expect(audit._entries[1].patchedAt).toBeNull();
    expect(audit._entries[1].reason).toMatch(/idempotent re-play/);
  });
});

describe('updateGbpServiceArea — distance sanity filter', () => {
  it('drops places > maxDistanceKm (default 100)', async () => {
    const client = makeFakeClient();
    const result = await updateGbpServiceArea(
      inputFor({
        newPlaces: [{ placeName: 'Brisbane CBD' }, { placeName: 'Cairns' }],
        contractorBaseDistanceKmByPlace: {
          'Brisbane CBD': 5,
          Cairns: 1450,
        },
      }),
      { client }
    );
    expect(result.patched).toBe(true);
    expect(result.added.map(p => p.placeName)).toEqual(['Brisbane CBD']);
    expect(result.droppedFarFromBase.map(p => p.placeName)).toEqual(['Cairns']);
  });

  it('honours opts.maxDistanceKm override', async () => {
    const client = makeFakeClient();
    const result = await updateGbpServiceArea(
      inputFor({
        newPlaces: [{ placeName: 'Mount Cotton' }],
        contractorBaseDistanceKmByPlace: { 'Mount Cotton': 30 },
      }),
      { client, maxDistanceKm: 20 }
    );
    expect(result.patched).toBe(false);
    expect(result.droppedFarFromBase.map(p => p.placeName)).toEqual([
      'Mount Cotton',
    ]);
    expect(result.reason).toMatch(/exceeded 20km/);
  });

  it('skips the filter entirely when no distance map provided', async () => {
    const client = makeFakeClient();
    const result = await updateGbpServiceArea(
      inputFor({
        newPlaces: [{ placeName: 'Anywhere' }],
        // no contractorBaseDistanceKmByPlace
      }),
      { client }
    );
    expect(result.patched).toBe(true);
    expect(result.droppedFarFromBase).toEqual([]);
  });

  it('returns no-op result when ALL places dropped by distance filter', async () => {
    const client = makeFakeClient();
    const audit = makeAuditCapture();
    const result = await updateGbpServiceArea(
      inputFor({
        newPlaces: [{ placeName: 'Cairns' }],
        contractorBaseDistanceKmByPlace: { Cairns: 1450 },
      }),
      { client, audit }
    );
    expect(result.patched).toBe(false);
    expect(client._patches).toHaveLength(0);
    expect(audit._entries[0].reason).toMatch(/exceeded 100km/);
  });
});

describe('updateGbpServiceArea — audit sink resilience', () => {
  it('PATCH still succeeds when audit sink throws', async () => {
    const client = makeFakeClient();
    const flakyAudit: GbpAuditSink = async () => {
      throw new Error('foundation-keeper unreachable');
    };
    const result = await updateGbpServiceArea(inputFor(), {
      client,
      audit: flakyAudit,
    });
    expect(result.patched).toBe(true);
    expect(client._patches).toHaveLength(1);
  });
});
