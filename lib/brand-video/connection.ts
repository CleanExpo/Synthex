/**
 * Brand Video worker database connection — SYN-1145.
 *
 * P2 (DECISIONS A-24) retired the shared Supabase-style client everywhere. The
 * founder reinstated it for the Brand Video worker only (ruling 22/11/2026,
 * "Bring it back"): the worker claims rows from `brand_video_jobs` and uploads
 * finished mp4s to Supabase Storage, and neither has a Prisma path. Nothing
 * else may import this module; the /api/brand-video routes stay retired.
 *
 * Server and worker code only. The service-role key bypasses row-level
 * security and is read from a non-public variable.
 *
 * The August failures ("Failed to read the Brand Video queue: Invalid API
 * key") came from a key that did not belong to the project the URL pointed
 * at. The preflight below answers three questions with yes or no before the
 * worker touches the queue:
 *
 *   1. Do the address and the key belong to the same Supabase project?
 *   2. Is the key a service-role key or an `sb_secret_` key?
 *   3. Does the storage bucket exist?
 *
 * It never prints, logs or returns a URL, key, project reference or bucket
 * name, because the workflow logs of this public repository are public. A
 * question it cannot answer is answered "no", never "yes".
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** The bucket that exists in the Synthex project (singular). */
export const DEFAULT_BRAND_VIDEO_BUCKET = 'brand-video';

/** How long a preflight network probe may take before it counts as "no". */
const PROBE_TIMEOUT_MS = 15_000;

type Env = Record<string, string | undefined>;

export interface BrandVideoConfig {
  url: string;
  key: string;
  bucket: string;
}

/** Raised when the worker's configuration is unusable. Names variables, never values. */
export class BrandVideoConfigError extends Error {
  constructor(message: string) {
    super(`brand-video config: ${message}`);
    this.name = 'BrandVideoConfigError';
  }
}

function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

/** Every URL variable that is set, in the order the worker prefers them. */
function configuredUrls(env: Env): string[] {
  return ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']
    .map(name => read(env, name))
    .filter((v): v is string => Boolean(v));
}

export function resolveBucket(env: Env = process.env): string {
  return read(env, 'BRAND_VIDEO_BUCKET') ?? DEFAULT_BRAND_VIDEO_BUCKET;
}

/**
 * Project reference from a hosted Supabase URL (`https://<ref>.supabase.co`).
 * Anything else, including a custom domain, returns null, so the same-project
 * question is answered "no" rather than assumed.
 */
export function projectRefFromUrl(url: string): string | null {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    host = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(host);
  return match ? match[1] : null;
}

export type BrandVideoKeyKind =
  | 'service_role'
  | 'secret'
  | 'anon'
  | 'publishable'
  | 'unknown';

export interface BrandVideoKeyInfo {
  kind: BrandVideoKeyKind;
  /** Project reference carried by a legacy JWT key; null for every other kind. */
  ref: string | null;
}

/**
 * Classify a key without contacting anything.
 *
 * Legacy keys are JWTs whose payload names the role and the project
 * reference. `sb_secret_` and `sb_publishable_` keys carry no project
 * reference, so for those only the live probe can say which project accepts
 * them. The signature is not checked here; the live probe does that.
 */
export function classifyKey(key: string | undefined): BrandVideoKeyInfo {
  if (!key) return { kind: 'unknown', ref: null };
  if (key.startsWith('sb_secret_')) return { kind: 'secret', ref: null };
  if (key.startsWith('sb_publishable_'))
    return { kind: 'publishable', ref: null };

  const parts = key.split('.');
  if (parts.length !== 3) return { kind: 'unknown', ref: null };
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    ) as { role?: unknown; ref?: unknown };
    const ref = typeof payload.ref === 'string' ? payload.ref : null;
    if (payload.role === 'service_role') return { kind: 'service_role', ref };
    if (payload.role === 'anon') return { kind: 'anon', ref };
    return { kind: 'unknown', ref };
  } catch {
    return { kind: 'unknown', ref: null };
  }
}

/**
 * The worker's configuration. Throws BrandVideoConfigError when a variable is
 * missing or the two URL variables point at different places.
 */
