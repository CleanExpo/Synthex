/**
 * parseVideoId — safely extract an 11-character YouTube video ID from either a
 * bare ID or any common YouTube URL form.
 *
 * Supported inputs:
 *   • Bare ID:                 dQw4w9WgXcQ
 *   • Standard watch URL:      https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *   • Short URL:               https://youtu.be/dQw4w9WgXcQ
 *   • Embed URL:               https://www.youtube.com/embed/dQw4w9WgXcQ
 *   • Privacy embed:           https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ
 *   • Shorts URL:              https://www.youtube.com/shorts/dQw4w9WgXcQ
 *   • Live URL:                https://www.youtube.com/live/dQw4w9WgXcQ
 *   • With extra query/params: ...watch?v=dQw4w9WgXcQ&t=42s&list=...
 *
 * Security: the returned ID is always validated against the exact YouTube ID
 * charset ([A-Za-z0-9_-], length 11). Anything else yields null, so the value
 * is safe to interpolate into an iframe `src` without further escaping.
 *
 * @task SYN-509
 */

/** A YouTube video ID is exactly 11 chars from the URL-safe base64 alphabet. */
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Host suffixes we accept video IDs from. */
const YT_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'];

function isYouTubeHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return YT_HOSTS.some(host => h === host || h.endsWith('.' + host));
}

/**
 * @param input a bare video ID or a YouTube URL
 * @returns the 11-char video ID, or null if none could be safely extracted
 */
export function parseVideoId(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Fast path: already a bare, valid ID.
  if (YT_ID.test(trimmed)) return trimmed;

  // Try to parse as a URL. Accept protocol-relative and scheme-less hosts too.
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    try {
      url = new URL('https://' + trimmed.replace(/^\/\//, ''));
    } catch {
      return null;
    }
  }

  if (!isYouTubeHost(url.hostname)) return null;

  // youtu.be/<id>  → id is the first path segment
  // youtube.com/watch?v=<id>
  // youtube.com/{embed,shorts,live,v}/<id>
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = segments[0] ?? null;
  } else {
    const vParam = url.searchParams.get('v');
    if (vParam) {
      candidate = vParam;
    } else if (
      segments.length >= 2 &&
      ['embed', 'shorts', 'live', 'v'].includes(segments[0])
    ) {
      candidate = segments[1];
    }
  }

  if (candidate && YT_ID.test(candidate)) return candidate;
  return null;
}

/** True when `input` resolves to a usable YouTube video ID. */
export function isValidYouTubeInput(input: string | null | undefined): boolean {
  return parseVideoId(input) !== null;
}

/**
 * Build a privacy-friendly (youtube-nocookie.com) embed URL for a parsed ID.
 * Returns null when the ID cannot be parsed.
 */
export function toNoCookieEmbedUrl(
  input: string | null | undefined,
  opts: { autoplay?: boolean } = {}
): string | null {
  const id = parseVideoId(input);
  if (!id) return null;
  const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
  if (opts.autoplay) params.set('autoplay', '1');
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}
