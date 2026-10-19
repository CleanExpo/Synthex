import { assertExternalUrlSafe } from '@/lib/security/validate-url';

export const ALLOWED_IMAGE_HOSTS = ['fal.media', 'fal.run'] as const;
// Exact fal hosts that serve generated media, by evidence: fal's CDN docs name
// v3b.fal.media (output URL format), v3.fal.media and its fallback fal.media
// (https://fal.ai/docs/documentation/model-apis/fal-cdn, read 19/10/2026), and
// every URL in production video/image generation rows is on v3b.fal.media.
// Downloads rebuild their URL from this constant, so the host never comes from
// caller input (CodeQL js/request-forgery). A host fal adds later is refused:
// the generation is marked failed with the provider URL kept, never fetched.
export const FAL_MEDIA_HOSTS = [
  'fal.media',
  'v3.fal.media',
  'v3b.fal.media',
] as const;
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

export function isAllowedImageHost(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  return ALLOWED_IMAGE_HOSTS.some(
    h => u.hostname === h || u.hostname.endsWith(`.${h}`)
  );
}

/**
 * SSRF-guarded provider-image download for library persistence (spec Part B).
 * Never throws — all failures are { ok: false, reason } so callers stay
 * non-fatal (the generation row keeps its imageUrl).
 */
export async function fetchImageAsBase64(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<
  | { ok: true; base64: string; contentType: string }
  | { ok: false; reason: string }
> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  try {
    if (!isAllowedImageHost(url))
      return { ok: false, reason: `host not in image allowlist: ${url}` };
    await assertExternalUrlSafe(url);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
    try {
      const res = await fetch(url, {
        redirect: 'error',
        signal: controller.signal,
      });
      if (!res.ok)
        return { ok: false, reason: `fetch failed: HTTP ${res.status}` };
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/'))
        return { ok: false, reason: `not an image: ${contentType}` };
      const declared = Number(res.headers.get('content-length') ?? '0');
      if (declared > maxBytes)
        return { ok: false, reason: `content-length ${declared} exceeds cap` };
      const buf = await res.arrayBuffer();
      if (buf.byteLength > maxBytes)
        return { ok: false, reason: `body ${buf.byteLength} exceeds cap` };
      return {
        ok: true,
        base64: Buffer.from(buf).toString('base64'),
        contentType,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
