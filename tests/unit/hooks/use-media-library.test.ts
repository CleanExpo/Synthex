/**
 * buildMediaLibraryQuery — filter mapping.
 *
 * The route reads `isFavorite`, `type`, `isArchived` etc. The hook's own option
 * names do not all match (`favouritesOnly` vs `isFavorite`), and a silent
 * mismatch is the dangerous kind of bug here: the request still returns 200 and
 * the grid still renders, it just quietly ignores the filter the founder set.
 * These assertions pin the wire format rather than the hook's ergonomics.
 */

import { buildMediaLibraryQuery } from '@/hooks/use-media-library';

/** Parse the query string back out so assertions do not depend on key order. */
function paramsOf(url: string): URLSearchParams {
  const qs = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  return new URLSearchParams(qs);
}

describe('buildMediaLibraryQuery — defaults', () => {
  it('hides archived assets by default', () => {
    expect(paramsOf(buildMediaLibraryQuery()).get('isArchived')).toBe('false');
  });

  it('targets the library route', () => {
    expect(buildMediaLibraryQuery()).toContain('/api/media/library');
  });

  it('sets no type filter when none is asked for', () => {
    expect(paramsOf(buildMediaLibraryQuery()).get('type')).toBeNull();
  });
});

describe('buildMediaLibraryQuery — type filter', () => {
  it('passes a single kind through', () => {
    expect(
      paramsOf(buildMediaLibraryQuery({ type: 'audio' })).get('type')
    ).toBe('audio');
  });

  it('comma-joins several kinds, which is what the route parses', () => {
    const type = paramsOf(
      buildMediaLibraryQuery({ type: ['video', 'audio'] })
    ).get('type');
    expect(type).toBe('video,audio');
  });
});

describe('buildMediaLibraryQuery — favourites', () => {
  it('maps favouritesOnly onto the isFavorite param the route reads', () => {
    const p = paramsOf(buildMediaLibraryQuery({ favouritesOnly: true }));
    expect(p.get('isFavorite')).toBe('true');
    // Guard against the option name leaking onto the wire.
    expect(p.get('favouritesOnly')).toBeNull();
  });

  it('omits the param entirely when favourites are not requested', () => {
    expect(
      paramsOf(buildMediaLibraryQuery({ favouritesOnly: false })).get(
        'isFavorite'
      )
    ).toBeNull();
  });
});

describe('buildMediaLibraryQuery — folders', () => {
  it('sends the literal string null for unfiled assets', () => {
    // `folderId=null` is how the route distinguishes "not in any folder" from
    // "no folder filter at all". Sending an empty value would mean the latter.
    expect(
      paramsOf(buildMediaLibraryQuery({ folderId: null })).get('folderId')
    ).toBe('null');
  });

  it('sends a folder id when given one', () => {
    expect(
      paramsOf(buildMediaLibraryQuery({ folderId: 'fld_1' })).get('folderId')
    ).toBe('fld_1');
  });

  it('omits folderId when undefined', () => {
    expect(paramsOf(buildMediaLibraryQuery({})).get('folderId')).toBeNull();
  });
});

describe('buildMediaLibraryQuery — search, tags, paging', () => {
  it('trims nothing but passes search through verbatim', () => {
    expect(
      paramsOf(buildMediaLibraryQuery({ search: 'carpet dry' })).get('search')
    ).toBe('carpet dry');
  });

  it('omits an empty search rather than sending a blank filter', () => {
    expect(
      paramsOf(buildMediaLibraryQuery({ search: '' })).get('search')
    ).toBeNull();
  });

  it('comma-joins tags', () => {
    expect(
      paramsOf(buildMediaLibraryQuery({ tags: ['before', 'after'] })).get(
        'tags'
      )
    ).toBe('before,after');
  });

  it('omits an empty tag list', () => {
    expect(
      paramsOf(buildMediaLibraryQuery({ tags: [] })).get('tags')
    ).toBeNull();
  });

  it('sends offset 0 explicitly, since 0 is meaningful and falsy', () => {
    expect(paramsOf(buildMediaLibraryQuery({ offset: 0 })).get('offset')).toBe(
      '0'
    );
  });

  it('passes limit and sort through', () => {
    const p = paramsOf(
      buildMediaLibraryQuery({
        limit: 48,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
    );
    expect(p.get('limit')).toBe('48');
    expect(p.get('sortBy')).toBe('createdAt');
    expect(p.get('sortOrder')).toBe('desc');
  });
});
