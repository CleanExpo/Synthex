---
title: Cross-Platform Algorithm Patterns
last_verified_date: 2026-04-01
applies_to: Google Search, Instagram, LinkedIn, TikTok, Facebook, YouTube
confidence_range: INFERRED
---

# Cross-Platform Algorithm Patterns

All entries are [INFERRED] — patterns observed consistently across multiple platforms, not a single confirmed source. Apply these after loading the platform-specific reference file.

---

## Universal Patterns

### engagement_velocity_window [INFERRED]
- **Category**: EV (Engagement Velocity)
- **Applies to**: Instagram, LinkedIn, TikTok, YouTube, Facebook
- **Pattern**: Every platform tracks how quickly engagement accumulates in the first window after publication. Early engagement signals to the algorithm that the content deserves broader distribution.
- **Window estimates** (inferred from platform behaviour):
  - Instagram Reels: 30–60 minutes
  - LinkedIn: 60–90 minutes
  - TikTok: 30 minutes
  - YouTube: First 24–48 hours
  - Facebook: First 3 hours
- **Implication**: Post when your specific audience is most active. Respond to comments immediately after posting to trigger continued engagement. Do not post and disappear.

### native_content_preference [INFERRED]
- **Category**: DS (Distribution)
- **Applies to**: All platforms
- **Pattern**: Every major platform penalises or de-prioritises content that drives users off-platform. Content that keeps users on-platform receives distribution preference.
- **Implication**:
  - LinkedIn: links in first comment, not post body
  - Instagram: link in bio, not caption
  - YouTube: links in description (not community post) — YouTube is less restrictive because description links are standard
  - Facebook: link posts underperform compared to native video or photo posts

### content_consistency_model [INFERRED]
- **Category**: AT (Authority & Trust)
- **Applies to**: All platforms
- **Pattern**: Algorithms build a content profile per account over time. Consistent content category/topic focus causes the algorithm to learn the audience and distribute more accurately. Topic switching confuses the model and resets distribution effectiveness.
- **Implication**: Choose 3–5 content pillars and commit. If changing brand direction: a slow topic pivot outperforms abrupt changes.

### interaction_quality_hierarchy [INFERRED]
- **Category**: EV (Engagement Velocity)
- **Applies to**: Instagram, LinkedIn, TikTok, Facebook, YouTube
- **Pattern**: All platforms weight interaction types hierarchically. Higher-intent interactions receive more weight than passive interactions.
  - Highest: DMs / shares to specific people (Instagram), comments with replies (LinkedIn/Instagram), saves
  - High: Comments without replies, shares/reposts
  - Medium: Likes, reactions
  - Low: Views without other engagement
  - Negative: Skip / scroll-past quickly, block, "not interested"
- **Implication**: Create content that earns high-intent interactions. "Would I DM this to someone?" is a stronger content test than "Would people like this?"

### thumbnail_and_first_frame [INFERRED]
- **Category**: UB (User Behaviour)
- **Applies to**: YouTube (thumbnail), Instagram Reels (cover frame), TikTok (first frame)
- **Pattern**: Click-through rate (or play-through initiation) on the visual preview strongly predicts distribution. Low CTR on thumbnails/covers signals the content is not compelling even before users engage with the substance.
- **Implication**: Invest in thumbnail/cover design. A/B test YouTube thumbnails. Keep Reel cover frames visually clear with readable text at small size (mobile feed is 75px wide).

### account_health_floor [INFERRED]
- **Category**: AT (Authority & Trust)
- **Applies to**: All platforms
- **Pattern**: Accounts with policy violations, spam reports, or patterns of inauthentic engagement operate with a suppressed distribution ceiling. Above-average content from a flagged account rarely recovers full reach.
- **Implication**: Never buy followers, engagement, or use automation that violates platform terms. Platform trust takes months to build and can be lost in a single violation.

### posting_cadence_consistency [INFERRED]
- **Category**: FR (Freshness)
- **Applies to**: All platforms
- **Pattern**: Irregular posting causes algorithms to deprioritise an account's content (the account is less "active" in the model). Returning after a dormancy period requires re-establishing the engagement velocity baseline.
- **Implication**: Consistency beats volume. 3 posts/week every week > 10 posts/week then silence. If going offline: schedule content rather than going dark.

---

## Platform Differentiation Summary

| Signal | Google | Instagram | LinkedIn |
|--------|--------|-----------|----------|
| Primary trust signal | Domain authority (siteAuthority) | Account engagement velocity | Topic authority |
| Primary content signal | OriginalContentScore | sends_per_reach | consumption_rate |
| External link penalty | No (Google rewards outbound links in editorial context) | Yes (leaves platform) | Yes (leaves platform) |
| Hashtag value | Not applicable | Minor (categorisation only) | Minor (categorisation only) |
| Early engagement window | Not applicable | 30–60 min | 60–90 min |
| Fresh content benefit | Query-dependent (high for news, low for evergreen) | High (recency weighted) | Moderate |

---

## AI Search / GEO Cross-Platform Notes

### llm_citability [INFERRED]
- **Category**: CQ (Content Quality)
- **Applies to**: Google AI Overviews, ChatGPT web browsing, Perplexity, Gemini
- **Pattern**: AI systems selecting content for citation favour: direct answer format (question → concise answer), structured headings, factual density, clear authorship, E-E-A-T signals, and siteAuthority.
- **Implication**: Content optimised for AI citation: use `<h2>` question-format headings, provide a direct 1–2 sentence answer immediately below each heading, include author credentials, cite sources. This pattern benefits both traditional SEO and GEO simultaneously.
