/**
 * Apply, undo and verify the portfolio brand setup and 4-week draft calendar.
 *
 * One home for the logic; scripts/seed-portfolio-marketing-calendar.ts and
 * /api/admin/portfolio-calendar are thin callers.
 *
 * Safety:
 *   - apply never touches calendarMode, liveModeT or autoPublishPaused. New
 *     orgs get the schema defaults (shadow, tier 0); live mode is Phill's.
 *   - CalendarPost is not read by any publishing cron, and every row is
 *     written as 'draft'. Slots are keyed by metadata.slotKey and only ever
 *     created: an existing slot, edited or not, is never rewritten.
 *   - A logo that cannot be confirmed as served never replaces or clears one
 *     already stored.
 *   - Every write is recorded in the returned manifest (ids plus prior values)
 *     so undo can reverse it. Undo is guarded row by row: it only touches rows
 *     still exactly as apply left them, and never deletes an organisation.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  PORTFOLIO_CALENDAR_TAG,
  PORTFOLIO_PLAN_VERSION,
  PORTFOLIO_WEEKLY_VIDEO_TARGET,
  buildPortfolioCalendar,
  slotBrief,
} from './portfolio-plan';
import {
  PORTFOLIO_BRANDS,
  PORTFOLIO_PARENT_SLUG,
  PORTFOLIO_WEEK_STARTS,
  brandHits,
  type PortfolioBrandProfile,
} from './portfolio-brands';
import { resolveLogoUrl } from './resolve-logo';
import {
  LeftWorkspaceError,
  inWorkspace,
  isActiveWorkspaceRoot,
  lockWorkspaceMember,
} from './workspace';
import { promptHits } from './prompt-guard';
import { renderPromptLegs } from '@/lib/ai/prompt-layer-builder';
import { foundationPromptText } from '@/lib/agency/foundation-context';

export const PORTFOLIO_SOURCE = 'portfolio-marketing-calendar';

export interface PortfolioManifest {
  planVersion: string;
  ranAt: string;
  write: boolean;
  createdOrganizations: Array<{ id: string; slug: string }>;
  updatedOrganizations: Array<{
    id: string;
    slug: string;
    before: { logo: string | null; primaryColor: string | null };
    after: { logo: string | null; primaryColor: string | null };
  }>;
  teamMembers: Array<{
    id: string;
    orgSlug: string;
    organizationId: string;
    userId: string;
  }>;
  businessOwnerships: Array<{
    id: string;
    orgSlug: string;
    organizationId: string;
    userId: string;
  }>;
  brandDna: Array<{
    id: string;
    orgSlug: string;
    organizationId: string;
    created: boolean;
    before: unknown;
    /** updatedAt as apply left it; undo only acts while it is unchanged. */
    appliedUpdatedAt: string;
  }>;
  clientProfiles: Array<{
    id: string;
    orgSlug: string;
    organizationId: string;
    created: boolean;
    before: unknown;
    appliedUpdatedAt: string;
  }>;
  calendarPosts: Array<{
    id: string;
    orgSlug: string;
    slotKey: string;
    kind: string;
    scheduledFor: string;
    /** updatedAt as written; undo deletes the post only while it still matches. */
    appliedUpdatedAt: string;
  }>;
  skippedSlots: Array<{ slotKey: string; reason: string }>;
  log: string[];
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function orgData(brand: PortfolioBrandProfile, logoUrl: string | null) {
  return {
    name: brand.name,
    slug: brand.orgSlug,
    description: brand.description,
    website: brand.website,
    industry: brand.industry,
    plan: 'enterprise',
    logo: logoUrl,
    primaryColor: brand.colours.primary,
  };
}