export function resolveBrandVideoConfig(
  env: Env = process.env
): BrandVideoConfig {
  const urls = configuredUrls(env);
  if (urls.length === 0) {
    throw new BrandVideoConfigError(
      'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required'
    );
  }
  if (new Set(urls.map(u => u.replace(/\/+$/, ''))).size > 1) {
    throw new BrandVideoConfigError(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_URL point at different addresses'
    );
  }
  const key = read(env, 'SUPABASE_SERVICE_ROLE_KEY');
  if (!key) {
    throw new BrandVideoConfigError('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  return { url: urls[0], key, bucket: resolveBucket(env) };
}

type ClientFactory = typeof createClient;

/** Fetch that gives up after `ms`, so a hung probe becomes a "no". */
function fetchWithTimeout(ms: number): typeof fetch {
  return (input, init) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(ms) });
}

/** The worker's Supabase client: no session persistence, no token refresh. */
export function createBrandVideoClient(
  config: BrandVideoConfig,
  factory: ClientFactory = createClient,
  options: { fetch?: typeof fetch } = {}
): SupabaseClient {
  return factory(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(options.fetch ? { global: { fetch: options.fetch } } : {}),
  });
}

export interface BrandVideoPreflight {
  sameProject: boolean;
  privilegedKey: boolean;
  bucketExists: boolean;
}

/**
 * Answer the three preflight questions. Never throws; every failure is "no".
 *
 * Same project: every URL variable that is set names the same hosted project,
 * a JWT key's `ref` claim names that project too, and the project accepts the
 * key (an authenticated bucket listing succeeds). An `sb_secret_` key has no
 * `ref` claim, so for it the accepted listing is the whole proof.
 */
export async function runBrandVideoPreflight(
  env: Env = process.env,
  factory: ClientFactory = createClient
): Promise<BrandVideoPreflight> {
  const result: BrandVideoPreflight = {
    sameProject: false,
    privilegedKey: false,
    bucketExists: false,
  };

  try {
    const key = read(env, 'SUPABASE_SERVICE_ROLE_KEY');
    const info = classifyKey(key);
    result.privilegedKey =
      info.kind === 'service_role' || info.kind === 'secret';

    const refs = configuredUrls(env).map(projectRefFromUrl);
    const urlRef =
      refs.length > 0 && refs.every(r => r !== null && r === refs[0])
        ? refs[0]
        : null;
    const refsAgree =
      urlRef !== null && (info.kind === 'secret' || info.ref === urlRef);

    if (!key || !urlRef || !refsAgree || !result.privilegedKey) return result;

    const client = createBrandVideoClient(
      { url: configuredUrls(env)[0], key, bucket: resolveBucket(env) },
      factory,
      { fetch: fetchWithTimeout(PROBE_TIMEOUT_MS) }
    );
    const { data, error } = await client.storage.listBuckets();
    if (error || !Array.isArray(data)) return result;

    result.sameProject = true;
    const bucket = resolveBucket(env);
    result.bucketExists = data.some(
      b => b?.name === bucket || b?.id === bucket
    );
  } catch {
    // A probe that throws answers nothing; the defaults stay "no".
  }
  return result;
}

const yesNo = (v: boolean) => (v ? 'yes' : 'no');

/** The only lines the preflight ever prints: fixed text plus yes or no. */
export function formatBrandVideoPreflight(r: BrandVideoPreflight): string[] {
  return [
    `Brand Video preflight: address and key belong to the same Supabase project: ${yesNo(r.sameProject)}`,
    `Brand Video preflight: key is a service-role or sb_secret_ key: ${yesNo(r.privilegedKey)}`,
    `Brand Video preflight: storage bucket exists: ${yesNo(r.bucketExists)}`,
  ];
}

export function brandVideoPreflightPassed(r: BrandVideoPreflight): boolean {
  return r.sameProject && r.privilegedKey && r.bucketExists;
}

/**
 * Replace any configured URL, key or project reference in `text` before it is
 * logged or stored, for messages the worker did not write itself (provider
 * and database errors).
 */
export function redactBrandVideoSecrets(
  text: string,
  env: Env = process.env
): string {
  const values = [
    ...configuredUrls(env),
    ...configuredUrls(env).map(projectRefFromUrl),
    read(env, 'SUPABASE_SERVICE_ROLE_KEY'),
  ].filter((v): v is string => typeof v === 'string' && v.length >= 8);
  let out = text;
  for (const v of values.sort((a, b) => b.length - a.length)) {
    out = out.split(v).join('[redacted]');
  }
  return out;
}
