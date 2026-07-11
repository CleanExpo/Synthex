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

  it('auto-detects the industry from a prompt via manifest keywords (synthetic)', () => {
    // Migrated off the real manifest: carpet-cleaning now carries several
    // owned subjects, so the real-manifest auto-detect outcome is no longer
    // pinned to a single deterministic subject. A synthetic single-subject
    // manifest keeps this test's intent (auto-detect + max clamp) stable
    // regardless of future real-manifest ingestion.
    const image = (n: number) => ({
      file: `wand-${n}.webp`,
      width: 10,
      height: 10,
      source: 'test',
    });
    const manifest: Manifest = {
      version: 1,
      industries: {
        'carpet-cleaning': {
          label: 'Carpet Cleaning',
          keywords: ['carpet cleaning', 'carpet wand'],
          subjects: {
            'carpet-cleaning-wand': {
              rights: 'owned',
              label: 'Carpet Cleaning Wand',
              images: [image(1), image(2), image(3)],
            },
          },
        },
      },
    };

    const r = resolveFromManifest(manifest, {
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

  it('never returns references for an unknown set (rights guard)', () => {
    const r = resolveReferences({ set: 'does-not-exist' });
    expect(r.imagePaths).toEqual([]);
  });

  it('never returns references for an industry with no subjects (rights guard, synthetic)', () => {
    // Migrated off the real manifest: water-damage-restoration currently has
    // `subjects: {}`, but real ingestion will populate it. A synthetic
    // empty-subjects industry keeps this rights-guard case stable.
    const manifest: Manifest = {
      version: 1,
      industries: {
        'water-damage-restoration': {
          label: 'Water Damage Restoration',
          subjects: {},
        },
      },
    };
    const r = resolveFromManifest(manifest, {
      set: 'water-damage-restoration',
    });
    expect(r.imagePaths).toEqual([]);
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

  describe('provenance completeness (audit contract)', () => {
    const RIGHTS_BASES = [
      'ccw-own-brand',
      'ccw-supplier-authorised',
      'first-party-photo',
    ];
    it('every populated subject carries an enum rightsBasis; non-CCW subjects are first-party', () => {
      const sets = listReferenceSets();
      let populated = 0;
      for (const s of sets) {
        for (const subj of s.subjects) {
          if (subj.count > 0) {
            populated++;
            expect(RIGHTS_BASES).toContain(subj.rightsBasis);
            if (!subj.key.startsWith('ccw-')) {
              expect(subj.rightsBasis).toBe('first-party-photo');
            }
          }
        }
      }
      expect(populated).toBeGreaterThan(0);
    });
  });

  describe('subject-aware selection', () => {
    const img = (n: number) => ({
      file: `f${n}.webp`,
      width: 10,
      height: 10,
      source: 't',
    });
    const M: Manifest = {
      version: 1,
      industries: {
        'water-damage-restoration': {
          label: 'Water Damage Restoration',
          keywords: ['water damage', 'air mover'],
          subjects: {
            'ccw-spec-dryer': {
              rights: 'owned',
              label: 'Injectidry Spec Drying Unit',
              images: [img(1)],
            },
            'ccw-razorback-aam-pro': {
              rights: 'owned',
              label: 'Razorback AAM Pro Axial Air Mover',
              images: [img(2)],
              provenance: {
                source: 'ccw-shopify',
                vendorKey: 'razorback',
                vendorRaw: 'Razorback',
                ingestedAt: '2026-07-11',
                rightsBasis: 'ccw-own-brand',
              },
            },
            'ccw-razorback-aam-mini': {
              rights: 'owned',
              label: 'Razorback AAM Mini Axial Air Mover',
              images: [img(3)],
            },
            'not-owned': {
              rights: 'third-party',
              label: 'Dri-Eaz Velo Air Mover',
              images: [img(4)],
            },
          },
        },
      },
    };

    it('explicit industry/subject resolves exactly that owned subject with lineage', () => {
      const r = resolveFromManifest(M, {
        set: 'water-damage-restoration/ccw-razorback-aam-pro',
      });
      expect(r.subject).toBe('ccw-razorback-aam-pro');
      expect(r.imagePaths).toEqual([
        '/reference-library/water-damage-restoration/f2.webp',
      ]);
      expect(r.vendorKey).toBe('razorback');
      expect(r.rightsBasis).toBe('ccw-own-brand');
    });

    it('explicit non-owned subject fails closed (never falls back)', () => {
      const r = resolveFromManifest(M, {
        set: 'water-damage-restoration/not-owned',
      });
      expect(r.imagePaths).toEqual([]);
    });

    it('prompt scoring picks the best subject among decoys', () => {
      const r = resolveFromManifest(M, {
        set: 'water-damage-restoration',
        prompt: 'a razorback pro air mover drying',
      });
      expect(r.subject).toBe('ccw-razorback-aam-pro');
    });

    it('non-zero tie resolves to the FIRST TIED subject in manifest order', () => {
      const r = resolveFromManifest(M, {
        set: 'water-damage-restoration',
        prompt: 'razorback axial mover',
      });
      // 'razorback', 'axial', 'mover' tie pro vs mini (both labels contain all three) -> pro (earlier)
      expect(r.subject).toBe('ccw-razorback-aam-pro');
    });

    it('zero-score prompt falls back to the first owned subject (regression)', () => {
      const r = resolveFromManifest(M, {
        set: 'water-damage-restoration',
        prompt: 'zzz qqq unrelated',
      });
      expect(r.subject).toBe('ccw-spec-dryer');
    });

    it('no prompt falls back to the first owned subject (regression)', () => {
      const r = resolveFromManifest(M, { set: 'water-damage-restoration' });
      expect(r.subject).toBe('ccw-spec-dryer');
    });

    it('malformed sets fail closed and NEVER fall through to auto-detect', () => {
      for (const bad of [
        '',
        '  ',
        '/',
        '/water-damage-restoration',
        'water-damage-restoration/',
        'a/b/c',
      ]) {
        const r = resolveFromManifest(M, {
          set: bad,
          prompt: 'air mover water damage',
        });
        expect(r.imagePaths).toEqual([]);
      }
    });
  });
});
