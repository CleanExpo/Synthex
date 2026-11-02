/**
 * An approved logo URL is only written once it actually serves an image, so a
 * brand never points at a 404 (the NRPG and Trade Hall files go live with the
 * deploy that ships public/brand-logos/). A host that does not answer within
 * LOGO_CHECK_TIMEOUT_MS counts as not serving it.
 */
export const LOGO_CHECK_TIMEOUT_MS = 10_000;

export async function resolveLogoUrl(
  url: string | null
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(LOGO_CHECK_TIMEOUT_MS),
    });
    const type = res.headers.get('content-type') ?? '';
    return res.ok && type.startsWith('image/') ? url : null;
  } catch {
    return null;
  }
}
