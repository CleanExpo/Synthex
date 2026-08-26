/**
 * listFromManifest — preview image paths.
 *
 * The Reference Library page shows a thumbnail per subject. The path it renders
 * must match the one the resolver hands to the generator
 * (`/reference-library/{industry}/{file}`), because if the two ever disagree the
 * page will happily show a broken image while generation still works, or vice
 * versa, and neither failure announces itself.
 */

import {
  listFromManifest,
  type Manifest,
} from '@/lib/services/ai/reference-library';
import realManifest from '@/public/reference-library/manifest.json';

const manifest = {
  version: 1,
  purpose: 'test',
  usage: 'test',
  updatedAt: '2026-08-18',
  industries: {
    'carpet-cleaning': {
      label: 'Professional Carpet Cleaning',
      iicrcStandard: 'S100',
      keywords: ['carpet cleaning'],
      subjects: {
        'carpet-wand': {
          rights: 'owned',
          label: 'Carpet cleaning wand',
          images: [
            {
              file: 'wand-01.webp',
              width: 1536,
              height: 2048,
              source: 'owned',
            },
            {
              file: 'wand-02.webp',
              width: 1536,
              height: 2048,
              source: 'owned',
            },
          ],
        },
        'no-photos-yet': {
          rights: 'owned',
          label: 'Subject with no images',
          images: [],
        },
        'images-key-absent': {
          rights: 'owned',
          label: 'Subject with no images key at all',
        },
      },
    },
  },
} as unknown as Manifest;

describe('listFromManifest — preview image', () => {
  const [set] = listFromManifest(manifest);
  const byKey = Object.fromEntries(set.subjects.map(s => [s.key, s]));

  it('builds the same public path shape the resolver returns', () => {
    expect(byKey['carpet-wand'].previewImage).toBe(
      '/reference-library/carpet-cleaning/wand-01.webp'
    );
  });

  it('uses the first image, not an arbitrary one', () => {
    expect(byKey['carpet-wand'].previewImage).toContain('wand-01');
    expect(byKey['carpet-wand'].previewImage).not.toContain('wand-02');
  });

  it('leaves previewImage undefined when the subject has an empty image list', () => {
    expect(byKey['no-photos-yet'].previewImage).toBeUndefined();
  });

  it('leaves previewImage undefined when the images key is absent entirely', () => {
    // A subject may predate the images field. Reading [0] off undefined would
    // throw and take the whole page down rather than render one placeholder.
    expect(byKey['images-key-absent'].previewImage).toBeUndefined();
  });

  it('still reports the existing summary fields', () => {
    expect(byKey['carpet-wand'].count).toBe(2);
    expect(byKey['carpet-wand'].label).toBe('Carpet cleaning wand');
    expect(byKey['carpet-wand'].rights).toBe('owned');
  });

  it('does not invent a preview for a subject with no photos', () => {
    // Guards the case that matters to Real Images Only: a subject with zero
    // owned references must look empty, because that is exactly the state that
    // blocks generation.
    expect(byKey['no-photos-yet'].count).toBe(0);
    expect(byKey['no-photos-yet'].previewImage).toBeUndefined();
  });
});

describe('listFromManifest — the real manifest on disk', () => {
  const sets = listFromManifest(realManifest as unknown as Manifest);

  it('reads every industry', () => {
    expect(sets.length).toBeGreaterThanOrEqual(3);
  });

  it('gives most real subjects a usable preview path', () => {
    const subjects = sets.flatMap(s => s.subjects);
    const withPhotos = subjects.filter(s => s.count > 0);
    expect(withPhotos.length).toBeGreaterThan(100);
    for (const s of withPhotos) {
      expect(s.previewImage).toMatch(/^\/reference-library\/[^/]+\/.+/);
    }
  });
});
