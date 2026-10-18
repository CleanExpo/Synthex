/**
 * Effect Report Generator — SYN-674
 *
 * Effect Reports are stored in `effect_reports`. That table has no Prisma
 * model, so generation and reads throw EffectReportNotProvisionedError rather
 * than report a fake success or a false "not found". The section builders in
 * ./sections stay available for when the store exists.
 *
 * Cold-start guard: clients created within 45 days of period_start are skipped.
 */

import { prisma } from '@/lib/prisma';
import type {
  EffectReportRow,
  GenerateEffectReportInput,
  GenerateEffectReportOutput,
} from './types';

/**
 * Thrown when an Effect Report would be stored or read: the `effect_reports`
 * table has no Prisma model, so there is nowhere real to keep reports.
 */
export class EffectReportNotProvisionedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED' as const;
  readonly table = 'effect_reports';

  constructor() {
    super(
      'effect_reports is not provisioned: no table in prisma/schema.prisma'
    );
    this.name = 'EffectReportNotProvisionedError';
  }
}

/** Clients active for fewer than this many days are skipped */
const COLD_START_DAYS = 45;

/**
 * Generate an Effect Report for one organisation.
 *
 * @returns null when cold-start guard fires or no meaningful data.
 * @throws EffectReportNotProvisionedError — the report cannot be persisted, so
 *         it is not generated (no section or AI spend for a dropped write).
 * @param _admin, _appUrl unused; kept so existing callers stay compatible.
 */
export async function generateEffectReport(
  input: GenerateEffectReportInput,
  _admin: unknown,
  _appUrl: string
): Promise<GenerateEffectReportOutput | null> {
  const { organizationId, periodStart } = input;

  // Resolve org metadata
  const org = await prisma.organization
    .findUnique({
      where: { id: organizationId },
      select: { name: true, createdAt: true },
    })
    .catch(() => null);

  if (!org) return null;

  // Cold-start guard: skip if client created within COLD_START_DAYS of period_start
  const clientCreatedAt = new Date(org.createdAt);
  const daysSinceCreation =
    (periodStart.getTime() - clientCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < COLD_START_DAYS) return null;

  // effect_reports is not provisioned: refuse before building sections or
  // calling the AI, because the result could not be stored.
  throw new EffectReportNotProvisionedError();
}

/**
 * Fetch a persisted Effect Report by ID (for viewer + download routes).
 * Throws EffectReportNotProvisionedError (never a false "not found").
 */
export async function getEffectReport(
  _admin: unknown,
  _reportId: string
): Promise<EffectReportRow | null> {
  throw new EffectReportNotProvisionedError();
}

/**
 * Fetch the most recent Effect Report for a client in a given period.
 * Used by the dashboard viewer to resolve /dashboard/effect-report/[period].
 * Throws EffectReportNotProvisionedError (never a false "not found").
 */
export async function getEffectReportByPeriod(
  _admin: unknown,
  _organizationId: string,
  _quarterLabel: string
): Promise<EffectReportRow | null> {
  throw new EffectReportNotProvisionedError();
}
