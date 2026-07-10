import {
  listReferenceSets,
  resolveReferences,
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
});
