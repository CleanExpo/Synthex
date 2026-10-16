/**
 * Claims this branch removed must not appear in what a visitor receives —
 * SUPPLEMENTARY layer of the blocking tripwire (SYN-1226).
 *
 * The blocking guarantee is the union of the layers `npm run claims:guard`
 * runs; the source fragment-stream layer (public-claims.test.ts) is the
 * complete layer for restored literal copy. This layer adds what only a
 * render produces, in the states it exercises — and only those:
 *  - every public page.tsx, server render and client render (effects and
 *    same-origin fetches settled);
 *  - the default state (no rows) and the PAGE_VARIANTS fixture states
 *    (bio, clients, blog post, blog, benchmark, analytics, credential
 *    intake, testimonial, welcome — each with its listed variants);
 *  - every inactive tab selected, collapsed accordion/disclosure expanded and
 *    <details> opened, once;
 *  - same-origin API data as the real handlers answer it for the fixtures.
 * Not exercised (covered by the source layer only): client branches fed by
 * a response shape the API does not return (e.g. /analytics' trends — its
 * API answers { data: { totals } }), states behind other inputs or
 * interactions, and copy from live AI/DB/external data.
 *
 * The source check (public-claims.test.ts) judges copy as written; this suite
 * judges it as served. Every public page.tsx is rendered twice:
 *  - on the server, with react-dom/server, awaiting async pages and the async
 *    server components inside them;
 *  - in the browser (jsdom, Testing Library), waiting for client effects and
 *    data loads to settle, so copy fetched after mount is judged too.
 * The normalised text, JSON-LD and copy-bearing attributes of both are
 * judged by the tripwire (exact seeds + high-precision patterns, nothing
 * allow-listed; see public-claims.test.ts).
 *
 * Data is real code over deterministic fixtures, not stubbed copy:
 *  - Prisma resolves per-page fixture rows (PAGE_FIXTURES), empty otherwise;
 *  - same-origin fetch('/api/…') is routed to the real route handler (its
 *    exported GET/POST called with a NextRequest), as a signed-in visitor, so
 *    API-fed copy renders as visitors see it. Other origins answer 503.
 * Each fixture names marker strings that must appear in the rendered copy,
 * which proves the page rendered its populated state, not an empty one; a
 * populated fixture without a marker fails.
 *
 * Copy behind an interaction is opened before scanning: every inactive tab
 * is selected, every collapsed accordion or disclosure expanded and every
 * <details> opened, and the markup of each state is judged.
 *
 * A page that stops rendering fails here.
 * Redirect-only pages (they call redirect()) serve no body to judge.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { SWRConfig } from 'swr';
import { generateToken } from '@/lib/auth/jwt-utils';
import { createCredentialIntakeToken } from '@/lib/credential-intake/tokens';
import path from 'path';
import {
  ROOT,
  apiRoutes,
  matchApiRoute,
  publicPageFiles,
  rel,
  renderedSentencesText,
  routeOf,
  isGovernedUnchanged,
  tripwireHits,
} from './helpers/public-claims';

// ── Fixture registry (read by the Prisma mock) ──────────────────────────────

type FixtureValue = unknown | ((args: unknown) => unknown);
type PrismaFixtures = Record<string, Record<string, FixtureValue>>;

declare global {
  var __copyFixtures: PrismaFixtures;
  var __copyReads: number;
}
globalThis.__copyFixtures = {};
globalThis.__copyReads = 0;

jest.mock('@/lib/prisma', () => {
  const empty = (method: string) => {
    if (/^find(Many)?$|^groupBy$/.test(method)) return [];
    if (/^count$/.test(method)) return 0;
    if (/^aggregate$/.test(method)) return {};
    return null;
  };
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string) => async (args: unknown) => {
          globalThis.__copyReads = (globalThis.__copyReads ?? 0) + 1;
          const fixture = globalThis.__copyFixtures[name]?.[String(method)];
          if (fixture === undefined) return empty(String(method));
          return typeof fixture === 'function'
            ? (fixture as (a: unknown) => unknown)(args)
            : fixture;
        },
      }
    );
  const client = new Proxy(
    {},
    {
      get: (_t, key: string) => {
        if (key === '__esModule') return false;
        if (key === 'then') return undefined;
        if (String(key).startsWith('$')) return async () => [];
        return model(String(key));
      },
    }
  );
  return { __esModule: true, default: client, prisma: client };
});

jest.mock('next/navigation', () => {
  const router = {
    push: () => undefined,
    replace: () => undefined,
    prefetch: () => undefined,
    back: () => undefined,
    forward: () => undefined,
    refresh: () => undefined,
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

jest.mock('server-only', () => ({}), { virtual: true });

// react-markdown is ESM-only and not transformed by this Jest config. Render
// the markdown source as text: the copy, not its formatting, is judged.
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-markdown="">{children}</div>
  ),
}));

// ── Per-page fixtures ───────────────────────────────────────────────────────

const NOW = new Date('2026-10-14T00:00:00.000Z');
const SOON = new Date('2026-10-16T09:00:00.000Z');
const FIXTURE_USER = 'fixture-user';
const FIXTURE_ORG = 'fixture-org';

interface PageFixture {
  params?: Record<string, string>;
  /** Browser URL for the client render (path + query). */
  url?: () => string;
  prisma: PrismaFixtures;
  /** Strings that must appear in the rendered copy. */
  markers: string[];
}

