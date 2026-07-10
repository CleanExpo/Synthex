/**
 * Brand Preset — get / update / delete (SYN-40).
 *
 *   GET    /api/brand-presets/[id]  → get one (cross-org read = 404)
 *   PATCH  /api/brand-presets/[id]  → update fields (merged row re-validated)
 *   DELETE /api/brand-presets/[id]  → hard delete (204)
 *
 * Tenant isolation mirrors the sibling marketing-agency [id] routes: the row
 * is loaded with findFirst({ id, organizationId: clientId }) so another org's
 * preset id is indistinguishable from a missing one (404, never 403 — no
 * existence oracle).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';
import { validateBrandStyle } from '@/lib/marketing-agency/brand-style';

export const runtime = 'nodejs';

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  font: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
  ctaText: z.string().nullable().optional(),
});

async function loadPreset(presetId: string, organizationId: string) {
  return prisma.brandPreset.findFirst({
    where: { id: presetId, organizationId },
  });
}

export const GET = withAuth(async (request, { clientId }) => {
  const id = extractId(request);
  if (!id)
    return NextResponse.json({ error: 'Invalid preset id' }, { status: 400 });
  const preset = await loadPreset(id, clientId);
  if (!preset)
    return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
  return NextResponse.json({ preset });
});

export const PATCH = withAuth(async (request, { clientId }) => {
  const id = extractId(request);
  if (!id)
    return NextResponse.json({ error: 'Invalid preset id' }, { status: 400 });
  const existing = await loadPreset(id, clientId);
  if (!existing)
    return NextResponse.json({ error: 'Preset not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Re-validate the MERGED row so a partial patch can never corrupt a preset
  // (e.g. patching font alone must still respect the curated manifest).
  const merged = {
    name: parsed.data.name ?? existing.name,
    primaryColor: parsed.data.primaryColor ?? existing.primaryColor,
    secondaryColor:
      parsed.data.secondaryColor !== undefined
        ? parsed.data.secondaryColor
        : existing.secondaryColor,
    accentColor:
      parsed.data.accentColor !== undefined
        ? parsed.data.accentColor
        : existing.accentColor,
    font: parsed.data.font ?? existing.font,
    logoUrl:
      parsed.data.logoUrl !== undefined
        ? parsed.data.logoUrl
        : existing.logoUrl,
    ctaText:
      parsed.data.ctaText !== undefined
        ? parsed.data.ctaText
        : existing.ctaText,
  };
  const validated = validateBrandStyle(merged);
  if (!validated.ok) {
    return NextResponse.json(
      { error: 'Invalid brand style', issues: validated.issues },
      { status: 400 }
    );
  }

  try {
    const v = validated.value;
    const preset = await prisma.brandPreset.update({
      where: { id },
      data: {
        name: v.name ?? existing.name,
        primaryColor: v.primaryColor,
        secondaryColor: v.secondaryColor,
        accentColor: v.accentColor,
        font: v.font,
        logoUrl: v.logoUrl,
        ctaText: v.ctaText,
      },
    });
    return NextResponse.json({ preset });
  } catch (error) {
    logger.error('brand-presets: update failed', {
      presetId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to update preset' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (request, { clientId }) => {
  const id = extractId(request);
  if (!id)
    return NextResponse.json({ error: 'Invalid preset id' }, { status: 400 });
  const existing = await loadPreset(id, clientId);
  if (!existing)
    return NextResponse.json({ error: 'Preset not found' }, { status: 404 });

  try {
    await prisma.brandPreset.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('brand-presets: delete failed', {
      presetId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to delete preset' },
      { status: 500 }
    );
  }
});

function extractId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  // /api/brand-presets/[id]
  const idx = segments.indexOf('brand-presets');
  if (idx === -1) return null;
  const id = segments[idx + 1];
  return id || null;
}
