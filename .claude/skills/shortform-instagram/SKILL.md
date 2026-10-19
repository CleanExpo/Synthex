---
name: shortform-instagram
description: >-
  Instagram Reels production and publishing rules for Synthex short-form video. Use when
  planning, scripting, editing, captioning, gating or publishing a Reel for any Unite Group
  brand, when nexus-viral-run derives an instagram cut, or when someone asks why a Reel
  under-performed. Specs, ranking signals, originality and AI-label rules, Trial Reels,
  Graph API publishing and insights. Pairs with shortform-pattern-library for the measured
  hook, pacing, caption and audio numbers.
metadata:
  author: synthex
  version: 1.0.0
  type: platform-reference
  triggers: [instagram reel, reels, ig video, trial reel, instagram cut]
---

# Instagram Reels

Last verified: 2026-10-19. Evidence: `../shortform-pattern-library/references/platform-docs-2026-10.md`
(sources and dates for every line). Tags: **[P]** read on an official page, **[S]** secondary.
Re-open any [S] line before turning it into a hard gate.

Craft numbers (hook timing, cut rate, caption style, loudness) live in
**shortform-pattern-library**. This skill is the Instagram-specific layer on top.

## 1. Deliverable spec

| Item | Rule |
|---|---|
| Aspect | 9:16, 1080×1920 master. API accepts other ratios but crops or letterboxes [P] |
| Length | API 3 s – 15 min [P]. In-app 3 min is the recommended ceiling: Reels over 3 min reach followers only, not non-followers [S] |
| Codec | H.264 or HEVC, closed GOP, 4:2:0, moov atom at front, 23–60 fps, ≤25 Mbps VBR, ≤300 MB [P] |
| Audio | AAC ≤48 kHz, 128 kbps [P]. Master to the loudness in shortform-pattern-library |
| Cover | `cover_url` JPEG ≤8 MB, 9:16. The centre 1:1 crop shows on the profile grid, so keep the title inside it [P] |
| Captions | No caption-file field in the API [P]. Burn captions in |
| Safe zone | No official pixel spec [gap]. Keep text out of the bottom ~35% and the right ~12% (Synthex `viral-method-cards.json` uses bottom 15% / right 12% reserved; Reels UI is taller, so treat 15% as a floor). Preview with the app UI on before approval |

## 2. What the ranking rewards

