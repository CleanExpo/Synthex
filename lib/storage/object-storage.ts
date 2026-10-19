/**
 * Durable object storage: one server-only helper over Supabase Storage
 * (DECISIONS.md FD-7).
 *
 * Credentials: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. The client is built
 * lazily on first use, never at import. If either variable is missing every
 * function throws ObjectStorageNotProvisionedError (code
 * FEATURE_NOT_PROVISIONED) so callers keep their honest 503 / failed / []
 * behaviour. Server code only: the service-role key bypasses RLS and is read
 * from a non-public env var, so it is never bundled for the browser.
 * Every Supabase error is thrown as ObjectStorageError; nothing is
 * swallowed or turned into success.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FEATURE_NOT_PROVISIONED } from '@/lib/api/not-provisioned';

export class ObjectStorageNotProvisionedError extends Error {
  readonly code = FEATURE_NOT_PROVISIONED;
  constructor() {
    super(
      `${FEATURE_NOT_PROVISIONED}: object storage is not provisioned (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required).`
    );
    this.name = 'ObjectStorageNotProvisionedError';
  }
}

export class ObjectStorageError extends Error {
  constructor(operation: string, bucket: string, detail: string) {
    super(`object storage ${operation} failed in ${bucket}: ${detail}`);
    this.name = 'ObjectStorageError';
  }
}

let client: SupabaseClient | null = null;

function bucketApi(bucket: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ObjectStorageNotProvisionedError();
  client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.storage.from(bucket);
}

export async function upload(
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string,
  { upsert = false }: { upsert?: boolean } = {}
): Promise<void> {
  const { error } = await bucketApi(bucket).upload(path, buffer, {
    contentType,
    upsert,
  });
  if (error) throw new ObjectStorageError('upload', bucket, error.message);
}

export function publicUrl(bucket: string, path: string): string {
  const { data } = bucketApi(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new ObjectStorageError('publicUrl', bucket, 'no URL returned');
  }
  return data.publicUrl;
}

/** Signed URLs in the order of `paths`; any per-path failure throws. */
export async function signedUrls(
  bucket: string,
  paths: string[],
  ttlSeconds: number
): Promise<string[]> {
  const { data, error } = await bucketApi(bucket).createSignedUrls(
    paths,
    ttlSeconds
  );
  if (error) throw new ObjectStorageError('signedUrls', bucket, error.message);
  if (!data || data.length !== paths.length) {
    throw new ObjectStorageError('signedUrls', bucket, 'incomplete result');
  }
  return data.map(d => {
    if (d.error || !d.signedUrl) {
      throw new ObjectStorageError(
        'signedUrls',
        bucket,
        `${d.path ?? 'unknown path'}: ${d.error ?? 'no URL returned'}`
      );
    }
    return d.signedUrl;
  });
}

export async function download(bucket: string, path: string): Promise<Buffer> {
  const { data, error } = await bucketApi(bucket).download(path);
  if (error) throw new ObjectStorageError('download', bucket, error.message);
  if (!data) throw new ObjectStorageError('download', bucket, 'no data');
  return Buffer.from(await data.arrayBuffer());
}

export async function remove(bucket: string, paths: string[]): Promise<void> {
  const { error } = await bucketApi(bucket).remove(paths);
  if (error) throw new ObjectStorageError('remove', bucket, error.message);
}
