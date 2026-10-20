---
name: shortform-linkedin
description: >-
  LinkedIn native video production and publishing rules for Synthex. Use when planning,
  scripting, editing, gating or publishing a LinkedIn video for a founder profile or
  company page (CARSI, RestoreAssist, Unite Group, clients), when nexus-viral-run derives
  a linkedin cut, or when a B2B video under-performs. Specs, the March 2026 feed rebuild
  (penalises videos that don't match the text), captions (SRT, English only), Videos and
  Posts API, video analytics. Pairs with shortform-pattern-library for the measured hook,
  pacing, caption and audio numbers.
metadata:
  author: synthex
  version: 1.0.0
  type: platform-reference
  triggers:
    [
      linkedin video,
      linkedin post video,
      b2b video,
      company page video,
      linkedin cut,
    ]
---

# LinkedIn video

Last verified: 2026-10-19. Evidence: `../shortform-pattern-library/references/platform-docs-2026-10.md`.
Tags: **[P]** official page read, **[S]** secondary. Craft numbers live in **shortform-pattern-library**,
but LinkedIn is the platform where they transfer least. Read section 2 first.

## 1. Deliverable spec

| Item      | Rule                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aspect    | 1:2.4 to 2.4:1 accepted [P]. Ship **9:16** for the mobile vertical feed, or **4:5** when the same cut also runs in the desktop feed                         |
| Length    | Native post 3 s – 15 min [P] (https://www.linkedin.com/help/linkedin/answer/a548372); API 3 s – 30 min [P]                                                  |
| File      | MP4 via API; the Videos API page says 500 MB in one place and 5 GB in another, so keep masters under 500 MB [P, inconsistent]                               |
| Captions  | **One SRT per video, English only**, uploaded with `uploadCaptions=true` [P]. Also burn captions in: the SRT can fail processing and the video still serves |
| Thumbnail | `uploadThumbnail=true`; otherwise LinkedIn picks one [P]                                                                                                    |

## 2. What LinkedIn rewards (and what it now punishes)

From https://news.linkedin.com/2026/ImprovingTheFeed (12 Mar 2026) [P]:

- The feed is now ranked by Generative Recommender sequence models and LLMs.
- LinkedIn is reducing engagement bait, including **"videos that don't match the text"**, "comment to
  agree" prompts, and recycled or click-driven content. It acts against comment automation and pods.

Consequences for Synthex:

- **The post text and the video must make the same point.** A reel recycled from Instagram with an
  unrelated caption is exactly what the new ranker demotes. Write the LinkedIn post copy from the
  video's transcript.
- No "comment YES for the PDF" bait. Ask a real question the expert can answer in comments.
- Tone: practitioner-expert, not entertainer. "3 things insurers check on a water-damage claim" beats
  a trend sound. Trending audio, slang and meme formats do not transfer.
- Hooks: no post opening with "I" (platform-content-adaptor rule); the first line states the problem
  or the number.

## 3. Length

Brand data (Socialinsider 2026) puts LinkedIn video views and engagement at their peak at **120–180 s** [S].
LinkedIn rewards longer, denser explainers than Reels. Working rule: 60–150 s, one idea, captions on,
face of a credentialed person within the first 2 s.

## 4. Company page vs personal profile

- Company pages reportedly get a higher median video reach than personal profiles, whose median video
  reach fell year on year (single source, AuthoredUp) [S]. Treat as unproven.
- Default: post on the company page **and** have the founder or trainer re-share with their own
  comment (a real comment, not a pod).

## 5. Publishing (Videos API + Posts API)

From https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api
and https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api [P]:

1. `POST /rest/videos?action=initializeUpload` with `owner` (person or organization URN),
   `fileSizeBytes`, `uploadCaptions`, `uploadThumbnail`.
2. PUT ~4 MB parts to each `uploadInstructions` URL; keep every ETag.
3. `POST /rest/videos?action=finalizeUpload` with the ETags; upload the SRT and thumbnail.
4. `POST /rest/posts` with `content.media.id = urn:li:video:…`, `commentary` (the post text), `title`.

Headers: `Linkedin-Version: YYYYMM` and `X-Restli-Protocol-Version: 2.0.0`. **Marketing version 202511
sunsets 16 Nov 2026**: confirm the version Synthex sends is newer [P].
Scopes: `w_member_social` (profiles), `w_organization_social` (pages; ADMIN or CONTENT_ADMIN role).
Code: **gap**. `lib/publish/platformAdapters/linkedin.ts` sends only a text or article share to
`/v2/ugcPosts` and ignores video; it does not implement the Videos API flow above. Until it does,
upload video manually in LinkedIn and never release a LinkedIn video cut through the queue.
Human-gated.

## 6. Measure (Video Analytics API)

From https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/video-analytics-api [P]:
`GET /rest/videoAnalytics?q=entity&entity=urn:li:ugcPost:…&type=` one of `VIDEO_VIEW` (≥3 s, loops
count once), `VIEWER` (unique), `TIME_WATCHED`, `TIME_WATCHED_FOR_VIDEO_VIEWS` ("Watch time" in the UI).
Scope `r_organization_social`; ~6 months of data. Member-profile analytics need `r_member_postAnalytics` [S].

Scorecard: watch time per viewer ÷ duration, unique viewers, comments from target roles (insurers,
property managers, restoration owners), and the client metric moved (trial sign-ups / enrolments).

## 7. Gate checklist

Hard gates ([P] or Synthex rule; a miss blocks the cut):

- [ ] Post text written from the transcript; same single point as the video [P feed change, Mar 2026]
- [ ] No engagement bait [P]; first line is not "I" [Synthex rule, platform-content-adaptor]
- [ ] SRT uploaded (English only) [P] and captions burned in [Synthex rule]
- [ ] Aspect within 1:2.4–2.4:1 [P]; API version newer than 202511 [P]
- [ ] Footage owned and grounded (real-images-only) [Synthex rule]

Advisory ([S] or house style; warn, do not block):

- [ ] Credentialed face on screen by 2 s; practitioner tone [house style]
- [ ] 60–150 s unless the idea needs less [S brand data]
