---
name: showrunner
description: Orchestrates end-to-end video production for board session episodes. Accepts a script JSON path, runs the full production pipeline (script doctor → audio → visual → render → QA → publish), and records all output URLs.
---

# Showrunner — Board Session Video Production Orchestrator

The Showrunner skill takes a finalised script JSON and runs the complete 10-stage production pipeline: script preparation, fact-checking, audio synthesis, music assignment, Remotion rendering, QA gating, multi-platform publishing, and production logging.

---

## Trigger

```bash
/showrunner [script-path]

# Examples:
/showrunner board-cron/video-scripts/session-23-client-journey.json
/showrunner board-cron/video-scripts/session-24-attribution-deep-dive.json

# Or triggered automatically by board-cron after Step 6 (script finalisation):
# board-cron passes the script path to showrunner as the final production step
```

---

## Pre-Flight Checks

Before starting any stage, verify:

```
REQUIRED FILES:
  ✓ [script-path] exists and is valid JSON
  ✓ board-cron/rotation-state.json exists
  ✓ board-cron/[brand]-brand-config.json exists
  ✓ board-cron/remotion/src/index.ts exists
  ✓ ffprobe is available in PATH (for audio duration)
  ✓ ffmpeg is available in PATH (for thumbnails)

REQUIRED ENV VARS:
  ✓ ELEVENLABS_API_KEY
  ✓ YOUTUBE_API_KEY (or YOUTUBE_OAUTH_TOKEN)
  ✓ LINKEDIN_ACCESS_TOKEN (optional — skip LinkedIn if missing)
  ✓ TWITTER_API_KEY (optional — skip Twitter if missing)
```

If required files or env vars are missing: log the specific missing item, exit with a clear error message. Do not proceed.

---

## Pipeline Overview

```
Stage 1: Script Doctor       → spoken delivery rewrite
Stage 2: Fact-Check          → verify data points against live sources
Stage 3: Audio Generation    → ElevenLabs multi-voice synthesis
Stage 4: Music & SFX         → scene-by-scene audio landscape
Stage 5: Remotion Input      → calculate durations, generate props JSON
Stage 6: Render              → Remotion long-form + short-form
Stage 7: Thumbnails          → 3 variants (frame extract + title card)
Stage 8: QA Gates            → automated pre-publish checks
Stage 9: Publish             → YouTube, LinkedIn, Twitter/X
Stage 10: Production Log     → record full run to JSON
```

---

## Stage 1: Script Doctor

**Purpose:** Rewrite `narrated: true` segments for spoken delivery. Written prose sounds unnatural when read aloud.

### Input
Script JSON at `[script-path]`. Process segments where `narrated: true`.

### Rewrite Rules

| Remove | Replace with |
|--------|-------------|
| "Furthermore," | "And," or restructure sentence |
| "In conclusion," | "So here's the bottom line:" |
| "As we can see," | "Look at this:" |
| "It is important to note that" | "Here's what matters:" |
| "Additionally," | "Also," |
| "Therefore," | "So," |

**Pause injection:**
- `...` → 0.5 second pause (use before dramatic statements)
- `—` → 0.25 second pause (use mid-sentence for emphasis)
- New paragraph in script → 1 second pause

**Statistics conversion:**
- "47.3%" → "forty-seven percent"
- "1,247 clients" → "over twelve hundred clients"
- "$4.2M" → "four point two million dollars"
- Any number over 1,000: convert to spoken form

**Sentence length:**
- Break sentences over 25 words into two sentences
- Rhetorical questions are encouraged: "Why does this matter?" works better spoken than "The significance of this is..."

### Output
`board-cron/video-scripts/[session-slug]-scripted.json`
Same structure as input; `narrated: true` segments have `content` replaced with spoken version.

### Failure Handling
If script doctor AI call fails: log error to production log, use original script as fallback. **Non-blocking — continue to Stage 2.**

---

## Stage 2: Fact-Check