const PAGE_FIXTURES: Record<string, PageFixture> = {
  'app/bio/[slug]/page.tsx': {
    params: { slug: 'fixture-bio' },
    prisma: {
      linkBioPage: {
        findUnique: {
          id: 'bio-1',
          slug: 'fixture-bio',
          title: 'Fixture Bio Title',
          bio: 'Fixture bio description text.',
          avatarUrl: 'https://example.com/avatar.png',
          coverUrl: 'https://example.com/cover.png',
          theme: 'default',
          primaryColor: '#ff6b35',
          backgroundColor: '#0f172a',
          textColor: '#ffffff',
          buttonStyle: 'rounded',
          socialLinks: [
            { platform: 'instagram', url: 'https://instagram.com/fixture' },
          ],
          showBranding: true,
          isPublished: true,
          links: [
            {
              id: 'link-1',
              title: 'Fixture Link Title',
              url: 'https://example.com/fixture',
              iconType: 'emoji',
              iconValue: '🔗',
              isHighlighted: true,
            },
          ],
        },
      },
    },
    markers: [
      'Fixture Bio Title',
      'Fixture bio description text.',
      'Fixture Link Title',
    ],
  },

  'app/clients/[slug]/page.tsx': {
    params: { slug: 'fixture-client' },
    prisma: {
      organization: {
        findUnique: {
          slug: 'fixture-client',
          name: 'Fixture Organisation',
          description: 'Fixture client description.',
          website: 'https://fixture.example.com',
          industry: 'Fixture Industry',
          phoneNumber: '+61 2 0000 0000',
          logo: 'https://example.com/logo.png',
          primaryColor: '#ff6b35',
          brandDna: {
            businessName: 'Fixture Business Name',
            vertical: 'Fixture Vertical',
            brandVoice: { tone: 'friendly' },
          },
          gbpLocations: [
            {
              address: {
                addressLines: ['1 Fixture Street'],
                locality: 'Fixtureville',
                region: 'NSW',
                postalCode: '2000',
                country: 'AU',
              },
              phone: '+61 2 1111 1111',
              hours: {
                regularHours: {
                  periods: [
                    {
                      openDay: 'MONDAY',
                      openTime: '09:00',
                      closeDay: 'MONDAY',
                      closeTime: '17:00',
                    },
                  ],
                },
              },
              reviews: [
                {
                  id: 'review-1',
                  reviewerName: 'Fixture Reviewer',
                  rating: 5,
                  comment: 'Fixture review comment.',
                  reviewTime: NOW,
                  isFeatured: true,
                },
              ],
            },
          ],
        },
        findMany: [{ slug: 'fixture-client' }],
      },
      authorityScore: {
        findFirst: {
          score: 72,
          eeAtBreakdown: {
            gbpCompleteness: 80,
            reviewVelocity: 60,
            contentFreshness: 70,
            backlinkSignals: 50,
            schemaCoverage: 90,
            reviewResponseRate: 65,
            averageReviewScore: 85,
          },
        },
      },
    },
    markers: [
      'Fixture Business Name',
      'Fixture client description.',
      'Fixture Reviewer',
      'Fixture review comment.',
      '1 Fixture Street',
    ],
  },

  'app/blog/[slug]/page.tsx': {
    params: { slug: 'fixture-post' },
    prisma: {
      blogPost: {
        findFirst: {
          id: 'post-1',
          slug: 'fixture-post',
          title: 'Fixture Post Title',
          excerpt: 'Fixture post excerpt.',
          content: 'Fixture post body paragraph.',
          author: 'Fixture Author',
          category: 'Fixture Category',
          tags: ['fixture-tag'],
          ogImage: null,
          ogImageAlt: null,
          seoTitle: null,
          seoDescription: null,
          readTime: 4,
          wordCount: 800,
          publishedAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          aiGenerated: false,
          views: 12,
        },
        update: {},
      },
    },
    markers: [
      'Fixture Post Title',
      'Fixture post body paragraph.',
      'Fixture Author',
    ],
  },

  'app/blog/page.tsx': {
    prisma: {
      blogPost: {
        findMany: [
          {
            id: 'post-1',
            slug: 'fixture-post',
            title: 'Fixture Listed Post Title',
            excerpt: 'Fixture listed post excerpt.',
            author: 'Fixture Author',
            category: 'Fixture Category',
            tags: ['fixture-tag'],
            ogImage: null,
            readTime: 4,
            publishedAt: NOW.toISOString(),
            aiGenerated: false,
          },
        ],
        count: 1,
      },
    },
    markers: ['Fixture Listed Post Title'],
  },

  'app/benchmark/page.tsx': {
    prisma: {
      platformConnection: {
        count: 30,
        findMany: [{ platform: 'instagram' }, { platform: 'linkedin' }],
      },
      platformPost: { count: 120 },
    },
    markers: ['Based on 30 anonymised Synthex client accounts'],
  },

  'app/analytics/page.tsx': {
    prisma: {
      campaign: { findMany: [{ id: 'campaign-1' }] },
      post: {
        findMany: [
          {
            id: 'post-a1',
            platform: 'instagram',
            status: 'published',
            analytics: {
              reach: 900,
              engagement: 45,
              impressions: 1500,
              clicks: 30,
            },
            publishedAt: NOW,
            createdAt: NOW,
          },
        ],
      },
      apiUsage: {
        findMany: [{ endpoint: '/api/fixture', status: 200, createdAt: NOW }],
      },
    },
    // /api/analytics answers { data: { totals } }, which this client does not
    // read, so no row reaches the copy. The markers are copy that exists only
    // on the Top Content and Insights tabs: they prove the tabs were opened.
    markers: ['Your best posts based on engagement', 'Key Insights'],
  },

  'app/credential-intake/page.tsx': {
    url: () =>
      `/credential-intake?token=${encodeURIComponent(
        createCredentialIntakeToken({
          organizationId: FIXTURE_ORG,
          providers: ['facebook'],
          createdByUserId: FIXTURE_USER,
        })
      )}`,
    prisma: {
      organization: {
        findUnique: {
          id: FIXTURE_ORG,
          name: 'Fixture Intake Organisation',
          slug: 'fixture-intake',
          status: 'active',
        },
      },
    },
    markers: ['Fixture Intake Organisation'],
  },

  'app/testimonial/[token]/page.tsx': {
    params: { token: 'fixture-token' },
    prisma: {
      testimonialRequest: {
        findUnique: {
          id: 'treq-1',
          title: 'Fixture Testimonial Title',
          subtitle: 'Fixture testimonial subtitle.',
          isActive: true,
          expiresAt: null,
          organization: { name: 'Fixture Testimonial Business' },
        },
      },
    },
    markers: ['Fixture Testimonial Title', 'Fixture testimonial subtitle.'],
  },

  'app/welcome/page.tsx': {
    prisma: {
      teamMember: {
        findFirst: {
          id: 'tm-1',
          organizationId: FIXTURE_ORG,
          lastActiveAt: null,
          lastWeeklyActiveFiredAt: null,
          organization: {
            id: FIXTURE_ORG,
            name: 'Fixture Welcome Organisation',
            users: [{ name: 'Fixture Owner', email: 'owner@example.com' }],
          },
        },
        update: {},
      },
      authorityScore: { findFirst: { score: 64 } },
      monthlyStory: {
        findFirst: {
          monthYear: '2026-09',
          storyText: 'Fixture monthly story text.',
          totalReach: 1234,
          postsPublished: 8,
        },
      },
      publishQueueItem: {
        findMany: [
          {
            id: 'post-q-1',
            platform: 'instagram',
            scheduledAt: SOON,
            status: 'pending',
          },
        ],
      },
    },
    markers: [
      'Fixture Welcome Organisation',
      'Fixture Owner',
      'Fixture monthly story text.',
    ],
  },
};

