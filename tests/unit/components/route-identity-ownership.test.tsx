/**
 * The route identity marker must be OWNED BY THE PAGE, and this is the only control
 * that says so.
 *
 * Raised as BF2 by the independent review of 746a02e6e. The two other controls both
 * pass while the defining invariant is broken:
 *
 *   - `route-identity.test.tsx` renders `<RouteIdentity>` in isolation. It cannot see
 *     where the component is used.
 *   - `scripts/check-route-identity-markers.mjs` reads the built HTML. A marker emitted
 *     by `layout.tsx` or `error.tsx` lands in that HTML looking exactly like a marker
 *     emitted by `page.tsx`; the artefact carries no provenance to tell them apart.
 *
 * So both stay green if the marker moves up into a layout or an error boundary - and
 * that mutation recreates the original defect this whole gate exists to close: a marker
 * that SURVIVES when the page subtree fails. A shared ancestor keeps rendering while the
 * page errors, so the signal would certify a page that never rendered.
 *
 * WHY THIS RENDERS INSTEAD OF READING SOURCE.
 *
 * Three earlier versions analysed source, and the independent review defeated every one
 * of them by executing mutants:
 *
 *   v1 matched the token `RouteIdentity` in file text. The review deleted the real usage
 *   from login/page.tsx, left `// <RouteIdentity ...` behind as a COMMENT to satisfy the
 *   page assertion, and emitted a raw `<span data-synthex-route="/login">` from
 *   login/layout.tsx. Passed 6/6.
 *
 *   v2 read the TypeScript AST and also scanned for the attribute. The review left an
 *   UNUSED `<RouteIdentity route="/login" />` expression in page.tsx to satisfy the AST
 *   check, and emitted the real marker from login/layout.tsx through a spread whose keys
 *   were assembled as `'data-synthex-' + 'route'`, which the text scan could not see.
 *   Passed 8/8.
 *
 *   v3 rendered the ancestors - but kept a literal source scan as a FALLBACK for the two
 *   modules jest could not mount, `app/layout.tsx` (it imports global CSS) and
 *   `app/error.tsx` (it needs the app router). The review planted
 *   `<span {...{ ['data-synthex-' + 'route']: '/forged-from-error-boundary' }} />` in
 *   `app/error.tsx`; the literal `data-synthex-route` never appears in that file, so the
 *   scan returned 0 and the suite passed 4/4 with a forged marker in the tree.
 *
 * Every mutant wins the same way: static analysis reads how the marker is WRITTEN, and
 * there are unlimited ways to write it. Two further holes make a source scan unfixable
 * here rather than merely weak:
 *
 *   - it reads ONE file, so a marker emitted by a component that file imports (`Card`,
 *     `Providers`) is invisible no matter how the scan is written. Closing that needs the
 *     whole import graph, which is unbounded.
 *   - "does this module emit attribute X" is not decidable from source at all. A key can
 *     be concatenated, built with `String.fromCharCode`, spread from a variable, or read
 *     from a template literal. Adding each spelling to a pattern list is a denylist, and
 *     a denylist fails open against the next spelling forever.
 *
 * So v4 renders EVERY ancestor and queries the DOM, and there is no source path left. A
 * spread, a concatenated key, `React.createElement`, a string assembled at runtime -
 * every one of them still puts `data-synthex-route` in the rendered output, which is the
 * only thing the smoke gate ever reads. What the source looks like stops mattering.
 *
 * AND AN ANCESTOR THAT CANNOT BE RENDERED IS A FAILURE, NOT A WEAKER CHECK.
 *
 * That is the rule the P0 turned on. If the property is only decidable at render, then a
 * module that will not mount leaves it UNDECIDED, and an undecided ancestor must fail
 * closed. Downgrading it to something cheaper is how the forged marker got through: the
 * gate reported a pass over a file it had never actually evaluated. `app/layout.tsx` and
 * `app/error.tsx` are made mountable below (mocking only FRAMEWORK modules - never an app
 * component, which could hide the very output this control inspects), so the clean tree is
 * green because every ancestor was genuinely rendered.
 *
 * The count is taken over the whole `document`, not RTL's container. React 19 treats
 * `<html>`, `<head>` and `<body>` as singletons and can place a layout's children on the
 * real document instead of inside the container - and `app/layout.tsx` is exactly such a
 * module, so a container-scoped query would be blind in the one file that most needed
 * rendering.
 *
 * WHAT THIS DOES NOT ASSERT, AND WHY THAT IS COMPLETE.
 *
 * It does not check that the page renders a marker; `check-route-identity-markers.mjs`
 * already proves each checked route's document carries exactly one correct marker. This
 * control proves no ANCESTOR of those routes emits one. Together the two force the
 * marker to originate in the page, without either needing to parse source.
 *
 * Scope is the ancestor chain of the routes the smoke gate actually checks, derived from
 * those routes rather than listed. A marker in `app/dashboard/layout.tsx` cannot forge a
 * signal for `/login`, so the chain is the honest surface, not an allow-list.
 *
 * Known residual, stated rather than hidden: this decides what a component emits UNDER
 * JEST. A forgery gated on `process.env.NODE_ENV !== 'test'` would render here as nothing
 * and in production as a marker. No test-time control can reach that, this one included;
 * it is caught, if at all, by reading the diff.
 */

