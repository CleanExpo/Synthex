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
import { BrandVideoQueueError } from '@/lib/brand-video/planner';

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
 * The one canonical form of a project address: `https://<ref>.supabase.co`.
 * A URL with a path, query, port or credentials, or one that is not a hosted
 * project, has no canonical form (null) and is refused.
 */
function canonicalProjectUrl(url: string): string | null {
  const ref = projectRefFromUrl(url);
  if (!ref) return null;
  const parsed = new URL(url);
  if (
    (parsed.pathname !== '/' && parsed.pathname !== '') ||
    parsed.search ||
    parsed.hash ||
    parsed.port ||
    parsed.username ||
    parsed.password
  ) {
    return null;
  }
  return `https://${ref}.supabase.co`;
}

/**
 * The worker's configuration, and the single rule for whether it is usable:
 * the preflight calls this too, so the preflight can never pass a
 * configuration the render step then refuses.
 *
 * Throws BrandVideoConfigError when a variable is missing, a URL is not a
 * plain hosted project address, or the two URL variables name different
 * projects. Messages name variables, never values.
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
  const canonical = urls.map(canonicalProjectUrl);
  if (canonical.some(u => u === null)) {
    throw new BrandVideoConfigError(
      'the Supabase URL must be a plain https://<project>.supabase.co address'
    );
  }
  if (new Set(canonical).size > 1) {
    throw new BrandVideoConfigError(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_URL point at different projects'
    );
  }
  const key = read(env, 'SUPABASE_SERVICE_ROLE_KEY');
  if (!key) {
    throw new BrandVideoConfigError('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  return { url: canonical[0] as string, key, bucket: resolveBucket(env) };
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
 * Same project: the configuration resolves (resolveBrandVideoConfig, the same
 * rule the render step uses), a JWT key's `ref` claim names the configured
 * project, and the project accepts the key (an authenticated bucket listing
 * succeeds). An `sb_secret_` key has no `ref` claim, so for it the accepted
 * listing is the whole proof.
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
    const info = classifyKey(read(env, 'SUPABASE_SERVICE_ROLE_KEY'));
    result.privilegedKey =
      info.kind === 'service_role' || info.kind === 'secret';

    let config: BrandVideoConfig;
    try {
      config = resolveBrandVideoConfig(env);
    } catch {
      return result;
    }
    const urlRef = projectRefFromUrl(config.url);
    const refsAgree =
      urlRef !== null && (info.kind === 'secret' || info.ref === urlRef);
    if (!refsAgree || !result.privilegedKey) return result;

    const client = createBrandVideoClient(config, factory, {
      fetch: fetchWithTimeout(PROBE_TIMEOUT_MS),
    });
    const { data, error } = await client.storage.listBuckets();
    if (error || !Array.isArray(data)) return result;

    result.sameProject = true;
    result.bucketExists = data.some(
      b => b?.name === config.bucket || b?.id === config.bucket
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

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Shapes of the values this worker must never show, configured or not: any
 * URL, a Supabase host without a scheme, a JWT-shaped key, an sb_ key, and a
 * 20-character project-reference-shaped token.
 */
const SENSITIVE_SHAPES: RegExp[] = [
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s'"<>`]+/gi,
  /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.supabase\.(?:co|in|com)\b/gi,
  /\beyJ[\w-]*\.[\w-]+\.[\w-]+/g,
  /\bsb_(?:secret|publishable)_[\w-]+/gi,
  /\b[a-z0-9]{20}\b/g,
];

/**
 * Replace every configured URL, project reference, key and bucket name in
 * `text`, then every value of a sensitive shape (SENSITIVE_SHAPES). The bucket
 * is matched as a whole name only, so 'brand-video' is removed from "Bucket
 * brand-video not found" but 'brand-video-worker' is left alone.
 *
 * This is the second line of defence. The first is that the public log never
 * carries text the worker did not compose (createBrandVideoLogger).
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
  const bucket = resolveBucket(env);
  out = out.replace(
    new RegExp(`(?<![\\w-])${escapeRegExp(bucket)}(?![\\w-])`, 'g'),
    '[redacted]'
  );
  for (const shape of SENSITIVE_SHAPES) out = out.replace(shape, '[redacted]');
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A job id for the public log: a UUID as stored, anything else withheld. */
export function publicJobId(id: unknown): string {
  return typeof id === 'string' && UUID.test(id) ? id : '(id withheld)';
}

/** Every error summary the public log can show. */
export const BRAND_VIDEO_PUBLIC_ERROR_CODES = [
  'QUEUE_READ_FAILED',
  'QUEUE_CLAIM_FAILED',
  'STATUS_WRITE_FAILED',
  'CONFIG_INVALID',
  'RENDER_FAILED',
  'UNEXPECTED',
] as const;
export type BrandVideoPublicErrorCode =
  (typeof BRAND_VIDEO_PUBLIC_ERROR_CODES)[number];

/** A PostgREST (PGRST123) or Postgres (SQLSTATE, five characters) error code. */
const DB_CODE = /^(?:PGRST\d{3}|[0-9A-Z]{5})$/;

/**
 * The only description of an error the public log shows: a code from a closed
 * set, plus the database error code when it has that exact shape. Never the
 * message, which can carry text from the database or a provider.
 */
export function publicErrorSummary(
  err: unknown,
  fallback: BrandVideoPublicErrorCode = 'UNEXPECTED'
): string {
  if (err instanceof BrandVideoQueueError) {
    const db =
      typeof err.dbCode === 'string' && DB_CODE.test(err.dbCode)
        ? ` ${err.dbCode}`
        : '';
    return `${err.code}${db}`;
  }
  if (err instanceof BrandVideoConfigError) return 'CONFIG_INVALID';
  return fallback;
}

/**
 * The worker's only way to write to stdout, stderr or a job's `error` column.
 *
 * Public log (stdout, stderr; this repository's Actions logs are public): the
 * worker passes only text it composed itself from fixed words, publicJobId and
 * publicErrorSummary, never a row field or an error message. Every line is
 * also run through redactBrandVideoSecrets as a second line of defence.
 *
 * Job error column (private, in the database): the raw message, redacted the
 * same way and cut to 500 characters, so an operator can see what failed.
 */
export function createBrandVideoLogger(
  env: Env = process.env,
  out: (line: string) => void = line => process.stdout.write(line),
  err: (line: string) => void = line => process.stderr.write(line),
  now: () => Date = () => new Date()
) {
  const stamp = () => now().toISOString().slice(11, 19);
  return {
    log(message: string): void {
      out(`[${stamp()}] ${redactBrandVideoSecrets(message, env)}\n`);
    },
    error(message: string): void {
      err(`${redactBrandVideoSecrets(message, env)}\n`);
    },
    /** For the private job error column only: redacted, at most 500 characters. */
    forColumn(message: string): string {
      return redactBrandVideoSecrets(message, env).slice(0, 500);
    },
  };
}
