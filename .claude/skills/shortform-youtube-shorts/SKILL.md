---
name: shortform-youtube-shorts
description: >-
  YouTube Shorts production and publishing rules for Synthex short-form video. Use when
  planning, scripting, editing, gating or uploading a Short for any Unite Group brand or
  client channel, when nexus-viral-run derives a youtube cut, or when Shorts views and
  engaged views diverge. Specs (3-minute Shorts), the 2025 view-count change, music claims,
  inauthentic-content and AI-disclosure policies, Data API upload and Analytics. Pairs
  with shortform-pattern-library for the measured hook, pacing, caption and audio numbers.
metadata:
  author: synthex
  version: 1.0.0
  type: platform-reference
  triggers: [youtube shorts, shorts, yt short, youtube cut, engaged views]
---

# YouTube Shorts

Last verified: 2026-10-19. Evidence: `../shortform-pattern-library/references/platform-docs-2026-10.md`.
Tags: **[P]** official page read, **[S]** secondary. Craft numbers live in **shortform-pattern-library**.

## 1. Deliverable spec

| Item | Rule |
|---|---|
| Classification | Square or vertical **and ≤3 min** = a Short (from 15 Oct 2024) [P]: https://support.google.com/youtube/answer/15424877. There is no "Short" flag in the API; aspect and length decide |
| Aspect | 9:16, 1080×1920 master |
| Upload | `videos.insert`, max 256 GB [P] |
| Thumbnail | Custom Shorts thumbnails reported rolling out from Jul 2026 [S]. Until confirmed for the channel, pick a strong frame and put the title text on it |
| Safe zone | None published [gap]. Same central-safe-area rule as TikTok/Reels; YouTube's title and channel bar sits bottom-left |

## 2. What distribution rewards

- No official Shorts ranking statement was found [gap]. The working signal is Studio's **"viewed vs
  swiped away"**, then watch time [S]: https://vidiq.com/blog/post/youtube-shorts-algorithm/
- **View counting changed on 31 Mar 2025**: a view now counts every start or replay with no minimum
  watch time; the old measure survives as **engaged views** [S]:
  https://ppc.land/youtube-changes-how-shorts-views-are-counted-from-march-31/
  Report engaged views as the quality number; raw views inflate with loops.
- Loops now add views. A Short whose last line flows into its first line (loop-back) earns replays.

## 3. Length

- Paddy Galloway's analysis (as summarised by vidIQ) found Shorts holding viewers past 50 s averaged
  far higher views [S, original not retrieved]. Brand data peaks lower.
- Working rule: 20–45 s for discovery, up to 60 s for a full tip, 60–180 s only when retention holds.

## 4. Music and copyright

From https://support.google.com/youtube/answer/13486873 [P]:
- **Shorts longer than 1 minute with an active copyright claim are blocked.**
- YouTube Audio Library tracks won't receive a Content ID claim.
- Synthex default: voice + Audio Library or Artlist-licensed bed. Never a commercial track over 60 s.

## 5. Inauthentic and reused content (monetisation)

From https://support.google.com/youtube/answer/1311392 (updated 15 Jul 2025) [P]:
- "Repetitious content" is now **"inauthentic content"**: mass-produced, templated or repetitive work,
  including AI content from generic templates that lacks the creator's perspective.
- Reused content (compilations from other platforms, unmodified re-uploads) is not allowed, even with
  permission, and can demonetise the whole channel.

Synthex consequence: templated batch output (brand-video, faceless-video) must vary the script,
footage and expert perspective per Short. A channel full of near-identical AI explainers is at risk.

## 6. AI disclosure

From https://support.google.com/youtube/answer/14328491 [P]:
- Disclose realistic altered or synthetic content: a real person saying something they didn't, a
  realistic scene that never happened, an altered real event.
- Not required: captions, colour, upscaling, script or title help, animation, your own voice clone
  for dubs.
- Set it in Studio, or via API `status.containsSyntheticMedia=true` [P]. Disclosure alone does not
  limit reach; non-disclosure risks removal.

## 7. Title, description, search

- YouTube is a search engine: the **title is the keyword** ("How to dry a wet carpet in 24 hours").
  ≤100 characters (`YOUTUBE_TITLE_MAX_CHARS` in `lib/video/social-derivation.ts:326`).
- Description: first line restates the benefit; add 3 hashtags; link to the long-form video or the
  client landing page.
- Shorts can link to a related long video. Use it to move viewers to the CARSI course or RestoreAssist
  demo video.

## 8. Upload (Data API v3)

From https://developers.google.com/youtube/v3/docs/videos/insert (updated 15 Oct 2026) [P]:
- `videos.insert` with `snippet` (title, description, tags, categoryId) and `status`
  (`privacyStatus`, `selfDeclaredMadeForKids`, `containsSyntheticMedia`).
- Quota: the page now shows `videos.insert` in its **own bucket of 100 calls/day**, and says uploads
  from unverified projects are **not** forced private. Both reverse older documented behaviour and were
  read through a summarising fetch; **re-verify on the live page before a batch** [P, re-check].
Code: `lib/video/youtube-uploader.ts`, `lib/publish/platformAdapters/youtube.ts`. Default
`privacyStatus=unlisted` for review, human flips to public.

## 9. Measure (Analytics API)

From https://developers.google.com/youtube/analytics/metrics (updated 14 Sep 2026) [P]:
`views`, **`engagedViews`**, `averageViewDuration`, `averageViewPercentage`, `estimatedMinutesWatched`,
`shares`, `subscribersGained`. Studio adds viewed-vs-swiped-away.

Scorecard: viewed % (Studio), engaged views, average view percentage (>100% = looping), subscribers
gained, related-video click-through, and the client metric moved.

## 10. Gate checklist

- [ ] ≤3 min, 9:16; loop-back ending considered
- [ ] Title = search phrase, ≤100 chars
- [ ] No claimed music on a Short over 60 s
- [ ] Script and perspective differ from the channel's last 10 Shorts (inauthentic-content rule)
- [ ] `containsSyntheticMedia` correct; footage owned and grounded (real-images-only)
- [ ] Uploaded unlisted for human review
