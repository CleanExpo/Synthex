/**
 * POST /api/admin/private-refs — one-off admin ingest for PRIVATE reference
 * images (owned customer job-site photos) into the private Supabase bucket
 * that reference grounding reads via signed URLs.
 *
 * These images must never live in the public repo/site — this route lets an
 * operator push them straight into the private bucket using the server-side
 * LEGACY_PLATFORM_SERVICE_KEY (never exposed to the client).
 *
 * Auth: requires header `x-ingest-token` to match REFERENCE_INGEST_TOKEN
 * (both must be set and non-empty). Intended to be enabled for a one-time
 * upload and then removed / the token rotated.
 *
 * Body: multipart/form-data — industry, subjectKey, label, and one or more
 * `images` files. Writes files to `<industry>/<subjectKey>/NN.<ext>` and
 * merges `_private-manifest.json`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServerClient } from '@/lib/platform/server';
import { logger } from '@/lib/logger';

const BUCKET = 'reference-library-private';
const MANIFEST_PATH = '_private-manifest.json';
const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30MB/image guard
const MAX_FILES = 50;

function tokenOk(provided: string | null): boolean {
  const expected = process.env.REFERENCE_INGEST_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  if (!tokenOk(req.headers.get('x-ingest-token'))) {
    return jsonError('Unauthorised', 401);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError('Expected multipart/form-data', 400);
  }

  const industry = String(form.get('industry') || '').trim();
  const subjectKey = String(form.get('subjectKey') || '').trim();
  const label = String(form.get('label') || '').trim();
  const files = form
    .getAll('images')
    .filter((f): f is File => f instanceof File);

  if (!/^[a-z0-9-]+$/.test(industry) || !/^[a-z0-9-]+$/.test(subjectKey)) {
    return jsonError('industry and subjectKey must be [a-z0-9-]', 400);
  }
  if (!label) return jsonError('label required', 400);
  if (files.length === 0) return jsonError('no images provided', 400);
  if (files.length > MAX_FILES) return jsonError('too many images', 400);

  let platform: ReturnType<typeof createServerClient>;
  try {
    platform = createServerClient();
  } catch {
    return jsonError('Server storage not configured', 500);
  }

  // Ensure the private bucket exists (idempotent).
  const { data: buckets } = await platform.storage.listBuckets();
  if (!buckets?.some((b: any) => b.name === BUCKET)) {
    const { error } = await platform.storage.createBucket(BUCKET, {
      public: false,
    });
    if (error && !/exists/i.test(error.message)) {
      return jsonError(`bucket create failed: ${error.message}`, 500);
    }
  }

  const images: Array<{
    path: string;
    bytes: number;
    contentHash: string;
    source: string;
  }> = [];

  try {
    let i = 0;
    for (const file of files) {
      i++;
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > MAX_FILE_BYTES) {
        return jsonError(`image ${i} exceeds ${MAX_FILE_BYTES} bytes`, 400);
      }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const contentType = file.type || 'image/jpeg';
      const path = `${industry}/${subjectKey}/${String(i).padStart(2, '0')}.${ext}`;
      const { error } = await platform.storage
        .from(BUCKET)
        .upload(path, buf, { contentType, upsert: true });
      if (error) throw new Error(`upload ${path}: ${error.message}`);
      images.push({
        path,
        bytes: buf.length,
        contentHash: 'sha256:' + createHash('sha256').update(buf).digest('hex'),
        source: 'owned-job-photo',
      });
    }

    // Merge the private manifest.
    interface PManifest {
      version?: number;
      industries?: Record<string, { subjects?: Record<string, unknown> }>;
    }
    let manifest: PManifest = { version: 1, industries: {} };
    const { data: existing } = await platform.storage
      .from(BUCKET)
      .download(MANIFEST_PATH);
    if (existing) {
      try {
        manifest = JSON.parse(await existing.text());
      } catch {
        /* keep default */
      }
    }
    manifest.industries ??= {};
    manifest.industries[industry] ??= { subjects: {} };
    manifest.industries[industry].subjects ??= {};
    manifest.industries[industry].subjects![subjectKey] = {
      rights: 'owned',
      label,
      provenance: {
        source: 'owned-job-photo',
        rightsBasis: 'owned',
        ingestedAt: new Date().toISOString().slice(0, 10),
      },
      images,
    };
    const { error: mErr } = await platform.storage
      .from(BUCKET)
      .upload(MANIFEST_PATH, Buffer.from(JSON.stringify(manifest, null, 2)), {
        contentType: 'application/json',
        upsert: true,
      });
    if (mErr) throw new Error(`manifest write: ${mErr.message}`);
  } catch (err) {
    logger.error('private-refs ingest failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(err instanceof Error ? err.message : 'ingest failed', 500);
  }

  return NextResponse.json({
    success: true,
    industry,
    subjectKey,
    count: images.length,
  });
}
