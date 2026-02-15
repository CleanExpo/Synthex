---
name: platform-showcase
description: >
  Multi-platform content adaptation across 8 social media platforms. Takes
  source content and adapts it per each platform's algorithm weights, content
  specs, and winning formulas. Handles the waterfall cross-posting strategy.
  Use when user says "adapt content", "cross-post", "repurpose", "platform
  versions", "multi-platform", or "content waterfall".
---

# Multi-Platform Content Showcase

## Process

1. **Ingest source content** -- receive the primary content piece (video, article, image, thread)
2. **Identify target platforms** -- determine which of the 8 platforms to adapt for
3. **Load platform configs** -- pull algorithm weights, content specs, and winning formulas from `platform_master_config.json`
4. **Adapt per platform** -- transform content to match each platform's format, tone, and algorithm priorities
5. **Apply winning formula** -- structure each adaptation using the platform's highest-performing template
6. **Schedule via waterfall** -- stagger publishing per the cross-posting cascade order and timing
7. **Generate platform metadata** -- hashtags, captions, descriptions, tags, thumbnails per platform

## Supported Platforms

| Platform | Category | Primary Algorithm Signal | Top Format |
|----------|----------|--------------------------|------------|
| YouTube | Video Authority | Watch time (40%) | Long-form 8-15 min, Shorts 15-60s |
| Instagram | Visual Storytelling | Engagement rate (35%) | Reels 15-30s, Carousels |
| TikTok | Entertainment Discovery | Completion rate (40%) | Standard 15-60s |
| X (Twitter) | Real-time Conversation | Early engagement (45%) | Tweets 71-100 chars, Threads |
| Facebook | Community Connection | Meaningful interactions (40%) | Video 1-3 min, Discussion posts |
| LinkedIn | Professional Authority | Professional relevance (35%) | Long-form text 1300+ chars, Articles |
| Pinterest | Inspiration Discovery | Saves (40%) | Standard pins 2:3, Idea pins |
| Reddit | Community Discussion | Upvotes (35%) | Value-sharing posts, Deep discussions |

## Waterfall Cross-Posting Strategy

### Cascade Order
```
YouTube (primary) --> LinkedIn --> Instagram --> Facebook --> X (Twitter) --> TikTok --> Pinterest --> Reddit
```

### Timing Rules
- Delay between platforms: 30 minutes
- Cascade delay from primary: 2 hours
- Each platform publishes at its own optimal time window
- Adaptation level: high (full rewrite per platform, not copy-paste)

### Adaptation Levels
- **High**: Full content rewrite matching platform voice, format, and algorithm priorities
- **Medium**: Structural changes with shared core message
- **Low**: Minor formatting adjustments (reserved for same-category platforms)

## Content Adaptation Rules

### YouTube (Source/Primary)
- Long-form: Hook (0-15s) > Problem (15-60s) > Solution (60-80%) > CTA (final 20s)
- Shorts: Extract most compelling 15-60s segment from long-form
- Thumbnail: custom, high contrast, readable text
- Description: timestamps, keywords, links
- Tags: 10-15 relevant keywords

### Instagram
- Reels: Re-edit video to 15-30s, vertical 9:16, trending audio
- Carousel: Extract key points into 5-10 swipeable slides
- Caption: storytelling hook, 5-10 hashtags (trending + niche mix)
- Visual hooks: movement or surprise in first 3 seconds

### TikTok
- Re-cut to 15-60s, fast pacing with scene changes every 2-3s
- Text overlay for silent viewing
- Trending sound integration within 24-48 hours
- Hashtags: #fyp #foryou + 3-5 niche tags
- Duet/stitch hooks for engagement

### X (Twitter)
- Distill core message to 71-100 characters for single tweet
- Thread version: 5-15 tweets with hook > narrative > conclusion
- Media every 2-3 tweets in threads
- 1-2 hashtags maximum
- Controversial or bold take angle for engagement

### Facebook
- Video: re-edit to 1-3 min, square or 4:5 aspect ratio, captions required
- Post: personal story angle with community question
- Images: minimal text overlay (<20% of image area)
- Group cross-posting with value-first approach

### LinkedIn
- Long-form post: 1300+ characters, professional tone, line breaks every 1-2 sentences
- Data-driven or insight angle from source content
- 3-5 hashtags at end
- Industry insight or professional story template
- Content pillars: 40% expertise, 25% personal, 20% company, 15% engagement

### Pinterest
- Create 2:3 vertical pin (1000x1500) with clear title and step visual
- Keyword-rich title (100 chars) and description (500 chars)
- Board placement with searchable names
- Alt text for accessibility
- Schedule 15-25 pins daily cadence

### Reddit
- Value-sharing format: helpful resource > context > community benefit
- Authentic voice, no self-promotion feel (90% value, 10% promotion)
- Subreddit-specific adaptation (respect community rules)
- Markdown formatting for readability
- Flair usage per subreddit requirements

## Content Pillars Distribution

| Pillar | Percentage | Primary Platforms |
|--------|------------|-------------------|
| Educational | 40% | YouTube, LinkedIn, Pinterest |
| Entertainment | 25% | TikTok, Instagram, X |
| Inspirational | 20% | Instagram, Facebook, LinkedIn |
| Promotional | 10% | All platforms |
| Community | 5% | Reddit, Facebook, X |

## Output

### Per Platform Adaptation
- Adapted content text/script matching platform format
- Platform-specific metadata (hashtags, tags, description)
- Recommended winning formula template applied
- Optimal posting time from platform schedule
- Required media assets list (dimensions, format)

### Campaign Package
- Full set of adaptations across selected platforms
- Waterfall publishing schedule with timestamps
- Cross-platform content calendar
- Performance tracking KPIs per platform

## References

- All platform specs, algorithm weights, and winning formulas sourced from `Synthex/platform_master_config.json`
- Posting schedules and optimization checklists per platform in config
- Analytics KPIs defined in `analytics_config.kpis` section of config
- See `imagen-designer` skill for visual asset specifications per platform
- See `video-engine` skill for video format adaptation
