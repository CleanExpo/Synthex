/**
 * Loads agency foundation snippets for workflow / autonomous execution (SYN-972).
 */

import { readFile } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';
import { getAgencyTask, type AgencyTaskId } from './agency-task-catalog';
import {
  assertPromptClean,
  portfolioBrandForOrg,
  promptHits,
} from '@/lib/marketing-calendar/prompt-guard';
import type { PortfolioBrandProfile } from '@/lib/marketing-calendar/portfolio-brands';

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

/** The org-setting text the foundation context hands to workflow prompts. */
export function foundationPromptText(settings: unknown): string[] {
  const s = (settings ?? {}) as Record<string, unknown>;
  // Values are serialised into workflow input whatever their JSON type.
  return [s.voiceTag, s.flywheel]
    .filter(v => v !== undefined && v !== null)
    .map(v => (typeof v === 'string' ? v : JSON.stringify(v)));
}

/** A foundation excerpt as a brand may receive it: withheld if it names that brand's forbidden words. */
function excerptFor(
  brand: PortfolioBrandProfile | undefined,
  excerpt: string
): string {
  return brand && promptHits(excerpt, brand).length > 0
    ? '[foundation excerpt withheld: it names words this brand never uses]'
    : excerpt;
}

/**
 * Build foundation context for an org (and optional AT-* task).
 */
export async function getAgencyFoundationContext(
  organizationId: string,
  opts?: { agencyTaskId?: string }
): Promise<AgencyFoundationContext> {
  const [ceoFoundationExcerpt, verificationGatesExcerpt, org, brand] =
    await Promise.all([
      readFoundationExcerpt(FOUNDATION_FILES.ceoFoundation),
      readFoundationExcerpt(FOUNDATION_FILES.verificationGates),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true, settings: true },
      }),
      // A brand only inside the workspace: a slug alone proves nothing.
      portfolioBrandForOrg(prisma, organizationId),
    ]);

  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  if (brand) assertPromptClean(brand.orgSlug, foundationPromptText(settings));
  const agencyMeta = opts?.agencyTaskId
    ? getAgencyTask(opts.agencyTaskId)
    : undefined;

  return {
    organizationId,
    organizationSlug: org?.slug,
    voiceTag: (settings.voiceTag as string) ?? agencyMeta?.label,
    flywheel: settings.flywheel as string | undefined,
    ceoFoundationExcerpt: excerptFor(brand, ceoFoundationExcerpt),
    verificationGatesExcerpt: excerptFor(brand, verificationGatesExcerpt),
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
