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

## Flow

1. User picks a **style** (default `flat-line`), **brand**, **topic**, optional
   **count**, and clicks **Generate**.
2. `POST /api/brand-video/generate` (auth-guarded via `withAuth`, Zod-validated)
   inserts a `brand_video_jobs` row with `status='queued'` and returns
   `{ jobId, status }`.
3. The page polls `GET /api/brand-video/jobs` (own jobs only) for live status.
4. `scripts/brand-video-worker.ts` claims a queued job and renders it.

Status lifecycle: `queued → rendering → done | needs_local_render | failed`.

## Worker

```bash
# one job
npx tsx scripts/brand-video-worker.ts
# drain the queue
npx tsx scripts/brand-video-worker.ts --loop
```

Pipeline per job: derive beats from the topic → **ElevenLabs TTS** (server-side
HTTP) → one styled image per beat via the `generateImage()` adapter → **ffmpeg**
stitch to 1080p → `status='done'` + `output_url` (served from `/public`).

### The image adapter (local-render seam)

margot — the validated brand-video image source — is a **local MCP** and is
**unreachable from a server-side worker**. `generateImage(prompt, style)`
therefore calls a generic HTTP image API. If `IMAGE_API_URL` / `IMAGE_API_KEY`
are **absent**, the job is marked **`needs_local_render`** (not failed) so it can
be finished on a machine that has margot.

Expected adapter contract:
`POST IMAGE_API_URL { prompt, negative_prompt, width, height } → { image_base64 }`.

## Environment

| Var                               | Required     | Purpose                                             |
| --------------------------------- | ------------ | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | yes          | Supabase project URL                                |
| `SUPABASE_SERVICE_ROLE_KEY`       | yes          | API insert + worker DB access                       |
| `ELEVENLABS_API_KEY`              | yes (worker) | Voiceover — job fails without it                    |
| `ELEVENLABS_VOICE_ID`             | recommended  | Voice (falls back to Rachel)                        |
| `IMAGE_API_URL` + `IMAGE_API_KEY` | optional     | Per-beat images. **Absent → `needs_local_render`.** |

## Migration

Apply out of band per CLAUDE.md (never `prisma db push`):

```sql
-- supabase/migrations/20260627000000_brand_video_jobs.sql
```

RLS mirrors the `recommended_actions` convention: `service_role` full access
(API + worker), authenticated users scoped to their own rows via `auth.uid()`.

## Follow-up

- Provide a hosted `IMAGE_API_URL`/`IMAGE_API_KEY` to render fully server-side;
  until then server-rendered jobs land in `needs_local_render`.
- Optional: upload finished MP4s to durable storage instead of `/public`.