/** The metadata setup writes on a planned slot's draft. */
function slotMetadata(
  slot: ReturnType<typeof buildPortfolioCalendar>[number],
  brand: PortfolioBrandProfile
) {
  return {
    source: PORTFOLIO_SOURCE,
    planVersion: PORTFOLIO_PLAN_VERSION,
    slotKey: slot.slotKey,
    slotKind: slot.kind,
    weekStart: slot.weekStart,
    scheduledLocal: slot.localTime,
    theme: slot.theme,
    presenter: slot.kind === 'shortform_video' ? 'Margot (HeyGen)' : null,
    approvalState: 'pending_approval',
    externalPublishBlocked: true,
    videoDelivery:
      slot.kind === 'shortform_video' ? { status: 'awaiting_video' } : null,
    brandRules: brand.brandRules,
  };
}

function brandDnaData(brand: PortfolioBrandProfile, logoUrl: string | null) {
  return {
    businessName: brand.name,
    vertical: brand.vertical,
    industry: brand.industry,
    // Omitted (not null) when unconfirmed, so an update keeps the stored logo.
    ...(logoUrl ? { logoUrl } : {}),
    primaryColour: brand.colours.primary,
    secondaryColour: brand.colours.secondary,
    neutralColour: brand.colours.neutral,
    brandVoice: json(brand.voice),
    persona: json(brand.audience),
    offerings: json(brand.offerings),
    socialProfiles: json(brand.socialProfiles),
    sourceUrl: brand.website,
    lastRefreshedAt: new Date(),
  };
}

function clientProfileData(brand: PortfolioBrandProfile) {
  return {
    intakeStatus: 'complete',
    intakeSource: PORTFOLIO_SOURCE,
    intakeCompletedAt: new Date(),
    icp: json(brand.audience),
    offers: json(brand.offerings),
    toneKeywords: json(brand.voice.tone),
    antiPatterns: json(brand.antiPatterns),
    vocabularyBank: json({
      preferred: brand.preferredWords,
      banned: brand.forbiddenWords,
    }),
    channels: json(brand.socialProfiles.map(p => p.platform)),
    constraints: json({
      brandRules: brand.brandRules,
      liveStatus: brand.liveStatus,
      publicContentHeldReason: brand.publicContentHeldReason ?? null,
      logoNote: brand.logoNote,
    }),
  };
}

function emptyManifest(write: boolean): PortfolioManifest {
  return {
    planVersion: PORTFOLIO_PLAN_VERSION,
    ranAt: new Date().toISOString(),
    write,
    createdOrganizations: [],
    updatedOrganizations: [],
    teamMembers: [],
    businessOwnerships: [],
    brandDna: [],
    clientProfiles: [],
    calendarPosts: [],
    skippedSlots: [],
    log: [],
  };
}