// Each data-dependent page renders in every state listed here, as well as
// its default state (no fixture rows at all). Variants cover the empty and
// other visible branches: no links, no reviews, an expired link…
type Rows = Record<string, unknown>;
const row = (page: string, model: string, method: string) =>
  PAGE_FIXTURES[page].prisma[model][method] as Rows;
function variant(
  page: string,
  prisma: PrismaFixtures,
  markers: string[]
): PageFixture {
  const base = PAGE_FIXTURES[page];
  const merged: PrismaFixtures = { ...base.prisma };
  for (const [model, methods] of Object.entries(prisma)) {
    merged[model] = { ...base.prisma[model], ...methods };
  }
  return { ...base, prisma: merged, markers };
}

const BIO = 'app/bio/[slug]/page.tsx';
const CLIENT = 'app/clients/[slug]/page.tsx';
const POST = 'app/blog/[slug]/page.tsx';
const INTAKE = 'app/credential-intake/page.tsx';
const TESTIMONIAL = 'app/testimonial/[token]/page.tsx';
const WELCOME = 'app/welcome/page.tsx';

const PAGE_VARIANTS: Record<string, Record<string, PageFixture>> = {
  'app/blog/page.tsx': { populated: PAGE_FIXTURES['app/blog/page.tsx'] },
  'app/benchmark/page.tsx': {
    populated: PAGE_FIXTURES['app/benchmark/page.tsx'],
  },
  'app/analytics/page.tsx': {
    populated: PAGE_FIXTURES['app/analytics/page.tsx'],
  },
  [BIO]: {
    populated: PAGE_FIXTURES[BIO],
    'no links, no bio, no branding': variant(
      BIO,
      {
        linkBioPage: {
          findUnique: {
            ...row(BIO, 'linkBioPage', 'findUnique'),
            bio: null,
            avatarUrl: null,
            coverUrl: null,
            socialLinks: [],
            showBranding: false,
            links: [],
          },
        },
      },
      ['Fixture Bio Title', 'No links yet']
    ),
  },
  [CLIENT]: {
    populated: PAGE_FIXTURES[CLIENT],
    'no reviews, location, contact or score': variant(
      CLIENT,
      {
        organization: {
          findUnique: {
            ...row(CLIENT, 'organization', 'findUnique'),
            description: null,
            website: null,
            industry: null,
            phoneNumber: null,
            logo: null,
            brandDna: null,
            gbpLocations: [],
          },
        },
        authorityScore: { findFirst: null },
      },
      ['Fixture Organisation']
    ),
  },
  [POST]: {
    populated: PAGE_FIXTURES[POST],
    'minimal post': variant(
      POST,
      {
        blogPost: {
          findFirst: {
            ...row(POST, 'blogPost', 'findFirst'),
            excerpt: '',
            category: null,
            tags: [],
            readTime: null,
            wordCount: null,
            publishedAt: null,
          },
        },
      },
      ['Fixture Post Title']
    ),
  },
  [INTAKE]: {
    populated: PAGE_FIXTURES[INTAKE],
    'inactive organisation': variant(
      INTAKE,
      {
        organization: {
          findUnique: {
            ...row(INTAKE, 'organization', 'findUnique'),
            status: 'suspended',
          },
        },
      },
      ['Organisation is not available']
    ),
  },
  [TESTIMONIAL]: {
    populated: PAGE_FIXTURES[TESTIMONIAL],
    'expired link': variant(
      TESTIMONIAL,
      {
        testimonialRequest: {
          findUnique: {
            ...row(TESTIMONIAL, 'testimonialRequest', 'findUnique'),
            expiresAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        },
      },
      ['This link has expired.']
    ),
  },
  [WELCOME]: {
    populated: PAGE_FIXTURES[WELCOME],
    'no score, story or upcoming posts': variant(
      WELCOME,
      {
        authorityScore: { findFirst: null },
        monthlyStory: { findFirst: null },
        publishQueueItem: { findMany: [] },
      },
      ['Fixture Welcome Organisation']
    ),
  },
};

const DEFAULT_STATE = 'default (no rows)';

// ── Same-origin fetch → real route handlers ─────────────────────────────────

const ROUTES = apiRoutes();
const SITE = new URL(
  process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social'
);
const SAME_ORIGIN_HOSTS = new Set([
  'localhost',
  SITE.hostname,
  'synthex.social',
]);
let inflight = 0;

function plainResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

async function routedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const url = new URL(urlOf(input), `${SITE.origin}/`);
  if (
    !SAME_ORIGIN_HOSTS.has(url.hostname) ||
    !url.pathname.startsWith('/api/')
  ) {
    return plainResponse(503, {});
  }
  const hit = matchApiRoute(ROUTES, url.pathname);
  if (!hit) return plainResponse(404, { error: 'No such route' });
  globalThis.__copyReads = (globalThis.__copyReads ?? 0) + 1;
  const method = (init.method ?? 'GET').toUpperCase();

  const handler = (require(hit.route.file) as Record<string, unknown>)[method];
  if (typeof handler !== 'function') return plainResponse(405, {});
  // A plain object: the Jest Request polyfill reads headers with
  // Object.entries, which sees nothing on a Headers instance.
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    authorization: `Bearer ${generateToken({ userId: FIXTURE_USER, email: 'fixture@example.com' } as never)}`,
  };
  const request = new NextRequest(
    new URL(url.pathname + url.search, SITE.origin),
    {
      method,
      headers,
      body:
        method === 'GET' || method === 'HEAD'
          ? undefined
          : (init.body as BodyInit),
    }
  );
  inflight++;
  try {
    const response = await (
      handler as (r: NextRequest, c: unknown) => Promise<Response>
    )(request, { params: Promise.resolve(hit.params) });
    // The Jest Response polyfill has no `ok`; pages branch on it.
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: response.headers,
      json: () => response.json(),
      text: () => response.text(),
    } as unknown as Response;
  } finally {
    inflight--;
  }
}

