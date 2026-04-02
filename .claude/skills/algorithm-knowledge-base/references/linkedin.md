---
title: LinkedIn Algorithm Reference
last_verified_date: 2026-04-01
applies_to: LinkedIn Feed, LinkedIn Search, LinkedIn Articles
confidence_range: CONFIRMED → INFERRED
---

# LinkedIn Algorithm Signals

## Overview

LinkedIn uses a 4-stage ranking pipeline: spam filter → quality score → engagement prediction → personalisation boost. LinkedIn Engineering Blog has published multiple detailed posts about this system. B2B content outperforms B2C content on LinkedIn by design — the platform optimises for professional utility.

---

## 4-Stage Ranking Pipeline [CONFIRMED]
- **Source**: LinkedIn Engineering Blog — "How LinkedIn's Feed Works" — 2022-10 (engineering.linkedin.com/blog/2022/understanding-feeds)
- **Stage 1**: Spam / safety filter — removes policy violations
- **Stage 2**: Quality score — ML classifier scoring content relevance and quality
- **Stage 3**: Engagement prediction — predicts probability of likes, comments, shares, reposts
- **Stage 4**: Personalisation boost — adjusts for individual user's network, interests, and past behaviour

---

## Primary Ranking Signals

### consumption_rate [CONFIRMED]
- **Category**: UB (User Behaviour)
- **Source**: LinkedIn Engineering Blog — 2022-10
- **Weight**: Critical
- **Description**: The proportion of users who clicked "see more" or engaged substantively with the post versus those who scrolled past. Posts with high dwell time (time spent viewing) score higher.
- **Implication**: Write content that earns the "see more" click. The first 2–3 lines visible in the feed must be compelling enough to expand. Use a strong hook.

### early_engagement_velocity [CONFIRMED]
- **Category**: EV (Engagement Velocity)
- **Source**: LinkedIn Engineering Blog — 2022-10
- **Weight**: Critical
- **Description**: Engagements received in the first 60–90 minutes after posting heavily influence distribution. LinkedIn uses this early signal to decide how broadly to distribute the post.
- **Implication**: Post when your audience is most active. Engage with comments immediately after posting. Tell 3–5 connections to engage early if you have relationships that permit it.

### topic_authority [INFERRED]
- **Category**: AT (Authority & Trust)
- **Source**: Multiple LinkedIn creator reports + Creator Mode documentation — 2023–2024
- **Weight**: Strong
- **Description**: LinkedIn tracks which topics an account consistently creates about. Accounts with strong content history in a topic area get preferential distribution for new posts on that topic.
- **Implication**: Pick 3–5 consistent content pillars and stay in them. Avoid posting off-topic content that confuses the topic authority model.

### connection_strength [CONFIRMED]
- **Category**: PS (Personalisation)
- **Source**: LinkedIn Engineering Blog — 2022-10
- **Weight**: Strong (personalisation layer)
- **Description**: Posts from 1st-degree connections who the user regularly interacts with are prioritised. Engagement history between two accounts directly affects distribution of that account's content to the user.
- **Implication**: Build genuine relationships. Engaging with others in your target audience's network increases your content's distribution to those users.

### creator_mode [CONFIRMED]
- **Category**: AT (Authority & Trust)
- **Source**: LinkedIn Help Center — Creator Mode documentation
- **Weight**: Moderate
- **Description**: Creator Mode changes "Connect" to "Follow", enables newsletter publishing, and makes the account eligible for "Suggested Creator" distribution. Signals to LinkedIn that the account creates rather than just consumes.
- **Implication**: Enable Creator Mode for business accounts focused on thought leadership. Tag 5 relevant topics at setup — these become distribution categories.

### dwell_time [CONFIRMED]
- **Category**: UB (User Behaviour)
- **Source**: LinkedIn Engineering Blog — "Improving Feed Relevance" — 2021
- **Weight**: Strong
- **Description**: Time a user spends viewing a post (with or without explicit engagement). LinkedIn treats dwell time as an implicit positive signal even without a like or comment.
- **Implication**: Long-form posts, carousels with multiple slides, and documents (PDFs) naturally generate high dwell time. Use these formats for important content.

