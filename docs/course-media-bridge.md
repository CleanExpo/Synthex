# Course-Media Bridge

`scripts/generate-course-media.mjs` — the connector between an external course repo's **media manifest**
and the Synthex media factory (`/api/media/generate/{image,video,voice}`). It lets CARSI (and any other
estate course) declare the images/video it needs as data, and have Synthex produce them, tag them into the
media library, and hand back an asset map.

This is the "Synthex as media producer for the training modules" container.

## Flow

```
external manifest (JSON)  ──▶  generate-course-media.mjs  ──▶  /api/media/generate/{image,video,voice}
   (prompts + specs +           validate → (execute) POST        → media library (tagged) + asset map
    placement + tags)
```

- **Manifest schema** — `{ course, assets: [{ id, kind: image|video|voice, endpoint, request, tags,
  placement }] }`. `request` is a verbatim payload for the matching generate endpoint (this bridge does
  not reshape it — it validates it against the same constraints the route enforces).
- **Validation first** — every payload is checked against the endpoint's enums/limits (image aspect
  ratios, video type/provider/duration, prompt lengths). Any invalid asset aborts the run **before** a
  paid call. Keep the mirror in `generate-course-media.mjs` in lock-step with
  `app/api/media/generate/*/route.ts` if those schemas change.
- **Async video** — video generations (fal / d-id / synthesia) return a job; the bridge records it as
  `submitted` and the completion lands in the media library under the manifest tag. Filter the library by
  tag (e.g. `ccw-workshop`) to collect finished URLs.

## Usage

```bash
# Dry-run — validate a manifest, spend nothing, no credentials required
node scripts/generate-course-media.mjs <manifest.json|url>

# Execute — drive the factory (owner-triggered; needs media API keys provisioned in this env)
SYNTHEX_BASE_URL=https://<host> SYNTHEX_MEDIA_TOKEN=<bearer> \
  node scripts/generate-course-media.mjs <manifest> --execute [--only=id,id] [--kind=image|video] [--out=path]
```

`SYNTHEX_MEDIA_TOKEN` is read from env only, never printed or committed. No new dependencies (node
built-ins + global `fetch`).

## First consumer

CARSI CCW workshop — manifest at `data/media/ccw-workshop-media-manifest.json` in the CARSI repo (15
assets: module heroes, training diagrams, explainer videos, marketing stills + trailer). Wiring notes:
`docs/course-content/ccw-workshop/MEDIA.md` in CARSI.
