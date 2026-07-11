// tests/unit/marketing-agency/ccw-catalogue-ingest-cli.test.ts
import { parseArgs, formatReport } from '@/scripts/ingest-ccw-catalogue';

describe('parseArgs', () => {
  it('parses modes and flags', () => {
    expect(parseArgs(['--dry-run']).dryRun).toBe(true);
    expect(parseArgs(['--remove-vendor', 'dri-eaz']).removeVendor).toBe(
      'dri-eaz'
    );
    expect(
      parseArgs(['--retag-vendor', 'dri-eaz', 'pending']).retagVendor
    ).toEqual({ vendorKey: 'dri-eaz', rights: 'pending' });
    expect(parseArgs(['--force-refresh-handle', 'x']).forceRefreshHandle).toBe(
      'x'
    );
    expect(parseArgs(['--force-refresh-vendor', 'y']).forceRefreshVendor).toBe(
      'y'
    );
    expect(parseArgs(['--verify']).verify).toBe(true);
    expect(parseArgs(['--force-size']).forceSize).toBe(true);
  });
  it('rejects unknown flags', () =>
    expect(() => parseArgs(['--nope'])).toThrow());
});

describe('formatReport', () => {
  it('renders every section, never omitting unmapped', () => {
    const text = formatReport({
      ingestable: { 'carpet-cleaning': 2 },
      perVendor: { razorback: 2 },
      perRights: { 'ccw-own-brand': 2 },
      upholsteryRerouted: ['a-tool'],
      skippedTypes: { 'IMP EQUIP TILE & GROUT': 3 },
      unmapped: { 'DOM CHEM RESTORATION': 5 },
      denylisted: 0,
      stale: ['gone-product'],
      orphans: ['ccw-old-1.webp'],
      newVendors: ['orbot'],
      aspectFlagged: ['ccw-x-9.webp'],
      imageCount: 4,
      estimatedBytes: 1_048_576,
      projectedManifestBytes: 2048,
    });
    for (const needle of [
      'unmapped',
      'DOM CHEM RESTORATION',
      'stale',
      'orphans',
      'new vendors',
      'aspect',
      'upholstery',
      '1.0 MB',
    ]) {
      expect(text.toLowerCase()).toContain(needle.toLowerCase());
    }
  });
});
