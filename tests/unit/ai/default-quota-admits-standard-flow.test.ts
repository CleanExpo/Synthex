/** @jest-environment node */
/**
 * SYN-1115 founder ruling 2026-08-03 (ruling 3) — the default quota must admit
 * the standard ranking flow.
 *
 * The defect this pins: admission reserves the WORST CASE a variant can spend,
 * which for a grounded run is ~3x typical. The dashboard hook sends
 * `variants: 3` unconditionally, so a default-quota organisation was refused
 * before it spent anything real — the image flow was unusable out of the box
 * while every unit test passed, because no test ever compared the reservation
 * against the cap that admits it.
 *
 * Nothing here is copied. The hold is computed by the SAME functions
 * `holdImageSpend` uses, the variant count is read out of the hook, and the
 * caps are read out of `prisma/schema.prisma`. Any of those moving without the
 * others moving fails this test rather than silently re-breaking admission.
 *
 * The raise is a BRIDGE. Per-attempt admission (SYN-1125) is what removes the
 * over-reservation; until then the cap has to cover the worst case.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  MAX_CALLS_PER_VARIANT_GROUNDED,
  maxProviderCallsPerVariant,
  resolveCostModel,
  resolveOutputDimensions,
} from '@/lib/services/ai/image/meter';
import { estimateImageCostUsd } from '@/lib/services/ai/image/registry';

const REPO_ROOT = join(__dirname, '..', '..', '..');

/** The default the `upsert({ create: { organizationId } })` in reserveSpend gets. */
function schemaDefault(field: 'dailyBudgetUsd' | 'monthlyBudgetUsd'): number {
  const schema = readFileSync(
    join(REPO_ROOT, 'prisma', 'schema.prisma'),
    'utf8'
  );
  const match = schema.match(
    new RegExp(`${field}\\s+Decimal\\s+@default\\((\\d+(?:\\.\\d+)?)\\)`)
  );
  if (!match)
    throw new Error(`no @default found for ${field} in schema.prisma`);
  return Number(match[1]);
}

/**
 * What the dashboard actually sends — read from the REQUEST BODY, not assumed.
 *
 * Anchored to the `JSON.stringify` body deliberately. A bare /variants:\s*(\d+)/
 * matches the first occurrence in the file, which is a COMMENT on line 81, so
 * the count could be raised at the real call site while this test kept reading
 * 3 and stayed green — the exact vacuous control this test exists to prevent
 * (independent review of 377dbd12, P2).
 *
 * Every executable occurrence is collected rather than the first, so a second
 * request site sending a different count fails here instead of silently
 * exceeding the ceiling this test claims to guard.
 */
function hookVariantCount(): number {
  const hook = readFileSync(
    join(REPO_ROOT, 'hooks', 'use-image-generation.ts'),
    'utf8'
  );
  const counts = [
    ...hook.matchAll(/JSON\.stringify\(\{[^}]*\bvariants:\s*(\d+)/g),
  ].map(m => Number(m[1]));

  if (counts.length === 0) {
    throw new Error(
      'no variants literal found in a request body in use-image-generation.ts'
    );
  }
  if (new Set(counts).size > 1) {
    throw new Error(
      `use-image-generation.ts sends inconsistent variant counts (${counts.join(', ')}) — admission is priced against the largest, so reconcile them`
    );
  }
  return counts[0];
}

/**
 * Worst-case hold for one grounded batch, computed exactly as `holdImageSpend`
 * computes it: dearest candidate, worst-case references, worst-case calls.
 */
function worstCaseHoldUsd(count: number): number {
  // 4 public manifest refs + 4 appended private signed refs is the ceiling
  // `meteredOptions` assumes when resolution fails, and therefore the most a
  // grounded run can bill as input megapixels.
  const options = { referenceImageCount: 8 };
  const model = resolveCostModel(options);
  const dimensions = resolveOutputDimensions(options);
  const perImageUsd = estimateImageCostUsd(model, {
    ...dimensions,
    referenceImageCount: options.referenceImageCount,
  });
  const callsPerVariant = maxProviderCallsPerVariant(options);
  return Math.round(perImageUsd * count * callsPerVariant * 10000) / 10000;
}

describe('the default quota admits the standard ranking flow', () => {
  const variants = hookVariantCount();
  const heldUsd = worstCaseHoldUsd(variants);

  it('reserves the grounded worst case, not one call per variant', () => {
    // Positive control on the control: if the chain ever stopped reserving the
    // retry, `heldUsd` would shrink and every assertion below would pass for
    // the wrong reason.
    expect(maxProviderCallsPerVariant({ referenceImageCount: 8 })).toBe(
      MAX_CALLS_PER_VARIANT_GROUNDED
    );
    expect(heldUsd).toBeGreaterThan(0);
  });

  it('did NOT fit the previous $5 default — the bounce was real', () => {
    // Proves this test can fail. Without it, a green run says nothing about
    // whether the cap was ever the binding constraint.
    expect(heldUsd).toBeGreaterThan(5);
  });

  it('fits the current daily default', () => {
    expect(heldUsd).toBeLessThanOrEqual(schemaDefault('dailyBudgetUsd'));
  });

  it('fits the MCP sub-cap, so agent-initiated runs are admitted too', () => {
    // MCP_DAILY_FRACTION default, unchanged by the ruling.
    const mcpFraction = 0.5;
    expect(heldUsd).toBeLessThanOrEqual(
      schemaDefault('dailyBudgetUsd') * mcpFraction
    );
  });

  it('leaves the monthly default able to carry more than one day at the cap', () => {
    expect(schemaDefault('monthlyBudgetUsd')).toBeGreaterThan(
      schemaDefault('dailyBudgetUsd')
    );
  });
});
