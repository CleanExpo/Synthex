---
title: Instagram / Meta Algorithm Reference
last_verified_date: 2026-04-01
applies_to: Instagram Feed, Reels, Stories, Explore
confidence_range: CONFIRMED → SPECULATIVE
---

# Instagram / Meta Algorithm Signals

## Overview

Instagram uses four distinct algorithm systems — one per surface (Feed, Reels, Stories, Explore). Each ranks content using different primary signals. Adam Mosseri (Instagram CEO) has confirmed the existence of separate systems in multiple interviews and blog posts.

---

## Surface-Specific Systems

### Feed Algorithm [CONFIRMED]
- **Source**: Instagram for Business blog + Mosseri video — 2023-09
- **Primary signals in order**: relationship strength (DMs, comments, likes history), interest prediction (ML model), recency
- **Implication**: Posting to an engaged existing audience matters more than posting frequency. Content that prompts replies or DMs gets the highest relationship boost.

### Reels Algorithm [CONFIRMED]
- **Source**: Mosseri — 2023-09 (instagram.com/creators)
- **Primary signals in order**: watch_time / completion rate, send rate (shares via DMs), likes, saves
- **Implication**: Reels designed to be re-watched or shared outperform Reels that are only liked. For service businesses: show process/transformation — high rewatch value.

### Stories Algorithm [CONFIRMED]
- **Source**: Instagram Help Center + Mosseri — 2022
- **Primary signals**: story completion rate, replies/reactions, tap-forward rate (inverse — high tap-forward = disengagement)
- **Implication**: Keep Stories under 7 frames for non-story-focused accounts. High tap-forward punishes irrelevant Stories.

### Explore Algorithm [INFERRED]
- **Source**: Multiple creator analytics reports + Meta's Explore documentation — 2024
- **Primary signals**: account engagement velocity, hashtag/topic relevance, share rate
- **Implication**: Explore distribution is primarily driven by how quickly a post generates interactions after publishing (engagement velocity window: first 30–60 mins).

---

## Reels Ranking Signals (Detail)

### watch_time / completion_rate [CONFIRMED]
- **Category**: UB (User Behaviour)
- **Source**: Mosseri — 2023-09
- **Weight**: Critical
- **Description**: Percentage of viewers who watch the full Reel, plus total accumulated watch time. Both are tracked independently.
- **Implication**: Hook within first 3 seconds is mandatory. Aim for 100%+ completion (re-watches count). Under 30s Reels generally outperform longer content unless content is highly engaging throughout.

### sends_per_reach [CONFIRMED]
- **Category**: EV (Engagement Velocity)
- **Source**: Mosseri — 2023-09 (referred to as "sends" — shares via DM)
- **Weight**: Critical
- **Description**: Number of times a Reel was shared via DM divided by accounts reached. The highest-weight signal for Reels distribution beyond existing followers.
- **Implication**: Create shareable content — relatable moments, surprising information, useful tips. "Would I send this to someone?" is the test.

### saves [CONFIRMED]
- **Category**: EV (Engagement Velocity)
- **Source**: Multiple Meta official creator resources — 2022–2024
- **Weight**: Strong
- **Description**: Saves indicate high-value content the user intends to return to. Saved content contributes to interest model refinement.
- **Implication**: Educational, reference, or aspirational content generates saves. Service businesses: pricing guides, step-by-step processes, before/after comparisons.

### comments (especially replies) [CONFIRMED]
- **Category**: EV (Engagement Velocity)
- **Source**: Instagram Help Center — 2023
- **Weight**: Moderate
- **Description**: Comments with replies from the original poster score higher than comments without response. Comment threads signal genuine conversation.
- **Implication**: Reply to every comment within the first hour. Ask questions in captions to prompt comments.

### hashtags [CONFIRMED]
- **Category**: DS (Distribution)
- **Source**: Mosseri — 2022 (hashtags are not amplifiers — they are categorisation tools)
- **Weight**: Minor
- **Description**: Instagram confirmed hashtags are used for categorisation/discoverability, NOT for amplification. Relevant hashtags help Explore categorisation but have no direct reach multiplier.
- **Implication**: Use 3–5 highly relevant niche hashtags. Avoid hashtag stuffing (30 hashtags is no longer beneficial).

---

## Account-Level Signals

### original_content_indicator [CONFIRMED]
- **Category**: CQ (Content Quality)
- **Source**: Meta Transparency Center — 2023-04
- **Weight**: Strong
- **Description**: Reels identified as reposted from other platforms (e.g. TikTok watermark, YouTube Shorts) receive reduced distribution. Original content uploaded natively receives priority.
- **Implication**: Never post TikToks with watermarks to Instagram. Always upload native vertical video.

### account_engagement_velocity [INFERRED]
- **Category**: EV (Engagement Velocity)
- **Source**: Multiple creator analytics reports — 2024
- **Weight**: Strong
- **Description**: Accounts with consistent engagement over time build a "trust baseline." Accounts that have gone dormant and return see suppressed initial distribution until activity re-establishes the velocity pattern.
- **Implication**: Consistency of posting matters more than frequency. 3 posts/week consistently outperforms 7 posts/week for 4 weeks then nothing.

### professional_account_boost [SPECULATIVE]
- **Category**: AT (Authority & Trust)
- **Source**: Community observations, not officially confirmed — 2023
- **Weight**: Unknown
- **Description**: Some practitioners report that switching to Creator or Business accounts affects distribution. Instagram has not confirmed this.
- **Implication**: Use cautiously. Creator/Business accounts unlock analytics regardless of any distribution effect.

---

## Anti-Signals

| Signal | Effect |
|--------|--------|
| High tap-forward rate on Stories | Suppressed future Story distribution |
| TikTok watermark on Reels | Explicit distribution penalty (confirmed) |
| Very low completion rate on Reels | Signals content is not worth distributing beyond current followers |
| Irregular posting gaps (> 3 weeks) | Velocity reset — distribution suppressed on return |
| Misleading thumbnail (clickbait) | Short dwell time increases `badClicks` equivalent |
