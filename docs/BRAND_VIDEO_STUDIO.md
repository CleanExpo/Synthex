# Brand Video Studio

Dashboard surface + queue + worker for producing consistent, on-brand faceless
marketing videos from a topic, in a selectable visual **style**. It wraps the
`/brand-video` CLI command (`.claude/skills/brand-video/`) as an in-app feature.

## Pieces

| Piece                              | Path                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------- |
| Skill (the `/brand-video` command) | `.claude/skills/brand-video/`                                           |
| Style registry (dropdown source)   | `lib/brand-video/styles.ts` ↔ `.claude/skills/brand-video/styles.json`  |
| Dashboard page                     | `app/dashboard/brand-video/page.tsx` (nav: CREATE → Brand Video Studio) |
| Queue API (POST)                   | `app/api/brand-video/generate/route.ts`                                 |
| Jobs API (GET)                     | `app/api/brand-video/jobs/route.ts`                                     |
| Table + RLS                        | `supabase/migrations/20260627000000_brand_video_jobs.sql`               |
| Render worker                      | `scripts/brand-video-worker.ts`                                         |
| Image adapter (prod, Gemini)       | `.claude/skills/brand-video/pipeline/image_gen.py`                      |
| Worker host (CI cron)              | `.github/workflows/brand-video-render.yml`                              |

## Flow

1. User picks a **style** (default `flat-line`), **brand**, **topic**, optional
   **count**, and clicks **Generate**.
2. `POST /api/brand-video/generate` (auth-guarded via `withAuth`, Zod-validated)
   inserts a `brand_video_jobs` row with `status='queued'` and returns
   `{ jobId, status }`.
3. The page polls `GET /api/brand-video/jobs` (own jobs only) for live status.
4. `scripts/brand-video-worker.ts` claims a queued job, renders it, uploads the
   mp4 to Supabase Storage, and sets `status='done'` + `output_url`.

Status lifecycle: `queued → rendering → done | failed`.

## Worker

```bash
# one job
npx tsx scripts/brand-video-worker.ts
# drain the queue
npx tsx scripts/brand-video-worker.ts --loop
```

Pipeline per job: derive beats from the topic → **ElevenLabs TTS** (server-side
HTTP) → one styled image per beat (Gemini, below) → **ffmpeg** stitch to 1080p →
**upload to Supabase Storage** (`BRAND_VIDEO_BUCKET`) → `status='done'` +
`output_url` (the bucket's public URL).

### The image adapter (Gemini "nano-banana")

margot — the original brand-video image source — is a **local MCP**, unreachable
from a server-side worker. The default adapter is therefore the validated Gemini
`gemini-2.5-flash-image` ("nano-banana") model over plain HTTPS, shipped with the
skill at `.claude/skills/brand-video/pipeline/image_gen.py` (stdlib-only, native
16:9 PNG). The worker shells to it:

```bash
GEMINI_API_KEY=... python3 .claude/skills/brand-video/pipeline/image_gen.py "<prompt>" <out.png>
```

Optional override: set `IMAGE_API_URL` + `IMAGE_API_KEY` and the worker POSTs to
that endpoint instead (contract: `{ prompt, negative_prompt, width, height } →
{ image_base64 }`).

## Prod render (GitHub Actions)

Vercel can't run ffmpeg or long jobs, so rendering runs in CI:
`.github/workflows/brand-video-render.yml` (`workflow_dispatch` + a `*/5 * * * *`
cron). It installs Node, Python and ffmpeg, runs `npm ci`, then runs the worker
in `--loop` mode to drain the queue.

**Required GitHub Actions secrets** (Settings → Secrets and variables → Actions):

| Secret                                         | Purpose                                              |
| ---------------------------------------------- | ---------------------------------------------------- |
| `GEMINI_API_KEY`                               | Per-beat images (Gemini nano-banana)                 |
| `ELEVENLABS_API_KEY`                           | Voiceover                                            |
| `ELEVENLABS_VOICE_ID`                          | Voice id                                             |
| `SUPABASE_URL` _or_ `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (set either; worker reads both) |
| `SUPABASE_SERVICE_ROLE_KEY`                    | DB + Storage write access                            |
| `BRAND_VIDEO_BUCKET`                           | Supabase Storage bucket name for finished mp4s       |

**Supabase Storage bucket:** create a bucket whose name matches
`BRAND_VIDEO_BUCKET` (suggested: `brand-videos`). Make it **public** so
`output_url` (the `getPublicUrl` link) is directly viewable from the dashboard.

## Environment (local worker)

| Var                                            | Required     | Purpose                                  |
| ---------------------------------------------- | ------------ | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) | yes          | Supabase project URL                     |
| `SUPABASE_SERVICE_ROLE_KEY`                    | yes          | API insert + worker DB + Storage access  |
| `ELEVENLABS_API_KEY`                           | yes (worker) | Voiceover — job fails without it         |
| `GEMINI_API_KEY`                               | yes (worker) | Per-beat images (default Gemini adapter) |
| `BRAND_VIDEO_BUCKET`                           | yes (worker) | Storage bucket for finished mp4s         |
| `ELEVENLABS_VOICE_ID`                          | recommended  | Voice (falls back to Rachel)             |
| `IMAGE_API_URL` + `IMAGE_API_KEY`              | optional     | Override the Gemini image adapter        |

## Migration

Apply out of band per CLAUDE.md (never `prisma db push`):

```sql
-- supabase/migrations/20260627000000_brand_video_jobs.sql
```

RLS mirrors the `recommended_actions` convention: `service_role` full access
(API + worker), authenticated users scoped to their own rows via `auth.uid()`.

## Follow-up

- Create the GitHub Actions secrets and the Supabase Storage bucket listed under
  **Prod render** above before the first scheduled run.
- The page still renders a legacy `needs_local_render` status pill if any old rows
  carry it; the worker no longer produces that state.
