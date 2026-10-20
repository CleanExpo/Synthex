# media-worker

Cloud **ffmpeg** service for the Synthex media MCP. Runs native ffmpeg in a
container (Railway) so agents/MCP tools can **probe, extract frames from, and
transcode** owned media of any size by URL — no local ffmpeg, no 4.5 MB
serverless body cap.

## Endpoints (Bearer `WORKER_TOKEN`)

| Method | Path         | Body                                                                                              | Returns                                                                                           |
| ------ | ------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| GET    | `/health`    | —                                                                                                 | `{ ok, ffmpeg }`                                                                                  |
| POST   | `/probe`     | `{ videoUrl }`                                                                                    | ffprobe JSON                                                                                      |
| POST   | `/extract`   | `{ videoUrl, everySeconds?, maxFrames?, format?, quality?, upload?:{industry,subjectKey,label} }` | frames (base64) — or pushed into the **private reference bucket** + manifest when `upload` is set |
| POST   | `/transcode` | `{ videoUrl, format?, maxWidth?, crf? }`                                                          | transcoded file (base64)                                                                          |

`videoUrl` may be any http(s) URL ffmpeg can fetch — a Supabase signed URL, a
fal URL, or (for owned Drive files) a Drive direct-download / signed URL.

## What is actually deployed (observed 20/10/2026)

- Railway project `synthex-media-worker`, service `synthex-media-worker`, public URL
  `https://synthex-media-worker-production.up.railway.app`. `GET /health` returned HTTP 200 with
  `ffmpeg version 5.1.9-0+deb12u1`, i.e. Debian 12's packaged ffmpeg.
- Railway's latest deployment (created 11/07/2026) uses the `DOCKERFILE` builder with
  `dockerfilePath: /Dockerfile`. The service has **no repo source connected**; it was uploaded from a
  local CLI (`railway up`). No health-check path is configured.
- **That Dockerfile is not in this repository.** A redeploy from this folder alone cannot reproduce the
  running image. Restoring a committed Dockerfile is a separate runtime change: pin the base image by
  digest, commit a lockfile, install with `npm ci --omit=dev --ignore-scripts`, and check `/health`
  after the deploy.

## Deploy to Railway

1. New Railway service from the **CleanExpo/Synthex** repo, **Root Directory = `services/media-worker`** (Dockerfile build; the Dockerfile must be restored first, see above).
2. Set variables:
   - `WORKER_TOKEN` — a random shared secret (the Synthex MCP tools send it as Bearer).
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — only needed for `/extract` `upload` (writing frames into the private reference bucket).
3. Deploy. Health-check `GET /health` should return the ffmpeg version.
4. Copy the public Railway URL → set `MEDIA_WORKER_URL` (+ `MEDIA_WORKER_TOKEN`) in Synthex (Vercel) so the MCP studio-tools can reach it.

## The video → private grounding loop

`POST /extract` with `upload:{industry:'carpet-steam-cleaning', subjectKey:'training-frames', label:'…'}` extracts frames from an owned carpet video and writes them straight into `reference-library-private` + the private manifest — so reference grounding (see `lib/services/ai/reference-library-private.ts`) can use them immediately, and the raw footage never leaves your control.
