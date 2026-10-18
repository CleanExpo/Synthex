/**
 * J12 — Golden regressions (hard gate). One case per fixed bug: each case
 * cites its fixing commit and re-asserts the fixed behaviour at HEAD, in
 * process. A FAIL is a regression. Controls re-implement the pre-fix code of
 * three cases (taken from the fixing commit's parent) and run the SAME
 * assertion, which must catch each.
 *
 * Boundary mocks only: Prisma is a recording stand-in (j12/db.ts) and
 * next/headers has no request scope in-process, so it serves an empty cookie jar.
 */
import {
  classify,
  inconclusive,
  recordResults,
  type JevResult,
} from '../runner/record';
import { Inconclusive, type GoldenCase, type Verdict } from './j12/harness';
import {
  assertEscapeHtml,
  assertSsrfGuard,
  assertStripeMapping,
  securityCases,
} from './j12/cases-security';
import { contentCases } from './j12/cases-content';
import { routeCases } from './j12/cases-routes';
import { platformCases } from './j12/cases-platform';

jest.mock('@/lib/prisma', () => {
  const { prismaStub } = jest.requireActual('./j12/db');
  return { __esModule: true, prisma: prismaStub, default: prismaStub };
});
// No Next request scope in-process: an empty cookie jar (auth comes from the bearer JWT).
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set() {},
    delete() {},
  }),
  headers: async () => new Headers(),
}));

const FAMILY = 'J12';
const EXPECTED = 100;
const results: JevResult[] = [];
afterAll(() => recordResults(FAMILY, results));

const allCases: GoldenCase[] = [
  ...securityCases,
  ...contentCases,
  ...routeCases,
  ...platformCases,
];

async function runCase(c: GoldenCase): Promise<JevResult> {
  const id = `J12-${c.slug}`;
  const base = { id, family: FAMILY, kind: 'case' as const, route: c.target };
  try {
    const v = await c.run();
    const r = classify(id, v.pass, `[${c.sha}] ${c.property} :: ${v.detail}`);
    return { ...base, ...r };
  } catch (err) {
    if (err instanceof Inconclusive)
      return {
        ...base,
        ...inconclusive(id, `[${c.sha}] ${err.message}`),
      };
    const msg =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    // The code under test threw where the fixed behaviour expects a value.
    return {
      ...base,
      ...classify(
        id,
        false,
        `[${c.sha}] ${c.property} :: threw ${msg.slice(0, 300)}`
      ),
    };
  }
}

describe('J12 golden regressions', () => {
  it('case ids are unique and stable', () => {
    const ids = allCases.map(c => c.slug);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it(`runs the ${EXPECTED} cases`, async () => {
    for (const c of [...allCases].sort((a, b) => (a.slug < b.slug ? -1 : 1))) {
      results.push(await runCase(c));
    }
    expect(results.filter(r => r.kind === 'case').length).toBe(EXPECTED);
  });

  // ── Planted regressions: pre-fix code, same assertion ─────────────────────
  function control(slug: string, sha: string, v: Verdict): JevResult {
    return {
      id: `J12-control-${slug}`,
      family: FAMILY,
      kind: 'control',
      state: v.pass ? 'PASS' : 'FAIL',
      detail: `planted pre-fix ${sha}^ :: ${v.detail}`,
    };
  }

  it('control: pre-fix escapeHtml (ae6e2739^) is caught', () => {
    function escapeHtml(s?: string) {
      if (!s) return '';
      return s.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
    }
    results.push(
      control('escape-html', 'ae6e2739', assertEscapeHtml(escapeHtml))
    );
  });

  it('control: pre-fix substring Stripe invoice mapping (82aa5820^) is caught', () => {
    function parse(type: string): string | null {
      if (type?.startsWith('invoice')) {
        if (type.includes('paid')) return 'billing.payment_succeeded';
        if (type.includes('failed')) return 'billing.payment_failed';
      }
      return null;
    }
    results.push(
      control('stripe-invoice-mapping', '82aa5820', assertStripeMapping(parse))
    );
  });

  it('control: pre-fix regex SSRF guard without bracketed IPv6 (99bd4f75^) is caught', async () => {
    const BLOCKED = [
      /^file:/i,
      /^ftp:/i,
      /localhost/i,
      /^127\./,
      /^0\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^::1/,
      /^fd[0-9a-f]{2}:/i,
      /^0\.0\.0\.0/,
    ];
    function validateExternalUrl(url: string): void {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error('Invalid URL');
      }
      if (!['http:', 'https:'].includes(parsed.protocol))
        throw new Error('URL must use http or https protocol');
      for (const p of BLOCKED)
        if (p.test(parsed.hostname))
          throw new Error('URL resolves to a blocked address');
    }
    results.push(
      control(
        'ssrf-ipv6-loopback',
        '99bd4f75',
        await assertSsrfGuard(validateExternalUrl, ['http://[::1]/admin'])
      )
    );
  });
});
