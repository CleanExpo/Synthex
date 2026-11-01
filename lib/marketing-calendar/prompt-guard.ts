/**
 * The portfolio content rule, checked on the finished prompt.
 *
 * Each portfolio brand has words it never uses (for Unite Group: the group's
 * own businesses and their industry). Rather than list every stored field a
 * prompt might read, the check runs on the prompt text itself, at the point
 * it goes to the model: whatever field fed it, a forbidden word in the prompt
 * stops the call. Orgs outside the portfolio are never checked.
 *
 * The same rule holds where calendar drafts are stored: every write of a
 * calendar draft checks the draft's own text (assertCalendarPostClean).
 */

import {
  PORTFOLIO_BRANDS,
  PORTFOLIO_PARENT_SLUG,
  brandHits,
  copyHits,
  type PortfolioBrandProfile,
} from './portfolio-brands';
import { inWorkspace, type WorkspaceOrgFields } from './workspace';

export class ForbiddenPromptError extends Error {
  readonly code = 'FORBIDDEN_PROMPT';
  constructor(
    readonly orgSlug: string,
    readonly hits: string[]
  ) {
    super(
      `Prompt for ${orgSlug} names words this brand never uses: ${hits.join(', ')}`
    );
    this.name = 'ForbiddenPromptError';
  }
}

export function brandForSlug(
  slug: string | null | undefined
): PortfolioBrandProfile | undefined {
  return slug ? PORTFOLIO_BRANDS.find(b => b.orgSlug === slug) : undefined;
}

/** The brand's forbidden words found in prompt text (see brandHits). */
export function promptHits(text: string, brand: PortfolioBrandProfile) {
  return brandHits(text, brand);
}

/** Throws ForbiddenPromptError when a portfolio brand's prompt names a forbidden word. */
export function assertPromptClean(
  orgSlug: string | null | undefined,
  parts: Array<string | null | undefined>
) {
  const brand = brandForSlug(orgSlug);
  if (!brand) return;
  const hits = promptHits(parts.filter(Boolean).join('\n'), brand);
  if (hits.length > 0) throw new ForbiddenPromptError(brand.orgSlug, hits);
}

/**
 * The parts of a calendar draft a reader sees or a publisher sends: its
 * copy, and the caption a delivered video carries. Metadata otherwise holds
 * machine fields (source, plan version, brand rules), not copy.
 */
export interface CalendarPostText {
  title?: string | null;
  content?: string | null;
  hashtags?: string[] | null;
  mentions?: string[] | null;
  metadata?: unknown;
}

function deliveredCaption(metadata: unknown): string | null {
  const delivery = (metadata as { videoDelivery?: { captionDraft?: unknown } })
    ?.videoDelivery;
  return typeof delivery?.captionDraft === 'string'
    ? delivery.captionDraft
    : null;
}

function calendarPostText(post: CalendarPostText) {
  return [
    post.title,
    post.content,
    ...(post.hashtags ?? []),
    ...(post.mentions ?? []),
    deliveredCaption(post.metadata),
  ];
}

/**
 * The brand's forbidden words in a draft's copy. Each field (title, content,
 * each hashtag and mention, the delivered caption) is read on its own, so no
 * phrase, forbidden or approved, is made from the end of one and the start
 * of the next.
 */
export function calendarPostHits(
  post: CalendarPostText,
  brand: Parameters<typeof copyHits>[1]
): string[] {
  const hits = calendarPostText(post).flatMap(field =>
    field ? copyHits(field, brand) : []
  );
  return [...new Set(hits)];
}

/**
 * Throws ForbiddenPromptError when a calendar draft for a portfolio brand
 * names a word that brand never uses. Every write of a calendar draft calls
 * this (or assertCalendarPostCleanForOrg) first, so no such draft is stored
 * however its text was produced.
 */
export function assertCalendarPostClean(
  orgSlug: string | null | undefined,
  post: CalendarPostText
) {
  const brand = brandForSlug(orgSlug);
  if (!brand) return;
  const hits = calendarPostHits(post, brand);
  if (hits.length > 0) throw new ForbiddenPromptError(brand.orgSlug, hits);
}

const WORKSPACE_FIELDS = {
  id: true,
  slug: true,
  status: true,
  parentOrgId: true,
} as const;

export interface OrgLookup {
  organization: {
    findUnique(args: {
      where: { id: string } | { slug: string };
      select: typeof WORKSPACE_FIELDS;
    }): Promise<WorkspaceOrgFields | null>;
  };
}

/**
 * The portfolio brand an organisation id is, if any. A slug alone proves
 * nothing: an org is a brand only when it is in the Unite Group workspace
 * (workspace.ts), so an outside org that shares a brand's slug gets no brand
 * and is left unchecked like any other org. Every brand rule applied by
 * organisation id decides it here.
 */
export async function portfolioBrandForOrg(
  db: OrgLookup,
  organizationId: string
): Promise<PortfolioBrandProfile | undefined> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: WORKSPACE_FIELDS,
  });
  const brand = brandForSlug(org?.slug);
  if (!org || !brand) return undefined;
  const root =
    org.slug === PORTFOLIO_PARENT_SLUG
      ? org
      : await db.organization.findUnique({
          where: { slug: PORTFOLIO_PARENT_SLUG },
          select: WORKSPACE_FIELDS,
        });
  return root && inWorkspace(org, root) ? brand : undefined;
}

/** assertPromptClean for an organisation id (see portfolioBrandForOrg). */
export async function assertPromptCleanForOrg(
  db: OrgLookup,
  organizationId: string,
  parts: Array<string | null | undefined>
) {
  const brand = await portfolioBrandForOrg(db, organizationId);
  if (brand) assertPromptClean(brand.orgSlug, parts);
}

/** assertCalendarPostClean for an organisation id (see portfolioBrandForOrg). */
export async function assertCalendarPostCleanForOrg(
  db: OrgLookup,
  organizationId: string,
  post: CalendarPostText
) {
  const brand = await portfolioBrandForOrg(db, organizationId);
  if (brand) assertCalendarPostClean(brand.orgSlug, post);
}