**Purpose:** Verify data-point claims in the script against live Supabase/Linear data.

### Process

For each segment containing a `data_point` field in the script JSON:

1. Identify the data source reference (e.g., `"source": "platform_metrics.total_reach"`)
2. Query the referenced table/field for the current value
3. Compare script value to live value:
   - Within 20% tolerance: auto-accept, continue
   - Over 20% discrepancy: flag in production log with: `{ "field": "...", "script_value": X, "live_value": Y, "discrepancy_pct": Z }`

### Tolerance Rules

| Discrepancy | Action |
|-------------|--------|
| ≤ 20% | Auto-accept. Log at INFO level. |
| > 20% | Flag for manual review. Log at WARN level. |
| Live data unavailable | Use script value. Log at WARN level. |

### Output
No file output — updates internal state only. Flags written to production log (Stage 10).

### Failure Handling
If fact-check query fails entirely: **non-blocking.** Proceed with original script values, flag all data points as "unverified" in production log.

---

## Stage 3: Audio Generation

**Purpose:** Multi-voice synthesis via ElevenLabs API.

### Voice Cast Resolution

Read voice cast from `board-cron/rotation-state.json → voice_cast`.

```json
{
  "voice_cast": {
    "ceo": { "voice_id": "aGkVQvWUZi16EH8aZJvT", "settings": { ... } },
    "revenue": { "voice_id": "...", "settings": { ... } }
  }
}
```

If a persona's `voice_id = "NEEDS_CASTING"`: use CEO fallback voice (`aGkVQvWUZi16EH8aZJvT`) and log warning.

### ElevenLabs API Call

For each segment where `narrated: true`:

```
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
Headers:
  xi-api-key: $ELEVENLABS_API_KEY
  Content-Type: application/json
Body:
  {
    "text": "[segment content from scripted JSON]",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
      "stability": [from voice_cast[persona].settings.stability],
      "similarity_boost": [from voice_cast[persona].settings.similarity_boost],
      "style": [from voice_cast[persona].settings.style],
      "use_speaker_boost": true
    }
  }
```

### Output Files

```
board-cron/video-assets/[session-slug]/audio/[persona]-[segment-index].mp3

# Example:
board-cron/video-assets/session-23/audio/ceo-0.mp3
board-cron/video-assets/session-23/audio/revenue-1.mp3
board-cron/video-assets/session-23/audio/product-2.mp3
```

### Failure Handling
- Single segment fails: retry once, then use silence placeholder (0-duration gap)
- Persona voice unavailable (API 404/422): fall back to CEO voice (`aGkVQvWUZi16EH8aZJvT`) for that segment, log warning
- All ElevenLabs calls fail (network/auth): **BLOCKING.** Abort pipeline. Log error. Do not proceed to render.

---

## Stage 4: Music & SFX Assignment

**Purpose:** Map scene types to music tracks and sound effects for the audio landscape.

### SFX Catalogue

Read from `board-cron/remotion/src/assets/sounds/catalogue.json`.

Expected structure:
```json
{
  "music_tracks": {
    "deliberation": "tense-underscore.mp3",
    "decision": "confident-build.mp3",
    "action": "momentum-drive.mp3",
    "opening": "synthex-intro.mp3",
    "closing": "synthex-outro.mp3",
    "neutral": "ambient-background.mp3"
  },
  "sfx": {
    "transition": "whoosh.mp3",
    "emphasis": "sting.mp3",
    "data_reveal": "data-pop.mp3"
  }
}
```

### Scene Type → Music Mapping

| Scene Type | Music Track | Notes |
|------------|-------------|-------|
| `deliberation` | tense-underscore | Board debating, weighing options |
| `decision` | confident-build | Conclusion reached, direction set |
| `action` | momentum-drive | Execution update, results revealed |
| `opening` | synthex-intro | First 15 seconds of episode |
| `closing` | synthex-outro | Final 30 seconds |
| `neutral` | ambient-background | Narration without strong scene type |
| (default) | ambient-background | Any unrecognised scene type |

