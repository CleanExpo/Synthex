# YouTube Channel Source List

> Status: 🟡 `DATA_REQUIRED`
> A full vault + machine scan on 2026-05-29 found **no YouTube channel references** and **no Neil
> Patel references**. This file therefore cannot list "the two channels from Obsidian" — they do
> not exist yet. Below is exactly how to supply them so the analysis can run for real.

## What was searched (and found nothing)

```
grep -rli "neil patel"  /Users/phillmcgurk/2nd-brain  → 0 hits
grep -rhoE "youtube.com/(channel|c|@)..." vault        → 0 hits
```

## Channel slots (to be populated by Phill — do not invent)

| Slot | Source | Channel URL | Why this channel | Status |
|------|--------|-------------|------------------|--------|
| Channel 1 | (vault — not present) | `DATA_REQUIRED` | `DATA_REQUIRED` | 🟡 awaiting URL |
| Channel 2 | (vault — not present) | `DATA_REQUIRED` | `DATA_REQUIRED` | 🟡 awaiting URL |
| Neil Patel | named in master prompt | `https://www.youtube.com/@neilpatel` *(canonical, to be confirmed before ingest)* | Master prompt requests last 50 relevant videos | 🟡 awaiting ingest pipeline |

> The Neil Patel URL above is the well-known canonical handle, included only as the ingestion
> target. **No video data has been pulled or invented.** Treat all NP advice as 💬 `OPINION_SOURCE`
> until cross-verified per [verified-ranking-claims.md](verified-ranking-claims.md).

## How to supply the channels (two options)

### Option A — drop them in the vault (lowest friction)

Create `/Users/phillmcgurk/2nd-brain/Sources/youtube-channels-for-marketing-intelligence.md`:

```markdown
---
type: source
component: marketing-intelligence
created: 2026-05-29
---
# YouTube channels to analyse
- Channel 1: <paste channel URL> — reason: <why>
- Channel 2: <paste channel URL> — reason: <why>
- Neil Patel: https://www.youtube.com/@neilpatel
```

The skill's Agent 2 ingestion step reads `Sources/` and will pick this up automatically.

### Option B — enable real video ingestion

The honest blocker: pulling 50 video transcripts reliably needs an API, not ad-hoc fetching.

1. Add a **YouTube Data API v3** key to the environment (`YOUTUBE_API_KEY`, Vercel dashboard only).
2. The skill's `workflow.md` § "YouTube ingestion" defines the call sequence:
   `channels.list` → `playlistItems.list` (uploads) → `videos.list` → transcript fetch.
3. Output lands in `Outcomes/research-ingest/` as `*-youtube-<channel>.md`, then is summarised into
   [youtube-claims-dataset.json](youtube-claims-dataset.json).

Until one of these is done, Agents 2–3 cannot produce real video analysis, and
[youtube-analysis-neil-patel-50.md](youtube-analysis-neil-patel-50.md) stays a scaffold.