/** Dry run unless write is true. On failure the partial manifest is attached to the error. */
export async function applyPortfolioSetup(opts: {
  write: boolean;
  ownerUserId: string;
}): Promise<PortfolioManifest> {
  const { write, ownerUserId } = opts;
  const manifest = emptyManifest(write);
  const log = (line: string) => manifest.log.push(line);
  const verb = write ? '' : 'would ';

  try {
    const parent = await prisma.organization.findUnique({
      where: { slug: PORTFOLIO_PARENT_SLUG },
    });
    if (!parent || !isActiveWorkspaceRoot(parent))
      throw new Error(
        `Parent org ${PORTFOLIO_PARENT_SLUG} not found, not active, or not a workspace root`
      );

    // Everyone who owns the parent workspace gets the same access to new brands.
    const parentOwners = await prisma.teamMember.findMany({
      where: { organizationId: parent.id, role: 'owner' },
      select: { userId: true },
    });
    const orgIds = new Map<string, string | null>();
    const refused = new Set<string>();

    for (const brand of PORTFOLIO_BRANDS) {
      const logoUrl = await resolveLogoUrl(brand.logoUrl);
      if (brand.logoUrl && !logoUrl) {
        log(
          `! ${brand.orgSlug}: approved logo not served yet (${brand.logoUrl}); logo left empty`
        );
      }

      let org = await prisma.organization.findUnique({
        where: { slug: brand.orgSlug },
      });
      // Slugs are global: an existing org only counts as this brand if it is
      // in the Unite Group workspace (see workspace.ts). Anything else is
      // someone else's org, so the brand gets no writes.
      const ours = !org || inWorkspace(org, parent);
      if (!ours) {
        log(
          `! ${brand.orgSlug}: existing org is not an active child of ${PORTFOLIO_PARENT_SLUG}; brand skipped, nothing written`
        );
        refused.add(brand.orgSlug);
        continue;
      }
      // Every write for this brand runs in a transaction that first
      // share-locks the brand and the parent by id and re-checks membership
      // (lockWorkspaceMember), so nothing is written after it leaves.
      const guarded = <T>(
        orgId: string,
        fn: (tx: Prisma.TransactionClient) => Promise<T>
      ) =>
        prisma.$transaction(async tx => {
          await lockWorkspaceMember(tx, orgId, parent.id);
          return fn(tx);
        });
      try {
        // Brand setup is create-only, record by record: brand DNA and client
        // profile are each created only when missing and never overwritten, and
        // an existing org's logo and colour are only ever filled when empty, so
        // no apply replaces anyone's edits.
        const dna = org
          ? await prisma.brandDNA.findUnique({
              where: { organizationId: org.id },
              select: { id: true },
            })
          : null;
        const profile = org
          ? await prisma.clientProfile.findUnique({
              where: { organizationId: org.id },
              select: { id: true },
            })
          : null;
        if (!org) {
          log(
            `+ create org ${brand.orgSlug} (child of ${PORTFOLIO_PARENT_SLUG})`
          );
          if (write) {
            org = await guarded(parent.id, tx =>
              tx.organization.create({
                data: { ...orgData(brand, logoUrl), parentOrgId: parent.id },
              })
            );
            manifest.createdOrganizations.push({ id: org.id, slug: org.slug });
          }
        } else {
          // An existing org keeps any logo and colour it already has: apply only
          // fills a field that is still empty, guarded in the WHERE so a value
          // set by anyone since the read is never replaced.
          const fills: Array<{
            field: 'logo' | 'primaryColor';
            value: string | null;
          }> = [
            { field: 'logo', value: logoUrl },
            { field: 'primaryColor', value: brand.colours.primary },
          ];
          const after = { logo: org.logo, primaryColor: org.primaryColor };
          for (const { field, value } of fills) {
            if (!value || org[field] !== null) continue;
            const where = { id: org.id, [field]: null };
            const orgId = org.id;
            const n = write
              ? (
                  await guarded(orgId, tx =>
                    tx.organization.updateMany({
                      where,
                      data: { [field]: value },
                    })
                  )
                ).count
              : await prisma.organization.count({ where });
            if (n) {
              log(`~ ${verb}fill empty org ${field} for ${brand.orgSlug}`);
              if (write) after[field] = value;
            }
          }
          if (
            after.logo !== org.logo ||
            after.primaryColor !== org.primaryColor
          ) {
            manifest.updatedOrganizations.push({
              id: org.id,
              slug: org.slug,
              before: { logo: org.logo, primaryColor: org.primaryColor },
              after,
            });
          }
        }
        orgIds.set(brand.orgSlug, org?.id ?? null);
        if (!org) continue;
        const orgId = org.id;

        for (const { userId } of parentOwners) {
          const member = await prisma.teamMember.findFirst({
            where: { organizationId: org.id, userId },
          });
          if (!member) {
            log(`+ team owner ${userId} on ${brand.orgSlug}`);
            if (write) {
              const row = await guarded(orgId, tx =>
                tx.teamMember.create({
                  data: { organizationId: orgId, userId, role: 'owner' },
                })
              );
              manifest.teamMembers.push({
                id: row.id,
                orgSlug: brand.orgSlug,
                organizationId: org.id,
                userId,
              });
            }
          }
          const ownership = await prisma.businessOwnership.findUnique({
            where: {
              ownerId_organizationId: {
                ownerId: userId,
                organizationId: org.id,
              },
            },
          });
          if (!ownership) {
            log(`+ business ownership ${userId} on ${brand.orgSlug}`);
            if (write) {
              const row = await guarded(orgId, tx =>
                tx.businessOwnership.create({
                  data: {
                    ownerId: userId,
                    organizationId: orgId,
                    displayName: brand.name,
                    isActive: true,
                    billingStatus: 'active',
                    monthlyRate: 0, // internal portfolio, no billing
                  },
                })
              );
              manifest.businessOwnerships.push({
                id: row.id,
                orgSlug: brand.orgSlug,
                organizationId: org.id,
                userId,
              });
            }
          }
        }

        // create, not upsert: a row written since the checks above fails the
        // unique constraint instead of being overwritten.
        if (dna) {
          log(
            `= ${brand.orgSlug}: brand DNA already in place; not overwritten`
          );
          if (logoUrl) {
            // Same null-only logo repair as the org above.
            const where = { organizationId: org.id, logoUrl: null };
            const n = write
              ? (
                  await guarded(orgId, tx =>
                    tx.brandDNA.updateMany({ where, data: { logoUrl } })
                  )
                ).count
              : await prisma.brandDNA.count({ where });
            if (n)
              log(`~ ${verb}fill empty brand DNA logo for ${brand.orgSlug}`);
          }
        } else {
          log(`+ create brand DNA for ${brand.orgSlug}`);
          if (write) {
            const row = await guarded(orgId, tx =>
              tx.brandDNA.create({
                data: {
                  organizationId: orgId,
                  ...brandDnaData(brand, logoUrl),
                },
              })
            );
            manifest.brandDna.push({
              id: row.id,
              orgSlug: brand.orgSlug,
              organizationId: org.id,
              created: true,
              before: null,
              appliedUpdatedAt: row.updatedAt.toISOString(),
            });
          }
        }

        if (profile) {
          log(
            `= ${brand.orgSlug}: client profile already in place; not overwritten`
          );
          continue;
        }
        log(`+ create client profile for ${brand.orgSlug}`);
        if (write) {
          const row = await guarded(orgId, tx =>
            tx.clientProfile.create({
              data: { organizationId: orgId, ...clientProfileData(brand) },
            })
          );
          manifest.clientProfiles.push({
            id: row.id,
            orgSlug: brand.orgSlug,
            organizationId: org.id,
            created: true,
            before: null,
            appliedUpdatedAt: row.updatedAt.toISOString(),
          });
        }
      } catch (error) {
        if (!(error instanceof LeftWorkspaceError)) throw error;
        // Writes already made stay (they were made to a member); nothing
        // more is written for this brand, its slots included.
        log(
          `! ${brand.orgSlug}: left the workspace during apply; nothing more written`
        );
        refused.add(brand.orgSlug);
      }
    }

    const slots = buildPortfolioCalendar(
      PORTFOLIO_BRANDS,
      PORTFOLIO_WEEK_STARTS
    );
    log(
      `calendar: ${slots.length} slots over ${PORTFOLIO_WEEK_STARTS.length} weeks`
    );

    for (const slot of slots) {
      const brand = PORTFOLIO_BRANDS.find(b => b.orgSlug === slot.orgSlug)!;
      const organizationId = orgIds.get(slot.orgSlug);
      const data = {
        title: `${slot.kind === 'shortform_video' ? 'Short-form video' : 'Post'}: ${brand.label}, ${slot.theme}`,
        content: slotBrief(slot, brand),
        platforms: slot.platforms,
        scheduledFor: slot.scheduledFor,
        tags: [
          PORTFOLIO_CALENDAR_TAG,
          slot.kind === 'shortform_video' ? 'shortform-video' : 'channel-post',
          slot.orgSlug,
          'calendar-draft',
        ],
        metadata: json(slotMetadata(slot, brand)),
      };

      if (refused.has(slot.orgSlug)) {
        manifest.skippedSlots.push({
          slotKey: slot.slotKey,
          reason: 'brand skipped: org is not ours',
        });
        continue;
      }
      if (!organizationId) {
        log(`+ ${slot.slotKey}  ${slot.localTime}  [org created on apply]`);
        continue;
      }
      const findSlot = (db: Prisma.TransactionClient | typeof prisma) =>
        db.calendarPost.findFirst({
          where: {
            organizationId,
            metadata: { path: ['slotKey'], equals: slot.slotKey },
          },
        });
      const skip = (status: string) =>
        // Create-only: a slot that exists belongs to Phill or the engine now.
        manifest.skippedSlots.push({
          slotKey: slot.slotKey,
          reason: `exists (status ${status})`,
        });
      if (!write) {
        const existing = await findSlot(prisma);
        if (existing) skip(existing.status);
        else log(`+ ${slot.slotKey}  ${slot.localTime}`);
        continue;
      }
      // Check and create under a transaction-scoped lock on this slot, so two
      // applies running at once cannot both see the slot missing and create it
      // twice (CalendarPost has no unique slot key to lean on).
      const row = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${PORTFOLIO_CALENDAR_TAG}:${organizationId}:${slot.slotKey}`}))`;
        try {
          await lockWorkspaceMember(tx, organizationId, parent.id);
        } catch (error) {
          if (!(error instanceof LeftWorkspaceError)) throw error;
          manifest.skippedSlots.push({
            slotKey: slot.slotKey,
            reason: 'brand left the workspace',
          });
          return null;
        }
        const existing = await findSlot(tx);
        if (existing) {
          skip(existing.status);
          return null;
        }
        return tx.calendarPost.create({
          data: {
            ...data,
            status: 'draft',
            mediaUrls: [],
            hashtags: [],
            mentions: [],
            organizationId,
            userId: ownerUserId,
          },
        });
      });
      if (!row) continue;
      log(`+ ${slot.slotKey}  ${slot.localTime}`);
      manifest.calendarPosts.push({
        id: row.id,
        orgSlug: slot.orgSlug,
        slotKey: slot.slotKey,
        kind: slot.kind,
        scheduledFor: row.scheduledFor.toISOString(),
        appliedUpdatedAt: row.updatedAt.toISOString(),
      });
    }
  } catch (err) {
    (err as Error & { manifest?: PortfolioManifest }).manifest = manifest;
    throw err;
  }
  log(
    `done: posts written ${manifest.calendarPosts.length}, orgs created ${manifest.createdOrganizations.length}, skipped ${manifest.skippedSlots.length}`
  );
  return manifest;
}

