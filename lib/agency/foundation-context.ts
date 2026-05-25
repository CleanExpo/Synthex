/**
 * Loads agency foundation snippets for workflow / autonomous execution (SYN-972).
 */

import { readFile } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';
import { getAgencyTask, type AgencyTaskId } from './agency-task-catalog';

const FOUNDATION_FILES = {
  ceoFoundation: '.claude/memory/ceo-foundation.md',
  verificationGates: '.claude/memory/verification-gates.md',
} as const;

const SNIPPET_MAX_CHARS = 12_000;

export interface AgencyFoundationContext {
  organizationId: string;
  organizationSlug?: string;
  voiceTag?: string;
  flywheel?: string;
  ceoFoundationExcerpt: string;
  verificationGatesExcerpt: string;
  agencyTaskId?: AgencyTaskId;
  loadedAt: string;
}

async function readFoundationExcerpt(relativePath: string): Promise<string> {
  const fullPath = path.join(process.cwd(), relativePath);
  try {
    const raw = await readFile(fullPath, 'utf8');
    return raw.length > SNIPPET_MAX_CHARS
      ? `${raw.slice(0, SNIPPET_MAX_CHARS)}\n\n[truncated for workflow context]`
      : raw;
  } catch {
    return `[foundation file missing: ${relativePath}]`;
  }
}

/**
 * Build foundation context for an org (and optional AT-* task).
 */
export async function getAgencyFoundationContext(
  organizationId: string,
  opts?: { agencyTaskId?: string }
): Promise<AgencyFoundationContext> {
  const [ceoFoundationExcerpt, verificationGatesExcerpt, org] =
    await Promise.all([
      readFoundationExcerpt(FOUNDATION_FILES.ceoFoundation),
      readFoundationExcerpt(FOUNDATION_FILES.verificationGates),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true, settings: true },
      }),
    ]);

  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const agencyMeta = opts?.agencyTaskId
    ? getAgencyTask(opts.agencyTaskId)
    : undefined;

  return {
    organizationId,
    organizationSlug: org?.slug,
    voiceTag: (settings.voiceTag as string) ?? agencyMeta?.label,
    flywheel: settings.flywheel as string | undefined,
    ceoFoundationExcerpt,
    verificationGatesExcerpt,
    agencyTaskId:
      opts?.agencyTaskId && getAgencyTask(opts.agencyTaskId)
        ? (opts.agencyTaskId as AgencyTaskId)
        : undefined,
    loadedAt: new Date().toISOString(),
  };
}

/**
 * Merge foundation into workflow inputData (non-destructive).
 */
export function mergeFoundationIntoInput(
  inputData: unknown,
  foundation: AgencyFoundationContext
): Record<string, unknown> {
  const base =
    inputData && typeof inputData === 'object' && !Array.isArray(inputData)
      ? { ...(inputData as Record<string, unknown>) }
      : { payload: inputData };
  return {
    ...base,
    agencyFoundation: foundation,
  };
}
