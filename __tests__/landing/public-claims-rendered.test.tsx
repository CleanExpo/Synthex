/**
 * Unsupported marketing claims must not appear in what a visitor receives —
 * rendered check (SYN-1226).
 *
 * The source check (public-claims.test.ts) cannot see copy composed at
 * runtime ('Join 5,' + '000+ …'). This suite renders every public page.tsx to
 * static markup with react-dom/server — awaiting async pages and the async
 * server components inside them — and scans the normalised text and
 * user-visible attributes with the same patterns.
 *
 * A page that cannot render under Jest is listed in UNRENDERABLE with its
 * reason. It still gets the source check, and this suite asserts it really
 * still fails to render, so the list cannot go stale and no page is skipped
 * silently: a new public page must either render clean or be added here.
 *
 * Mocks are the minimum a page needs outside Next: router hooks, request
 * headers/cookies, the Prisma client (empty results) and fetch (503).
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  findClaims,
  publicPageFiles,
  rel,
  routeOf,
} from './helpers/public-claims';

jest.mock('next/navigation', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  };
  return {
    useRouter: () => router,
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    useSelectedLayoutSegment: () => null,
    useSelectedLayoutSegments: () => [],
    redirect: (to: string) => {
      throw new Error(`NEXT_REDIRECT ${to}`);
    },
    permanentRedirect: (to: string) => {
      throw new Error(`NEXT_REDIRECT ${to}`);
    },
    notFound: () => {
      throw new Error('NEXT_NOT_FOUND');
    },
  };
});

jest.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
  }),
  draftMode: async () => ({ isEnabled: false }),
}));

// Every model method resolves empty, so data-driven pages render their
// empty state rather than reaching a database.
jest.mock('@/lib/prisma', () => {
  const empty = (method: string) => {
    if (/^find(Many)?$|^groupBy$/.test(method)) return Promise.resolve([]);
    if (/^count$/.test(method)) return Promise.resolve(0);
    if (/^aggregate$/.test(method)) return Promise.resolve({});
    return Promise.resolve(null);
  };
  const model = new Proxy(
    {},
    { get: (_t, method: string) => () => empty(String(method)) }
  );
  const client = new Proxy(
    {},
    {
      get: (_t, key: string) => {
        if (key === '__esModule') return false;
        if (String(key).startsWith('$')) return async () => [];
        return model;
      },
    }
  );
  return { __esModule: true, default: client, prisma: client };
});

jest.mock('server-only', () => ({}), { virtual: true });

// Pages that cannot be rendered outside Next, with the reason. Each still gets
// the normalised source check in public-claims.test.ts. `outcome` is asserted,
// so an entry is removed the moment its page starts rendering copy.
const UNRENDERABLE: Record<
  string,
  { outcome: 'throws' | 'empty'; reason: string }
> = {
  'app/bio/[slug]/page.tsx': {
    outcome: 'throws',
    reason: 'dynamic route: renders notFound() unless a bio page record exists',
  },
  'app/clients/[slug]/page.tsx': {
    outcome: 'throws',
    reason: 'dynamic route: renders notFound() unless a client record exists',
  },
  'app/blog/[slug]/page.tsx': {
    outcome: 'throws',
    reason:
      'imports react-markdown, ESM-only and not transformed by this Jest config',
  },
  'app/credential-intake/page.tsx': {
    outcome: 'empty',
    reason: 'client page renders nothing until its token is read after mount',
  },
  'app/testimonial/[token]/page.tsx': {
    outcome: 'empty',
    reason: 'renders nothing until the testimonial request loads on the client',
  },
  'app/welcome/page.tsx': {
    outcome: 'empty',
    reason:
      'client page renders nothing until the session check runs after mount',
  },
};

const SAMPLE_PARAMS: Record<string, string> = {
  slug: 'example',
  token: 'example',
  id: 'example',
};

function paramsFor(route: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [, name] of route.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)) {
    params[name] = SAMPLE_PARAMS[name] ?? 'example';
  }
  return params;
}

const isAsync = (fn: unknown) =>
  typeof fn === 'function' && fn.constructor.name === 'AsyncFunction';

// Resolve async server components ahead of react-dom/server, which (unlike
// the RSC renderer) cannot await them. Client components are left to React.
async function resolveServerTree(
  node: React.ReactNode
): Promise<React.ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveServerTree));
  if (!React.isValidElement(node)) return node;
  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  if (isAsync(element.type)) {
    const rendered = await (
      element.type as (p: unknown) => Promise<React.ReactNode>
    )(element.props);
    return resolveServerTree(rendered);
  }
  const { children } = element.props ?? {};
  if (children === undefined) return element;
  return React.cloneElement(
    element,
    undefined,
    await resolveServerTree(children)
  );
}

// What a visitor reads: text content plus the attributes that surface as copy.
function visibleCopy(markup: string): string {
  const attributes = [
    ...markup.matchAll(
      /\s(?:alt|title|aria-label|placeholder|content|value)="([^"]*)"/g
    ),
  ].map(m => m[1]);
  // Tags drop out; script bodies (JSON-LD) stay, since crawlers read them.
  const text = markup.replace(/<[^>]+>/g, ' ');
  return `${text} ${attributes.join(' ')}`;
}

async function renderPage(file: string): Promise<string> {
  const route = routeOf(file);

  const mod = require(file) as { default: (props: unknown) => React.ReactNode };
  const Page = mod.default;
  if (typeof Page !== 'function')
    throw new Error('no default export component');
  const params = paramsFor(route);
  const props = {
    params: Promise.resolve(params),
    searchParams: Promise.resolve({}),
  };
  const tree = isAsync(Page)
    ? await (Page as (p: unknown) => Promise<React.ReactNode>)(props)
    : React.createElement(Page as React.ComponentType<unknown>, props);
  return renderToStaticMarkup(<>{await resolveServerTree(tree)}</>);
}

const pages = publicPageFiles();

describe('public copy — unsupported claims (rendered)', () => {
  const originalFetch = global.fetch;
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
    // A plain function: the Jest config resets jest.fn implementations.
    global.fetch = (async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
      text: async () => '',
    })) as unknown as typeof fetch;
    // Rendering 50+ pages outside Next is noisy; failures are asserted below.
    console.error = () => undefined;
    console.warn = () => undefined;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    console.error = originalError;
    console.warn = originalWarn;
  });

  it('finds the public pages', () => {
    expect(pages.map(rel)).toEqual(
      expect.arrayContaining([
        'app/compare/page.tsx',
        'app/add-ons/page.tsx',
        'app/(auth)/signup/page.tsx',
        'app/vision-board-preview/ra-launch-2026-05/page.tsx',
      ])
    );
  });

  it('lists only real pages as unrenderable', () => {
    const known = new Set(pages.map(rel));
    expect(Object.keys(UNRENDERABLE).filter(f => !known.has(f))).toEqual([]);
  });

  it.each(pages.map(file => [rel(file), file]))(
    '%s',
    async (relative, file) => {
      const known = UNRENDERABLE[relative];
      if (known?.outcome === 'throws') {
        // Still unrenderable — if this starts passing, remove it from the list.
        await expect(renderPage(file)).rejects.toThrow();
        return;
      }
      let markup: string;
      try {
        markup = await renderPage(file);
      } catch (error) {
        // A redirect-only page serves no body, so there is no copy to judge.
        if (String((error as Error).message).startsWith('NEXT_REDIRECT ')) {
          return;
        }
        throw error;
      }
      const copy = visibleCopy(markup);
      const length = copy.replace(/\s+/g, '').length;
      if (known?.outcome === 'empty') {
        expect(length).toBe(0);
        return;
      }
      expect(length).toBeGreaterThan(0);
      expect(findClaims(copy)).toEqual([]);
    },
    30_000
  );
});