### Output

`board-cron/video-scripts/[session-slug]-with-audio-map.json`

Adds `music_track` and `sfx[]` fields to each scene object in the script.

### Failure Handling
If catalogue.json missing or track files not found: **non-blocking.** Render with voice-only (no music bed). Log warning: "Music assets unavailable — rendering voice-only."

---

## Stage 5: Remotion Input Generation

**Purpose:** Calculate scene durations from audio files and generate the `RemotionInputProps` JSON.

### Audio Duration Extraction

For each audio file generated in Stage 3:

```bash
ffprobe -i [audio-file] -show_entries format=duration -v quiet -of csv=p=0
```

Returns duration in seconds (e.g., `14.832`).

Add `INTER_SCENE_GAP = 0.5` seconds between scenes.

### RemotionInputProps Structure

```json
{
  "sessionSlug": "session-23-client-journey",
  "sessionNumber": 23,
  "episodeTitle": "The Client Journey Episode",
  "scenes": [
    {
      "index": 0,
      "persona": "ceo",
      "audioFile": "board-cron/video-assets/session-23/audio/ceo-0.mp3",
      "durationSeconds": 14.832,
      "sceneType": "opening",
      "musicTrack": "synthex-intro.mp3",
      "sfx": ["whoosh.mp3"],
      "content": "[spoken text]"
    }
  ],
  "totalDurationSeconds": 623.4,
  "voiceCast": { ... },
  "brandConfig": { ... }
}
```

### Output

`board-cron/video-assets/[session-slug]/remotion-props.json`

### Failure Handling
If ffprobe fails for a file: use estimated duration based on word count (average 2.5 words/second). Log warning. Non-blocking.

---

## Stage 6: Render

**Purpose:** Trigger Remotion render for long-form and short-form compositions.

### Long-Form Render

```bash
cd board-cron/remotion && npx remotion render src/index.ts BoardSession \
  --props ../../video-assets/[session-slug]/remotion-props.json \
  --output ../../video-assets/[session-slug]/long-form.mp4 \
  --codec h264 \
  --image-format jpeg
```

Expected: 8–15 minutes runtime. Output: `board-cron/video-assets/[session-slug]/long-form.mp4`

### Short-Form Render

```bash
cd board-cron/remotion && npx remotion render src/index.ts BoardSessionShort \
  --props ../../video-assets/[session-slug]/remotion-props.json \
  --output ../../video-assets/[session-slug]/short-form.mp4 \
  --codec h264 \
  --image-format jpeg
```

Expected: 45–90 seconds. Output: `board-cron/video-assets/[session-slug]/short-form.mp4`

### Vercel Lambda (if configured)

If `REMOTION_LAMBDA_FUNCTION_ARN` is set in env:

```typescript
import { renderMediaOnLambda } from '@remotion/lambda';

await renderMediaOnLambda({
  region: 'ap-southeast-2',
  functionName: process.env.REMOTION_LAMBDA_FUNCTION_NAME,
  serveUrl: process.env.REMOTION_SERVE_URL,
  composition: 'BoardSession',
  inputProps: remotionProps,
  codec: 'h264',
  downloadBehavior: { type: 'download', fileName: 'long-form.mp4' }
});
```

### Failure Handling
Render failure is **BLOCKING.** Log error with full stderr output. Do not proceed to Stage 7. Alert: "Render failed for [session-slug]. Manual intervention required."

---

## Stage 7: Thumbnail Generation

**Purpose:** Generate 3 thumbnail variants for YouTube and social.

### Variant A — Frame extract at 0.5s

```bash
ffmpeg -i board-cron/video-assets/[session-slug]/long-form.mp4 \
  -vframes 1 -ss 0.5 \
  board-cron/video-assets/[session-slug]/thumbnail-a.jpg
```

### Variant B — Frame extract at 30s

