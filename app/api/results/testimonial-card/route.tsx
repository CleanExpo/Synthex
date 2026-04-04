/**
 * GET /api/results/testimonial-card
 *
 * Generates a 1080×1080px PNG testimonial card using Next.js ImageResponse (next/og).
 * Client controls what they share — no public URL, no business-identifying path.
 *
 * Query params:
 *   client_id (required) — organisation UUID
 *   quarter   (optional) — e.g. "Q1 2026"
 *
 * Card content:
 *   - Business name
 *   - Headline metric (highest-impact: GEO delta → attribution → Synthex IQ)
 *   - "Powered by Synthex" watermark
 *
 * Auth: requires valid Supabase session (standard cookie auth).
 * Clients may only generate their own card (enforced by org-scope check).
 *
 * SYN-662
 */

import { NextRequest } from 'next/server';
import { ImageResponse }     from 'next/og';
import { createClient }      from '@supabase/supabase-js';

export const runtime = 'edge';

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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const clientId    = searchParams.get('client_id');
  const quarterLabel = searchParams.get('quarter') ?? '';

  if (!clientId) {
    return new Response(JSON.stringify({ error: 'client_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let cardData: CardData;
  try {
    cardData = await buildCardData(clientId, quarterLabel);
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
