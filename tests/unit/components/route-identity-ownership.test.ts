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
 * The rule is a pattern, not an allow-list: any file that names the component must be a
 * `page.tsx`. An allow-list of the three known layouts would be silent about the fourth,
 * and about a shared component a layout could route through.
 *
 * A comment mentioning `RouteIdentity` in a non-page file fails this test. That is the
 * intended direction of the error: it fails loud and is one line to fix, whereas a
 * cleverer matcher that could tell code from prose is a second thing that can be wrong.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const COMPONENT = 'RouteIdentity';

/** Where the component itself is defined - the one file exempt from the rule. */
const DEFINITION = join('components', 'system', 'RouteIdentity.tsx');

/** Pages that must carry a marker. Mirrors WANT in check-route-identity-markers.mjs. */
const MARKED_PAGES = [
  join('app', 'page.tsx'),
  join('app', '(auth)', 'login', 'page.tsx'),
  join('app', 'pricing', 'page.tsx'),
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

function filesNaming(component: string): string[] {
  return [...sourceFiles('app'), ...sourceFiles('components')].filter(rel => {
    if (rel === DEFINITION) return false;
    try {
      return readFileSync(join(ROOT, rel), 'utf8').includes(component);
    } catch {
      return false;
    }
  });
}

describe('route identity marker ownership', () => {
  it('is named only by page files - never a layout, error boundary or shared component', () => {
    const offenders = filesNaming(COMPONENT).filter(
      rel => !rel.endsWith(`${sep}page.tsx`)
    );
    expect(offenders).toEqual([]);
  });

  it.each(MARKED_PAGES)('%s renders the marker', page => {
    const src = readFileSync(join(ROOT, page), 'utf8');
    expect(src).toContain(`<${COMPONENT}`);
  });

  it('finds the component definition where the exemption expects it', () => {
    // A moved or renamed definition would silently exempt nothing and make the
    // first test pass for the wrong reason.
    expect(() => readFileSync(join(ROOT, DEFINITION), 'utf8')).not.toThrow();
  });

  it('the walk actually reaches the pages it is meant to police', () => {
    // Positive control. If `sourceFiles` returned [] - a wrong root, a rename, a
    // readdir that quietly failed - every assertion above would pass over an empty
    // set. A control that cannot find its subject is not a control.
    const walked = [...sourceFiles('app'), ...sourceFiles('components')];
    expect(walked).toEqual(expect.arrayContaining(MARKED_PAGES));
    expect(walked).toContain(DEFINITION);
  });
});
