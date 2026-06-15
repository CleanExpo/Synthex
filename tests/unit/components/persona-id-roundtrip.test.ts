/**
 * Persona id round-trip — regression for the cuid → numeric → cuid mapping.
 *
 * Bug: persona API ids are Prisma `cuid()` strings (e.g. `clxy29a7b0000…`).
 * `transformPersona` used `parseInt(p.id, 10) || Date.now()`, but
 * `parseInt('clxy…', 10)` is `NaN`, so every persona got a fresh `Date.now()`
 * numeric id that (a) changed on every render and (b) could never be mapped
 * back to its cuid by `findApiId`. Result: selection/React keys churned and
 * delete / train / clone all failed with "Persona not found" for every real
 * (cuid) persona.
 *
 * These tests drive the real helpers and lock the round-trip + stability.
 *
 * @module tests/unit/components/persona-id-roundtrip.test
 */

import { describe, it, expect } from '@jest/globals';
import {
  transformPersona,
  findApiId,
  personaComponentId,
} from '@/components/personas/persona-helpers';
import type { Persona as APIPersona } from '@/hooks/use-personas';

function makeApiPersona(overrides: Partial<APIPersona> = {}): APIPersona {
  return {
    id: 'clxy29a7b0000abcd1234wxyz',
    name: 'Brand Voice',
    description: 'A professional persona',
    status: 'active',
    tone: 'professional',
    style: 'formal',
    vocabulary: 'standard',
    emotion: 'neutral',
    trainingSourcesCount: 3,
    trainingWordsCount: 1200,
    trainingSamplesCount: 5,
    accuracy: 82,
    lastTrained: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('persona id round-trip', () => {
  it('cuid persona round-trips: transformPersona id maps back to the cuid via findApiId', () => {
    const api = makeApiPersona();
    const component = transformPersona(api);

    // The numeric component id must resolve back to the original cuid.
    expect(findApiId([api], component.id)).toBe(api.id);
  });

  it('cuid no longer collapses to Date.now() (the bug)', () => {
    const api = makeApiPersona();
    const now = Date.now();

    const id1 = transformPersona(api).id;
    const id2 = transformPersona(api).id;

    // Deterministic across calls for the same cuid...
    expect(id1).toBe(id2);
    // ...and not a wall-clock timestamp.
    expect(Math.abs(id1 - now)).toBeGreaterThan(1000);
    expect(Number.isNaN(id1)).toBe(false);
  });

  it('distinct cuids produce distinct, stable component ids', () => {
    const a = makeApiPersona({ id: 'claaa0000000000000000000a' });
    const b = makeApiPersona({ id: 'clbbb1111111111111111111b' });

    const ca = transformPersona(a);
    const cb = transformPersona(b);

    expect(ca.id).not.toBe(cb.id);
    expect(findApiId([a, b], ca.id)).toBe(a.id);
    expect(findApiId([a, b], cb.id)).toBe(b.id);
  });

  it('findApiId returns null when no persona matches', () => {
    const api = makeApiPersona();
    expect(findApiId([api], 999999999)).toBeNull();
    expect(findApiId([], transformPersona(api).id)).toBeNull();
  });

  it('honours genuinely numeric api ids directly', () => {
    expect(personaComponentId('42')).toBe(42);
    const api = makeApiPersona({ id: '42' });
    expect(transformPersona(api).id).toBe(42);
    expect(findApiId([api], 42)).toBe('42');
  });

  it('component ids are non-negative 32-bit integers', () => {
    const id = personaComponentId('clxy29a7b0000abcd1234wxyz');
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThanOrEqual(0);
    expect(id).toBeLessThanOrEqual(0xffffffff);
  });
});
