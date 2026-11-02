/**
 * Supabase project ref named by a Postgres connection URL, for the portfolio
 * calendar CLI's "is this the Synthex database?" check. Never returns or
 * prints the URL itself.
 *
 * Only Supabase hosts count. Direct: db.<ref>.supabase.co (user postgres).
 * Supavisor pooler: aws-N-<region>.pooler.supabase.com with user
 * postgres.<ref>. Anything else, or a host and user that disagree, is
 * refused rather than trusted on the username alone.
 */
export function supabaseProjectRef(raw: string | undefined): string {
  if (!raw) return 'unset';
  let url: URL;
  let user: string;
  try {
    url = new URL(raw);
    user = decodeURIComponent(url.username);
  } catch {
    return 'unparseable';
  }
  const host = url.hostname.toLowerCase();
  const unknown = `unknown (${url.protocol}//${host})`;
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:')
    return unknown;
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(host)?.[1];
  if (direct)
    return user === 'postgres' || user === `postgres.${direct}`
      ? direct
      : unknown;
  if (/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host))
    return /^postgres\.([a-z0-9]+)$/.exec(user)?.[1] ?? unknown;
  return unknown;
}
