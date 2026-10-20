# Short-form video platform documentation: primary-source findings

Researched 19 October 2026 using WebSearch and WebFetch. Each fact names its URL and, where the page shows one, its last-updated date ("no date shown" means the page has none).

**Evidence labels**
- **[P]**: read directly on a primary/official page during this session. WebFetch returns a summary of each page written by a small model, not the raw page, so quote-level wording can drift. Re-open the URL before encoding any surprising [P] fact as a hard rule.
- **[S]**: secondary or unconfirmed. Comes from press, blogs or vendor guides, or from a search-engine summary of an official page that was not fetched. Do not encode an [S] fact into a skill as a rule without re-checking it.
- Some search results were summarised by the search tool rather than fetched, so those are marked [S] even when the underlying URL is official.

---

## Instagram (Reels)

### Technical specs: API upload (Content Publishing)

Source: [IG User Media reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media). No last-updated date shown; it uses API v26.0, and its latest dated changelog note is 9 Jul 2025. [P]

| Property | Spec |
|---|---|
| Container | MOV or MP4 (MPEG-4 Part 14), no edit lists, moov atom at front |
| Video codec | HEVC or H.264, progressive scan, closed GOP, 4:2:0 chroma |
| Audio | AAC, 48 kHz max, mono/stereo, 128 kbps |
| Frame rate | 23–60 fps |
| Resolution | max 1920 px horizontal |
| Aspect ratio | 0.01:1 to 10:1 accepted; **9:16 recommended** to avoid crop/blank space |
| Bitrate | VBR, 25 Mbps max |
| Duration | **3 s min, 15 min max** (API) |
| File size | 300 MB max |
| Cover (`cover_url`) | JPEG, ≤8 MB, sRGB; 9:16 recommended (centre 9:16 used, centre 1:1 used for feed); `cover_url` overrides `thumb_offset` |
| `thumb_offset` | ms offset of cover frame; default 0 |

