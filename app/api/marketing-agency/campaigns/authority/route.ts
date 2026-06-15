/**
 * Authority Campaign — generate + persist (real, org-scoped).
 *
 *   POST /api/marketing-agency/campaigns/authority
 *
 * Wires the deterministic `generateFullAuthorityCampaign()` into the product:
 * validates a campaign brief, derives the business block from the caller's
 * Organisation (+ BrandDNA), runs the pure generator, and persists a real
 * `MarketingAgencyCampaign` (providerMode `'live'`) with its source refs —
 * returning the DB id, NOT the mock fixture served by `../route.ts` (which
 * stays mock per spec.md §13).
 *
 * Child spec: spec-authority-campaign-002.md (master spec §8 #2).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { defineRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';
import {
  generateFullAuthorityCampaign,
  type AuthorityCampaignBusinessInput,
  type AuthorityCampaignSourceInput,
} from '@/lib/marketing-agency/full-campaign-generator';

export const runtime = 'nodejs';

const sourceSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().min(1).max(300),
  sourceType: z.string().min(1).max(80),
  url: z.string().url().optional(),
  path: z.string().min(1).max(500).optional(),
  checkedAt: z.string().min(1).optional(),
});

const businessOverrideSchema = z
  .object({
    positioning: z.string().max(2000).optional(),
    audience: z.array(z.string().max(300)).max(50).optional(),
    offers: z.array(z.string().max(300)).max(50).optional(),
    voiceRules: z.array(z.string().max(300)).max(50).optional(),
    forbiddenClaims: z.array(z.string().max(500)).max(50).optional(),
  })
  .optional();

const createSchema = z.object({
  name: z.string().min(1).max(120),
  objective: z.string().min(3).max(2000),
  operatingMandate: z.string().min(3).max(4000),
  sources: z.array(sourceSchema).min(1).max(40),
  channels: z
    .array(
      z.enum([
        'blog',
        'newsletter',
        'linkedin',
        'facebook',
        'instagram',
        'youtube_shorts',
        'reddit',
      ])
    )
    .min(1)
    .max(7)
    .optional(),
  horizonDays: z.coerce.number().int().min(1).max(90).optional(),
  productName: z.string().min(1).max(160).optional(),
  primaryOffer: z.string().min(1).max(300).optional(),
  business: businessOverrideSchema,
});

// Defensive read of a loose BrandDNA `Json` column into a string[] — the columns
// default to `{}` / `[]` and carry no schema-level shape, so never assume.
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'authority'
  );
}

interface OrgForBusiness {
  name: string;
  slug: string;
  website: string | null;
  description: string | null;
  brandDna: {
    brandVoice: unknown;
    persona: unknown;
    offerings: unknown;
  } | null;
}

// Build the generator's business block from the org (authoritative for
// name/slug/site), best-effort from BrandDNA, with the request body able to
// override any field.
function deriveBusiness(
  org: OrgForBusiness,
  override: z.infer<typeof businessOverrideSchema>
): AuthorityCampaignBusinessInput {
  const voice = (org.brandDna?.brandVoice ?? {}) as Record<string, unknown>;
  const persona = (org.brandDna?.persona ?? {}) as Record<string, unknown>;

  const brandVoiceRules = [
    typeof voice.tone === 'string' ? voice.tone : null,
    ...asStringArray(voice.samplePhrases),
  ].filter((v): v is string => Boolean(v));

  return {
    slug: org.slug,
    name: org.name,
    websiteUrl: org.website ?? undefined,
    positioning:
      override?.positioning ??
      (typeof persona.description === 'string'
        ? persona.description
        : null) ??
      org.description ??
      `${org.name} — authority campaign`,
    audience: override?.audience ?? asStringArray(persona.values),
    offers: override?.offers ?? asStringArray(org.brandDna?.offerings),
    voiceRules: override?.voiceRules ?? brandVoiceRules,
    forbiddenClaims: override?.forbiddenClaims ?? [],
  };
}

export const POST = defineRoute(
  {
    body: createSchema,
    serverErrorMessage: 'Failed to generate authority campaign',
    onError: (error) =>
      logger.error('marketing-agency: authority campaign generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
  },
  async ({ body }, { userId, clientId }) => {
    const org = (await prisma.organization.findUnique({
      where: { id: clientId },
      select: {
        name: true,
        slug: true,
        website: true,
        description: true,
        brandDna: {
          select: { brandVoice: true, persona: true, offerings: true },
        },
      },
    })) as OrgForBusiness | null;

    if (!org) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 404 }
      );
    }

    const generatedAt = new Date().toISOString();
    const campaignId = randomUUID();
    const business = deriveBusiness(org, body.business);

    const sources: AuthorityCampaignSourceInput[] = body.sources.map(
      (s, i) => ({
        id: s.id ?? `src-${i + 1}`,
        label: s.label,
        sourceType: s.sourceType,
        url: s.url,
        path: s.path,
        checkedAt: s.checkedAt ?? generatedAt,
      })
    );

    const pack = generateFullAuthorityCampaign({
      campaignId,
      generatedAt,
      business,
      objective: body.objective,
      operatingMandate: body.operatingMandate,
      sources,
      channels: body.channels,
      horizonDays: body.horizonDays,
    });

    const campaign = await prisma.marketingAgencyCampaign.create({
      data: {
        organizationId: clientId,
        createdById: userId,
        name: body.name,
        slug: `${slugify(body.name)}-${campaignId.slice(0, 8)}`,
        providerMode: 'live',
        productName: body.productName ?? org.name,
        primaryOffer:
          body.primaryOffer ?? business.offers[0] ?? body.objective.slice(0, 280),
        metadata: pack as unknown as Prisma.InputJsonValue,
        sourceRefs: {
          create: sources.map((s) => ({
            organizationId: clientId,
            createdById: userId,
            label: s.label,
            url: s.url ?? null,
            path: s.path ?? null,
            sourceType: s.sourceType,
          })),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ id: campaign.id, pack }, { status: 201 });
  }
);