// Framework modules only. Mocking an app component that renders above the page -
// Providers, ErrorBoundary, Toaster, LazyClientComponents - would delete from the render
// exactly the output this control exists to inspect, so none of them is mocked.

// `app/error.tsx` calls useRouter(), which throws "invariant expected app router to be
// mounted" outside a Next.js app tree. Plain functions, not jest.fn(): the jest config
// sets resetMocks, which wipes jest.fn implementations before each test and would leave
// useRouter returning undefined.
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: () => {},
  notFound: () => {},
}));

// `app/layout.tsx` imports './globals.css'. Jest has no CSS transform, so the file was
// parsed as JavaScript and the import failed with "Invalid or unexpected token".
jest.mock('../../../app/globals.css', () => ({}));

// next/font/google is a build-time babel transform; imported at runtime it throws. Each
// loader returns the shape the layout reads off it.
jest.mock('next/font/google', () => {
  const face = () => ({
    className: 'font-stub',
    variable: '--font-stub',
    style: { fontFamily: 'stub' },
  });
  return new Proxy({}, { get: () => face });
});

import { cleanup, render } from '@testing-library/react';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import React from 'react';

const ROOT = join(__dirname, '..', '..', '..');
const APP = join(ROOT, 'app');
const MARKER_ATTR = 'data-synthex-route';

/** Routes the smoke gate checks. Mirrors WANT in check-route-identity-markers.mjs. */
const CHECKED_ROUTES = ['/', '/login', '/pricing'];

/** Files that render ABOVE or INSTEAD OF a page, so their output survives its failure. */
const ANCESTOR_KINDS = [
  'layout.tsx',
  'template.tsx',
  'error.tsx',
  'loading.tsx',
  'not-found.tsx',
];

/** A path segment that groups routes without appearing in the URL. */
const isGroup = (segment: string) =>
  segment.startsWith('(') && segment.endsWith(')');

/** Every page.tsx under app/, with the URL path it actually serves. */
function pagesByRoute(): Map<string, string> {
  const out = new Map<string, string>();
  for (const rel of readdirSync(APP, { recursive: true }) as string[]) {
    if (!rel.endsWith(`${sep}page.tsx`) && rel !== 'page.tsx') continue;
    const segments = dirname(rel)
      .split(sep)
      .filter(s => s && s !== '.' && !isGroup(s));
    out.set('/' + segments.join('/'), join('app', rel));
  }
  return out;
}