```bash
ffmpeg -i board-cron/video-assets/[session-slug]/long-form.mp4 \
  -vframes 1 -ss 30 \
  board-cron/video-assets/[session-slug]/thumbnail-b.jpg
```

### Variant C — Custom title card (Remotion still)

```bash
cd board-cron/remotion && npx remotion still src/index.ts BoardSessionThumbnail \
  --props ../../video-assets/[session-slug]/remotion-props.json \
  --output ../../video-assets/[session-slug]/thumbnail-c.jpg \
  --frame 0
```

All 3 variants saved to `board-cron/video-assets/[session-slug]/`.

### Failure Handling
Thumbnail failures are **non-blocking.** Proceed to Stage 8 with whatever variants were generated. YouTube upload will use the best available thumbnail (prefer Variant C → B → A).

---

## Stage 8: QA Gates

**Purpose:** Automated pre-publish quality checks. All gates must pass before publish.

### Gate 1: Audio Levels

```bash
ffmpeg -i [long-form.mp4] -af "loudnorm=print_format=json" -f null - 2>&1
```

- Voice peaks must be between **-14 LUFS and -10 LUFS**
- PASS: within range
- FAIL: outside range → flag for manual audio review

### Gate 2: Branding Check

Extract frames at 5s, 30s, and 60s:

```bash
ffmpeg -i [long-form.mp4] -vframes 1 -ss 5 qa-frame-5s.jpg
ffmpeg -i [long-form.mp4] -vframes 1 -ss 30 qa-frame-30s.jpg
ffmpeg -i [long-form.mp4] -vframes 1 -ss 60 qa-frame-60s.jpg
```

Verify Synthex logo presence using Remotion composition metadata (logo is always rendered at these timestamps in `BoardSession` composition). This is a metadata check, not pixel analysis.

- PASS: composition includes logo layer at all three timestamps
- FAIL: logo layer absent → branding violation

### Gate 3: Duration

```bash
ffprobe -i [long-form.mp4] -show_entries format=duration -v quiet -of csv=p=0
ffprobe -i [short-form.mp4] -show_entries format=duration -v quiet -of csv=p=0
```

- Long-form: **8–15 minutes** (480–900 seconds)
- Short-form: **45–90 seconds**
- PASS: within range
- FAIL: outside range → flag (too short = likely render error; too long = content issue)

### Gate 4: Text Readability

Extract first and last 5 frames. Check that no text elements in the Remotion composition have font size < 24px. This is validated from `remotion-props.json` scene data, not pixel analysis.

- PASS: all text elements ≥ 24px per composition spec
- FAIL: any text element < 24px

### Gate Result Logic

```
IF all 4 gates PASS:
  → Proceed to Stage 9 (Publish)

IF any gate FAILS:
  → Save QA report to board-cron/logs/qa-[YYYY-MM-DD]-[session-slug].json
  → Set pipeline status: "QA_FAILED"
  → Log: "QA failed for [session-slug]. Manual review required before publish."
  → EXIT pipeline (do NOT publish)
```

### QA Report Format

```json
{
  "session_slug": "session-23-client-journey",
  "qa_date": "2026-04-03",
  "gates": {
    "audio_levels": { "status": "PASS", "lufs": -12.4 },
    "branding": { "status": "PASS" },
    "duration": {
      "status": "FAIL",
      "long_form_seconds": 423,
      "expected_min": 480,
      "expected_max": 900
    },
    "text_readability": { "status": "PASS" }
  },
  "overall": "FAIL",
  "action_required": "Long-form video is 7m 3s — below minimum 8 minutes. Review script for missing scenes."
}
```

---

## Stage 9: Publish

**Purpose:** Multi-platform upload. Only reached if ALL QA gates pass.

### YouTube Long-Form

```
POST https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status
```

