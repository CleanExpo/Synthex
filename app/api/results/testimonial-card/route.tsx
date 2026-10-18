/**
 * GET /api/results/testimonial-card
 *
 * Generates a 1080×1080px PNG testimonial card using Next.js ImageResponse (next/og).
 * Client controls what they share — no public URL, no business-identifying path.
 *
 * Query params:
 *   quarter (optional) — e.g. "Q1 2026" (display-only; not a tenant key)
 *
 * Card content:
 *   - Business name (from the authenticated user's organisation)
 *   - Headline metric (highest-impact: GEO delta → attribution → Synthex IQ)
 *   - "Powered by Synthex" watermark
 *
 * SECURITY (2026-05-16, service-role-leak triage refactor 4/N — final
 * CRITICAL fix):
 *   Previously accepted `?client_id=<uuid>` UNAUTHENTICATED and passed it
 *   straight into `.eq('id', x)` over a service-role Supabase client. That
 *   bypassed RLS and let any requester fetch any tenant's organisation
 *   name + GEO trend + brand accent colour by guessing UUIDs.
 *
 *   The route now:
 *   1. Requires an authenticated session (cookie or Authorization header).
 *   2. Derives `organizationId` from the authenticated user via Prisma.
 *      The `client_id` query param is ignored.
 *   3. Returns 401 if no session, 403 if no org membership.
 *
 *   Runtime switched from `edge` → `nodejs` because Prisma is not edge-
 *   compatible. ImageResponse from next/og is supported on both runtimes.
 *
 *   The organisation name is read via Prisma, scoped to that organizationId.
 *
 *   NOT PROVISIONED: the GEO-delta headline (client_geo_scores) and brand
 *   accent colour (brand_profiles) have no tables in prisma/schema.prisma.
 *   The card renders the milestone headline and default accent, and says
 *   so in the `X-Synthex-Unavailable` response header.
 *
 * SYN-662 (initial); service-role leak fix 4/N (auth gate added).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const runtime = 'nodejs';

/** Card inputs whose tables are not provisioned in prisma/schema.prisma. */
const UNAVAILABLE_SOURCES = ['client_geo_scores', 'brand_profiles'];

// ── Card data ─────────────────────────────────────────────────────────────────

interface CardData {
  businessName: string;
  headline: string;
  subtext: string;
  accentColour: string;
}

async function buildCardData(
  organizationId: string,
  quarterLabel: string
): Promise<CardData | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  // No organisation row: there is nothing true to put on the card.
  if (!org?.name) return null;

  return {
    businessName: org.name,
    headline: quarterLabel
      ? `${quarterLabel} Milestone`
      : 'Quarterly Milestone',
    subtext: 'Powered by Synthex',
    accentColour: '#0f172a',
  };
}

// ── Auth gate ─────────────────────────────────────────────────────────────────

/**
 * Resolve the authenticated user's tenant.
 *
 * Returns `{ clientId }` on success or a `NextResponse` error (401/403) the
 * caller must return as-is.
 */
async function resolveTenant(
  req: NextRequest
): Promise<{ clientId: string } | NextResponse> {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );
  }
  return { clientId: user.organizationId };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  const tenant = await resolveTenant(req);
  if (tenant instanceof NextResponse) return tenant;

  const { searchParams } = new URL(req.url);
  const quarterLabel = searchParams.get('quarter') ?? '';

  let cardData: CardData | null;
  try {
    // SECURITY: organizationId comes from resolveTenant() — never from the
    // query string. Any `?client_id=` param is deliberately ignored.
    cardData = await buildCardData(tenant.clientId, quarterLabel);
  } catch {
    // A failed read must not look like a card: never issue placeholder data.
    return NextResponse.json(
      { error: 'Organisation data could not be read' },
      { status: 503 }
    );
  }
  if (!cardData) {
    return NextResponse.json(
      { error: 'Organisation not found' },
      { status: 404 }
    );
  }

  // 1080×1080 square card — works for Instagram, WhatsApp, download
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        background: '#ffffff',
        padding: '80px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          display: 'flex',
          width: '80px',
          height: '6px',
          background: cardData.accentColour,
          borderRadius: '3px',
        }}
      />

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#64748b',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {cardData.businessName}
        </div>
        <div
          style={{
            fontSize: '56px',
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.1,
            letterSpacing: '-2px',
          }}
        >
          {cardData.headline}
        </div>
        {cardData.subtext && (
          <div style={{ fontSize: '24px', fontWeight: 500, color: '#64748b' }}>
            {cardData.subtext}
          </div>
        )}
      </div>

      {/* Powered by Synthex watermark */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          opacity: 0.7,
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#94a3b8',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Powered by Synthex
        </div>
      </div>
    </div>,
    {
      width: 1080,
      height: 1080,
      headers: {
        'X-Synthex-Unavailable': UNAVAILABLE_SOURCES.join(','),
        'Content-Disposition': `attachment; filename="synthex-result-${quarterLabel.replace(/\s+/g, '-').toLowerCase() || 'card'}.png"`,
      },
    }
  );
}