/**
 * Reverse an apply manifest. Dry run unless write is true.
 *
 * Undo deletes only the draft posts apply created that nobody has touched
 * since: each delete carries its guard in the WHERE (still draft, no media,
 * portfolio tag and source, updatedAt unchanged since apply), so a post that
 * was edited, rescheduled or given a video, before or during undo, is kept.
 *
 * Everything else apply wrote is shared with whoever works on the brand next
 * (other posts, edits, people), so undo never deletes or restores it: brand
 * DNA, client profile, org logo and colour, owner access and organisations
 * are listed for a person to review instead.
 */
export async function undoPortfolioSetup(
  manifest: PortfolioManifest,
  write: boolean
): Promise<string[]> {
  const lines: string[] = [];
  const verb = write ? '' : 'would ';

  let deleted = 0;
  for (const post of manifest.calendarPosts) {
    // A manifest without the applied timestamp cannot prove the post is untouched.
    if (!post.appliedUpdatedAt) continue;
    const where: Prisma.CalendarPostWhereInput = {
      id: post.id,
      status: 'draft',
      mediaUrls: { isEmpty: true },
      tags: { has: PORTFOLIO_CALENDAR_TAG },
      metadata: { path: ['source'], equals: PORTFOLIO_SOURCE },
      updatedAt: new Date(post.appliedUpdatedAt),
    };
    deleted += write
      ? (await prisma.calendarPost.deleteMany({ where })).count
      : await prisma.calendarPost.count({ where });
  }
  lines.push(
    `- ${verb}delete ${deleted}/${manifest.calendarPosts.length} portfolio posts (untouched drafts with no video only; the rest are kept)`
  );

  for (const row of manifest.clientProfiles) {
    lines.push(
      `= client profile ${row.orgSlug} kept (undo never removes brand setup; edit it in Brand if unwanted)`
    );
  }
  for (const row of manifest.brandDna) {
    lines.push(
      `= brand DNA ${row.orgSlug} kept (undo never removes brand setup; edit it in Brand if unwanted)`
    );
  }
  for (const row of manifest.updatedOrganizations) {
    lines.push(
      `= org ${row.slug} logo and colour kept (before apply: ${row.before.logo ?? 'none'} / ${row.before.primaryColor ?? 'none'})`
    );
  }
  for (const row of [...manifest.businessOwnerships, ...manifest.teamMembers]) {
    lines.push(
      `= owner access ${row.id} on ${row.orgSlug} kept (undo never removes access; remove it in Team if unwanted)`
    );
  }
  for (const row of manifest.createdOrganizations) {
    lines.push(
      `= org ${row.slug} kept (undo never deletes an organisation; remove it in Businesses if unwanted)`
    );
  }
  return lines;
}

