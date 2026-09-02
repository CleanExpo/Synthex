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
 * Two earlier versions analysed source, and the independent review defeated both by
 * executing mutants:
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
 * Both mutants win the same way: static analysis reads how the marker is WRITTEN, and
 * there are unlimited ways to write it. A third source-level patch would be the third
 * round of the same mistake.
 *
 * So this control renders the ancestors and queries the DOM. A spread, a concatenated
 * attribute key, `React.createElement`, a string assembled at runtime - every one of them
 * still puts `data-synthex-route` in the rendered output, which is the only thing the
 * smoke gate ever reads. What the source looks like stops mattering.
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
 */
import { render } from '@testing-library/react';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
      note: `import failed: ${(e as Error).message.slice(0, 80)}`,
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
    const { container } = render(
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
    return {
      file: rel,
      markers: container.querySelectorAll(`[${MARKER_ATTR}]`).length,
      rendered: true,
    };
  } catch (e) {
    return {
      file: rel,
      markers: 0,
      rendered: false,
      note: `render threw: ${(e as Error).message.slice(0, 80)}`,
    };
  }
}

/**
 * Fallback for a module jest cannot mount (the root layout imports global CSS; the root
 * error boundary needs the app router). Weaker than a render - it reads source - so it is
 * reported separately and never presented as the same evidence.
 */
function scanSource(rel: string): number {
  try {
    return readFileSync(join(ROOT, rel), 'utf8').includes(MARKER_ATTR) ? 1 : 0;
  } catch {
    return 0;
  }
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
    expect(CHAIN.length).toBeGreaterThan(3);
  });

  it('no ancestor of a checked route emits a marker in its rendered output', () => {
    const outcomes = CHAIN.map(renderAncestor);
    const emitting = outcomes
      .filter(o => o.rendered && o.markers > 0)
      .map(o => o.file);
    expect(emitting).toEqual([]);

    // Nothing is skipped: a module that could not be mounted still gets the weaker
    // source scan, and is reported so the gap is visible rather than silent.
    const unrenderable = outcomes.filter(o => !o.rendered);
    const smuggled = unrenderable
      .filter(o => scanSource(o.file) > 0)
      .map(o => o.file);
    expect(smuggled).toEqual([]);
    if (unrenderable.length > 0) {
      console.log(
        'source-scanned only (could not mount in jest):\n' +
          unrenderable.map(o => `  ${o.file} - ${o.note}`).join('\n')
      );
    }
  });

  it('detects a marker an ancestor emits however the attribute is constructed', () => {
    // Negative control for the assertion above, using the review's own v2 mutant: a
    // spread whose keys are assembled at runtime. A source scan cannot see this; the
    // rendered DOM always can.
    const key = 'data-synthex-';
    const Sneaky = () =>
      React.createElement('span', {
        [`${key}route`]: '/login',
        [`${key}build`]: 'x',
      });
    const { container } = render(React.createElement(Sneaky));
    expect(container.querySelectorAll(`[${MARKER_ATTR}]`).length).toBe(1);
  });
});
