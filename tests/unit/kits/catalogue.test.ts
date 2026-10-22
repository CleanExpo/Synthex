/**
 * SEAM: the exported data `KITS`, `carsiManifest`, `restoreassistManifest` and
 * the exported zod schemas `Kit` / `ClientManifest`.
 * CATCHES: a kit missing a required field, a kit or manifest field with the
 * wrong shape, an in-repo artefact / test / verifier path that does not exist
 * in this checkout, a client-manifest `claimsFile` path that does not exist
 * (#1061), K3 not pointing at the shipped lib/schema-packs implementation, a
 * manifest null not declared in `unknown`, a kit cost estimate above the
 * per-build ceiling, a missing or duplicated kit id.
 * MISSES: in-skills paths (they live under ~/.claude/skills, outside the repo),
 * whether `wired` is true in production, and whether time/cost estimates are
 * accurate (they are judgements until measured).
 */
import fs from 'fs';
import path from 'path';
import { KITS } from '@/lib/kits/catalogue';
import { BUILD_COST_CEILING_USD, ClientManifest, Kit } from '@/lib/kits/schema';
import { carsiManifest } from '@/lib/kits/clients/carsi';
import { restoreassistManifest } from '@/lib/kits/clients/restoreassist';

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Deep copy of plain data (jsdom has no structuredClone). */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Every repo path a kit names that does not exist in the checkout. */
function missingRepoPaths(kits: readonly unknown[]): string[] {
  const missing: string[] = [];
  for (const raw of kits) {
    const kit = Kit.parse(raw);
    const paths: string[] = [];
    for (const a of kit.artefacts) {
      if (a.kind !== 'in-repo') continue;
      paths.push(a.path);
      if (a.testPath) paths.push(a.testPath);
    }
    if (kit.verifier.path) paths.push(kit.verifier.path);
    for (const p of paths)
      if (!fs.existsSync(path.join(REPO_ROOT, p)))
        missing.push(`${kit.id}: ${p}`);
  }
  return missing;
}

/** Every repo path a client manifest names that does not exist in the checkout. */
function missingManifestPaths(manifests: readonly unknown[]): string[] {
  const missing: string[] = [];
  for (const raw of manifests) {
    const m = ClientManifest.parse(raw);
    const p = m.claimsFile?.value;
    if (p && !fs.existsSync(path.join(REPO_ROOT, p)))
      missing.push(`${m.slug}: ${p}`);
  }
  return missing;
}

const K3_IMPL = 'lib/schema-packs/';
const K3_TEST = 'tests/unit/schema-packs/schema-packs.test.ts';

/** In-repo artefacts a kit names under the K3 implementation directory. */
function schemaPackArtefacts(kit: unknown) {
  return Kit.parse(kit).artefacts.filter(
    a => a.kind === 'in-repo' && a.path.startsWith(K3_IMPL)
  );
}

describe('kit catalogue', () => {
  it('holds K1-K14 and the manifest entry M, each exactly once', () => {
    expect(KITS.map(k => k.id)).toEqual([
      'K1',
      'K2',
      'K3',
      'K4',
      'K5',
      'K6',
      'K7',
      'K8',
      'K9',
      'K10',
      'K11',
      'K12',
      'K13',
      'K14',
      'M',
    ]);
  });

  it.each(KITS.map(k => [k.id, k] as const))(
    '%s has every required field filled',
    (_id, kit) => {
      const result = Kit.safeParse(kit);
      expect(result.success ? [] : result.error.issues).toEqual([]);
    }
  );

  it('every in-repo artefact path exists at HEAD', () => {
    expect(missingRepoPaths(KITS)).toEqual([]);
  });

  it('K3 links the shipped schema packs and their test', () => {
    const linked = schemaPackArtefacts(KITS.find(k => k.id === 'K3'));
    expect(linked.length).toBeGreaterThan(0);
    for (const a of linked)
      expect(a.kind === 'in-repo' ? a.testPath : null).toBe(K3_TEST);
  });

  it('control: a K3 entry without the schema-packs link is caught', () => {
    const planted = clone(KITS.find(k => k.id === 'K3')!);
    planted.artefacts = planted.artefacts.filter(
      a => !(a.kind === 'in-repo' && a.path.startsWith(K3_IMPL))
    );
    expect(schemaPackArtefacts(planted)).toEqual([]);
  });

  it('no kit estimates direct spend above the per-build ceiling', () => {
    const over = KITS.filter(k => k.maxDirectCostUsd.usd > 12).map(k => k.id);
    expect(over).toEqual([]);
    expect(BUILD_COST_CEILING_USD).toBe(12);
  });

  it('control: planted non-existent in-repo path is caught', () => {
    const planted = clone(KITS[0]);
    planted.artefacts.push({
      kind: 'in-repo',
      path: 'lib/kits/__planted_does_not_exist__.ts',
      what: 'planted',
      wired: false,
      testPath: null,
    });
    expect(missingRepoPaths([planted])).toEqual([
      'K1: lib/kits/__planted_does_not_exist__.ts',
    ]);
  });

  it('control: planted missing required field is caught', () => {
    const planted: Record<string, unknown> = clone(KITS[0]);
    delete planted.verifier;
    const result = Kit.safeParse(planted);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(i => i.path.join('.'))).toContain(
      'verifier'
    );
  });

  it.each([
    ['a ".." segment', '../Synthex-sibling/package.json'],
    ['a nested ".." segment', 'lib/../../outside.ts'],
    ['a backslash', 'lib\\kits\\schema.ts'],
  ])('control: an in-repo path with %s is rejected', (_what, bad) => {
    const planted = clone(KITS[0]);
    planted.artefacts.push({
      kind: 'in-repo',
      path: bad,
      what: 'planted',
      wired: false,
      testPath: null,
    });
    expect(Kit.safeParse(planted).success).toBe(false);
  });
});

describe('client manifests', () => {
  it.each([
    ['carsi', carsiManifest],
    ['restoreassist', restoreassistManifest],
  ] as const)('%s validates through ClientManifest', (_slug, manifest) => {
    const result = ClientManifest.safeParse(manifest);
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it('every manifest claimsFile path exists at HEAD', () => {
    expect(
      missingManifestPaths([carsiManifest, restoreassistManifest])
    ).toEqual([]);
  });

  it('control: a planted missing claimsFile path is caught in any manifest', () => {
    const planted = clone(restoreassistManifest);
    planted.claimsFile = {
      value: 'packages/brand-config/src/brands/__planted_missing__.md',
      source: 'planted',
    };
    // Planted in the second manifest so a sweep that stops early also fails.
    expect(missingManifestPaths([carsiManifest, planted])).toEqual([
      'restoreassist: packages/brand-config/src/brands/__planted_missing__.md',
    ]);
  });

  it('CARSI is recorded as not an RTO', () => {
    const rto = carsiManifest.compliance.find(f => f.id === 'rto');
    expect(rto?.value).toBe(false);
  });

  it('control: a null fact not declared unknown is caught', () => {
    const planted = clone(carsiManifest);
    planted.unknown = planted.unknown.filter(u => u !== 'nap');
    const result = ClientManifest.safeParse(planted);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(i => i.message)).toContain(
      'nap is null but not listed in unknown'
    );
  });

  it('control: a cost ceiling above US$12 is caught', () => {
    const planted = { ...restoreassistManifest, costCeilingUsd: 13 };
    expect(ClientManifest.safeParse(planted).success).toBe(false);
  });
});