// Row identity: ids only, never text a prompt reads.
const ROW_KEYS = new Set(['id', 'organizationId', 'parentOrgId']);

/** JSON with object keys sorted, so a jsonb round trip compares equal. */
function canonical(value: unknown) {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0
          )
        )
      : v
  );
}

/**
 * Every field of a stored row except its ids, as one string: whatever column
 * a prompt reads is covered without naming it here. A field still exactly as
 * setup writes it (`seeded`) is skipped, since setup's own values are checked
 * in portfolio-plan.test.ts; so is the banned list, and the rule and
 * anti-pattern lists while they are exactly the approved ones (they name
 * banned words only to forbid them). Anything edited is scanned.
 */
function promptedText(
  row: Record<string, unknown> | null | undefined,
  brand: PortfolioBrandProfile,
  seeded: Record<string, unknown> = {}
) {
  if (!row) return '';
  const approved: Record<string, string> = {
    banned: canonical(brand.forbiddenWords),
    antiPatterns: canonical(brand.antiPatterns),
    brandRules: canonical(brand.brandRules),
  };
  const kept = Object.fromEntries(
    Object.entries(row).filter(
      ([k, v]) =>
        !ROW_KEYS.has(k) &&
        !(k in seeded && canonical(v) === canonical(seeded[k]))
    )
  );
  return JSON.stringify(kept, (k, v) =>
    (k === 'banned' && canonical(v) === approved.banned) ||
    (k in approved && k !== 'banned' && canonical(v) === approved[k])
      ? undefined
      : v
  );
}