/**
 * Ancestor files between app/ and the given page, inclusive of every level.
 *
 * These are the only files whose render can outlive the page's own.
 */
function ancestorsOf(pageRel: string): string[] {
  const found: string[] = [];
  let dir = dirname(join(ROOT, pageRel));
  for (;;) {
    for (const kind of ANCESTOR_KINDS) {
      const candidate = join(dir, kind);
      if (existsSync(candidate)) found.push(relative(ROOT, candidate));
    }
    if (dir === APP) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return found;
}

type Outcome = {
  file: string;
  markers: number;
  rendered: boolean;
  note?: string;
};

/**
 * Markers anywhere a browser would see them.
 *
 * Deliberately `document`, not the render container - see the header note on React 19
 * host singletons. A layout's `<body>` children can land outside the container.
 */
const countMarkers = () => document.querySelectorAll(`[${MARKER_ATTR}]`).length;

/** Mount an element, count what it put in the document, and leave the document clean. */
function markersFromRender(element: React.ReactElement): number {
  try {
    render(element);
    return countMarkers();
  } finally {
    cleanup();
  }
}

/** Render an ancestor with a stub child and count markers in what it produced. */
function renderAncestor(rel: string): Outcome {
  const spec = join(ROOT, rel).replace(/\.tsx$/, '');
  let mod: { default?: React.ComponentType<Record<string, unknown>> };
  try {
    mod = require(spec);
  } catch (e) {
    return {
      file: rel,
      markers: 0,
      rendered: false,
      note: `import failed: ${(e as Error).message.slice(0, 120)}`,
    };
  }
  const Component = mod.default;
  if (typeof Component !== 'function') {
    return {
      file: rel,
      markers: 0,
      rendered: false,
      note: 'no default component export',
    };
  }
  try {
    const markers = markersFromRender(
      React.createElement(
        Component,
        {
          error: Object.assign(new Error('ownership probe'), {
            digest: 'probe',
          }),
          reset: () => {},
          params: {},
          searchParams: {},
        },
        // children as the third argument, so a layout still receives a subtree
        React.createElement('div', { 'data-stub': '1' })
      )
    );
    return { file: rel, markers, rendered: true };
  } catch (e) {
    // The assertion message stays short; the stack is what someone actually needs to
    // make the file mountable again, and a failure here now blocks the gate.
    console.error(`[ownership] ${rel} failed to render\n`, e);
    return {
      file: rel,
      markers: 0,
      rendered: false,
      note: `render threw: ${(e as Error).message.slice(0, 120)}`,
    };
  }
}

/**
 * The whole rule, in one place so a control can arm each branch of it.
 *
 * Two ways to fail, and the second is the one the P0 was about: an ancestor whose output
 * could not be observed has NOT been shown to be clean, so it fails.
 */
function ownershipFailures(outcomes: Outcome[]): string[] {
  const problems: string[] = [];
  for (const o of outcomes) {
    if (!o.rendered) {
      problems.push(
        `${o.file}: could not be rendered, so what it emits is undecided (${o.note}). ` +
          'Make it mountable in jest - an ancestor this control cannot observe must fail, ' +
          'never fall back to reading its source.'
      );
    } else if (o.markers > 0) {
      problems.push(
        `${o.file}: rendered ${o.markers} route identity marker(s). Only a page may emit one; ` +
          'an ancestor outlives the page it would be certifying.'
      );
    }
  }
  return problems;
}

const PAGES = pagesByRoute();
const CHAIN = [
  ...new Set(
    CHECKED_ROUTES.flatMap(r => {
      const page = PAGES.get(r);
      return page ? ancestorsOf(page) : [];
    })
  ),
].sort();

describe('route identity marker ownership', () => {
  beforeAll(() => {
    // jsdom ships no matchMedia. next-themes calls it while mounting, and it mounts
    // inside app/layout.tsx via app/providers.tsx - so without this the root layout
    // throws, which is now a gate failure. A browser API, not an app component, so
    // stubbing it hides nothing this control is looking for.
    if (typeof window.matchMedia !== 'function') {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    }
  });

  it('every checked route resolves to a real page file', () => {
    // Positive control. If a route stopped resolving, its ancestor chain would be empty
    // and every assertion below would pass over nothing.
    for (const route of CHECKED_ROUTES) {
      expect(PAGES.get(route)).toBeTruthy();
    }
  });

  it('the chain reaches the layout the review used to smuggle a marker', () => {
    // Second positive control, naming the exact file both mutants emitted from. A walk
    // that silently missed it would make this suite certify nothing.
    expect(CHAIN).toContain(join('app', '(auth)', 'login', 'layout.tsx'));
    expect(CHAIN).toContain(join('app', '(auth)', 'layout.tsx'));
    // The two files the v3 fallback source-scanned instead of rendering. app/error.tsx is
    // where the review planted the forgery that passed; if either dropped out of the
    // chain the fix would be certifying a surface it no longer covers.
    expect(CHAIN).toContain(join('app', 'layout.tsx'));
    expect(CHAIN).toContain(join('app', 'error.tsx'));
    expect(CHAIN.length).toBeGreaterThan(3);
  });

  it('every ancestor of a checked route renders, and none emits a marker', () => {
    const outcomes = CHAIN.map(renderAncestor);
    expect(ownershipFailures(outcomes)).toEqual([]);
  });

  it('the rule fails an ancestor that emits a marker', () => {
    // Negative control for branch one of ownershipFailures.
    expect(
      ownershipFailures([
        { file: 'app/x/layout.tsx', markers: 1, rendered: true },
      ])
    ).toHaveLength(1);
  });

  it('the rule fails an ancestor it could not render', () => {
    // Negative control for branch two - the branch the P0 was about. Without this, the
    // fail-closed path is a control that has never been watched firing.
    const unmountable = renderAncestor(
      join('app', '__no_such_ancestor_for_this_control__.tsx')
    );
    expect(unmountable.rendered).toBe(false);
    expect(ownershipFailures([unmountable])).toHaveLength(1);
    expect(ownershipFailures([unmountable])[0]).toContain('undecided');
  });

  it('detects a marker an ancestor emits however the attribute is constructed', () => {
    // Negative control for the DETECTION mechanism, shaped like the file that defeated
    // v3: a root layout emitting <html>/<body>, with the marker key assembled at runtime
    // by three different spellings at once. A source scan sees none of them.
    //
    // The <html>/<body> wrapper is load-bearing. React 19 may place those children on the
    // real document rather than in the render container, so this also proves the count is
    // not blind to where a layout's output actually lands.
    const concatenated = 'data-synthex-' + 'route';
    const charCoded = String.fromCharCode(
      100,
      97,
      116,
      97,
      45,
      115,
      121,
      110,
      116,
      104,
      101,
      120,
      45,
      98,
      117,
      105,
      108,
      100
    );
    const via = 'route';
    const templated = `data-synthex-${via}`;
    const spreadFromVariable: Record<string, string> = {
      [concatenated]: '/login',
      [charCoded]: 'forged',
    };

    const SneakyLayout = () =>
      React.createElement(
        'html',
        null,
        React.createElement(
          'body',
          null,
          React.createElement('span', { ...spreadFromVariable }),
          React.createElement('span', { [templated]: '/pricing' })
        )
      );

    expect(markersFromRender(React.createElement(SneakyLayout))).toBe(2);

    // Isolation control, and it belongs HERE rather than after the ancestor loop: this is
    // the one place a marker was definitely present and definitely hoisted, so a zero now
    // proves cleanup drained it. Asserting zero after a loop that already reported zero
    // markers would be a tautology - the shape this reviewer has caught three times.
    expect(countMarkers()).toBe(0);

    expect(charCoded).toBe('data-synthex-build');
    expect(templated).toBe(MARKER_ATTR);
  });
});
