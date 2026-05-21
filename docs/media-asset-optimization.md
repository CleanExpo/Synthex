# Media Asset Optimisation Rule

All public images and videos must pass the media asset gate before they are used
in Synthex UI, marketing pages, generated campaign previews, or static exports.

## Rule

- Put delivery assets under `public/` only when they are intended for browser
  delivery.
- Run `npm run media:optimize` after adding or replacing any image or video.
- Commit the generated sidecars with the source asset:
  - images: `.webp` and `.avif`
  - videos: `.webm`
- Use modern sidecars first in UI where the element supports it.
- Keep original PNG/JPG/MP4 files only as compatibility fallbacks, manifest
  icons, social cards, or source provenance.
- Do not commit large raw production exports. Store raw source media outside the
  app repo or in the approved media library.

## Gate

`npm run media:check` runs in CI and deploy workflows. It fails when:

- a source PNG/JPG/JPEG is missing WebP or AVIF sidecars
- a source MP4/MOV is missing a WebM sidecar
- a public video exceeds the delivery budget
- an image file extension does not match its encoded format

The gate may warn when a source image remains large even though sidecars exist.
Warnings are treated as follow-up performance work, not release blockers.
