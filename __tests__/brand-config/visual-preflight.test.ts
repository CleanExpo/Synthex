/** Offline regression tests: no providers, live credentials or database. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  auditReferenceManifest,
  runBrandVisualPreflight,
  brandVisualPreflightExitCode,
} from '../../lib/brand/visual-preflight';
import {
  getBrandConfig,
  getBrandContent,
} from '../../lib/remotion/brand-registry';

const fixture = (rights = 'owned', file = 'photo.webp') => ({
  industries: {
    restoration: {
      subjects: {
        equipment: {
          rights,
          images: [
            { file, width: 100, height: 100, source: 'owned-equipment-photo' },
          ],
        },
      },
    },
  },
});

describe('offline reference preflight', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'syn1113-test-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
  function photo() {
    const file = path.join(
      root,
      'public/reference-library/restoration/photo.webp'
    );
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'fixture');
  }
  it('does not count a manifest entry whose local file is absent', () => {
    const report = auditReferenceManifest(root, fixture());
    expect(report.usableImages).toBe(0);
    expect(report.missingAssets).toEqual([
      'public/reference-library/restoration/photo.webp',
    ]);
  });
  it('does not promote unlicensed images to owned coverage', () => {
    photo();
    const report = auditReferenceManifest(root, fixture('unknown'));
    expect(report.usableImages).toBe(0);
    expect(report.rightsGaps).toEqual([
      'public/reference-library/manifest.json#/industries/restoration/subjects/equipment/rights',
    ]);
  });
  it('counts a present, owned reference', () => {
    photo();
    expect(auditReferenceManifest(root, fixture()).usableImages).toBe(1);
  });
  it.each(['../photo.webp', '/photo.webp', 'https://example.com/photo.webp'])(
    'refuses unsafe manifest file %s',
    file => {
      photo();
      const report = auditReferenceManifest(root, fixture('owned', file));
      expect(report.usableImages).toBe(0);
      expect(report.invalidImages).toHaveLength(1);
    }
  );
  it('refuses missing dimensions rather than pretending it is grounded', () => {
    photo();
    const manifest = fixture();
    manifest.industries.restoration.subjects.equipment.images[0].width = 0;
    expect(auditReferenceManifest(root, manifest).invalidImages).toHaveLength(
      1
    );
  });
  it('reports empty coverage', () => {
    expect(auditReferenceManifest(root, { industries: {} }).usableImages).toBe(
      0
    );
  });
});

describe('canonical brand and repository evidence', () => {
  it('resolves John without inventing publishing copy or approving his tokens', () => {
    expect(getBrandConfig('john-coutis')?.tokenStatus).toBe('proposal');
    expect(getBrandContent('john-coutis')).toBeUndefined();
  });
  it('uses the canonical DR primary and preserves the no-red rule', () => {
    expect(getBrandContent('dr')?.brandColour).toBe(
      getBrandConfig('dr')?.colour.primary
    );
    expect(getBrandConfig('dr')?.doNot).toContain(
      'never use red as a primary brand colour'
    );
  });
  it('keeps identity approvals blocking after the complete logo pack is restored', () => {
    const report = runBrandVisualPreflight(path.join(__dirname, '../..'));
    expect(report.readiness.codeDebtCount).toBe(0);
    expect(report.readiness.ready).toBe(false);
    expect(report.approvalGaps.map(gap => gap.slug)).toContain('ccw');
    expect(report.approvalGaps.map(gap => gap.slug)).toContain('john-coutis');
    expect(
      report.missingAssets.filter(file => file.startsWith('public/fonts/'))
    ).toEqual([]);
    expect(report.missingAssets).toEqual([]);
    expect(report.declaredAssets).toContain('public/logos/ccw/favicon.ico');
    expect(brandVisualPreflightExitCode(report)).toBe(1);
  });
});

describe('readiness stays scoped to the actual identity', () => {
  it('allows recovered Synthex identity to be ready while refusing John', () => {
    const report = runBrandVisualPreflight(path.join(__dirname, '../..'));
    expect(report.brandReadiness.synthex.ready).toBe(true);
    expect(report.brandReadiness['john-coutis'].ready).toBe(false);
    expect(report.readiness.ready).toBe(false);
  });
});