Metadata:
```json
{
  "snippet": {
    "title": "Synthex Board | [Session Topic] | EP[N]",
    "description": "[contents of board-cron/templates/youtube-description.md with variables replaced]",
    "tags": ["Synthex", "AI Marketing", "Small Business", "Board", "Marketing Strategy", "Australian Business"],
    "categoryId": "22",
    "defaultLanguage": "en-AU"
  },
  "status": {
    "privacyStatus": "public",
    "selfDeclaredMadeForKids": false
  }
}
```

After upload: set thumbnail to best available (Variant C preferred → B → A).

Add to playlist: "The Board" (`playlistId` from brand config).

### YouTube Short

Upload `short-form.mp4` with:
- Title: `Synthex Board Short | [Session Topic] | EP[N] #Shorts`
- Description: First 3 decision bullets from script + standard footer
- Tags include: `#Shorts`, `#Synthex`, `#AIMarketing`

### LinkedIn

```
POST https://api.linkedin.com/v2/ugcPosts
```

```json
{
  "author": "urn:li:organization:[companyId]",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": {
        "text": "[DECISION body from script — full text of key decision for this episode]"
      },
      "shareMediaCategory": "VIDEO",
      "media": [{
        "status": "READY",
        "description": { "text": "[episode description]" },
        "media": "[LinkedIn video URN after upload]",
        "title": { "text": "Synthex Board | [Session Topic] | EP[N]" }
      }]
    }
  },
  "visibility": { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
}
```

Note: LinkedIn video upload is a 2-step process (register upload → upload binary). Handle accordingly.

### Twitter/X

Only if `TWITTER_API_KEY` is available in env.

Create a thread (max 280 chars per tweet):
1. Hook tweet: key stat or provocative question from episode
2. Decision summary: 2–3 bullet points as tweets
3. Closing tweet: YouTube link + hashtags

```
POST https://api.twitter.com/2/tweets
```

### URL Recording

After each successful platform upload, record the URL:

```json
// Update rotation-state.json → history[n].video:
{
  "session_slug": "session-23",
  "youtube_long": "https://www.youtube.com/watch?v=...",
  "youtube_short": "https://www.youtube.com/shorts/...",
  "linkedin": "https://www.linkedin.com/feed/update/...",
  "twitter_thread": "https://twitter.com/synthexsocial/status/..."
}
```

### Failure Handling

Individual platform failures are **non-blocking.** If one platform fails:
- Log the error with platform name and HTTP status
- Continue with remaining platforms
- Record partial URLs in rotation-state.json
- Flag in production log: "Published to X/Y platforms. [platform] failed: [reason]"

---

## Stage 10: Production Log

**Purpose:** Complete record of the production run for audit, debugging, and analytics.

### Output File

`board-cron/logs/production-[YYYY-MM-DD]-[session-slug].json`

### Log Structure