// ── Rendering ───────────────────────────────────────────────────────────────

// Browser APIs jsdom does not implement, at their inert defaults.
function installBrowserApis() {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.ResizeObserver ??= Observer as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??=
    Observer as unknown as typeof IntersectionObserver;
  window.scrollTo ??= (() => undefined) as typeof window.scrollTo;
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
  HTMLMediaElement.prototype.play ??= async () => undefined;
  HTMLMediaElement.prototype.pause ??= () => undefined;
}

function paramsFor(
  route: string,
  fixture?: PageFixture
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [, name] of route.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)) {
    params[name] = fixture?.params?.[name] ?? 'example';
  }
  return params;
}

const isAsync = (fn: unknown) =>
  typeof fn === 'function' && fn.constructor.name === 'AsyncFunction';

// Resolve async server components ahead of React DOM, which (unlike the RSC
// renderer) cannot await them. Client components are left to React.
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

async function pageTree(
  file: string,
  fixture?: PageFixture
): Promise<React.ReactNode> {
  const mod = require(file) as { default: (props: unknown) => React.ReactNode };
  const Page = mod.default;
  if (typeof Page !== 'function') {
    throw new Error('no default export component');
  }
  const props = {
    params: Promise.resolve(paramsFor(routeOf(file), fixture)),
    searchParams: Promise.resolve({}),
  };
  const tree = isAsync(Page)
    ? await (Page as (p: unknown) => Promise<React.ReactNode>)(props)
    : React.createElement(Page as React.ComponentType<unknown>, props);
  return resolveServerTree(tree);
}

