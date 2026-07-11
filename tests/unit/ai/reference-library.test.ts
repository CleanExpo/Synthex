import {
  listReferenceSets,
  resolveReferences,
  resolveFromManifest,
  type Manifest,
} from '@/lib/services/ai/reference-library';

describe('reference-library resolver', () => {
  it('lists owned reference sets with counts', () => {
    const sets = listReferenceSets();
    const carpet = sets.find(s => s.industry === 'carpet-cleaning');
    expect(carpet).toBeDefined();
    const wand = carpet!.subjects.find(s => s.key === 'carpet-cleaning-wand');
    expect(wand!.count).toBe(18);
    expect(wand!.rights).toBe('owned');
  });

  it('resolves an explicit set to site-relative owned image paths', () => {
    const r = resolveReferences({ set: 'carpet-cleaning', max: 3 });
    expect(r.industry).toBe('carpet-cleaning');
    expect(r.imagePaths).toHaveLength(3);
    expect(r.imagePaths[0]).toBe(
      '/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp'
    );
  });

  it('auto-detects the industry from a prompt via manifest keywords', () => {
    const r = resolveReferences({
      prompt: 'a technician using a carpet cleaning wand on office carpet',
      max: 2,
    });
    expect(r.industry).toBe('carpet-cleaning');
    expect(r.count).toBe(2);
  });

  it('returns nothing for an unrelated prompt (no false grounding)', () => {
    const r = resolveReferences({ prompt: 'a law firm office in Sydney' });
    expect(r.industry).toBeNull();
    expect(r.imagePaths).toEqual([]);
  });

  it('never returns references for a non-owned / unknown set (rights guard)', () => {
    const r = resolveReferences({ set: 'water-damage-restoration' });
    expect(r.imagePaths).toEqual([]);
    const r2 = resolveReferences({ set: 'does-not-exist' });
    expect(r2.imagePaths).toEqual([]);
  });

  describe('resolveFromManifest — rights === "owned" filter', () => {
    const image = {
      file: 'test-01.webp',
      width: 100,
      height: 100,
      source: 'test',
    };

    it('excludes a populated subject whose rights are not "owned"', () => {
      const manifest: Manifest = {
        version: 1,
        industries: {
          'water-damage-restoration': {
            label: 'Water Damage Restoration',
            subjects: {
              'water-damage-carpet': {
                label: 'Water Damage Carpet',
                rights: 'third-party',
                images: [image],
              },
            },
          },
        },
      };

      const r = resolveFromManifest(manifest, {
        set: 'water-damage-restoration',
      });
      expect(r.imagePaths).toEqual([]);
      expect(r.count).toBe(0);
    });

    it('excludes a populated subject with no rights field at all', () => {
      const manifest: Manifest = {
        version: 1,
        industries: {
          'mould-remediation': {
            label: 'Mould Remediation',
            subjects: {
              'mould-wall': {
                label: 'Mould Wall',
                images: [image],
              },
            },
          },
        },
      };

      const r = resolveFromManifest(manifest, { set: 'mould-remediation' });
      expect(r.imagePaths).toEqual([]);
      expect(r.count).toBe(0);
    });

    it('still returns paths for a populated subject with rights: "owned"', () => {
      const manifest: Manifest = {
        version: 1,
        industries: {
          'carpet-cleaning': {
            label: 'Carpet Cleaning',
            subjects: {
              'carpet-cleaning-wand': {
                label: 'Carpet Cleaning Wand',
                rights: 'owned',
                images: [image],
              },
            },
          },
        },
      };

      const r = resolveFromManifest(manifest, { set: 'carpet-cleaning' });
      expect(r.imagePaths).toEqual([
        '/reference-library/carpet-cleaning/test-01.webp',
      ]);
      expect(r.count).toBe(1);
    });
  });

  describe('resolveFromManifest — negative max clamp', () => {
    it('returns no paths (not a tail slice) for a negative max', () => {
      const manifest: Manifest = {
        version: 1,
        industries: {
          'carpet-cleaning': {
            label: 'Carpet Cleaning',
            subjects: {
              'carpet-cleaning-wand': {
                label: 'Carpet Cleaning Wand',
                rights: 'owned',
                images: [
                  { file: 'a.webp', width: 1, height: 1, source: 'test' },
                  { file: 'b.webp', width: 1, height: 1, source: 'test' },
                ],
              },
            },
          },
        },
      };

      const r = resolveFromManifest(manifest, {
        set: 'carpet-cleaning',
        max: -1,
      });
      expect(r.imagePaths).toEqual([]);
    });
  });

  // Regression: the manifest must be BUNDLED, not read from
  // process.cwd()/public — Vercel serverless functions have no public/ on the
  // runtime fs, which silently emptied the library in production. This test
  // reproduces that condition (a cwd with no public/) and asserts the resolver
  // still returns the real sets. With the old fs.readFileSync approach it
  // returned []; with the bundled import it works regardless of cwd.
  describe('manifest is bundled (Vercel serverless resilience)', () => {
    it('resolves reference sets even when process.cwd() has no public/ dir', () => {
      const cwdSpy = jest
        .spyOn(process, 'cwd')
        .mockReturnValue('/tmp/no-public-dir-here-xyz');
      try {
        let sets: Array<{ industry: string }> = [];
        jest.isolateModules(() => {
          const mod = require('@/lib/services/ai/reference-library');
          sets = mod.listReferenceSets();
        });
        expect(sets.some(s => s.industry === 'carpet-cleaning')).toBe(true);
      } finally {
        cwdSpy.mockRestore();
      }
    });
  });
});
