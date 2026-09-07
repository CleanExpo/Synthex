/**
 * GOVERNOR — per-brand runner flags and kill-switch (SYN-1196).
 *
 * Two hard requirements from the goal card live here:
 *
 *   1. "every runner behind a per-brand flag" — DEFAULT OFF. A missing row is
 *      a refusal, exactly like `enabled: false`. There is no arrangement of
 *      data under which a runner turns itself on.
 *   2. "kill-switch per brand stops a runner immediately" — the flag is read
 *      on EVERY call, with no cache and no TTL. A cached kill-switch does not
 *      stop a runner immediately; it stops it eventually, which is a different
 *      and much weaker promise.
 *
 * The brand-level row (`runner = '*'`) is checked alongside the runner row in
 * one query, so a single write kills every runner for a brand.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { BRAND_WIDE_RUNNER, type GovernorOutcome } from './types';

export interface FlagDecision {
  allowed: boolean;
  /** 'enabled' when allowed; otherwise the reason, mirrored into provenance. */
  verdict: string;
  /** Set when !allowed — the outcome the receipt must record. */
  outcome: GovernorOutcome | null;
}

const ALLOWED: FlagDecision = {
  allowed: true,
  verdict: 'enabled',
  outcome: null,
};

/**
 * Resolve whether `runner` may act for `brandSlug` in `organizationId`.
 *
 * Precedence, highest first:
 *   brand-wide kill-switch → runner kill-switch → missing row → disabled row.
 * Kill-switches outrank everything, including an explicitly enabled row: an
 * emergency stop that could be overridden by configuration is not a stop.
 */
export async function resolveRunnerFlag(
  organizationId: string,
  brandSlug: string,
  runner: string
): Promise<FlagDecision> {
  let rows;
  try {
    rows = await prisma.runnerFlag.findMany({
      where: {
        organizationId,
        brandSlug,
        runner: { in: [runner, BRAND_WIDE_RUNNER] },
      },
      select: { runner: true, enabled: true, killSwitch: true },
    });
  } catch (error) {
    // FAIL-CLOSED. budget-enforcer.ts fails OPEN on a control-plane read error
    // by documented design; the Governor must not. If we cannot read the
    // flag we do not know whether this runner was killed, and "unknown" is
    // never "proceed".
    logger.error('Governor flag read failed — refusing (fail-closed)', {
      organizationId,
      brandSlug,
      runner,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      allowed: false,
      verdict: 'control_plane_error',
      outcome: 'refused_control_plane_error',
    };
  }

  const brandRow = rows.find(r => r.runner === BRAND_WIDE_RUNNER);
  if (brandRow?.killSwitch) {
    return {
      allowed: false,
      verdict: 'brand_kill_switch',
      outcome: 'refused_kill_switch',
    };
  }

  const runnerRow = rows.find(r => r.runner === runner);
  if (!runnerRow) {
    return {
      allowed: false,
      verdict: 'flag_missing',
      outcome: 'refused_flag_missing',
    };
  }

  if (runnerRow.killSwitch) {
    return {
      allowed: false,
      verdict: 'runner_kill_switch',
      outcome: 'refused_kill_switch',
    };
  }

  if (!runnerRow.enabled) {
    return {
      allowed: false,
      verdict: 'flag_disabled',
      outcome: 'refused_flag_disabled',
    };
  }

  return ALLOWED;
}