- **In-app length:** Adam Mosseri announced on 20 Jan 2025 that Reels can run up to 3 minutes (previously 90 s), and that the profile grid would move to taller rectangles. [S] ([Business Today](https://www.businesstoday.in/technology/news/story/instagram-head-announces-big-changes-3-minute-reels-and-new-look-for-profile-grid-461527-2025-01-21)). Blogs claim 20-minute Reels since late 2025 ([Inro](https://www.inro.social/blog/instagram-reels-can-now-be-20-minutes-long-new-time-limit-explained-2025)). That is [S] and not corroborated. The API limit of 15 min is the only confirmed number.
- **Safe zones:** Meta's own safe-zone page was not retrieved. Third-party figures for 1080×1920 (about 14% top, 35% bottom, 6% sides) conflict with other figures (13%/23.4%; 250 px top / 280 px bottom). [S] ([adsuploader](https://adsuploader.com/blog/meta-ads-safe-zones), [Billo, which claims Stories and Reels safe zones were unified in Mar 2026](https://billo.app/blog/meta-ads-safe-zones)).
- **Captions/subtitles:** the publishing API has no caption-file field. Captions are in-app (auto-captions) or burned in. No primary source was found for API caption upload.

### Ranking and recommendation signals
- **Official ranking explainer** ([about.instagram.com, "Instagram Ranking Explained"](https://about.instagram.com/blog/announcements/instagram-ranking-explained), dated 31 May 2023) [P]. Reels signals, roughly in order of importance:
  1. Your activity (reels you liked, saved, reshared, commented on)
  2. Your history with the poster
  3. Information about the reel (audio, visuals, popularity)
  4. Information about the poster

  The same page says Instagram makes reels **less visible** if they are low-resolution or watermarked, muted or bordered, mostly text, or already posted on Instagram. Content that breaks the Recommendation Guidelines stays up but is not recommended.
- **2025 signal guidance from Mosseri:** the top three signals are **watch time, likes and sends**. Creators should track **average watch time, likes per reach, and sends per reach**. Likes count slightly more for followers ("connected" content), sends slightly more for non-followers ("unconnected"). [S] ([Social Media Today](https://www.socialmediatoday.com/news/instagram-shares-algorithm-2025/738034/)). The original Mosseri video was not retrieved. The widely repeated claim that sends are weighted "3–5x likes" is unconfirmed.
- **Trial Reels**, from [creators.instagram.com](https://creators.instagram.com/blog/instagram-trial-reels), 10 Dec 2024 [P]:
  - "Trial reels will be shown to non-followers first." They are not shown in followers' Feed or Reels tab.
  - A trial can be shared to everyone with one tap, or auto-shared if it performs well on views "within the first 72 hours".
  - Insights (views, likes, comments, shares, plus a comparison with previous trials) are available about 24 h after sharing.
  - The page says "eligible creators" and does not state account-type requirements.
  - Through the API this is `trial_params.graduation_strategy` = `MANUAL` or `SS_PERFORMANCE` [P] (Media reference above).
- **Meta system cards:** 22 AI system cards exist on the Transparency Center ([about.fb.com, Jun 2023](https://about.fb.com/news/2023/06/how-ai-ranks-content-on-facebook-and-instagram/)). The guessed URL for the IG Reels card (`transparency.meta.com/features/explaining-ranking/ig-reels/`) returned **404**, so its content is **not verified**.

### Originality, AI labels and music
- **Originality**, from [creators.instagram.com "Rewarding original creators"](https://creators.instagram.com/blog/rewarding-original-creators-on-instagram), dated 30 Apr 2026 [P]:
  - Reel protections have existed since 2024. As of 30 Apr 2026 they extend to **photos and carousels**.
  - Accounts that mainly post unoriginal content are **ineligible for recommendations**. Followers still see them.
  - Adding only a **border, watermark, subtitles or caption credit does not make content original**.
  - Eligibility returns when most posts in a rolling **30-day** window are original. Creators can appeal via Account Status.
  - 75% of US recommendations now come from original posts.
  - The "10+ reposts in 30 days" threshold seen in press coverage is [S] ([TechCrunch](https://techcrunch.com/2026/04/30/instagram-restricts-reach-of-content-aggregators-in-new-crackdown/)).
- **AI labels**, from [about.fb.com "Our approach to labeling AI-generated content"](https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/), first published 5 Apr 2024, updated 23 Oct 2025 [P]:
  - The label is **"AI info"** (renamed from "Made with AI" on 1 Jul 2024).
  - Since 12 Sep 2024, AI-*edited* content shows the label in the post menu, while AI-*generated* content shows it visibly.
  - Labels are triggered by industry signals (C2PA/IPTC) or by self-disclosure.
- **Meta Help Center** ([meta.com/help/artificial-intelligence/1783222608822690](https://www.meta.com/en-gb/help/artificial-intelligence/1783222608822690/), no date shown) [P]: Meta "may require an AI label" for **photorealistic video or realistic-sounding audio** that was digitally created or altered. "There may be penalties" if a required label is missing. Profiles can carry an "AI creator" label.
- **API flag:** `is_ai_generated` is listed as a supported disclosure in [Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing) [P].
- **Music for business accounts:** business accounts are reportedly limited to the **Meta Sound Collection** (royalty-free, cleared for commercial use), and Reels ads cannot use licensed library music. [S] ([foximusic guide](https://www.foximusic.com/blog/instagram-reels-music-copyright-legal-guide/)). No Meta help page was retrieved. Through the API, `audio_name` renames original audio once only [P].

### Publishing API
From [Content Publishing guide](https://developers.facebook.com/docs/instagram-platform/content-publishing) (no date shown; latest dated note 24 Mar 2025) and the Media reference [P].
- **Flow:**
  1. `POST /<IG_ID>/media` with `media_type=REELS` plus `video_url`, or `upload_type=resumable` followed by `POST https://rupload.facebook.com/ig-api-upload/<ver>/<container_id>` (resumable only with Facebook Login for Business).
  2. Poll `GET /<container>?fields=status_code` until `FINISHED` (once a minute, for no more than 5 minutes).
  3. `POST /<IG_ID>/media_publish?creation_id=`.
  - A published reel returns `media_type=VIDEO`; check `media_product_type` to tell it is a reel.
- **Options:** `share_to_feed`, `collaborators` (max 3), `trial_params`, `cover_url`, `thumb_offset`, `audio_name`, `is_ai_generated`. Containers expire after 24 h.
- **Limits:** **100 API-published posts per rolling 24 h** (the carousel section on the same page says 50, and the page does not reconcile the two). Check usage with `GET /<IG_ID>/content_publishing_limit`. Separately, **400 containers per 24 h**.
- **Permissions:**
  - Instagram Login: `instagram_business_basic` and `instagram_business_content_publish`.
  - Facebook Login: `instagram_basic`, `instagram_content_publish` and `pages_read_engagement`, plus `ads_management`/`ads_read` if the role comes via Business Manager.
  - Both need Advanced or Standard Access, and Pages that require Page Publishing Authorization must complete it first.

### Insights API
From [Instagram Media Insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights) (no date shown) [P]. REELS metrics:
- `views` (in development)
- `reach`
- `likes`, `comments`, `saved`, `shares`, `reposts`
- `total_interactions`
- `ig_reels_avg_watch_time`
- `ig_reels_video_view_total_time` (includes replays; in development)
- `reels_skip_rate`: share of initial views where viewers skipped within the first 3 s (estimated; in development)
- `crossposted_views`, `facebook_views`
- `total_views`, `total_likes`, `total_comments`: all surfaces including promoted media; Facebook Login only
- `impressions`: deprecated for media created after 2 Jul 2024

**Views migration** ([Graph API v22.0 changelog](https://developers.facebook.com/docs/graph-api/changelog/version22.0), 21 Jan 2025) [S, search summary of an official page]:
- `views` was introduced.
- `plays`, `clips_replays_count`, `ig_reels_aggregated_all_plays_count` and `impressions` were deprecated on v22+ and for all versions from **21 Apr 2025**.
- `video_views` is listed as deprecated, with removal dates that are [S].

---

## Facebook (Reels)

### Technical specs: Reels Publishing API
Source: [Reels Publishing guide](https://developers.facebook.com/docs/video-api/guides/reels-publishing) (no date shown; uses v26.0) [P].

| Property | Spec |
|---|---|
| File | .mp4 recommended |
| Aspect ratio | 9:16 |
| Resolution | 1080×1920 recommended; 540×960 min |
| Frame rate | 24–60 fps, fixed, progressive |
| Duration | **3–90 s** via API (60 s max if published as a Page story) |
| Video codec | H.264/H.265 (VP9, AV1 supported), 4:2:0, closed GOP 2–5 s |
| Audio | AAC-LC stereo 48 kHz ≥128 kbps |
| File size | not stated |

- **Safe zones:** no primary source found (see the Instagram note above) [S].

### Ranking and originality
- **Unoriginal content**, from [creators.facebook.com "Combating unoriginal content"](https://creators.facebook.com/blog/combating-unoriginal-content), dated 14 Jul 2025 [P]:
  - Accounts that repeatedly reuse others' content **lose monetisation for a period** and get **reduced distribution on everything they share**.
  - Duplicate videos get reduced distribution, and Meta is testing links from duplicates to the original.
  - "Simply stitching together clips or adding your watermark does not qualify as meaningful enhancement."
  - Creators should avoid visible third-party watermarks. Captions perform best with no links, minimal capital letters and **no more than five hashtags**. Very short, low-value videos should be avoided.
  - Risk status is shown on the Support home screen.
- **AI labels:** the same Meta policy and API `is_ai_generated` field as Instagram apply [P].
- **Facebook Reels system card:** not retrieved [gap].

### Publishing API
Same guide as above [P].
- **Flow:**
  1. `POST /{page-id}/video_reels?upload_phase=start`.
  2. `POST rupload.facebook.com/video-upload/{video-id}` (OAuth header, `offset` and `file_size`, or a `file_url` header; fbcdn URLs are rejected).
  3. `GET /{video-id}?fields=status`.
  4. `POST /{page-id}/video_reels?upload_phase=finish&video_state=PUBLISHED|DRAFT|SCHEDULED`.
- **Options:** `description`, `title`, `scheduled_publish_time` (more than 10 min ahead and within 29 days), `place`, `is_ai_generated`, collaborators (10 invites per Page per 24 h).
- **Limit:** **30 API-published reels per Page per rolling 24 h**. Reels can be published to Pages only.
- **Permissions:** `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, and a Page token from a user with the CREATE_CONTENT task.

### Insights API
Source: [Video Insights reference](https://developers.facebook.com/docs/graph-api/reference/video/video_insights/) (no date shown; v26.0) [P]. Reels metrics (lifetime):
- `blue_reels_play_count`: plays with at least 1 ms of playback, excluding replays
- `fb_reels_total_plays`: includes replays
- `fb_reels_replay_count`
- `post_impressions_unique`: reach
- `post_video_avg_time_watched` (ms; can exceed the reel's length)
- `post_video_view_time` (total ms)
- `post_video_retention_graph`
- `post_video_followers`
- `post_video_likes_by_reaction_type`
- `post_video_social_actions` (comments and shares)

Permissions: `pages_manage_engagement` and `read_insights`, plus the ANALYZE task.

---

## TikTok

### Technical specs: Content Posting API
Source: [Media Transfer Guide](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide), last updated 4 Aug 2026 [P].

| Property | Spec |
|---|---|
| Formats | MP4 (recommended), WebM, MOV |
| Codecs | H.264 (recommended), H.265, VP8, VP9 |
| Frame rate | 23–60 fps |
| Resolution | 360–4096 px for both height and width |
| Duration | up to 10 min via API. The creator's actual cap is returned as `max_video_post_duration_sec` (accounts may be limited to 3, 5 or 10 min) |
| File size | ≤4 GB |
| Chunking | under 5 MB: one chunk. Over 64 MB: multiple chunks. Chunks are 5–64 MB, the final one up to 128 MB, 1–1000 chunks, uploaded in order |
| Photos | WebP/JPEG, ≤1080p, ≤20 MB |
| Cover | `video_cover_timestamp_ms` (frame pick). There is no custom-image cover in Direct Post |

- **In-app limits:** 60-minute uploads and 10-minute in-app recording are reported, as are mobile file-size caps. [S] ([Goldcast](https://goldcast.io/blog-post/tiktok-video-upload-sizes)).
- **Safe zones:** TikTok publishes no fixed pixel figure. Third-party figures conflict (for example about 254 px top / 707 px bottom / 242 px right, or "keep top 150 px and bottom 350–400 px clear"). [S] ([Relevant Audience](https://www.relevantaudience.com/tiktok-ads/tiktok-video-size-ad-specs/)).

### Ranking and recommendation signals
- From the [TikTok Newsroom "How TikTok recommends videos #ForYou"](https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you), dated 18 Jun 2020 (the most recent official explainer retrieved) [P]:
  - Factors are **user interactions** (likes, shares, follows, comments, content created), **video information** (captions, sounds, hashtags) and **device/account settings** (lower weight).
  - "Whether a user finishes watching a longer video from beginning to end" gets greater weight.
  - "Neither follower count nor whether the account has had previous high-performing videos are direct factors."
  - Spam, content under review and some regulated content are not recommended.
- **FYF eligibility standards** exist in the [Community Guidelines](https://www.tiktok.com/community-guidelines/en/fyf-standards), but the page is JavaScript-rendered and **could not be read**. The unoriginal/reupload ineligibility details are [S/gap].

### Originality, AI labels and music
- **AIGC**, from the [TikTok Newsroom](https://newsroom.tiktok.com/tiktok-ssa-shares-more-ways-to-spot-shape-and-understand-ai-generated-content?lang=en-ZA), dated 10 Mar 2026 (press dates the original to Nov 2025) [P]:
  - "We require people to label realistic AI-generated content."
  - Detection uses TikTok's own models plus **C2PA Content Credentials**, and more than 1.3 billion videos have been labelled.
  - TikTok is **testing invisible watermarks** on content made with TikTok AI tools and on C2PA uploads.
  - TikTok is **testing an AIGC slider** in Manage Topics so users can choose how much AI content they see.
- **C2PA auto-labelling** was announced 9 May 2024 ([newsroom](https://newsroom.tiktok.com/partnering-with-our-industry-to-advance-ai-transparency-and-literacy?lang=en)) [S, search summary].
- **API flags:** Direct Post `post_info.is_aigc` (bool; labels the video as AI-generated) [P] ([Direct Post reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post), updated 24 Aug 2026). The Display API video object also returns `is_aigc` [P].
- **Commercial music:** business accounts are limited in-app to the **Commercial Music Library** (CML). Third-party music needs a commercial licence plus TikTok's **Music Usage Confirmation**. Library size figures conflict (600k / 1M / 1.5M). [S] ([Soundstripe](https://www.soundstripe.com/blogs/tiktok-music-licensing-rules)). Music Usage Confirmation consent text is **required** in Direct Post UX [P] (guidelines below).

### Publishing API (Content Posting API)
- **Direct Post**, from [Get Started: Direct Post](https://developers.tiktok.com/doc/content-posting-api-get-started), updated 4 Aug 2026 [P]:
  - Scope `video.publish`.
  - Call `POST /v2/post/publish/creator_info/query/` first. It returns privacy options, interaction flags and `max_video_post_duration_sec`.
  - Then `POST /v2/post/publish/video/init/` with `FILE_UPLOAD` (PUT chunks) or `PULL_FROM_URL` (verified domain/prefix only).
  - Poll the Get Post Status endpoint.
- **Upload to inbox/draft** is a separate flow (`/v2/post/publish/inbox/video/init/`). Its scope is reportedly `video.upload` [S; that page was not fetched].
- **Rate limit:** 6 requests per minute per user token on init; HTTP 429 when exceeded [P] (Direct Post reference).
- **Audit**, from the [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines), updated 4 Aug 2026 [P]:
  - Unaudited clients are limited to **5 users per 24 h**, accounts must be **private** and posts **SELF_ONLY**. An audit is required to post publicly.
  - The per-creator posting cap is **about 15 posts/day, shared across all Direct Post clients**, and there is a per-client daily active-creator cap.
- **Mandatory UX** [P]:
  - Show the creator nickname.
  - Privacy dropdown with **no default**; comment, duet and stitch boxes unchecked by default.
  - Commercial content toggle: "Your brand" leads to the "Promotional content" label, "Branded content" to "Paid partnership". Branded content cannot be private.
  - Consent text for the Music Usage Confirmation and the Branded Content Policy.
  - Show a preview and add no app watermarks.
- **Caption:** `title` up to 2200 UTF-16 runes [P].

### Insights / analytics
- **Display API video object**, from [video object](https://developers.tiktok.com/doc/tiktok-api-v2-video-object), updated 24 Aug 2026 [P]: `view_count`, `like_count`, `comment_count`, `share_count`, `duration`, `height`/`width`, `cover_image_url` (expires after 6 h), `is_aigc`. There is **no watch-time or reach** in the Display API.
- **TikTok Business API** (organic business accounts): `average_time_watched`, `total_time_watched`, `full_video_watched_rate`, `reach`, `video_views`. Data is reportedly lifetime-aggregated only. [S] ([Adverity](https://docs.adverity.com/reference/connectors/connector-tiktok-business.html), [Saras](https://help.sarasanalytics.com/tiktok-business/schema-information)). The official business-api.tiktok.com page was not retrieved.

---

## YouTube Shorts

### Technical specs
- From [Understand three-minute YouTube Shorts](https://support.google.com/youtube/answer/15424877) (no date shown; ©2026) [P]:
  - Videos that are **square or vertical and up to 3 minutes** are classified as Shorts. This applies to standard channels from 15 Oct 2024 and to Official Artist Channels from 8 Dec 2025.
  - Use 16:9 to keep a video out of Shorts.
- **Recommended resolution** (1080×1920; some sources say 2160×3840), **file size** and **safe zones**: no primary page retrieved [S].
- **Custom Shorts thumbnails:** reported rolling out from 25 Jul 2026, YPP channels first, desktop only, no A/B testing [S] ([PPC Land](https://ppc.land/youtube-ends-2-year-wait-for-shorts-thumbnails-but-blocks-a-b-testing/)).
- **Captions:** standard YouTube captions apply (`captions.insert` in the Data API). Not separately verified for Shorts [gap].

### Ranking, view counting and policies
- **View definition change, 31 Mar 2025:** a Shorts view now counts each time a Short **starts or replays, with no minimum watch time**. The old measure survives as **"engaged views"** in Advanced Mode. API alignment reportedly came 30 Apr 2025. [S] ([PPC Land](https://ppc.land/youtube-changes-how-shorts-views-are-counted-from-march-31/), [Brandwatch](https://social-media-management-help.brandwatch.com/en/articles/12767954-youtube-changes-to-views-counts-on-shorts)). The YouTube Community thread was not readable.
- **Ranking:** the "viewed vs swiped away" Studio metric is the publicly discussed Shorts signal [S] ([vidIQ](https://vidiq.com/blog/post/youtube-shorts-algorithm/)). No primary blog.youtube Shorts-ranking statement was retrieved [gap].
- **Music on Shorts longer than 1 minute**, from [Music eligibility for YouTube Shorts](https://support.google.com/youtube/answer/13486873) (no date shown) [P]:
  - "Shorts longer than one minute that have an active copyright claim, regardless of the policy, will be blocked on YouTube."
  - Depending on the song, YouTube tools allow up to 90 s of music in a 3-minute Short.
  - Audio Library royalty-free music "won't receive a Content ID claim".
  - The fetch summary also said part of the page applies to music partners with a Shorts agreement. Re-read the page to see exactly which part.
  - The 60 s and 30 s per-track caps and the "no channel penalty" wording come from a search summary of 15424877 [S].
- **YPP "inauthentic content"**, from [YouTube channel monetization policies](https://support.google.com/youtube/answer/1311392) (latest dated update 15 Jul 2025) [P]:
  - "Repetitious content" was renamed **"inauthentic content"**: mass-produced, templated or repetitive work, including AI content from generic templates that lacks the creator's perspective.
  - **Reused content:** compilations of short videos taken from other social sites, unmodified re-uploads, and songs altered only in pitch or speed are not allowed. This can demonetise the whole channel and applies even with the original creator's permission.
- **AI disclosure**, from [Disclosing use of GenAI content](https://support.google.com/youtube/answer/14328491) (no date shown) [P]:
  - Disclose realistic altered or synthetic content: a real person saying or doing something they didn't, altered real events or places, realistic scenes that never happened, and AI music that is the main focus.
  - Not required: unrealistic or animated content, beauty filters, captions, upscaling, your own voice clone for dubs, and script/title/thumbnail help.
  - The disclosure is the "AI use" attribute in Studio. YouTube may auto-label via its own tools, **C2PA metadata** or detection.
  - Disclosure alone "won't limit a video's audience or impact its eligibility to earn money".
  - Persistent non-disclosure risks removal or YPP suspension.

### Publishing API (Data API v3)
- **`videos.insert`**, from [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert), last updated 15 Oct 2026 [P]:
  - Scopes: `youtube.upload`, `youtube`, `youtubepartner` or `youtube.force-ssl`.
  - Max file **256 GB**; MIME types `video/*` and `application/octet-stream`.
  - Settable fields include `status.containsSyntheticMedia` and `status.selfDeclaredMadeForKids`.
  - The page currently says: "Videos uploaded from unverified API projects are **not** restricted to private viewing mode." This reverses the long-standing rule that they were locked to private. Treat it as a recent change and re-verify before relying on it.
  - There is **no Shorts flag**. Shorts classification follows aspect ratio and duration (see above).
- **Quota**, from [Quota costs](https://developers.google.com/youtube/v3/determine_quota_cost), updated 15 Oct 2026 [P]:
  - Default 10,000 units/day for all methods except `search.list` and `videos.insert`.
  - `videos.insert` and `search.list` each have their **own cap of 100 calls/day** at 1 unit per call.
  - This differs from the historical 1,600 units per insert. Both this quota model and the "not restricted to private" statement reverse long-standing documented behaviour and came from machine-summarised fetches. **Re-open both pages and verify before relying on either.**

### Analytics API
From [Analytics metrics](https://developers.google.com/youtube/analytics/metrics), updated 14 Sep 2026 [P]:
- `views`
- `engagedViews`: views "past the first frame, or the user clicks/taps to play"
- `averageViewDuration` and `averageViewPercentage`: both exclude looping-clips traffic since 13 Dec 2021
- `estimatedMinutesWatched`
- `shares`
- `subscribersGained`

A Shorts filter dimension (`creatorContentType`) is reported but not confirmed on the fetched page [gap].

---

## LinkedIn

### Technical specs
- **Native posts**, from [LinkedIn Help a548372](https://www.linkedin.com/help/linkedin/answer/a548372), "last updated 2 years ago" [P]:

| Property | Spec |
|---|---|
| Formats | MP4, MOV, AVI, WEBM, MKV, WMV and others (ProRes may upload but won't process) |
| File size | 75 KB – 5 GB |
| Duration | 3 s (desktop) / 2 s (mobile) – **15 min** |
| Aspect ratio | 1:2.4 to 2.4:1 |
| Resolution | 256×144 – 4096×2304 |
| Frame rate | 10–60 fps |
| Bitrate | 192 kbps – 30 Mbps |

- **Videos API**, from [Videos API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api), ms.date 12 Feb 2026, updated_at 2 Mar 2026, default version li-lms-2026-10 [P]:
  - 3 s – 30 min, 75 KB – 500 MB, MP4 (for non-CTV video).
  - The `initializeUpload` field description says the maximum is 5 GB, so the page is internally inconsistent.
- **Vertical ads:** 9:16 at 720×1280 recommended (360×640 min, 1080×1920 max) [S, search summary of [LinkedIn video ads specs](https://www.linkedin.com/help/linkedin/answer/85306)].
- **Captions:** one SRT file per video, **English only**, via `uploadCaptions=true`. A feed video still serves if caption processing fails [P].
- **Thumbnail:** `uploadThumbnail=true`; otherwise a system thumbnail is generated [P].
- **Safe zones:** none published [gap].

### Ranking and feed changes
- **12 Mar 2026**, from the [LinkedIn Newsroom "Improving the Feed"](https://news.linkedin.com/2026/ImprovingTheFeed) [P]:
  - Feed ranking now uses **Generative Recommender** sequence models plus LLMs.
  - LinkedIn is reducing engagement bait, including **"videos that don't match the text"**, "comment to agree" prompts, and recycled or click-driven content.
  - It is acting against comment automation and engagement pods.
- **Engineering detail** (LLM dual-encoder retrieval, a GR ranker over 1,000+ interactions) comes from a LinkedIn Engineering post by H. Danchev dated 12 Mar 2026 [S, via [PPC Land](https://ppc.land/linkedin-rebuilds-its-feed-from-scratch-with-llms-and-gpu-powered-ranking/)]. The original post was not fetched.
- **Vertical video feed:** reported live on mobile with web in test, and video viewership +36% YoY as of Feb 2025 [S] ([TechCrunch](https://techcrunch.com/2025/02/04/linkedin-amps-up-vertical-video-tools-as-uploads-jump-36)).
- No LinkedIn AI-label policy for video was found [gap].

### Publishing API
- **Upload flow**, from the Videos API page [P]:
  1. `POST /rest/videos?action=initializeUpload` with owner (person or organization URN), `fileSizeBytes`, `uploadCaptions` and `uploadThumbnail`.
  2. PUT about **4 MB parts** to the `uploadInstructions` URLs and keep each part's ETag.
  3. `POST /rest/videos?action=finalizeUpload` with the ETags.
  4. Create the post with `POST /rest/posts`, using `content.media.id = urn:li:video:…` and `title` ([Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), ms.date 7 May 2026) [P].
  - Required headers: `Linkedin-Version: YYYYMM` and `X-Restli-Protocol-Version: 2.0.0`.
  - Upload URLs expire after about 30 days.
- **Permissions:**
  - `w_member_social` (members).
  - `w_organization_social` (organizations; ADMIN, DSC poster or CONTENT_ADMIN role).
  - `r_member_social` is restricted to approved partners.
- **Version sunset:** Marketing version 202511 sunsets **16 Nov 2026** [P].
- **Rate limits:** not stated on these pages beyond HTTP 429 [gap]. They are app/member-specific and visible in the Developer Portal.

### Analytics API
- **Organizations**, from [Video Analytics API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/video-analytics-api), ms.date 15 Jul 2025, updated 16 Oct 2025 [P]:
  - `GET /rest/videoAnalytics?q=entity&entity=urn:li:ugcPost:…&type=` one of:
    - `VIDEO_VIEW`: play-pause cycles of at least 3 s; auto-loops count once
    - `VIEWER`: unique engaged viewers
    - `TIME_WATCHED` (ms; includes loops)
    - `TIME_WATCHED_FOR_VIDEO_VIEWS`: equals "Watch Time" in the UI
  - Aggregation DAY, WEEK or ALL. Data is available for about 6 months.
  - Permission `r_organization_social`.
  - Likes and comments come from the Social Actions API.
- **Members:** Member Post Analytics APIs launched Jul 2025, with scope `r_member_postAnalytics` and endpoints `memberCreatorPostAnalytics` and `memberCreatorVideoAnalytics` (`VIDEO_PLAY`, `VIDEO_VIEWER`, `VIDEO_WATCH_TIME`). [S] ([Social Media Today](https://www.socialmediatoday.com/news/linkedin-provides-analytics-data-members-third-party-platforms/752638/), [withone.ai mirror](https://withone.ai/knowledge/linked-in/conn_mod_def%3A%3AGJ4wYdenOEo%3A%3AR9im6oE3RZ2wLF01hR3zOg)). The official Microsoft Learn page was not retrieved.

---

## Changes 2025–2026 (dated)

| Date | Platform | Change | Evidence |
|---|---|---|---|
| 20 Jan 2025 | Instagram | Reels up to 3 min; taller profile grid | [S] |
| Jan 2025 | Instagram | Mosseri names watch time, likes per reach and sends per reach as top signals | [S] |
| 21 Jan / 21 Apr 2025 | Instagram API | `views` introduced; `plays`, `clips_replays_count`, `ig_reels_aggregated_all_plays_count` and `impressions` deprecated (all versions from 21 Apr 2025) | [S, official changelog via search] |
| Feb 2025 | LinkedIn | Vertical video feed expansion; video views +36% | [S] |
| 31 Mar 2025 | YouTube | Shorts views count every start/replay; "engaged views" kept | [S] |
| 14 Jul 2025 | Facebook | Unoriginal-content penalties: demonetisation and reduced distribution; duplicate detection | [P] |
| 15 Jul 2025 | YouTube | YPP "repetitious" renamed "inauthentic content" | [P] |
| Jul 2025 | LinkedIn | Member Post Analytics APIs | [S] |
| 23 Oct 2025 | Meta | AI labelling post updated | [P] (date only) |
| Nov 2025 / 10 Mar 2026 | TikTok | AIGC slider test; invisible watermarking; 1.3B+ videos labelled | [P] |
| Late 2025 | Instagram | Reported 20-min Reels | [S, uncorroborated] |
| 8 Dec 2025 | YouTube | 3-min Shorts extended to Official Artist Channels | [P] |
| 12 Mar 2026 | LinkedIn | LLM/Generative Recommender feed; penalises "videos that don't match the text" | [P] |
| Mar 2026 | Meta ads | Stories/Reels safe zones reportedly unified | [S] |
| 30 Apr 2026 | Instagram | Originality rules extended to photos and carousels; 30-day rolling eligibility | [P] |
| 25 Jul 2026 | YouTube | Custom Shorts thumbnails rollout | [S] |
| Aug 2026 | TikTok | Content Posting API docs updated (posting cap ~15/day/creator; unaudited 5 users/24 h) | [P] |
| 15 Oct 2026 | YouTube API | `videos.insert` has its own 100 calls/day bucket; unverified-project uploads "not restricted to private" | [P, summarised; reverses earlier policy, re-verify] |
| 16 Nov 2026 | LinkedIn API | Marketing version 202511 sunset | [P] |

## Gaps / could not verify
1. **Safe zones (all five platforms):** no primary pixel spec was retrieved. Meta and TikTok pages were not found or not rendered; YouTube and LinkedIn publish none. All pixel figures here are [S] and conflict with each other. Recommendation: derive safe zones from each platform's own downloadable template or preview, not blog numbers.
2. **Instagram:**
   - The IG Reels system card URL returned 404, so its content is unverified.
   - Mosseri's 2025 signal video was not viewed directly.
   - The current in-app max Reel length (3 min vs 20 min) is unconfirmed.
   - The Help Center page on Sound Collection and business-account music was not retrieved.
3. **Facebook:** the Reels ranking system card and the in-app max length were not retrieved.
4. **TikTok:**
   - Community Guidelines (FYF standards, AIGC rules) and support.tiktok.com pages are JavaScript-rendered and could not be read.
   - The unoriginal-content ineligibility wording, the CML help page and the official Business API metric docs are unverified.
   - The For You explainer is from 2020; no newer official signal list was found.
5. **YouTube:**
   - No primary Shorts ranking statement was found.
   - The 31 Mar 2025 view change rests on secondary reports.
   - Recommended Shorts resolution and the thumbnail spec are unverified.
   - The `creatorContentType=SHORTS` dimension was not confirmed.
   - The "unverified projects not private" wording is a reversal of earlier policy. Re-check it before relying on it.
6. **LinkedIn:**
   - The Videos API file-size limit is inconsistent within the page (500 MB vs 5 GB).
   - The member analytics endpoints are confirmed only by secondary mirrors.
   - Rate limits are not published on the pages fetched.
   - The Help page specs are "updated 2 years ago".
7. **Not in scope of what was fetched:** X/Twitter, Snapchat Spotlight and Pinterest.
