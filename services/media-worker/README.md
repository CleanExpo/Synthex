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

## Deploy to Railway

1. New Railway service from the **CleanExpo/Synthex** repo, **Root Directory = `services/media-worker`** (Dockerfile build).
2. Set variables:
   - `WORKER_TOKEN` — a random shared secret (the Synthex MCP tools send it as Bearer).
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — only needed for `/extract` `upload` (writing frames into the private reference bucket).
3. Deploy. Health-check `GET /health` should return the ffmpeg version.
4. Copy the public Railway URL → set `MEDIA_WORKER_URL` (+ `MEDIA_WORKER_TOKEN`) in Synthex (Vercel) so the MCP studio-tools can reach it.

## The video → private grounding loop

`POST /extract` with `upload:{industry:'carpet-steam-cleaning', subjectKey:'training-frames', label:'…'}` extracts frames from an owned carpet video and writes them straight into `reference-library-private` + the private manifest — so reference grounding (see `lib/services/ai/reference-library-private.ts`) can use them immediately, and the raw footage never leaves your control.