- Mosseri (Jan 2025): the top three signals are **watch time, likes per reach and sends per reach**.
  Sends weigh slightly more for non-followers, likes for followers [S, via Social Media Today:
  https://www.socialmediatoday.com/news/instagram-shares-algorithm-2025/738034/].
- Official ranking explainer: Reels that are **low-resolution, watermarked, muted, bordered,
  mostly text or already on Instagram** are shown less [P]:
  https://about.instagram.com/blog/announcements/instagram-ranking-explained
- Build for **sends**: one concrete, useful or surprising takeaway that a viewer would forward
  to a specific person ("send this to whoever's doing your reno").

## 3. Originality (hard rule)

From 30 Apr 2026 [P] (https://creators.instagram.com/blog/rewarding-original-creators-on-instagram):
- Accounts that mainly post unoriginal content lose recommendation eligibility. A border,
  watermark, subtitles or a caption credit added to someone else's clip **does not** make it original.
- Eligibility is judged over a rolling 30 days.

Synthex consequence: **study competitors, never re-post them.** The pattern library extracts
structure (timing, framing, typography), and every Synthex Reel is shot from the brand's own
footage through the grounded pipeline (`.claude/rules/real-images-only.md`). Export a clean
master per platform: no TikTok or CapCut watermark ever reaches Instagram.

## 4. AI disclosure

- Meta labels AI content "AI info". Photorealistic video or realistic audio that was digitally
  created or altered may require a label, and a missing label can be penalised [P]:
  https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/
- API: set `is_ai_generated=true` when a Reel contains generated photoreal people, scenes or a
  cloned voice [P]. Grounded edits of real job footage (colour, captions, crops) do not need it.

## 5. Audio

- Business accounts are limited to the Meta Sound Collection for licensed music [S]. Default
  Synthex Reels to **original audio**: voice plus a licensed bed (Artlist via `artlist-mcp`, or
  the Sound Collection). Never use a trending commercial track on a brand account.
- `audio_name` renames original audio once [P]. Name it after the hook so the sound itself is
  findable.

## 6. Caption, hashtags, search

- Hashtags: **maximum 5** per Reel (rolled out Dec 2025) [S, Social Media Today 18 Dec 2025:
  https://www.socialmediatoday.com/news/instagram-implements-new-limits-on-hashtag-use/808309/].
  Use 3–5 specific tags (#waterdamagerestoration, #brisbanebuilder), never #reels or #explore.
- Put the search phrase in **all three** of: the spoken line, the on-screen text, and the caption's
  first line. Instagram search reads captions and understands the video, and Google indexes
  public professional-account posts [S].
- First caption line ≤125 characters (truncation), carrying the hook restated as a benefit.

## 7. Trial Reels: the default test path

From https://creators.instagram.com/blog/instagram-trial-reels [P]:
- Trials go to **non-followers first** and do not appear in followers' feeds.
- Results after ~24 h. Optional auto-share if it performs on views within 72 h.
- API: `trial_params.graduation_strategy` = `MANUAL` or `SS_PERFORMANCE`.

Synthex rule: every **new format or hook family** ships as a Trial Reel first. Compare trials
with trials, not with main-feed Reels.

## 8. Publishing (Graph API)

From https://developers.facebook.com/docs/instagram-platform/content-publishing [P]:
1. `POST /<IG_ID>/media` with `media_type=REELS`, `video_url`, `caption`, `share_to_feed`,
   optional `cover_url`, `collaborators` (≤3), `trial_params`, `is_ai_generated`.
2. Poll `GET /<container>?fields=status_code` until `FINISHED` (once a minute, ≤5 min).
3. `POST /<IG_ID>/media_publish?creation_id=<container>`.

Limits: 100 API posts per rolling 24 h (the same page also says 50; budget for 50) and 400
containers per 24 h. Check `GET /<IG_ID>/content_publishing_limit` before a batch [P].
Scopes: `instagram_business_basic` + `instagram_business_content_publish` (Instagram Login) or
`instagram_basic` + `instagram_content_publish` + `pages_read_engagement` (Facebook Login).
Code: `lib/publish/platformAdapters/instagram.ts`, OAuth fixes in the `connecting-meta-facebook-instagram` skill.
Publishing stays human-gated (`queued_human_gated` in nexus-viral-run).

## 9. Measure (Insights API)

Reels metrics [P] (https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights):
`views`, `reach`, `shares`, `saved`, `likes`, `comments`, `ig_reels_avg_watch_time`,
`ig_reels_video_view_total_time`, **`reels_skip_rate`** (share skipped in the first 3 s).
`plays` and `impressions` are deprecated.

Scorecard per Reel, read at 24 h and 7 d:
- `reels_skip_rate`: the hook score. Compare against the account's own median.
- `ig_reels_avg_watch_time ÷ duration`: retention.
- `shares ÷ reach` (sends per reach) and `likes ÷ reach`: Mosseri's two rate signals.
- The client metric it moved (RestoreAssist trial sign-ups, CARSI enrolments) via UTM'd bio link.

## 10. Gate checklist (feeds Gate A / Gate B)

- [ ] 9:16 clean master, no foreign watermark, no border
- [ ] Subject on screen in frame 1, text hook visible by 0.5 s (pattern library)
- [ ] All text inside the safe zone with the Reels UI overlaid
- [ ] Burned-in captions match the transcript
- [ ] Original or licensed audio; `is_ai_generated` set correctly
- [ ] ≤5 specific hashtags; search phrase in voice, text and caption line 1
- [ ] New format → Trial Reel
- [ ] Footage is owned and grounded (real-images-only)
