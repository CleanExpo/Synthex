/**
 * Guards the `/lock` output contract for the `synthex-design` engine.
 *
 * The skill writes locked themes, promoted run records and rendered boards to
 * fixed paths (SKILL.md §12 tier 2, §13). Nothing at runtime reads them, so a
 * `.gitignore` pattern that swallows one fails *silently*: the write succeeds,
 * the file sits on disk, the run reports success, and git commits nothing. It
 * is discovered only when someone goes looking for a template that was never
 * there.
 *
 * This has already happened twice:
 *   - `*.png` is blanket-ignored (allowlisting only `public/**`,
 *     `components/**`, `app/**`), so boards must render under `public/`.
 *   - A bare `templates/` pattern matched a directory of that name at ANY
 *     depth, including the exact path §13 writes locked themes to. It was
 *     caught by chance, not by a gate. This is that gate.
 *
 * Reading `git check-ignore` correctly matters, and is the reason this test
 * parses rather than trusting the exit code. Three distinct outcomes:
 *
 *   rc=1, no output          -> no pattern matched          -> NOT ignored
 *   rc=0, pattern `!foo`     -> matched a NEGATION          -> NOT ignored
 *   rc=0, pattern `foo`      -> matched a plain rule        -> IGNORED
 *
 * So `rc === 0` does not mean "ignored" — a negation match also exits 0. The
 * only sound rule is: ignored iff a line is printed whose pattern does not
 * begin with `!`.
 */
import { execFileSync } from 'child_process';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..');

/**
 * Every path `/lock` writes to. Representative rather than exhaustive for the
 * per-run directories — the run id varies, the parent does not, and git
 * resolves ignore rules the same way for any leaf beneath it.
 *
 * Add a row here whenever the skill gains an output path.
 */
const LOCK_TARGETS = [
  // §13 step 1-2 — the frozen theme and the reusable template.
  'docs/marketing-agency/design-runs/templates/example-brand/example.tokens.json',
  'docs/marketing-agency/design-runs/templates/example-brand/example.html',
  // §12 tier 2 — the promoted run record.
  'docs/marketing-agency/design-runs/example-run-2026-01-01-01/manifest.json',
  'docs/marketing-agency/design-runs/example-run-2026-01-01-01/README.md',
  'docs/marketing-agency/design-runs/example-run-2026-01-01-01/winner/board.html',
  // §12 tier 2 — rendered boards. These are PNGs, so they live under
  // `public/` and depend on the `!public/**/*.png` negation holding.
  'public/marketing-agency/design-runs/example-run-2026-01-01-01/winner.png',
  'public/marketing-agency/design-runs/example-run-2026-01-01-01/funnel/story.png',
  // §2 / taste files — the engine's memory between runs.
  'docs/marketing-agency/design-runs/taste/PRINCIPLES.md',
  'docs/marketing-agency/design-runs/taste/example-brand.md',
] as const;

interface IgnoreResult {
  ignored: boolean;
  /** The matching rule, e.g. `.gitignore:198:*.png`, or null when none matched. */
  rule: string | null;
}

function checkIgnored(path: string): IgnoreResult {
  let stdout = '';
  try {
    stdout = execFileSync('git', ['check-ignore', '-v', '--', path], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  } catch (err) {
    // Exit 1 means no pattern matched at all: the path is not ignored.
    // Any other failure is a real error and should surface.
    const e = err as { status?: number; stderr?: string };
    if (e.status === 1) return { ignored: false, rule: null };
    throw new Error(
      `git check-ignore failed for ${path}: ${e.stderr ?? String(err)}`
    );
  }

  const line = stdout.trim();
  if (!line) return { ignored: false, rule: null };

  // Format: `<source>:<linenum>:<pattern>\t<pathname>`
  const [descriptor] = line.split('\t');
  const parts = descriptor.split(':');
  const pattern = parts.slice(2).join(':');

  // A leading `!` is a negation — the path is explicitly re-included.
  return { ignored: !pattern.startsWith('!'), rule: descriptor };
}

describe('synthex-design /lock output paths stay trackable', () => {
  it.each(LOCK_TARGETS)('%s is not gitignored', path => {
    const { ignored, rule } = checkIgnored(path);

    expect({ path, ignored, rule }).toEqual({
      path,
      ignored: false,
      rule: rule ?? null,
    });
  });

  it('the test itself can detect an ignored path', () => {
    // Anchors the parser: a PNG under `docs/` IS swallowed by the blanket
    // `*.png` rule. If this ever stops being ignored the detection logic has
    // broken and every assertion above is vacuously passing.
    const result = checkIgnored(
      'docs/marketing-agency/design-runs/example/board.png'
    );

    expect(result.ignored).toBe(true);
    expect(result.rule).toContain('*.png');
  });

  it('a negation match is read as NOT ignored', () => {
    // The `!public/**/*.png` rule matches (exit 0) but re-includes the path.
    // Trusting the exit code here would invert the result.
    const result = checkIgnored(
      'public/marketing-agency/design-runs/example/board.png'
    );

    expect(result.ignored).toBe(false);
    expect(result.rule).toContain('!public/**/*.png');
  });
});
