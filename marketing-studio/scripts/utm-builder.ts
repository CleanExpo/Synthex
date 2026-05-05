/**
 * UTM URL builder — canonical pattern for the Marketing Skills Package.
 *
 * Used by:
 *   - marketing-analytics-attribution (canonical scheme)
 *   - marketing-copywriter (every CTA URL)
 *   - marketing-social-content (every post link)
 *   - marketing-launch-runbook (per-drop link)
 *   - remotion-composition-builder (CTA URL on video CTAs)
 *
 * Usage:
 *   import { buildUtm } from './utm-builder';
 *   buildUtm({
 *     base: 'https://synthex.example.com/launch',
 *     brand: 'synthex',
 *     channel: 'linkedin',
 *     medium: 'social-organic',
 *     jobId: 'synthex-launch-2026-04-28',
 *     content: 'lp-1',
 *   });
 *   // → https://synthex.example.com/launch?utm_source=synthex-linkedin&utm_medium=social-organic&utm_campaign=synthex-launch-2026-04-28&utm_content=lp-1
 *
 * CLI:
 *   npx tsx scripts/utm-builder.ts --base=... --brand=... --channel=... --medium=... --jobId=... --content=... [--term=...]
 */

export interface UtmInput {
  base: string;
  brand: string;
  channel: string;
  medium: 'social-organic' | 'social-paid' | 'email' | 'cpc' | 'referral' | 'display' | 'video';
  jobId: string;
  content: string;
  term?: string;
}

export function buildUtm(i: UtmInput): string {
  const url = new URL(i.base);
  url.searchParams.set('utm_source', `${i.brand}-${i.channel}`);
  url.searchParams.set('utm_medium', i.medium);
  url.searchParams.set('utm_campaign', i.jobId);
  url.searchParams.set('utm_content', i.content);
  if (i.term) url.searchParams.set('utm_term', i.term);
  return url.toString();
}

/** Validate that a URL has all required UTM params for this campaign job. */
export function validateUtm(url: string, jobId: string): { ok: boolean; missing: string[] } {
  const u = new URL(url);
  const required = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  const missing = required.filter((k) => !u.searchParams.get(k));
  if (u.searchParams.get('utm_campaign') !== jobId) missing.push(`utm_campaign mismatch (expected ${jobId})`);
  return { ok: missing.length === 0, missing };
}

/* ────────────────────────────  CLI  ──────────────────────────── */

if (import.meta.url === `file://${process.argv[1]}`) {
  const args: Record<string, string> = {};
  for (const a of process.argv.slice(2)) {
    if (!a.startsWith('--')) continue;
    const [k, ...rest] = a.slice(2).split('=');
    args[k] = rest.join('=');
  }
  const required = ['base', 'brand', 'channel', 'medium', 'jobId', 'content'];
  const missing = required.filter((k) => !args[k]);
  if (missing.length) {
    console.error(`utm-builder: missing required arg(s): ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(
    buildUtm({
      base: args.base,
      brand: args.brand,
      channel: args.channel,
      medium: args.medium as UtmInput['medium'],
      jobId: args.jobId,
      content: args.content,
      term: args.term,
    }),
  );
}