```json
{
  "session_name": "session-23-client-journey",
  "brand": "synthex",
  "start_time": "2026-04-03T09:00:00.000Z",
  "end_time": "2026-04-03T09:47:23.000Z",
  "total_duration_seconds": 2843,
  "stages": {
    "script_doctor": {
      "status": "completed",
      "duration_seconds": 12,
      "output_path": "board-cron/video-scripts/session-23-scripted.json",
      "fallback_used": false
    },
    "fact_check": {
      "status": "completed",
      "duration_seconds": 8,
      "flags": [
        {
          "field": "total_clients",
          "script_value": 847,
          "live_value": 923,
          "discrepancy_pct": 8.2,
          "action": "auto_accepted"
        }
      ]
    },
    "audio_generation": {
      "status": "completed",
      "duration_seconds": 340,
      "files_generated": 12,
      "fallbacks_used": ["contrarian → ceo_fallback"]
    },
    "music_sfx": {
      "status": "completed",
      "duration_seconds": 2,
      "output_path": "board-cron/video-scripts/session-23-with-audio-map.json"
    },
    "remotion_input": {
      "status": "completed",
      "duration_seconds": 15,
      "output_path": "board-cron/video-assets/session-23/remotion-props.json"
    },
    "render": {
      "status": "completed",
      "duration_seconds": 1847,
      "long_form_path": "board-cron/video-assets/session-23/long-form.mp4",
      "short_form_path": "board-cron/video-assets/session-23/short-form.mp4"
    },
    "thumbnails": {
      "status": "completed",
      "duration_seconds": 18,
      "variants_generated": ["a", "b", "c"]
    },
    "qa_gates": {
      "status": "passed",
      "duration_seconds": 45,
      "gates": {
        "audio_levels": "PASS",
        "branding": "PASS",
        "duration": "PASS",
        "text_readability": "PASS"
      }
    },
    "publish": {
      "status": "completed",
      "duration_seconds": 520,
      "platforms": {
        "youtube_long": { "status": "success", "url": "https://www.youtube.com/watch?v=..." },
        "youtube_short": { "status": "success", "url": "https://www.youtube.com/shorts/..." },
        "linkedin": { "status": "success", "url": "https://www.linkedin.com/feed/update/..." },
        "twitter": { "status": "skipped", "reason": "TWITTER_API_KEY not configured" }
      }
    }
  },
  "published_urls": {
    "youtube_long": "https://www.youtube.com/watch?v=...",
    "youtube_short": "https://www.youtube.com/shorts/...",
    "linkedin": "https://www.linkedin.com/feed/update/..."
  },
  "qa_result": "passed",
  "overall_status": "completed"
}
```

---

## Brand Configuration

The showrunner reads brand config from `board-cron/[brand]-brand-config.json`.

Default brand: `synthex` (reads `board-cron/synthex-brand-config.json`).

To run for a different brand:
```bash
/showrunner board-cron/video-scripts/session-23.json --brand restoreassist
```

See `board-cron/brand-config.schema.json` for the full JSON schema.

### Supported Brands

| Brand | Config File |
|-------|-------------|
| Synthex | `board-cron/synthex-brand-config.json` |
| RestoreAssist | `board-cron/restoreassist-brand-config.json` |
| Unite Group | `board-cron/unite-group-brand-config.json` |
| external client | `board-cron/external-client-brand-config.json` |
| NRPG | `board-cron/nrpg-brand-config.json` |

---

## Graceful Degradation Summary

| Failure | Blocking? | Fallback |
|---------|-----------|----------|
| Script Doctor AI call fails | No | Use original script |
| Fact-check query fails | No | Use script values, flag as unverified |
| Single audio segment fails | No | Silence placeholder for that segment |
| Persona voice unavailable | No | CEO voice fallback |
| ALL ElevenLabs calls fail | Yes | Abort — no audio = no render |
| Music catalogue missing | No | Voice-only render |
| ffprobe duration extraction fails | No | Estimate from word count |
| Render fails | Yes | Abort — alert for manual review |
| Thumbnail generation fails | No | Proceed with fewer variants |
| QA gate fails | Yes | Save QA report, do NOT publish |
| Individual platform publish fails | No | Continue with other platforms |
| All platforms fail | No | Log failure — video files still saved locally |

---

## Output Directory Structure

After a successful run, the following files exist:

```
board-cron/
  video-scripts/
    session-23-client-journey.json          (original)
    session-23-scripted.json               (Stage 1 output)
    session-23-with-audio-map.json         (Stage 4 output)
  video-assets/
    session-23-client-journey/
      audio/
        ceo-0.mp3
        revenue-1.mp3
        product-2.mp3
        [... all segments]
      remotion-props.json                  (Stage 5 output)
      long-form.mp4                        (Stage 6 output)
      short-form.mp4                       (Stage 6 output)
      thumbnail-a.jpg                      (Stage 7 output)
      thumbnail-b.jpg
      thumbnail-c.jpg
  logs/
    production-2026-04-03-session-23-client-journey.json   (Stage 10)
    qa-2026-04-03-session-23-client-journey.json           (Stage 8, if failed)
```
