/**
 * Public calls to action funnel to the Unite-Group CRM, never self-serve.
 *
 * Synthex is Unite-Group's in-house marketing agency (FD-8). Logins are for
 * named operators only, and enquiries go through Nexus: the public
 * Opportunity Map hands a consenting visitor to the CRM as a Lead
 * (app/api/opportunity-map/handoff/route.ts). So no public page may send a
 * visitor to self-serve /signup, and /pricing carries no plan or price list.
 *
 * Scope: every file a public route renders (publicSourceInventory follows
 * imports from each non-protected app/ route file), minus the account flows
 * that exist for invited operators (login, signup, password reset, invites).
 */
import { readFileSync } from 'fs';
import path from 'path';
import { ROOT, publicSourceInventory, rel } from './helpers/public-claims';

const ACCOUNT_FLOW_PREFIXES = [
  'app/(auth)/',
  'app/auth/',
  'app/_login_disabled/',
  'app/forgot-password/',
  'app/reset-password/',
  'app/invite/',
];

const SELF_SERVE_LINK =
  /(?:href\s*[=:]\s*\{?\s*|router\.(?:push|replace)\(\s*)['"`]\/(signup|pricing)(?=['"`?#/])/g;

function publicFiles(): string[] {
  return publicSourceInventory({ followApi: false })
    .map(rel)
    .filter(file => /\.(tsx?|jsx?|mjs)$/.test(file))
    .filter(file => !ACCOUNT_FLOW_PREFIXES.some(p => file.startsWith(p)));
}

describe('public calls to action', () => {
  it('scans the public marketing surface (positive control on scope)', () => {
    const files = publicFiles();
    expect(files).toEqual(
      expect.arrayContaining([
        'app/page.tsx',
        'app/pricing/page.tsx',
        'app/agencies/page.tsx',
        'app/compare/hootsuite/page.tsx',
        'components/landing/nav-bar.tsx',
        'components/marketing/MarketingLayout.tsx',
      ])
    );
  });

  it('never link a visitor to self-serve /signup or to /pricing', () => {
    const offenders: string[] = [];
    for (const file of publicFiles()) {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      for (const m of source.matchAll(SELF_SERVE_LINK)) {
        const line = source.slice(0, m.index).split('\n').length;
        offenders.push(`${file}:${line} -> /${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the detector catches a self-serve link (negative control)', () => {
    const planted = [
      '<Link href="/signup">Start free</Link>',
      "{ href: '/pricing', label: 'Pricing' }",
      "router.push('/signup?plan=pro')",
    ].join('\n');
    expect([...planted.matchAll(SELF_SERVE_LINK)]).toHaveLength(3);
    expect([
      ...'<Link href="/opportunity-map">'.matchAll(SELF_SERVE_LINK),
    ]).toHaveLength(0);
  });
});

describe('/pricing', () => {
  const source = readFileSync(path.join(ROOT, 'app/pricing/page.tsx'), 'utf8');

  it('carries no plan, pilot, retainer or price framing', () => {
    const banned =
      /\$\s?\d|\bA?UD\s?\d|per month|\/mo\b|free trial|pilot|retainer|metered|subscription|\bplans?\b|\btiers?\b|pricing/i;
    // The route identity marker names the path itself; it is not copy.
    const copy = source.replace(/route="\/pricing"/g, '');
    expect(copy).not.toMatch(banned);
  });

  it('presents Synthex as the in-house agency and sends enquiries to the CRM path', () => {
    expect(source).toMatch(/in-house marketing agency/i);
    expect(source).toMatch(/href="\/opportunity-map"/);
  });
});
