/**
 * Guards the brand logo contract — SYN-1133.
 *
 * `brands[*].logo` paths are relative to `public/` and no runtime code reads
 * them, so a wrong or absent path fails silently: nothing throws, nothing
 * 404s, the asset simply never appears. That is how all 21 declared files came
 * to be missing without anyone noticing, and how four competing path
 * conventions accumulated.
 *
 * Two rules, both mechanical:
 *   1. Every declared path resolves under `public/`, or is an acknowledged gap
 *      in `config/brand-logo-baseline.json`. A baseline entry that now resolves is a
 *      failure too, so the list is forced downward and cannot go stale.
 *   2. Every declared path uses `logos/<slug>/{primary,inverted,icon}.<ext>`.
 *      This is the canonical scheme (`.claude/DESIGN.md` § Real Logos); the
 *      legacy `brands/<name>/` scheme is read-only for existing consumers.
 */
import { existsSync } from 'fs';
import { join } from 'path';

// The source, not the `@unite-group/brand-config` entrypoint. That entrypoint
// resolves to a gitignored `dist/index.cjs` outside Jest, and a stale build made
// an earlier draft of this test pass against a brand that had reverted to the
// legacy path scheme. SYN-1134 added a moduleNameMapper so the package specifier
// reaches source under Jest too; this stays explicit so the guard does not depend
// on that config staying correct.
import {
  TENANTS,
  type TenantSlug,
} from '../../packages/brand-config/src/tenant-resolver';

import baseline from '../../config/brand-logo-baseline.json';

const PUBLIC_DIR = join(__dirname, '..', '..', 'public');
const VARIANTS = ['primary', 'inverted', 'icon'] as const;

const acknowledgedGaps = new Set<string>(baseline.missing);

interface Declaration {
  tenant: TenantSlug;
  variant: (typeof VARIANTS)[number];
  path: string;
}

/**
 * Flattened so a failure names the brand and variant, not just a path — and so
 * `phill` is covered, which reuses Unite's artwork and is absent from the
 * `brands` record.
 */
const declarations: Declaration[] = Object.entries(TENANTS).flatMap(
  ([tenant, config]) =>
    Object.values(config.brands).flatMap(brand =>
      VARIANTS.map(variant => ({
        tenant: tenant as TenantSlug,
        variant,
        path: brand.logo[variant],
      }))
    )
);

describe('brand-config logo paths', () => {
  it('declares three logo variants for every tenant', () => {
    expect(declarations.length).toBe(Object.keys(TENANTS).length * 3);
  });

  it.each(declarations)(
    '$tenant $variant resolves on disk or is an acknowledged gap',
    ({ path }) => {
      if (acknowledgedGaps.has(path)) return;

      expect(existsSync(join(PUBLIC_DIR, path))).toBe(true);
    }
  );

  it('has no stale baseline entries — a gap that now resolves must be removed', () => {
    const resolved = [...acknowledgedGaps].filter(path =>
      existsSync(join(PUBLIC_DIR, path))
    );

    expect(resolved).toEqual([]);
  });

  it('has no orphaned baseline entries — every gap is still declared', () => {
    const declared = new Set(declarations.map(d => d.path));
    const orphaned = [...acknowledgedGaps].filter(path => !declared.has(path));

    expect(orphaned).toEqual([]);
  });

  it.each(declarations)(
    '$tenant $variant uses the canonical logos/<slug>/<variant> scheme',
    ({ variant, path }) => {
      expect(path).toMatch(
        new RegExp(`^logos/[a-z0-9-]+/${variant}\\.[a-z0-9]+$`)
      );
    }
  );
});
