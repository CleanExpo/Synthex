/**
 * The media contract between the three surfaces that resolve a composition ID
 * — SYN-1113.
 *
 * A composition ID is a string shared by four places that never check each
 * other:
 *
 *   1. `COMPOSITION_REGISTRY` — pure metadata (dimensions, fps, duration).
 *   2. `COMPOSITION_COMPONENTS` in `Root.tsx` — the ID→component bindings the
 *      Remotion bundle is built from.
 *   3. `EDUCATIONAL_VIDEOS[].compositionId` — 116 entries the render script
 *      feeds to `selectComposition`.
 *   4. The admin Studio page's preview map.
 *
 * Every mismatch between them fails *silently*. `Root.tsx` skipped an unbound
 * registry entry with `return null`, so it vanished from the bundle rather than
 * erroring. The Studio guards its player with `{Component && …}`, so an unmapped
 * selection renders an empty black box. And `selectComposition` only discovers a
 * missing ID after the bundle and the voiceover audio have already been built.
 *
 * These are pure-data assertions — no bundling, no rendering, no provider calls.
 */
import { COMPOSITION_REGISTRY } from '../../lib/remotion/registry';
import { EDUCATIONAL_VIDEOS } from '../../lib/remotion/educational-content';
import { COMPOSITION_COMPONENTS } from '../../lib/remotion/Root';
import { STUDIO_PREVIEW_COMPONENTS } from '../../lib/remotion/studio-preview-map';

const registryIds = COMPOSITION_REGISTRY.map(c => c.id);
const boundIds = Object.keys(COMPOSITION_COMPONENTS);
const previewIds = Object.keys(STUDIO_PREVIEW_COMPONENTS);

/** Distinct so a broken composition is reported once, not once per video. */
const educationalIds = [
  ...new Set(EDUCATIONAL_VIDEOS.map(v => v.compositionId)),
].sort();

describe('composition registry ↔ component bindings', () => {
  it('binds a component for every registered composition', () => {
    // Unbound entries used to be dropped by `return null`: registered, offered
    // in the Studio dropdown, absent from the bundle, and silent about it.
    const unbound = registryIds.filter(id => !boundIds.includes(id));

    expect(unbound).toEqual([]);
  });

  it('registers every bound component', () => {
    // A binding with no registry entry is dead weight — Root only iterates the
    // registry, so the component can never render.
    const unregistered = boundIds.filter(id => !registryIds.includes(id));

    expect(unregistered).toEqual([]);
  });

  it('previews every registered composition in the admin Studio', () => {
    // The Studio builds its selector from the whole registry but guards the
    // player with `{Component && …}`, so an unmapped entry is selectable and
    // renders an empty black panel with nothing logged.
    const unpreviewable = registryIds.filter(id => !previewIds.includes(id));

    expect(unpreviewable).toEqual([]);
  });

  it('previews nothing the registry does not offer', () => {
    const orphaned = previewIds.filter(id => !registryIds.includes(id));

    expect(orphaned).toEqual([]);
  });

  it('has no duplicate composition IDs', () => {
    // Remotion keys compositions by ID; a duplicate silently shadows the first.
    expect(registryIds).toEqual([...new Set(registryIds)]);
  });
});

describe('educational videos ↔ composition registry', () => {
  it.each(educationalIds)(
    '%s is registered, so selectComposition can resolve it',
    id => {
      expect(registryIds).toContain(id);
    }
  );

  it('reports how many videos a missing composition would break', () => {
    // The render script bundles and synthesises voiceover *before* calling
    // selectComposition, so an unregistered ID wastes that work on every video
    // that references it.
    const broken = EDUCATIONAL_VIDEOS.filter(
      v => !registryIds.includes(v.compositionId)
    );

    expect(broken).toEqual([]);
  });
});

describe('educational video metadata matches its composition', () => {
  it.each(EDUCATIONAL_VIDEOS.map(v => [v.id, v] as const))(
    '%s agrees with its registry entry on dimensions and fps',
    (_id, video) => {
      const entry = COMPOSITION_REGISTRY.find(
        c => c.id === video.compositionId
      );
      if (!entry) return; // Covered above; do not double-report.

      // `renderMedia` uses the registry's metadata, not the video's. Where they
      // disagree the video's numbers are a lie — the script logs them, callers
      // size players from them, and the output is a different shape.
      expect({
        width: video.width,
        height: video.height,
        fps: video.fps,
      }).toEqual({
        width: entry.width,
        height: entry.height,
        fps: entry.fps,
      });
    }
  );
});
