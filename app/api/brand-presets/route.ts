/**
 * Brand Presets — list / create (SYN-40).
 *
 *   GET  /api/brand-presets  → tenant-filtered list. On an org's FIRST read
 *                              (no rows), seeds one default preset from the
 *                              org's BrandDNA (deterministic fallbacks when
 *                              DNA is missing/partial) and returns it.
 *   POST /api/brand-presets  → create, domain-validated by validateBrandStyle
 *                              (strict hex, enum-only font, CTA length cap,
 *                              https/origin-allowlisted logo URL).
 *
 * Auth mirrors the sibling marketing-agency routes: withAuth() resolves
 * { userId, clientId } and every query is filtered by
 * organizationId = clientId. Presets feed the BrandOverlaySpec consumed by
 * the Remotion render step — nothing here touches prompt text, generation,
 * publishing, or spend.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';
import {
  seedBrandPresetFromDna,
  validateBrandStyle,
} from '@/lib/marketing-agency/brand-style';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(80),
  primaryColor: z.string(),
  secondaryColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  font: z.string(),
  logoUrl: z.string().nullable().optional(),
  ctaText: z.string().nullable().optional(),
});

export const GET = withAuth(async (_request, { clientId }) => {
  try {
    const presets = await prisma.brandPreset.findMany({
      where: { organizationId: clientId },
      orderBy: { createdAt: 'asc' },
    });
    if (presets.length > 0) {
      return NextResponse.json({ presets, seeded: false });
    }

    // First read for this org — seed the default preset from BrandDNA.
    const dna = await prisma.brandDNA.findUnique({
      where: { organizationId: clientId },
      select: {
        businessName: true,
        primaryColour: true,
        secondaryColour: true,
        neutralColour: true,
        logoUrl: true,
      },
    });
    const seed = seedBrandPresetFromDna(dna);
    const created = await prisma.brandPreset.create({
      data: { organizationId: clientId, ...seed },
    });
    return NextResponse.json({ presets: [created], seeded: true });
  } catch (error) {
    logger.error('GET /api/brand-presets failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to load brand presets' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request, { clientId }) => {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const validated = validateBrandStyle(parsed.data);
  if (!validated.ok) {
    return NextResponse.json(
      { error: 'Invalid brand style', issues: validated.issues },
      { status: 400 }
    );
  }

  try {
    const v = validated.value;
    const preset = await prisma.brandPreset.create({
      data: {
        organizationId: clientId,
        name: v.name ?? parsed.data.name,
        primaryColor: v.primaryColor,
        secondaryColor: v.secondaryColor,
        accentColor: v.accentColor,
        font: v.font,
        logoUrl: v.logoUrl,
        ctaText: v.ctaText,
      },
    });
    return NextResponse.json({ preset }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/brand-presets failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to create brand preset' },
      { status: 500 }
    );
  }
});
