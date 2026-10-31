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
 *     written as 'draft'. Slots are keyed by metadata.slotKey (idempotent); a
 *     slot moved past draft, edited, or holding media is left alone.
 *   - Every write is recorded in the returned manifest (ids plus prior values)
 *     so undo can reverse it.
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
    before: Record<string, unknown>;
  }>;
  teamMembers: Array<{ id: string; orgSlug: string; userId: string }>;
  businessOwnerships: Array<{ id: string; orgSlug: string; userId: string }>;
  brandDna: Array<{
    id: string;
    orgSlug: string;
    created: boolean;
    before: unknown;
  }>;
  clientProfiles: Array<{
    id: string;
    orgSlug: string;
    created: boolean;
    before: unknown;
  }>;
  calendarPosts: Array<{
    id: string;
    orgSlug: string;
    slotKey: string;
    kind: string;
    scheduledFor: string;
    created: boolean;
    before: unknown;
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
    logoUrl,
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
      } else {
        const changes: { logo?: string; primaryColor?: string } = {};
        if (logoUrl && org.logo !== logoUrl) changes.logo = logoUrl;
        if (org.primaryColor !== brand.colours.primary)
          changes.primaryColor = brand.colours.primary;
        if (Object.keys(changes).length > 0) {
          log(
            `~ update org ${brand.orgSlug}: ${Object.keys(changes).join(', ')}`
          );
          if (write) {
            await prisma.organization.update({
              where: { id: org.id },
              data: changes,
            });
            manifest.updatedOrganizations.push({
              id: org.id,
              slug: org.slug,
              before: { logo: org.logo, primaryColor: org.primaryColor },
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
              userId,
            });
          }
        }
      }

      const dna = await prisma.brandDNA.findUnique({
        where: { organizationId: org.id },
      });
      log(`${dna ? '~ update' : '+ create'} brand DNA for ${brand.orgSlug}`);
      if (write) {
        const row = await prisma.brandDNA.upsert({
          where: { organizationId: org.id },
          create: { organizationId: org.id, ...brandDnaData(brand, logoUrl) },
          update: brandDnaData(brand, logoUrl),
        });
        manifest.brandDna.push({
          id: row.id,
          orgSlug: brand.orgSlug,
          created: !dna,
          before: dna,
        });
      }

      const profile = await prisma.clientProfile.findUnique({
        where: { organizationId: org.id },
      });
      log(
        `${profile ? '~ update' : '+ create'} client profile for ${brand.orgSlug}`
      );
      if (write) {
        const row = await prisma.clientProfile.upsert({
          where: { organizationId: org.id },
          create: { organizationId: org.id, ...clientProfileData(brand) },
          update: clientProfileData(brand),
        });
        manifest.clientProfiles.push({
          id: row.id,
          orgSlug: brand.orgSlug,
          created: !profile,
          before: profile,
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
      const existing = await prisma.calendarPost.findFirst({
        where: {
          organizationId,
          metadata: { path: ['slotKey'], equals: slot.slotKey },
        },
      });
      if (existing && existing.status !== 'draft') {
        manifest.skippedSlots.push({
          slotKey: slot.slotKey,
          reason: `status is ${existing.status}`,
        });
        log(`= ${slot.slotKey} left alone (status ${existing.status})`);
        continue;
      }
      if (existing && existing.mediaUrls.length > 0) {
        manifest.skippedSlots.push({
          slotKey: slot.slotKey,
          reason: 'has media',
        });
        log(`= ${slot.slotKey} kept (has media)`);
        continue;
      }
      if (
        existing &&
        existing.content === data.content &&
        existing.scheduledFor.getTime() === slot.scheduledFor.getTime()
      ) {
        continue; // already current
      }
      log(`${existing ? '~' : '+'} ${slot.slotKey}  ${slot.localTime}`);
      if (!write) continue;
      const row = existing
        ? await prisma.calendarPost.update({ where: { id: existing.id }, data })
        : await prisma.calendarPost.create({
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
      manifest.calendarPosts.push({
        id: row.id,
        orgSlug: slot.orgSlug,
        slotKey: slot.slotKey,
        kind: slot.kind,
        scheduledFor: row.scheduledFor.toISOString(),
        created: !existing,
        before: existing
          ? {
              title: existing.title,
              content: existing.content,
              scheduledFor: existing.scheduledFor,
            }
          : null,
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

function withoutKeys(value: unknown, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...(value as Record<string, unknown>),
  };
  for (const key of keys) delete out[key];
  return out;
}

/** Reverse an apply manifest. Dry run unless write is true. */
export async function undoPortfolioSetup(
  manifest: PortfolioManifest,
  write: boolean
): Promise<string[]> {
  const lines: string[] = [];
  const createdPosts = manifest.calendarPosts
    .filter(p => p.created)
    .map(p => p.id);
  const stillDraft = await prisma.calendarPost.findMany({
    where: { id: { in: createdPosts }, status: 'draft' },
    select: { id: true },
  });
  lines.push(
    `- delete ${stillDraft.length}/${createdPosts.length} created calendar posts still in draft`
  );
  if (write)
    await prisma.calendarPost.deleteMany({
      where: { id: { in: stillDraft.map(p => p.id) } },
    });

  const fixed = ['id', 'organizationId', 'createdAt', 'updatedAt'];
  for (const row of manifest.clientProfiles) {
    lines.push(
      `${row.created ? '- delete' : '~ restore'} client profile ${row.orgSlug}`
    );
    if (!write) continue;
    if (row.created)
      await prisma.clientProfile.delete({ where: { id: row.id } });
    else if (row.before)
      await prisma.clientProfile.update({
        where: { id: row.id },
        data: withoutKeys(row.before, fixed) as Prisma.ClientProfileUpdateInput,
      });
  }
  for (const row of manifest.brandDna) {
    lines.push(
      `${row.created ? '- delete' : '~ restore'} brand DNA ${row.orgSlug}`
    );
    if (!write) continue;
    if (row.created) await prisma.brandDNA.delete({ where: { id: row.id } });
    else if (row.before)
      await prisma.brandDNA.update({
        where: { id: row.id },
        data: withoutKeys(row.before, fixed) as Prisma.BrandDNAUpdateInput,
      });
  }
  for (const row of manifest.updatedOrganizations) {
    lines.push(`~ restore org ${row.slug}`);
    if (write)
      await prisma.organization.update({
        where: { id: row.id },
        data: row.before,
      });
  }
  for (const row of manifest.businessOwnerships) {
    lines.push(`- delete business ownership on ${row.orgSlug}`);
    if (write) await prisma.businessOwnership.delete({ where: { id: row.id } });
  }
  for (const row of manifest.teamMembers) {
    lines.push(`- delete team member on ${row.orgSlug}`);
    if (write) await prisma.teamMember.delete({ where: { id: row.id } });
  }
  for (const row of manifest.createdOrganizations) {
    lines.push(`- delete org ${row.slug}`);
    if (write) await prisma.organization.delete({ where: { id: row.id } });
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
    const served = await resolveLogoUrl(brand.logoUrl);
    check(
      (org.brandDna?.logoUrl ?? null) === served,
      `${brand.orgSlug}: logo ${served ? 'is the approved logo' : 'empty until the approved logo is served'}`
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
  const keys = new Set(
    posts.map(p => (p.metadata as { slotKey?: string } | null)?.slotKey)
  );

  check(
    expected.every(s => keys.has(s.slotKey)),
    `all ${expected.length} planned slots exist`
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
