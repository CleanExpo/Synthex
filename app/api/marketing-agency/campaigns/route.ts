/**
 * Marketing-agency authority-campaign route.
 *
 * Wires the real (previously unwired) generateFullAuthorityCampaign generator into
 * a POST endpoint and persists the result to the existing Campaign model
 * (content Json). Replaces the prior mock-only handler. Uses existing infra only:
 * Supabase JWT auth, org scoping, Prisma, and the in-repo generator.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { prisma } from '@/lib/prisma';
import {
  generateFullAuthorityCampaign,
  type AuthorityCampaignInput,
} from '@/lib/marketing-agency/full-campaign-generator';

const CHANNELS = [
  'blog',
  'newsletter',
  'linkedin',
  'facebook',
  'instagram',
  'youtube_shorts',
  'reddit',
] as const;

const BusinessSchema = z.object({
  slug: z.string().default(''),
  name: z.string().min(1),
  websiteUrl: z.string().url().optional(),
  positioning: z.string().default(''),
  audience: z.array(z.string()).default([]),
  offers: z.array(z.string()).default([]),
  voiceRules: z.array(z.string()).default([]),
  forbiddenClaims: z.array(z.string()).default([]),
});

const SourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string().optional(),
  path: z.string().optional(),
  sourceType: z.string(),
  role: z.string().optional(),
  checkedAt: z.string(),
});

const InputSchema = z.object({
  campaignId: z.string().min(1),
  generatedAt: z.string().optional(),
  business: BusinessSchema,
  objective: z.string().min(1),
  operatingMandate: z.string().min(1),
  sources: z.array(SourceSchema).default([]),
  channels: z.array(z.enum(CHANNELS)).optional(),
  horizonDays: z.number().int().positive().max(90).optional(),
  coreEvidenceRefs: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = {
    ...parsed.data,
    generatedAt: parsed.data.generatedAt ?? new Date().toISOString(),
  } as AuthorityCampaignInput;

  const campaignPack = generateFullAuthorityCampaign(input);

  const organizationId = await getEffectiveOrganizationId(userId);

  const campaign = await prisma.campaign.create({
    data: {
      name: `${input.business.name} — Authority Campaign`,
      description: input.objective,
      platform: 'multi',
      status: 'draft',
      content: JSON.parse(JSON.stringify(campaignPack)),
      userId,
      organizationId: organizationId ?? null,
    },
  });

  return NextResponse.json(
    { ok: true, campaignId: campaign.id, campaignPack },
    { status: 201 }
  );
}