### poll_completion [INFERRED]
- **Category**: EV (Engagement Velocity)
- **Source**: Multiple creator analytics observations — 2023–2024
- **Weight**: Moderate
- **Description**: Polls generate high engagement volume quickly. Poll votes count as engagement signals. High poll activity generates distribution spikes.
- **Implication**: Use polls for topics where your audience has genuine opinions. Polls burn bright but don't sustain — use sparingly for spikes, not regularly.

### external_link_penalty [INFERRED]
- **Category**: DS (Distribution)
- **Source**: Multiple creator analytics reports — 2022–2024
- **Weight**: Strong (negative)
- **Description**: Posts containing external links (to websites outside LinkedIn) consistently receive lower organic distribution than posts without links. LinkedIn appears to penalise content that moves users off-platform.
- **Implication**: Post external links in the FIRST COMMENT, not in the post body. Use "link in comments" strategy. Posts with pure text or LinkedIn-native media outperform posts with outbound links.

---

## Content Format Signals

### document_carousel [INFERRED]
- **Category**: UB (User Behaviour)
- **Source**: Multiple LinkedIn creator analytics reports — 2023–2024
- **Weight**: Strong
- **Description**: LinkedIn document posts (PDF carousels) generate significantly higher dwell time than static images. Multiple slides require multiple swipes — each swipe increases consumption time.
- **Implication**: Convert high-value content into 5–10 slide document posts. Industry insights, frameworks, how-to guides work well in this format.

### native_video [CONFIRMED]
- **Category**: UB (User Behaviour)
- **Source**: LinkedIn Help Center — video best practices documentation
- **Weight**: Strong
- **Description**: Videos uploaded directly to LinkedIn (not YouTube links) receive preferential distribution. Watch time and completion rate are tracked for native videos.
- **Implication**: Upload video files directly. Keep videos under 3 minutes for educational content. Add captions — most LinkedIn video is watched without sound.

### text_posts (no media) [INFERRED]
- **Category**: CQ (Content Quality)
- **Source**: Creator analytics observations — 2022–2024
- **Weight**: Moderate
- **Description**: Pure text posts without images or links can perform extremely well when content is high-quality and generates engagement velocity. Algorithm treats them neutrally — quality alone determines performance.
- **Implication**: Don't add low-quality images just to have an image. A strong text post outperforms a mediocre image post.

---

## LinkedIn Search Signals

### profile_completeness [CONFIRMED]
- **Category**: AT (Authority & Trust)
- **Source**: LinkedIn Help Center — "All-Star Profile" documentation
- **Weight**: Critical (search)
- **Description**: Complete profiles (photo, headline, summary, 5 skills, 3 experiences, education) receive "All-Star" status and rank higher in LinkedIn Search.
- **Implication**: Complete every section. Use a keyword-rich headline — it's weighted heavily in search ranking.

### keyword_in_headline [CONFIRMED]
- **Category**: CQ (Content Quality)
- **Source**: LinkedIn Help Center + documented search behaviour
- **Weight**: Strong (search)
- **Description**: LinkedIn Search heavily weights keywords in the professional headline field. Job titles, industry terms, and service descriptions in headlines directly improve search visibility.
- **Implication**: Put your primary keyword in the headline. "B2B Marketing Consultant | LinkedIn Strategy | Lead Generation" outperforms "Helping businesses grow."

---

## Anti-Signals

| Signal | Effect |
|--------|--------|
| External link in post body | Confirmed distribution reduction |
| Engagement pod activity (coordinated fake engagement) | Algorithm detects unnatural engagement patterns — may suppress |
| Multiple hashtags (10+) | No distribution benefit; looks spammy |
| Reposting same content within 2 weeks | Suppressed distribution on repeated posts |
| Low dwell time (scroll-past without engagement) | Negative quality signal |
| Asking for likes/follows explicitly | May trigger policy review |