export interface PortfolioCheck {
  label: string;
  pass: boolean;
}

/** Read-only. Every check must pass for the setup to count as in place. */
export async function verifyPortfolioSetup(): Promise<{
  ok: boolean;
  checks: PortfolioCheck[];
}> {
  const checks: PortfolioCheck[] = [];
  const check = (pass: boolean, label: string) => checks.push({ pass, label });

  const orgs = await prisma.organization.findMany({
    where: { slug: { in: PORTFOLIO_BRANDS.map(b => b.orgSlug) } },
    // Whole rows: a kept row is checked on every field a prompt can read.
    include: {
      brandDna: true,
      clientProfile: true,
      brandOperatingSystem: true,
    },
  });
  const bySlug = new Map(orgs.map(o => [o.slug, o]));

  for (const brand of PORTFOLIO_BRANDS) {
    const org = bySlug.get(brand.orgSlug);
    check(!!org, `${brand.orgSlug}: organisation exists`);
    if (!org) continue;
    const root = bySlug.get(PORTFOLIO_PARENT_SLUG);
    const member = !!root && inWorkspace(org, root);
    check(
      member,
      `${brand.orgSlug}: active and in the ${PORTFOLIO_PARENT_SLUG} workspace`
    );
    // Nothing else about an org outside the workspace is read into the
    // (public) result: its mode, DNA and profile are not ours to report.
    if (!member) continue;
    check(
      org.calendarMode === 'shadow' && org.liveModeT === 0,
      `${brand.orgSlug}: shadow mode, live tier 0`
    );
    check(
      org.brandDna?.primaryColour === brand.colours.primary,
      `${brand.orgSlug}: brand DNA with brand colour`
    );
    // A logo that cannot be confirmed as served fails; it never passes as empty.
    const served = await resolveLogoUrl(brand.logoUrl);
    check(
      served !== null && org.brandDna?.logoUrl === served,
      `${brand.orgSlug}: logo ${served ? 'is the approved logo' : `could not be confirmed as served (${brand.logoUrl})`}`
    );
    // Rows kept from before (seeding never overwrites one) are checked on
    // content, not on counts: every forbidden word held, and none of them in
    // any field of the org, brand DNA or client profile a prompt can read.
    const profile = org.clientProfile;
    const vocab = (profile?.vocabularyBank ?? null) as {
      banned?: string[];
      preferred?: string[];
    } | null;
    const held = new Set((vocab?.banned ?? []).map(w => w.toLowerCase()));
    check(
      !!profile && brand.forbiddenWords.every(w => held.has(w.toLowerCase())),
      `${brand.orgSlug}: client profile holds all ${brand.forbiddenWords.length} forbidden words`
    );
    const { brandDna, clientProfile, brandOperatingSystem } = org;
    // The prompt itself, rendered by the same composers the content
    // generator and workflow foundation use, so whatever field feeds a
    // prompt is checked as the model would see it.
    const rendered = [
      ...renderPromptLegs({
        bos: brandOperatingSystem,
        profile: clientProfile,
        dna: brandDna,
        org,
      }),
      ...foundationPromptText(org.settings),
    ].join('\n');
    // Plus the stored rows themselves, whole, for readers outside those
    // composers (brand profile, onboarding summary, website schema). The org
    // row holds billing and account data no prompt reads, so only its
    // description and AI-generated profile are added.
    const stored = [
      promptedText(
        { description: org.description, aiGeneratedData: org.aiGeneratedData },
        brand,
        { description: brand.description }
      ),
      promptedText(brandDna, brand, brandDnaData(brand, served)),
      promptedText(clientProfile, brand, clientProfileData(brand)),
      promptedText(brandOperatingSystem, brand),
    ].join(' ');
    check(
      !!profile &&
        !!org.brandDna &&
        promptHits(rendered, brand).length === 0 &&
        brandHits(stored, brand).length === 0,
      `${brand.orgSlug}: the prompt built from the organisation, brand DNA, Brand OS and client profile carries no forbidden words`
    );
  }

  // Only workspace members' rows count: a tagged row in any other org is
  // neither read nor reported, so it cannot fail (or pass) this check.
  const root = bySlug.get(PORTFOLIO_PARENT_SLUG);
  const members = root ? orgs.filter(o => inWorkspace(o, root)) : [];
  const posts = await prisma.calendarPost.findMany({
    where: {
      tags: { has: PORTFOLIO_CALENDAR_TAG },
      organizationId: { in: members.map(o => o.id) },
    },
    select: {
      status: true,
      organizationId: true,
      title: true,
      content: true,
      metadata: true,
      publishedAt: true,
      hashtags: true,
      mentions: true,
      scheduledFor: true,
      platforms: true,
    },
  });
  const slugOf = new Map(members.map(o => [o.id, o.slug]));
  const expected = buildPortfolioCalendar(
    PORTFOLIO_BRANDS,
    PORTFOLIO_WEEK_STARTS
  );
  const planBySlot = new Map(expected.map(s => [s.slotKey, s]));
  // A kept draft (create-only seeding never rewrites one) carries whatever
  // title, brief and metadata it was made with or was given since (a
  // delivered caption, edited rules), so it is scanned like the brand rows:
  // every metadata field still exactly as setup wrote it is skipped.
  for (const brand of PORTFOLIO_BRANDS) {
    const text = posts
      .filter(p => slugOf.get(p.organizationId) === brand.orgSlug)
      .map(p => {
        const { videoDelivery, ...meta } = (p.metadata ?? {}) as Record<
          string,
          unknown
        >;
        // A delivery's link and ids are machine-written; only its caption
        // is copy, so only the caption is scanned.
        const caption = (videoDelivery as { captionDraft?: unknown } | null)
          ?.captionDraft;
        const slot = planBySlot.get(String(meta.slotKey ?? ''));
        return [
          p.title ?? '',
          p.content ?? '',
          ...(p.hashtags ?? []),
          ...(p.mentions ?? []),
          typeof caption === 'string' ? caption : '',
          promptedText(meta, brand, slot ? slotMetadata(slot, brand) : {}),
        ].join(' ');
      })
      .join(' ');
    if (!text.trim()) continue;
    check(
      brandHits(text, brand).length === 0,
      `${brand.orgSlug}: calendar drafts carry no forbidden words`
    );
  }
  // slotKey -> every row found under it, so a slot filed under the wrong
  // brand, duplicated, or moved to another time or channel fails rather than
  // counting as present.
  const placed = new Map<string, typeof posts>();
  for (const p of posts) {
    const key = (p.metadata as { slotKey?: string } | null)?.slotKey;
    if (!key) continue;
    placed.set(key, [...(placed.get(key) ?? []), p]);
  }
  const misplaced = expected.filter(s => {
    const at = placed.get(s.slotKey);
    if (!at || at.length !== 1) return true;
    const [p] = at;
    return (
      slugOf.get(p.organizationId) !== s.orgSlug ||
      p.scheduledFor?.getTime() !== s.scheduledFor.getTime() ||
      canonical(p.platforms) !== canonical(s.platforms)
    );
  });
  // Counts only: this result is public, so no slot key or other id goes in it.
  check(
    misplaced.length === 0,
    `all ${expected.length} planned slots exist once, each under its own brand at its planned time and channels${misplaced.length ? ` (${misplaced.length} missing, misplaced or moved)` : ''}`
  );
  check(
    posts.length === expected.length,
    `no extra portfolio calendar rows (${posts.length} found)`
  );
  check(
    posts.every(p => p.status === 'draft' && !p.publishedAt),
    'every portfolio calendar row is draft and unpublished'
  );
  for (const week of PORTFOLIO_WEEK_STARTS) {
    const n = posts.filter(p => {
      const m = p.metadata as { weekStart?: string; slotKind?: string } | null;
      return m?.weekStart === week && m?.slotKind === 'shortform_video';
    }).length;
    check(
      n === PORTFOLIO_WEEKLY_VIDEO_TARGET,
      `week ${week}: ${n} short-form video slots`
    );
  }
  for (const brand of PORTFOLIO_BRANDS.filter(b => b.publicContentHeldReason)) {
    const n = posts.filter(
      p => slugOf.get(p.organizationId) === brand.orgSlug
    ).length;
    check(
      n === 0,
      `${brand.orgSlug}: no public content (${brand.publicContentHeldReason})`
    );
  }

  return { ok: checks.every(c => c.pass), checks };
}
