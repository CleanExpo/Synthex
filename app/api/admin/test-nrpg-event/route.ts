/**
 * POST /api/admin/test-nrpg-event
 *
 * Owner-gated. Fires a synthetic ContractorOnboardedEvent through the
 * SYN-834 NRPG → DR pipeline so an operator can verify end-to-end
 * before real contractor signups arrive.
 *
 * Body (all optional — sensible defaults):
 *   {
 *     "suburb":          "Brisbane City",
 *     "postcode":        "4000",
 *     "lat":             -27.4698,
 *     "lng":             153.0251,
 *     "radiusKm":        5,
 *     "serviceCategories": ["water-damage"]
 *   }
 *
 * Returns the full {@link NrpgPipelineResult} as JSON so the operator
 * can see per-stage outcome (gbp.ok, bingPlaces.ok, landingPages.ok,
 * sitemap.ok, etc.) — including which stages failed and why.
 *
 * @module app/api/admin/test-nrpg-event/route
 * @see SYN-834 (epic — Track 2 ship-now)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getUserIdFromCookies,
  isOwnerEmail,
  verifyTokenSafe,
} from '@/lib/auth/jwt-utils';
import { getUserEmailById } from '@/lib/admin/verify-admin';
import { logger } from '@/lib/logger';
import { emitContractorOnboarded } from '@/lib/contractor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface TestEventBody {
  suburb?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  serviceCategories?: string[];
}

const DEFAULT_BODY: Required<TestEventBody> = {
  suburb: 'Brisbane City',
  postcode: '4000',
  lat: -27.4698,
  lng: 153.0251,
  radiusKm: 5, // Tight radius — keeps the test event to ~1 suburb.
  serviceCategories: ['water-damage'],
};

export async function POST(request: NextRequest) {
  // ─── auth gate (owner email only) ─────────────────────────────────────
  void getUserIdFromCookies; // imported for parity; cookie path used below
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const payload = verifyTokenSafe(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const email = await getUserEmailById(payload.userId);
  if (!email || !isOwnerEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ─── parse + merge body ───────────────────────────────────────────────
  let body: TestEventBody = {};
  try {
    body = (await request.json()) as TestEventBody;
  } catch {
    /* empty body OK — defaults apply */
  }
  const merged = { ...DEFAULT_BODY, ...body };

  // ─── emit synthetic event ─────────────────────────────────────────────
  const sourceOfTruthJobId = `test-nrpg-${Date.now()}`;
  const contractorId = `test-contractor-${Date.now()}`;

  try {
    const result = await emitContractorOnboarded({
      sourceOfTruthJobId,
      contractorId,
      brand: 'NRPG',
      baseLat: merged.lat,
      baseLng: merged.lng,
      addressHash: 'sha256:test-event-no-real-address',
      radiusKm: merged.radiusKm,
      serviceCategories: merged.serviceCategories,
      paymentConfirmedAt: new Date().toISOString(),
      consentForServiceAreaListing: true,
    });

    logger.info('[test-nrpg-event] emitted', {
      sourceOfTruthJobId,
      notifiedHandlers: result.notifiedHandlers,
      failedHandlers: result.failedHandlers,
      requestedBy: email,
    });

    return NextResponse.json({
      ok: true,
      sourceOfTruthJobId,
      contractorId,
      input: merged,
      emitResult: {
        firstEmit: result.firstEmit,
        notifiedHandlers: result.notifiedHandlers,
        failedHandlers: result.failedHandlers,
      },
      note: 'Per-stage outcomes are logged via lib/nrpg-pipeline subscriber. Check Vercel logs for [nrpg-pipeline] entries to see gbp/bing/landing/sitemap status.',
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error('[test-nrpg-event] emit failed', {
      sourceOfTruthJobId,
      reason,
      requestedBy: email,
    });
    return NextResponse.json(
      { ok: false, sourceOfTruthJobId, reason },
      { status: 500 }
    );
  }
}
