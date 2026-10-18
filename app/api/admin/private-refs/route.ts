/**
 * POST /api/admin/private-refs — one-off admin ingest for PRIVATE reference
 * images (owned customer job-site photos) into the private storage bucket
 * that reference grounding reads via signed URLs.
 *
 * These images must never live in the public repo/site. The route used to push
 * them into the private Supabase bucket `reference-library-private`, but that
 * client was removed (SYN-1070) and the repo has no private-bucket storage
 * helper — lib/storage/platform-storage.ts writes under public/, which would
 * leak them. Until private storage is provisioned the route answers 503
 * FEATURE_NOT_PROVISIONED after auth and stores nothing.
 *
 * Auth: requires header `x-ingest-token` to match REFERENCE_INGEST_TOKEN
 * (both must be set and non-empty).
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  FEATURE_NOT_PROVISIONED,
  notProvisionedResponse,
} from '@/lib/api/not-provisioned';

const BUCKET = 'reference-library-private';

function tokenOk(provided: string | null): boolean {
  const expected = process.env.REFERENCE_INGEST_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req.headers.get('x-ingest-token'))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  return notProvisionedResponse(
    `Private reference ingest is not available: the ${BUCKET} storage bucket is not provisioned. Nothing was uploaded.`
  );
}
