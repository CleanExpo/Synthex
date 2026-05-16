/**
 * Persistence for brand-voice-enforce runs.
 *
 * Per spec §7 + Q3.2.5 P10 binding:
 * - Never persists the candidate body
 * - Persists sha256(candidate)[0:64] hash only
 * - Lazy-init Prisma (SYN-953 pattern)
 *
 * Failures here are swallowed-with-log so the gate decision is never blocked
 * by a tracking outage. The gate decision is the contract; tracking is audit.
 */

import { createHash } from 'crypto';
import { logger } from '@/lib/logger';
import type { BrandVoiceEnforceInput, BrandVoiceEnforceResult } from './types';

let _prisma: import('@prisma/client').PrismaClient | null = null;

async function getPrisma() {
  if (_prisma) return _prisma;
  const mod = await import('@prisma/client');
  _prisma = new mod.PrismaClient();
  return _prisma;
}

export function hashCandidate(candidate: string): string {
  return createHash('sha256').update(candidate, 'utf8').digest('hex');
}

export async function trackGateRun(
  input: BrandVoiceEnforceInput,
  result: BrandVoiceEnforceResult,
): Promise<void> {
  try {
    const prisma = await getPrisma() as unknown as {
      aeoGateRun: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
    };
    await prisma.aeoGateRun.create({
      data: {
        brand: input.brand,
        surface: input.surface,
        pass: result.pass,
        reasons: result.reasons,
        evidenceUrls: result.evidence_urls,
        candidateHash: hashCandidate(input.candidate),
        candidateLength: input.candidate.length,
        sourceOfTruthJobId: input.sourceOfTruthJobId ?? null,
        durationMs: result.durationMs,
        ruleSetVersion: '2026-05-16',
      },
    });
  } catch (err) {
    logger.warn?.('aeo: trackGateRun persistence failed (decision unaffected)', {
      brand: input.brand,
      surface: input.surface,
      pass: result.pass,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
