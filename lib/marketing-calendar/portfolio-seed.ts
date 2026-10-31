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
  type PortfolioBrandProfile,
} from './portfolio-brands';
import { resolveLogoUrl } from './resolve-logo';

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

  try {
    const parent = await prisma.organization.findUnique({
      where: { slug: PORTFOLIO_PARENT_SLUG },
    });
    if (!parent)
      throw new Error(`Parent org ${PORTFOLIO_PARENT_SLUG} not found`);

    // Everyone who owns the parent workspace gets the same access to new brands.
    const parentOwners = await prisma.teamMember.findMany({
      where: { organizationId: parent.id, role: 'owner' },
      select: { userId: true },
    });
    const orgIds = new Map<string, string | null>();

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
      // Brand setup is create-only, record by record: brand DNA and client
      // profile are each created only when missing and never overwritten, and
      // the org logo and colour are set only on a brand with neither yet, so a
      // repeat apply never replaces anyone's edits.
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
      const freshBrand = !dna && !profile;
      if (!org) {
        log(
          `+ create org ${brand.orgSlug} (child of ${PORTFOLIO_PARENT_SLUG})`
        );
        if (write) {
          org = await prisma.organization.create({
            data: {
              name: brand.name,
              slug: brand.orgSlug,
              description: brand.description,
              website: brand.website,
              industry: brand.industry,
              plan: 'enterprise',
              parentOrgId: parent.id,
              logo: logoUrl,
              primaryColor: brand.colours.primary,
            },
          });
          manifest.createdOrganizations.push({ id: org.id, slug: org.slug });
        }
      } else if (freshBrand) {
        const changes: { logo?: string; primaryColor?: string } = {};
        if (logoUrl && org.logo !== logoUrl) changes.logo = logoUrl;
        if (org.primaryColor !== brand.colours.primary)
          changes.primaryColor = brand.colours.primary;
        if (Object.keys(changes).length > 0) {
          log(
            `~ update org ${brand.orgSlug}: ${Object.keys(changes).join(', ')}`
          );
          if (write) {
            const after = await prisma.organization.update({
              where: { id: org.id },
              data: changes,
            });
            manifest.updatedOrganizations.push({
              id: org.id,
              slug: org.slug,
              before: { logo: org.logo, primaryColor: org.primaryColor },
              after: { logo: after.logo, primaryColor: after.primaryColor },
            });
          }
        }
      }
      orgIds.set(brand.orgSlug, org?.id ?? null);
      if (!org) continue;

      for (const { userId } of parentOwners) {
        const member = await prisma.teamMember.findFirst({
          where: { organizationId: org.id, userId },
        });
        if (!member) {
          log(`+ team owner ${userId} on ${brand.orgSlug}`);
          if (write) {
            const row = await prisma.teamMember.create({
              data: { organizationId: org.id, userId, role: 'owner' },
            });
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
            ownerId_organizationId: { ownerId: userId, organizationId: org.id },
          },
        });
        if (!ownership) {
          log(`+ business ownership ${userId} on ${brand.orgSlug}`);
          if (write) {
            const row = await prisma.businessOwnership.create({
              data: {
                ownerId: userId,
                organizationId: org.id,
                displayName: brand.name,
                isActive: true,
                billingStatus: 'active',
                monthlyRate: 0, // internal portfolio, no billing
              },
            });
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
        log(`= ${brand.orgSlug}: brand DNA already in place; not overwritten`);
      } else {
        log(`+ create brand DNA for ${brand.orgSlug}`);
        if (write) {
          const row = await prisma.brandDNA.create({
            data: { organizationId: org.id, ...brandDnaData(brand, logoUrl) },
          });
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
        const row = await prisma.clientProfile.create({
          data: { organizationId: org.id, ...clientProfileData(brand) },
        });
        manifest.clientProfiles.push({
          id: row.id,
          orgSlug: brand.orgSlug,
          organizationId: org.id,
          created: true,
          before: null,
          appliedUpdatedAt: row.updatedAt.toISOString(),
        });
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
        metadata: json({
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
            slot.kind === 'shortform_video'
              ? { status: 'awaiting_video' }
              : null,
          brandRules: brand.brandRules,
        }),
      };

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
    select: {
      id: true,
      slug: true,
      calendarMode: true,
      liveModeT: true,
      brandDna: { select: { logoUrl: true, primaryColour: true } },
      clientProfile: { select: { vocabularyBank: true } },
    },
  });
  const bySlug = new Map(orgs.map(o => [o.slug, o]));

  for (const brand of PORTFOLIO_BRANDS) {
    const org = bySlug.get(brand.orgSlug);
    check(!!org, `${brand.orgSlug}: organisation exists`);
    if (!org) continue;
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
    const banned =
      (org.clientProfile?.vocabularyBank as { banned?: string[] } | null)
        ?.banned ?? [];
    check(
      banned.length === brand.forbiddenWords.length,
      `${brand.orgSlug}: client profile holds ${brand.forbiddenWords.length} forbidden words`
    );
  }

  const posts = await prisma.calendarPost.findMany({
    where: { tags: { has: PORTFOLIO_CALENDAR_TAG } },
    select: {
      status: true,
      organizationId: true,
      metadata: true,
      publishedAt: true,
    },
  });
  const slugOf = new Map(orgs.map(o => [o.id, o.slug]));
  const expected = buildPortfolioCalendar(
    PORTFOLIO_BRANDS,
    PORTFOLIO_WEEK_STARTS
  );
  // slotKey -> every brand it was found under, so a slot filed under the
  // wrong brand (or duplicated) fails rather than counting as present.
  const placed = new Map<string, string[]>();
  for (const p of posts) {
    const key = (p.metadata as { slotKey?: string } | null)?.slotKey;
    if (!key) continue;
    placed.set(key, [
      ...(placed.get(key) ?? []),
      slugOf.get(p.organizationId) ?? '?',
    ]);
  }
  const misplaced = expected.filter(s => {
    const at = placed.get(s.slotKey);
    return !at || at.length !== 1 || at[0] !== s.orgSlug;
  });
  check(
    misplaced.length === 0,
    `all ${expected.length} planned slots exist once, each under its own brand${misplaced.length ? ` (${misplaced.length} missing or misplaced, e.g. ${misplaced[0].slotKey})` : ''}`
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
