/**
 * The route identity marker must be OWNED BY THE PAGE, and this is the only control
 * that says so.
 *
 * Raised as BF2 by the independent review of 746a02e6e. The other two controls both
 * pass while the defining invariant is broken:
 *
 *   - `route-identity.test.tsx` renders `<RouteIdentity>` in isolation. It cannot see
 *     where the component is used.
 *   - `scripts/check-route-identity-markers.mjs` reads the built HTML. A marker emitted
 *     by `layout.tsx` or `error.tsx` lands in that HTML looking exactly like a marker
 *     emitted by `page.tsx`; there is no provenance in the artefact to tell them apart.
 *
 * So both stay green if the marker moves up into a layout or an error boundary - and
 * that mutation recreates the original defect this whole gate exists to close: a marker
 * that SURVIVES when the page subtree fails. A shared ancestor keeps rendering while the
 * page errors, so the signal would certify a page that never rendered.
 *
 * WHY THIS PARSES SOURCE INSTEAD OF SEARCHING IT.
 *
 * The first version of this file matched the bare token `RouteIdentity` in file text,
 * and the independent review of c341091f7 broke it by executing a mutant: it deleted the
 * real usage from `login/page.tsx`, left `// <RouteIdentity ...` behind as a COMMENT to
 * satisfy the page assertion, and emitted a raw
 * `<span data-synthex-route="/login" data-synthex-build="local">` from `login/layout.tsx`.
 * The suite passed 6/6 against a tree where an ancestor owned the marker - precisely the
 * defect this control exists to catch.
 *
 * Two holes, one cause: the control policed the component's NAME rather than the marker
 * CONTRACT, and a comment counted as a usage. So:
 *
 *   - The page requirement is now answered from the TypeScript AST, where a comment does
 *     not exist as a node. A commented-out marker cannot satisfy it.
 *   - The ownership rule now looks for the marker ATTRIBUTE as well as the component,
 *     over source with comments stripped by the compiler. A raw span smuggles the marker
 *     just as effectively as the component does, and it is the attribute the smoke gate
 *     actually reads.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import ts from 'typescript';

const ROOT = join(__dirname, '..', '..', '..');
const COMPONENT = 'RouteIdentity';

/** What the built HTML is searched for. Smuggling this is smuggling the marker. */
const MARKER_ATTR = 'data-synthex-route';

/** Where the component itself is defined - the one file exempt from the rule. */
const DEFINITION = join('components', 'system', 'RouteIdentity.tsx');

/** Pages that must carry a marker. Mirrors WANT in check-route-identity-markers.mjs. */
const MARKED_PAGES: Array<[string, string]> = [
  [join('app', 'page.tsx'), '/'],
  [join('app', '(auth)', 'login', 'page.tsx'), '/login'],
  [join('app', 'pricing', 'page.tsx'), '/pricing'],
];

function sourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(join(ROOT, dir), { recursive: true }) as string[];
  } catch {
    return [];
  }
  return entries
    .filter(rel => rel.endsWith('.tsx') || rel.endsWith('.ts'))
    .map(rel => join(dir, rel));
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/**
 * Source with comments removed, by the compiler rather than by a regex.
 *
 * On a parse failure this returns the ORIGINAL text. That direction is deliberate: a
 * commented-out reference then reads as a real one and the ownership test fails loudly,
 * rather than a broken parse quietly exempting a file.
 */
function withoutComments(src: string, rel: string): string {
  try {
    return ts.transpileModule(src, {
      fileName: rel,
      compilerOptions: {
        removeComments: true,
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ESNext,
        isolatedModules: true,
      },
    }).outputText;
  } catch {
    return src;
  }
}

/** Routes this file actually RENDERS a `<RouteIdentity route="...">` for. */
function renderedRoutes(src: string, rel: string): string[] {
  const sf = ts.createSourceFile(
    rel,
    src,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX
  );
  const routes: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      if (node.tagName.getText(sf) === COMPONENT) {
        for (const attr of node.attributes.properties) {
          if (
            ts.isJsxAttribute(attr) &&
            attr.name.getText(sf) === 'route' &&
            attr.initializer &&
            ts.isStringLiteral(attr.initializer)
          ) {
            routes.push(attr.initializer.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return routes;
}

/** Files that emit the marker in any form, comments excluded. */
function emittingFiles(): string[] {
  return [...sourceFiles('app'), ...sourceFiles('components')].filter(rel => {
    if (rel === DEFINITION) return false;
    let src: string;
    try {
      src = read(rel);
    } catch {
      return false;
    }
    const code = withoutComments(src, rel);
    return code.includes(COMPONENT) || code.includes(MARKER_ATTR);
  });
}

describe('route identity marker ownership', () => {
  it('is emitted only by page files - never a layout, error boundary or shared component', () => {
    const offenders = emittingFiles().filter(
      rel => !rel.endsWith(`${sep}page.tsx`)
    );
    expect(offenders).toEqual([]);
  });

  it('catches a RAW marker attribute, not just the component name', () => {
    // The exact smuggling route the c341091f7 review used: a layout emitting the span
    // by hand never mentions RouteIdentity at all.
    const raw = `export default function L() { return <span ${MARKER_ATTR}="/login" data-synthex-build="x" />; }`;
    expect(withoutComments(raw, 'probe.tsx')).toContain(MARKER_ATTR);
  });

  it.each(MARKED_PAGES)('%s renders a marker for %s', (page, route) => {
    // From the AST: a comment is not a node, so `// <RouteIdentity route="/login" />`
    // cannot satisfy this the way a substring search allowed.
    expect(renderedRoutes(read(page), page)).toContain(route);
  });

  it('a commented-out marker does not count as rendering one', () => {
    // Negative control for the assertion above. Without this, a change that reverted
    // the AST check to a substring search would still pass every test here.
    const commented = `export default function P() { return <div>{/* <${COMPONENT} route="/login" /> */}</div>; }`;
    expect(renderedRoutes(commented, 'probe.tsx')).toEqual([]);
  });

  it('finds the component definition where the exemption expects it', () => {
    // A moved or renamed definition would silently exempt nothing and make the
    // ownership test pass for the wrong reason.
    expect(() => read(DEFINITION)).not.toThrow();
  });

  it('the walk actually reaches the pages it is meant to police', () => {
    // Positive control. If `sourceFiles` returned [] - a wrong root, a rename, a
    // readdir that quietly failed - every assertion above would pass over an empty
    // set. A control that cannot find its subject is not a control.
    const walked = [...sourceFiles('app'), ...sourceFiles('components')];
    expect(walked).toEqual(
      expect.arrayContaining(MARKED_PAGES.map(([p]) => p))
    );
    expect(walked).toContain(DEFINITION);
  });
});