// Interactive controls that hide copy until used.
const HIDDEN_COPY_CONTROLS = [
  '[role="tab"][aria-selected="false"]',
  'button[aria-expanded="false"]',
  '[role="button"][aria-expanded="false"]',
  'summary',
].join(', ');

// Mount in jsdom and wait until effects and same-origin fetches settle.
async function clientMarkup(tree: React.ReactNode): Promise<string> {
  // A fresh SWR cache per render: states must not reuse each other's data.
  const { container } = render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {tree}
    </SWRConfig>
  );
  // Data libraries (SWR) start requests on a later frame, so each step is a
  // real wait, and the DOM must be quiet for several steps in a row.
  const settle = async () => {
    let last = '';
    let stable = 0;
    for (let i = 0; i < 100 && stable < 5; i++) {
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      const html = container.innerHTML;
      stable = inflight === 0 && html === last ? stable + 1 : 0;
      last = html;
    }
  };
  await settle();
  const states = [container.innerHTML];
  // Open every hidden-copy control once, judging each resulting state.
  const used = new WeakSet<Element>();
  for (let round = 0; round < 40; round++) {
    container
      .querySelectorAll('details:not([open])')
      .forEach(d => d.setAttribute('open', ''));
    const next = [...container.querySelectorAll(HIDDEN_COPY_CONTROLS)].find(
      el => !used.has(el)
    );
    if (!next) break;
    used.add(next);
    await act(async () => {
      // Radix tabs select on mousedown; other controls on click.
      fireEvent.mouseDown(next, { button: 0 });
      fireEvent.click(next);
    });
    await settle();
    states.push(container.innerHTML);
  }
  states.push(container.innerHTML);
  cleanup();
  return states.join('\n');
}

