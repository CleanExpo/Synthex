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
 *   The service-role Supabase client is retained for the actual DB reads
 *   (organizations / client_geo_scores / brand_profiles) — the tenant
 *   boundary now sits at the auth check, not at the DB client choice.
 *
 * SYN-662 (initial); service-role leak fix 4/N (auth gate added).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse }     from 'next/og';
import { createClient }      from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const runtime = 'nodejs';

// ── Supabase admin for data fetching ─────────────────────────────────────────

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ── Card data ─────────────────────────────────────────────────────────────────

interface CardData {
  businessName:  string;
  headline:      string;
  subtext:       string;
  accentColour:  string;
}

async function buildCardData(organizationId: string, quarterLabel: string): Promise<CardData> {
  const admin = getAdmin() as ReturnType<typeof createClient<any>>;

  // Business name from org table (via a simple query)
  const { data: orgData } = await admin
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single();

  const businessName = (orgData as { name?: string } | null)?.name ?? 'Your Business';

  // Headline metric strategy: GEO delta → attribution → Synthex IQ
  let headline = '';
  let subtext  = '';

  // Try GEO delta (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: geoScores } = await admin
    .from('client_geo_scores')
    .select('overall_score, scored_at')
    .eq('organization_id', organizationId)
    .order('scored_at', { ascending: false })
    .limit(20);

  if (geoScores && geoScores.length >= 4) {
    const scores = geoScores as { overall_score: number; scored_at: string }[];
    const currentScore = scores[0].overall_score;
    const oldest90     = scores.filter(s => s.scored_at < ninetyDaysAgo).at(-1);
    const delta        = oldest90 ? Math.round(currentScore - oldest90.overall_score) : null;

    if (delta !== null && delta >= 20) {
      headline = `Google visibility: ${delta > 0 ? '+' : ''}${delta} pts in 90 days`;
      subtext  = 'Local search improvement';
    }
  }

  // Brand accent colour
  const { data: brandData } = await admin
    .from('brand_profiles')
    .select('accent_color')
    .eq('organization_id', organizationId)
    .single();

  const accentColour = (brandData as { accent_color?: string } | null)?.accent_color ?? '#0f172a';

  // Fallback: Synthex IQ (posts × 2 as simple estimate)
  if (!headline) {
    headline = quarterLabel ? `${quarterLabel} Milestone` : 'Quarterly Milestone';
    subtext  = 'Powered by Synthex';
  }

  return { businessName, headline, subtext, accentColour };
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

  let cardData: CardData;
  try {
    // SECURITY: organizationId comes from resolveTenant() — never from the
    // query string. Any `?client_id=` param is deliberately ignored.
    cardData = await buildCardData(tenant.clientId, quarterLabel);
  } catch {
    cardData = {
      businessName: 'Your Business',
      headline:     'Quarterly Milestone',
      subtext:      'Powered by Synthex',
      accentColour: '#0f172a',
    };
  }

  // 1080×1080 square card — works for Instagram, WhatsApp, download
  return new ImageResponse(
    (
      <div
        style={{
          display:         'flex',
          flexDirection:   'column',
          justifyContent:  'space-between',
          width:           '100%',
          height:          '100%',
          background:      '#ffffff',
          padding:         '80px',
          fontFamily:      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Top accent bar */}
        <div style={{ display: 'flex', width: '80px', height: '6px', background: cardData.accentColour, borderRadius: '3px' }} />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '28px', fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {cardData.businessName}
          </div>
          <div style={{ fontSize: '56px', fontWeight: 800, color: '#0f172a', lineHeight: 1.1, letterSpacing: '-2px' }}>
            {cardData.headline}
          </div>
          {cardData.subtext && (
            <div style={{ fontSize: '24px', fontWeight: 500, color: '#64748b' }}>
              {cardData.subtext}
            </div>
          )}
        </div>

        {/* Powered by Synthex watermark */}
        <div style={{
          display:        'flex',
          justifyContent: 'flex-end',
          alignItems:     'center',
          opacity:        0.7,
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Powered by Synthex
          </div>
        </div>
      </div>
    ),
    {
      width:  1080,
      height: 1080,
      headers: {
        'Content-Disposition': `attachment; filename="synthex-result-${quarterLabel.replace(/\s+/g, '-').toLowerCase() || 'card'}.png"`,
      },
    }
  );
}
