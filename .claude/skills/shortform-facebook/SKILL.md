---
name: shortform-facebook
description: >-
  Facebook Reels production and publishing rules for Synthex short-form video. Use when
  planning, scripting, editing, gating or publishing a Facebook Reel for any Unite Group
  brand or client Page, when nexus-viral-run derives a facebook cut, or when a Page's
  reach drops. Specs, the July 2025 unoriginal-content penalties, AI labels, Reels
  Publishing API and Page video insights. Pairs with shortform-pattern-library for the
  measured hook, pacing, caption and audio numbers.
metadata:
  author: synthex
  version: 1.0.0
  type: platform-reference
  triggers: [facebook reel, fb reel, facebook video, page reel, facebook cut]
---

# Facebook Reels

Last verified: 2026-10-19. Evidence: `../shortform-pattern-library/references/platform-docs-2026-10.md`.
Tags: **[P]** official page read, **[S]** secondary. Craft numbers live in **shortform-pattern-library**.

## 1. Deliverable spec

From https://developers.facebook.com/docs/video-api/guides/reels-publishing [P]:

| Item | Rule |
|---|---|
| Aspect | 9:16; 1080×1920 recommended, 540×960 minimum |
| Length | **3–90 s via the API** (60 s max if also published as a Page story). Longer Reels must be posted in-app |
| Codec | H.264/H.265 (VP9, AV1 accepted), 24–60 fps fixed, closed GOP 2–5 s |
| Audio | AAC-LC stereo 48 kHz ≥128 kbps |
| Safe zone | No official pixel spec [gap]. Use the Instagram floor (bottom ~35%, right ~12% clear) and preview |

## 2. Audience and length

- Facebook skews older than TikTok: over half of users are 25–44 [S]. That suits homeowners, property
  managers and insurance-adjacent buyers (RestoreAssist, Disaster Recovery).
- Brand data (Socialinsider 2026) shows Facebook Reel engagement **rising with length** up to 120–180 s,
  unlike Instagram's 45–60 s peak [S]. Because the API caps at 90 s, publish **60–90 s explainer
  cuts** here and keep the 20–45 s reach cut for Instagram and TikTok.
- Captions matter more here: older sound-off data (85% muted, circa 2016) is dated [S], but every
  Facebook cut ships with burned-in captions regardless.

## 3. Unoriginal-content penalties (hard rule)

From https://creators.facebook.com/blog/combating-unoriginal-content (14 Jul 2025) [P]:
- Accounts that repeatedly reuse others' content lose monetisation for a period and get **reduced
  distribution on everything they share**.
- Duplicate videos get reduced distribution. "Stitching together clips or adding your watermark does
  not qualify as meaningful enhancement."
- Avoid visible third-party watermarks. Captions perform best with **no links, minimal capitals and no
  more than five hashtags**.
- Risk status shows on the Page's Support home screen. Check it monthly for every Page Synthex runs.

## 4. AI disclosure

Same Meta policy as Instagram ("AI info"; label photoreal generated video or realistic audio) [P]:
https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/
API field `is_ai_generated` [P].

## 5. Caption

- No links in the caption (they suppress reach per Meta's own guidance above). Put the link in the first
  comment or the Page CTA button.
- Sentence case, ≤5 hashtags, search phrase in the first line.
- Name the place for local businesses ("Brisbane flood clean-up"), since Facebook audiences are local.

## 6. Publishing (Reels Publishing API)

From https://developers.facebook.com/docs/video-api/guides/reels-publishing [P]:
1. `POST /{page-id}/video_reels?upload_phase=start` → `video_id`.
2. Upload to `rupload.facebook.com/video-upload/{video-id}` (binary with `offset`/`file_size`, or a
   `file_url` header; fbcdn URLs are rejected).
3. `GET /{video-id}?fields=status` until processed.
4. `POST /{page-id}/video_reels?upload_phase=finish&video_state=PUBLISHED|DRAFT|SCHEDULED` with
   `description`, optional `scheduled_publish_time` (10 min – 29 days ahead), `is_ai_generated`.

Limits: **30 API reels per Page per rolling 24 h**; Pages only, not profiles. Permissions:
`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, Page token with CREATE_CONTENT.
Code: `lib/publish/platformAdapters/facebook.ts`; publish gate `APPROVED_TO_PUBLISH_META_ADS` in
`docs/marketing-agency/FACEBOOK-VIDEO-CREATOR-SPEC.md`. Human-gated.

## 7. Measure (Video Insights)

From https://developers.facebook.com/docs/graph-api/reference/video/video_insights/ [P]:
`blue_reels_play_count` (excludes replays), `fb_reels_total_plays`, `fb_reels_replay_count`,
`post_impressions_unique` (reach), `post_video_avg_time_watched` (ms), `post_video_view_time`,
**`post_video_retention_graph`**, `post_video_followers`, `post_video_social_actions`.
Permissions: `pages_manage_engagement`, `read_insights`.

Scorecard: retention graph shape (3 s drop, then plateau), average time ÷ duration, shares ÷ reach,
and the client metric moved (UTM on the first-comment link).

## 8. Gate checklist

Hard gates ([P] or Synthex rule; a miss blocks the cut):
- [ ] 9:16, 3–90 s if API-published [P]
- [ ] Clean master, no foreign watermark, no border [P unoriginal-content post]
- [ ] Caption: no link, ≤5 hashtags, minimal capitals [P unoriginal-content post]
- [ ] `is_ai_generated` correct [P]; footage owned and grounded (real-images-only) [Synthex rule]
- [ ] Page risk status checked this month [Synthex rule]

Advisory ([S]; warn, do not block):
- [ ] Burned-in captions, sound-off legible [S, dated sound-off data]
- [ ] Local place name in the caption where relevant [house style]
