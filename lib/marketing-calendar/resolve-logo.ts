/**
 * An approved logo URL is only written once it actually serves an image, so a
 * brand never points at a 404 (the NRPG and Trade Hall files go live with the
 * deploy that ships public/brand-logos/).
 */
export async function resolveLogoUrl(
  url: string | null
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const type = res.headers.get('content-type') ?? '';
    return res.ok && type.startsWith('image/') ? url : null;
  } catch {
    return null;
  }
}
