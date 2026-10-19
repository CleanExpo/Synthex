---
name: shortform-tiktok
description: >-
  TikTok production and publishing rules for Synthex short-form video. Use when planning,
  scripting, editing, captioning, gating or publishing a TikTok for any Unite Group brand,
  when nexus-viral-run derives a tiktok cut, or when diagnosing a TikTok that stalled.
  Specs, For You signals, AIGC labelling, Commercial Music Library, Content Posting API
  (audit limits and mandatory UX) and analytics. Pairs with shortform-pattern-library for
  the measured hook, pacing, caption and audio numbers.
metadata:
  author: synthex
  version: 1.0.0
  type: platform-reference
  triggers: [tiktok, for you page, fyp, tiktok cut, content posting api]
---

# TikTok

Last verified: 2026-10-19. Evidence: `../shortform-pattern-library/references/platform-docs-2026-10.md`.
Tags: **[P]** official page read, **[S]** secondary. Craft numbers live in **shortform-pattern-library**.

## 1. Deliverable spec

| Item | Rule |
|---|---|
| Aspect | 9:16, 1080×1920 master (360–4096 px accepted) [P] |
| Length | API ≤10 min; the creator's own cap comes back as `max_video_post_duration_sec` (3, 5 or 10 min) [P] |
| Codec | MP4/H.264 recommended, 23–60 fps, ≤4 GB [P] |
| Cover | Frame pick only via `video_cover_timestamp_ms`; no custom cover in Direct Post [P]. So the chosen frame must carry the title text |
| Safe zone | TikTok publishes no pixel spec, only "keep key elements central" [P principle]. Working floor: 160 px top, 480 px bottom, 120 px each side on 1080×1920 [S] |
| Font | TikTok's native face is **TikTok Sans** (open source, SIL OFL, on Google Fonts) [P]: https://developers.tiktok.com/blog/tiktok-sans-open-source. Use it for text that should feel native |

## 2. What For You rewards

From https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you (Jun 2020, still the
latest official explainer) [P]:
- User interactions (likes, shares, follows, comments, watch-through), video information
  (captions, sounds, hashtags), and device/account settings (lower weight).
- **Finishing a longer video** gets greater weight.
- "Neither follower count nor previous high-performing videos are direct factors." A new brand
  account can break out on one video.

TikTok's own creative guidance [P] (https://ads.tiktok.com/help/article/creative-best-practices):
state the point within **3 s**, hook within **6 s**, on-screen text readable at **5–10 words/s**.

TikTok is a **sound-on** platform: 88% of users call sound essential (Kantar for TikTok, 2021) [P, dated].
Voice carries the hook; captions back it up.

## 3. Length choice

Large-sample data conflicts (see the pattern library's Contested section). Working rule:
- Reach test: 20–45 s. OpusClip's viral tier (top 10%, ≥5.1M views) had a median of 41 s [S].
- Watch-time / authority: 60–120 s is fine on TikTok if retention holds. Buffer (1.1M TikToks) found
  >60 s got 43% more reach [S]: https://buffer.com/resources/longer-tiktoks-get-more-views-data/

## 4. AIGC and originality

- TikTok requires labels on realistic AI-generated content and auto-detects via its models and
  C2PA Content Credentials [P]:
  https://newsroom.tiktok.com/tiktok-ssa-shares-more-ways-to-spot-shape-and-understand-ai-generated-content?lang=en-ZA
- API: `post_info.is_aigc=true` for generated photoreal people, scenes or voices [P].
- Unoriginal re-uploads are ineligible for For You (Community Guidelines page is JS-only and
  could not be read) [S]. Same Synthex rule as everywhere: own footage only, no foreign watermark.

## 5. Music

Business accounts may use only the **Commercial Music Library** in-app. Any third-party track needs
a commercial licence plus TikTok's Music Usage Confirmation [S]. The Direct Post UX must show
the Music Usage Confirmation consent text [P]. Default: original voice + licensed bed.

## 6. Caption and search

- Caption ≤2,200 characters via API [P]. Lead with the searchable phrase. Socialinsider (600K+ TikToks,
  2023) found captions under 10 words had a higher view rate [S].
- Say the keyword in the first spoken sentence; TikTok reads captions, sounds and on-screen text.
- 3–5 specific hashtags; no #fyp padding.

## 7. Publishing (Content Posting API)

From https://developers.tiktok.com/doc/content-posting-api-get-started and
https://developers.tiktok.com/doc/content-sharing-guidelines (updated 4 Aug 2026) [P]:
1. `POST /v2/post/publish/creator_info/query/`: privacy options, interaction flags, max duration.
2. `POST /v2/post/publish/video/init/` with `FILE_UPLOAD` (5–64 MB chunks) or `PULL_FROM_URL`
   (verified domain only). Scope `video.publish`.
3. Poll post status. Init is rate-limited to 6 requests/min per user token (HTTP 429).

Constraints that change the plan:
- **Unaudited apps: max 5 users per 24 h, private accounts, SELF_ONLY posts.** Public posting needs
  TikTok's audit. Until Synthex's client is audited, use the **inbox/draft upload** flow and let a
  human press Post in the app.
- About 15 posts/day per creator across all Direct Post clients.
- Mandatory UX: show the creator nickname; privacy dropdown with **no default**; comment/duet/stitch
  unchecked by default; commercial-content toggle ("Your brand" → Promotional content; "Branded
  content" → Paid partnership, cannot be private); preview; no app watermark.

Code: `lib/publish/platformAdapters/tiktok.ts`, `lib/oauth/providers/tiktok.ts`. Human-gated.

## 8. Measure

- Display API video object: `view_count`, `like_count`, `comment_count`, `share_count` only, no
  watch time [P]: https://developers.tiktok.com/doc/tiktok-api-v2-video-object
- Watch time, full-watch rate and reach come from the TikTok Business API or the in-app analytics
  screen [S]. Until that is connected, read them in-app and log manually; never report them as zero.

Scorecard: average watch time ÷ duration, full-watch rate, shares ÷ views, profile visits, and the
client metric moved.

## 9. Gate checklist

Hard gates ([P] or Synthex rule; a miss blocks the cut):
- [ ] Own footage, no Instagram or CapCut watermark [Synthex rule]
- [ ] CML or licensed audio with Music Usage Confirmation shown [P]; `is_aigc` correct [P]
- [ ] Cover frame chosen via `video_cover_timestamp_ms` [P]
- [ ] Publishing path matches audit status: draft/inbox until audited [P]
- [ ] Footage is owned and grounded (real-images-only) [Synthex rule]

Advisory (ads guidance, [S] or house style; warn, do not block):
- [ ] Spoken hook by 3 s, point by 6 s; on-screen text ≤10 words/s [P, but written for ads]
- [ ] Text inside the central safe area [S pixel figures]
- [ ] Caption leads with the search phrase; 3–5 specific hashtags [house style]