// ── Suite ───────────────────────────────────────────────────────────────────

const pages = publicPageFiles();

describe('public copy — unsupported claims (rendered)', () => {
  const originalFetch = global.fetch;
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeAll(() => {
    // The calendar is the fixtures' NOW, so dates in copy are reproducible.
    // Only Date is faked: renders settle on real timers.
    jest.useFakeTimers({
      now: NOW,
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
    installBrowserApis();
    // A plain function: the Jest config resets jest.fn implementations.
    global.fetch = routedFetch as unknown as typeof fetch;
    // Rendering 50+ pages outside Next is noisy; failures are asserted below.
    console.error = () => undefined;
    console.warn = () => undefined;
  });

  afterAll(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    console.error = originalError;
    console.warn = originalWarn;
  });

  afterEach(() => {
    globalThis.__copyFixtures = {};
    window.history.replaceState({}, '', '/');
  });

  it('finds the public pages', () => {
    expect(pages.map(rel)).toEqual(
      expect.arrayContaining([
        'app/compare/page.tsx',
        'app/add-ons/page.tsx',
        'app/(auth)/signup/page.tsx',
        ...Object.keys(PAGE_VARIANTS),
      ])
    );
  });

  // Review previews leave the inventory only because they 404 in production.
  it.each([
    'app/vision-board-preview/ra-launch-2026-05/page.tsx',
    'app/quick-access-preview/page.tsx',
  ])('serves %s to no production visitor', async relative => {
    expect(pages.map(rel)).not.toContain(relative);
    const env = process.env as Record<string, string | undefined>;
    const nodeEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const served = async () => {
        const tree = await pageTree(path.join(ROOT, relative));
        return renderToStaticMarkup(<>{tree}</>);
      };
      await expect(served()).rejects.toThrow('NEXT_NOT_FOUND');
    } finally {
      env.NODE_ENV = nodeEnv;
    }
  });

  it('has fixtures only for real pages', () => {
    const known = new Set(pages.map(rel));
    expect(Object.keys(PAGE_VARIANTS).filter(f => !known.has(f))).toEqual([]);
  });

  const cases: Array<[string, string, string]> = pages.flatMap(file => {
    const relative = rel(file);
    const states = [
      DEFAULT_STATE,
      ...Object.keys(PAGE_VARIANTS[relative] ?? {}),
    ];
    return states.map(
      state => [relative, state, file] as [string, string, string]
    );
  });
  const readsData = new Set<string>();

  it.each(cases)(
    '%s — %s',
    async (relative, state, file) => {
      const fixture =
        state === DEFAULT_STATE ? undefined : PAGE_VARIANTS[relative][state];
      globalThis.__copyFixtures = fixture?.prisma ?? {};
      globalThis.__copyReads = 0;
      const route = routeOf(file);
      const params = paramsFor(route, fixture);
      window.history.replaceState(
        {},
        '',
        fixture?.url?.() ??
          route.replace(
            /\[(?:\.\.\.)?([^\]]+)\]/g,
            (_m, name: string) => params[name]
          )
      );

      let markup: string;
      try {
        const tree = await pageTree(file, fixture);
        markup = renderToStaticMarkup(<>{tree}</>);
        markup += `\n${await clientMarkup(tree)}`;
      } catch (error) {
        cleanup();
        const message = String((error as Error).message);
        // A redirect-only page serves no body, so there is no copy to judge.
        if (message.startsWith('NEXT_REDIRECT ')) return;
        // notFound(): the visitor gets app/not-found.tsx; judge that instead.
        if (message === 'NEXT_NOT_FOUND' && !fixture) {
          const notFound = await pageTree(path.join(ROOT, 'app/not-found.tsx'));
          markup = renderToStaticMarkup(<>{notFound}</>);
        } else {
          throw error;
        }
      }
      if (state === DEFAULT_STATE && globalThis.__copyReads > 0) {
        readsData.add(relative);
      }

      const text = renderedSentencesText(markup);
      expect(text.replace(/\s+/g, '').length).toBeGreaterThan(0);
      if (fixture) expect(fixture.markers.length).toBeGreaterThan(0);
      for (const marker of fixture?.markers ?? []) {
        expect(text).toContain(marker);
      }
      const findings = tripwireHits(text, undefined, {
        governed: isGovernedUnchanged(relative),
      }).map(hit => `${hit.rule} — "${hit.sentence}"`);
      expect(findings).toEqual([]);
    },
    60_000
  );

  // A page that reads data in its default state must also be rendered with a
  // populated fixture, or its data-driven copy is never judged.
  it('gives every data-reading page a populated fixture', () => {
    const missing = [...readsData].filter(f => !PAGE_VARIANTS[f]?.populated);
    expect(missing).toEqual([]);
  });
});
