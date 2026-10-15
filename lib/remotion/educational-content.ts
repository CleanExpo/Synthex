/**
 * Educational Video Registry — 100 entries (SYN-429)
 *
 * Each entry maps to a Remotion composition. Composition IDs correspond to
 * components exported from lib/remotion/compositions/index.ts.
 *
 * Voiceover scripts are sized for natural spoken pace (~150 wpm):
 *   TipCard/CountdownCTA (15s) ≈ 37 words
 *   StatReveal/QuoteCard/DefinitionCard (20s) ≈ 50 words
 *   ComparisonSlide (25s) ≈ 63 words
 *   ExplainerVideo/ListicleVideo (30s) ≈ 75 words
 *   HowToVideo/CaseStudyVideo (40s) ≈ 100 words
 */

import { HELP_VIDEO_BY_ID, type EducationalVideo } from './help-videos';

export type { EducationalVideo } from './help-videos';

export const EDUCATIONAL_VIDEOS: EducationalVideo[] = [
  // ── ExplainerVideo (16:9 · 900f / 30s · 1920×1080) ─────────────────────────

  {
    id: 'intro-ai-marketing',
    title: 'What is AI Marketing Automation? | Synthex Education',
    description: `Learn how AI marketing automation can transform your business's social media presence.

In this video:
• What AI marketing automation means
• How it saves time on content creation
• Real results from early adopters

Start free: https://synthex.social

#AIMarketing #MarketingAutomation #Synthex`,
    tags: [
      'AI marketing',
      'marketing automation',
      'social media',
      'Synthex',
      'education',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Welcome to Synthex Education. Today we explore AI marketing automation — ' +
      'what it is, why it matters, and how platforms like Synthex are making it accessible ' +
      'to businesses of every size. AI marketing automation uses artificial intelligence to ' +
      'create, schedule, and optimise your social media content automatically. ' +
      'Instead of spending hours crafting posts, your AI learns your brand voice and ' +
      'generates on-brand content around the clock. ' +
      'The future of marketing is autonomous. Visit Synthex dot social to get started today.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'how-ai-writes-social-posts',
    title: 'How AI Writes Your Social Media Posts | Synthex Education',
    description: `Discover the technology behind AI-generated social media content.

Covered:
• How large language models understand your brand
• Why AI content stays on-brand every time
• The human-AI collaboration model

Start free: https://synthex.social

#AIContent #SocialMedia #ContentCreation #Synthex`,
    tags: [
      'AI writing',
      'social media posts',
      'content generation',
      'LLM',
      'Synthex',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Ever wonder how AI generates social media posts that sound exactly like you? ' +
      'It starts with your Business DNA — your tone, vocabulary, values, and audience. ' +
      'The AI combines ' +
      'what it knows about your industry with your brand profile to craft content that is both on-brand and ' +
      'optimised for engagement. Every post is scored before it reaches you, ensuring ' +
      'quality and relevance. You review, approve, and publish — the AI handles the rest. ' +
      'Discover how Synthex creates content that sounds authentically you at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'understanding-brand-voice-ai',
    title: 'What is Brand Voice & Why AI Needs It | Synthex Education',
    description: `Your brand voice is your personality online. Here's why it matters for AI marketing.

Learn:
• What brand voice actually means
• How to define yours in 3 steps
• How Synthex captures and applies it automatically

Start free: https://synthex.social

#BrandVoice #ContentStrategy #AIMarketing #Synthex`,
    tags: [
      'brand voice',
      'content strategy',
      'AI marketing',
      'branding',
      'Synthex',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Brand voice is how your business sounds online — your personality, your tone, ' +
      'your way of speaking to customers. Without a consistent brand voice, your content ' +
      'feels disjointed and forgettable. With it, every post builds recognition and trust. ' +
      'Defining your brand voice takes three things: knowing your audience, ' +
      'choosing three to five tone descriptors like friendly, expert, or bold, ' +
      'and documenting words you always use and words you never use. ' +
      'Synthex captures your brand voice automatically and applies it to every piece of content it generates. ' +
      'Build your brand voice today at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'what-is-a-content-strategy',
    title: 'What is a Content Strategy? (And Why You Need One) | Synthex',
    description: `Posting randomly on social media doesn't work. A content strategy does.

In this explainer:
• The 4 pillars of a content strategy
• How to choose your content mix
• Why strategy beats volume every time

Start free: https://synthex.social

#ContentStrategy #SocialMediaMarketing #DigitalMarketing #Synthex`,
    tags: [
      'content strategy',
      'social media marketing',
      'digital marketing',
      'content pillars',
      'Synthex',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'A content strategy is your plan for what to publish, where to publish it, and why. ' +
      'Without one, you are guessing — and guessing wastes time and budget. ' +
      'A strong content strategy has four pillars: clear goals tied to business outcomes, ' +
      'deep audience understanding, a defined content mix across education, entertainment, and promotion, ' +
      'and a consistent publishing cadence. ' +
      'Synthex helps you build and execute your strategy ' +
      'automatically, generating the right content for the right platform at the right time. ' +
      'Start your strategy at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'social-media-automation-explained',
    title: 'Social Media Automation Explained in 60 Seconds | Synthex',
    description: `What is social media automation and how does it work? We break it down simply.

Start free: https://synthex.social

#SocialMediaAutomation #MarketingTools #Synthex`,
    tags: [
      'social media automation',
      'marketing tools',
      'scheduling',
      'AI',
      'Synthex',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Social media automation is the use of software to handle repetitive marketing tasks ' +
      'automatically — content creation, scheduling, publishing, and even engagement tracking. ' +
      'Instead of logging into five platforms every day, your automation tool handles it all ' +
      'from one dashboard. Modern AI-powered automation goes further: it analyses your audience, ' +
      'learns what content performs best, and optimises your strategy over time. ' +
      'The result is more consistent posting, better engagement, and hours saved every week. ' +
      'Synthex is the next generation of social media automation — visit synthex dot social to see it in action.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'ai-vs-human-content-creation',
    title: 'AI vs Human Content Creation: The Truth | Synthex Education',
    description: `Is AI replacing human marketers? Here's what the data says.

Covered:
• What AI does better than humans
• What humans do better than AI
• The winning combination for 2026

Start free: https://synthex.social

#AIvsHuman #ContentCreation #MarketingTrends #Synthex`,
    tags: [
      'AI content',
      'human creativity',
      'content creation',
      'marketing trends',
      'Synthex',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'AI is not replacing human marketers — it is replacing the tasks that drain them. ' +
      'AI excels at speed, scale, and consistency: generating hundreds of on-brand posts, ' +
      "analysing performance data, and optimising for each platform's algorithm. " +
      'Humans excel at empathy, creativity, and strategy: understanding what truly moves an audience, ' +
      'crafting campaigns with emotional resonance, and making judgment calls that data cannot. ' +
      'The highest-performing marketing teams in 2026 combine both — AI handles the volume, ' +
      'humans provide the vision. Synthex is built for this partnership. ' +
      'Discover what AI-assisted marketing looks like at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'building-your-digital-presence',
    title: 'How to Build a Digital Presence From Scratch | Synthex Education',
    description: `Starting from zero? Here's the playbook for building a digital presence that works.

Start free: https://synthex.social

#DigitalPresence #SocialMediaMarketing #SmallBusiness #Synthex`,
    tags: [
      'digital presence',
      'social media',
      'small business',
      'brand building',
      'Synthex',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Building a digital presence from scratch can feel overwhelming — but it does not have to be. ' +
      'Start with one platform where your audience already spends time. ' +
      'Set up a complete profile: professional photo, clear bio, and a link to your website. ' +
      'Commit to a publishing cadence you can sustain — three posts a week beats seven for one week and none for three. ' +
      'Focus on providing value: educate, entertain, or inspire. ' +
      'Engage genuinely with comments and questions. ' +
      'Track what works and double down on it. ' +
      'Synthex makes this entire process automatic — build your digital presence today at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'from-zero-to-social-media-success',
    title: 'From Zero to Social Media Success in 90 Days | Synthex',
    description: `The 90-day roadmap every small business should follow for social media growth.

Start free: https://synthex.social

#SocialMediaGrowth #SmallBusiness #90DayPlan #Synthex`,
    tags: [
      'social media growth',
      'small business',
      '90 day plan',
      'marketing roadmap',
      'Synthex',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Here is a ninety-day plan for building a social media presence. ' +
      'In the first thirty days: set up your profiles, define your brand voice, and commit to a content calendar. ' +
      'In days thirty-one to sixty: publish consistently, engage with every comment, and test different content formats. ' +
      'Analyse your top performers and create more like them. ' +
      'In days sixty-one to ninety: scale what works, experiment with video, and start growing your following intentionally. ' +
      'Synthex accelerates every stage — start your 90-day journey at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'future-of-ai-marketing-2026',
    title: 'The Future of AI Marketing in 2026 | Synthex Education',
    description: `What does AI-powered marketing look like in 2026? Here are the trends reshaping the industry.

Start free: https://synthex.social

#MarketingTrends2026 #AIMarketing #FutureOfMarketing #Synthex`,
    tags: [
      'marketing trends',
      'AI marketing',
      'future of marketing',
      '2026',
      'Synthex',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Marketing in 2026 is being redefined by AI at every level. ' +
      'Personalisation has moved from batch-and-blast to one-to-one content at scale. ' +
      'Autonomous agents now research trends, draft content, and optimise campaigns overnight while you sleep. ' +
      'Video has overtaken static images as the default content format across every platform. ' +
      'The question is no longer whether to use AI in your marketing — it is how fast you can get started. ' +
      'The future is already here at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'content-calendar-tips',
    title: '5 Content Calendar Tips for 2026 | Synthex Education',
    description: `Master your content calendar with these proven strategies for 2026.

Tips covered:
• Batch content creation
• Platform-specific scheduling
• Repurposing content effectively
• Analytics-driven timing
• AI-assisted planning

Start free: https://synthex.social

#ContentCalendar #SocialMediaStrategy #Synthex`,
    tags: [
      'content calendar',
      'social media strategy',
      'content planning',
      'Synthex',
      'marketing tips',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Five content calendar tips to transform your social media strategy in 2026. ' +
      'First — batch your content creation. Set aside dedicated blocks each week to ' +
      'create multiple posts at once, rather than scrambling daily. ' +
      'Second — tailor your schedule to each platform. Instagram peaks on Tuesday mornings, ' +
      'LinkedIn on Wednesday afternoons, TikTok in the evenings. ' +
      'Third — repurpose relentlessly. One blog post becomes five social posts, ' +
      'one video becomes ten quote cards. ' +
      'Fourth — let your analytics guide your timing. Post when your audience is most active, ' +
      'not just when it is convenient. ' +
      'And fifth — use AI to fill the gaps. Synthex can generate a month of on-brand content ' +
      'in minutes, keeping your calendar full without burning out your team. ' +
      'Visit Synthex dot social to build your content calendar today.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  // ── TipCard (9:16 · 450f / 15s · 1080×1920) ─────────────────────────────────

  {
    id: 'tip-batch-content-creation',
    title: 'Tip: Batch Your Content Creation | Synthex',
    description: `Stop creating content one post at a time. Batch it instead.

#ContentCreation #ProductivityTip #Synthex`,
    tags: [
      'content creation',
      'productivity',
      'batch creation',
      'social media tip',
      'Synthex',
    ],
    compositionId: 'TipCard',
    voiceoverScript:
      'Marketing tip: batch your content creation. ' +
      'Set aside two hours once a week to create all your social posts at once. ' +
      'You will produce better content, faster, with far less stress. ' +
      'Or let Synthex do it automatically.',
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
  },

  {
    id: 'tip-best-times-to-post',
    title: 'Tip: When to Post on Each Platform | Synthex',
    description: `Timing matters. Post at the right time on every platform.

#PostingTips #SocialMedia #Synthex`,
    tags: [
      'posting times',
      'social media',
      'engagement',
      'scheduling',
      'Synthex',
    ],
    compositionId: 'TipCard',
    voiceoverScript:
      'Marketing tip: post at the right time. ' +
      'Instagram: Tuesday 9am. LinkedIn: Wednesday 10am. TikTok: Thursday 7pm. ' +
      'Facebook: Friday 1pm. Check your own analytics, as your audience may be online at different times. ' +
      'Synthex schedules automatically for each platform.',
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
  },

  {
    id: 'tip-hashtag-strategy',
    title: 'Tip: How to Use Hashtags in 2026 | Synthex',
    description: `Hashtags still work — if you use them correctly.

#HashtagStrategy #Instagram #SocialMedia #Synthex`,
    tags: ['hashtag strategy', 'Instagram', 'social media', 'reach', 'Synthex'],
    compositionId: 'TipCard',
    voiceoverScript:
      'Hashtag tip for 2026: use fewer, better hashtags. ' +
      'On Instagram, three to five highly relevant hashtags outperform thirty generic ones. ' +
      'Mix one broad tag, two niche tags, and one branded tag. ' +
      'Quality beats quantity every time.',
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
  },

  {
    id: 'tip-engagement-rate-benchmark',
    title: 'Tip: What Engagement Rate Should You Aim For? | Synthex',
    description: `Not sure if your engagement rate is good? Here's your benchmark.

#EngagementRate #SocialMediaMetrics #Synthex`,
    tags: [
      'engagement rate',
      'social media metrics',
      'benchmarks',
      'analytics',
      'Synthex',
    ],
    compositionId: 'TipCard',
    voiceoverScript:
      'Marketing tip: know your engagement benchmarks. ' +
      'Instagram: aim for three percent or above. LinkedIn: above two percent is strong. ' +
      'TikTok: five percent-plus is excellent. ' +
      'Below benchmark? Focus on better hooks and more specific audience targeting.',
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
  },

  {
    id: 'tip-repurpose-content',
    title: 'Tip: Repurpose Every Piece of Content | Synthex',
    description: `Create once, publish everywhere. The content repurposing formula.

#ContentRepurposing #ContentMarketing #Synthex`,
    tags: [
      'content repurposing',
      'content marketing',
      'efficiency',
      'social media',
      'Synthex',
    ],
    compositionId: 'TipCard',
    voiceoverScript:
      'Repurposing tip: one piece of content should fuel ten posts. ' +
      'A blog post becomes a LinkedIn article, five social posts, a quote card, a short video, and an email. ' +
      'Stop creating from scratch every time — repurpose what already works. ' +
      'Synthex handles this automatically.',
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
  },

  {
    id: 'tip-call-to-action-formulas',
    title: 'Tip: 3 Call-to-Action Formulas That Convert | Synthex',
    description: `Your CTA determines whether people act or scroll past. Use these formulas.

#CTA #Copywriting #SocialMedia #Synthex`,
    tags: [
      'call to action',
      'copywriting',
      'conversion',
      'social media',
      'Synthex',
    ],
    compositionId: 'TipCard',
    voiceoverScript:
      'Three CTA formulas that drive action. ' +
      'One: benefit-plus-command — "plan your next month of posts: start your free trial." ' +
      'Two: curiosity — "want to know the one thing top brands do differently? Click the link." ' +
      'Three: social proof — "join the businesses already using Synthex." ' +
      'Always end your post with a clear next step.',
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
  },

  {
    id: 'tip-hook-your-audience',
    title: 'Tip: Write Hooks That Stop the Scroll | Synthex',
    description: `The first line of your post determines everything. Make it count.

#Copywriting #SocialMedia #ContentTips #Synthex`,
    tags: ['hooks', 'copywriting', 'social media', 'content tips', 'Synthex'],
    compositionId: 'TipCard',
    voiceoverScript:
      'You have three seconds to stop the scroll. Your hook is everything. ' +
      'Start with a bold claim, a surprising number, or a question your audience is already asking. ' +
      'Avoid "I" at the start — lead with the value. ' +
      'Test two hooks per post and double down on what works.',
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
  },

  {
    id: 'tip-brand-consistency',
    title: 'Tip: Stay Consistent to Build Trust | Synthex',
    description: `Brand consistency is the foundation of trust. Here's why it matters.

#BrandConsistency #Branding #MarketingTips #Synthex`,
    tags: [
      'brand consistency',
      'branding',
      'trust',
      'marketing tips',
      'Synthex',
    ],
    compositionId: 'TipCard',
    voiceoverScript:
      'Consistency tip: your audience needs to see you repeatedly before they trust you. ' +
      'Use the same colours, fonts, tone of voice, and posting style every time. ' +
      'Inconsistency signals unreliability — even unconsciously. ' +
      'Synthex keeps your brand perfectly consistent across every platform, every post.',
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
  },

  {
    id: 'tip-analyse-competitors',
    title: "Tip: Learn From Your Competitors' Best Content | Synthex",
    description: `Competitive analysis is free market research. Use it.

#CompetitorAnalysis #SocialMedia #MarketingTips #Synthex`,
    tags: [
      'competitor analysis',
      'social media',
      'market research',
      'content strategy',
      'Synthex',
    ],
    compositionId: 'TipCard',
    voiceoverScript:
      'Competitive analysis tip: spend thirty minutes a month studying your top three competitors. ' +
      'Note what posts get the most engagement, which formats they favour, and what topics they avoid. ' +
      'Then do those things better. ' +
      'Your competitors have already done the testing — learn from their results.',
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
  },

  {
    id: 'tip-test-post-formats',
    title: 'Tip: Test Every Post Format to Find What Works | Synthex',
    description: `Carousel, video, image, or text? Test everything to find your winner.

#ContentFormats #SocialMedia #AandBTesting #Synthex`,
    tags: [
      'post formats',
      'social media',
      'A/B testing',
      'content strategy',
      'Synthex',
    ],
    compositionId: 'TipCard',
    voiceoverScript:
      'Format testing tip: do not assume — test. ' +
      'Publish carousels, single images, short videos, and text posts, then compare engagement rates. ' +
      'Most audiences have a clear preference you will only discover by experimenting. ' +
      'Find your winning format and make it your default.',
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
  },

  // ── ComparisonSlide (16:9 · 750f / 25s · 1920×1080) ─────────────────────────

  {
    id: 'compare-manual-vs-ai-posting',
    title: 'Manual Posting vs AI Automation | Synthex',
    description: `Side-by-side: doing social media manually vs with AI automation.

#MarketingAutomation #AIMarketing #Productivity #Synthex`,
    tags: [
      'manual posting',
      'AI automation',
      'productivity',
      'comparison',
      'Synthex',
    ],
    compositionId: 'ComparisonSlide',
    voiceoverScript:
      'Manual social media posting: writing posts, choosing images, ' +
      'logging into each platform, and hoping you remembered to schedule everything. ' +
      'AI-powered automation with Synthex: your brand voice is learned once, ' +
      'content is drafted and scheduled for you, and you review and approve every post before it is published. ' +
      'The choice is clear at synthex dot social.',
    durationInFrames: 750,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'compare-organic-vs-paid',
    title: 'Organic vs Paid Social Media: Which Wins? | Synthex',
    description: `Organic reach vs paid ads — they serve different purposes. Here's when to use each.

#OrganicMarketing #PaidAds #SocialMedia #Synthex`,
    tags: [
      'organic marketing',
      'paid ads',
      'social media',
      'comparison',
      'Synthex',
    ],
    compositionId: 'ComparisonSlide',
    voiceoverScript:
      'Organic social media: builds long-term trust and community, costs time not money, ' +
      'and compounds in value over months and years. Slower to start, but free to sustain. ' +
      'Paid social media: reaches new audiences immediately, delivers measurable ROI fast, ' +
      'but stops working the moment you stop spending. ' +
      'The winning formula: use organic to build your foundation and retarget warm audiences with paid. ' +
      'Synthex handles your organic strategy at synthex dot social.',
    durationInFrames: 750,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'compare-facebook-vs-instagram',
    title:
      'Facebook vs Instagram: Which Platform Wins for Your Business? | Synthex',
    description: `Facebook and Instagram serve different audiences and content types. Know the difference.

#Facebook #Instagram #SocialMediaStrategy #Synthex`,
    tags: [
      'Facebook',
      'Instagram',
      'social media strategy',
      'platform comparison',
      'Synthex',
    ],
    compositionId: 'ComparisonSlide',
    voiceoverScript:
      'Facebook: strong for local businesses, ' +
      'events, groups, and long-form content. Excellent for community building and retargeting. ' +
      'Instagram: a visual-first platform, ' +
      'strong for product-based businesses, lifestyle brands, and short-form video. ' +
      'Your choice depends entirely on where your audience spends their time. ' +
      'Synthex publishes to both automatically — learn more at synthex dot social.',
    durationInFrames: 750,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'compare-short-vs-long-form',
    title: 'Short-Form vs Long-Form Content: What Works Better? | Synthex',
    description: `Short videos or in-depth articles? The answer might surprise you.

#ShortFormContent #LongFormContent #ContentStrategy #Synthex`,
    tags: [
      'short form content',
      'long form content',
      'content strategy',
      'comparison',
      'Synthex',
    ],
    compositionId: 'ComparisonSlide',
    voiceoverScript:
      'Short-form content — Reels, TikToks, and quick posts — drives discovery. ' +
      'Algorithms love it, attention spans are short, and one clip can reach people who have never heard of you. ' +
      'Long-form content — articles, podcasts, and deep-dive videos — builds authority. ' +
      'It converts browsers into believers and establishes you as a genuine expert. ' +
      'Both have a place in your strategy: short-form for reach, long-form for depth. ' +
      'Synthex creates both at synthex dot social.',
    durationInFrames: 750,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'compare-image-vs-video-posts',
    title: 'Image Posts vs Video Posts | Synthex',
    description: `Images or video? The platform-by-platform breakdown.

#VideoMarketing #ImageContent #SocialMedia #Synthex`,
    tags: [
      'video posts',
      'image posts',
      'social media',
      'content formats',
      'Synthex',
    ],
    compositionId: 'ComparisonSlide',
    voiceoverScript:
      'Image posts: fast to create, clear and visually impactful, great for product showcases and quotes. ' +
      'Average reach is solid, but engagement has declined on most platforms as video dominates. ' +
      'Video posts: take longer to produce, but add sound and motion to hold attention. ' +
      'Video is prioritised by every major algorithm in 2026 — Instagram, LinkedIn, and TikTok all push it first. ' +
      'Ideal strategy: video as your lead format, images to fill the gaps. ' +
      'Synthex creates both at synthex dot social.',
    durationInFrames: 750,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'compare-single-vs-cross-platform',
    title: 'One Platform vs Multi-Platform Strategy | Synthex',
    description: `Should you focus on one platform or publish everywhere? The honest answer.

#CrossPlatform #SocialMediaStrategy #MultiChannel #Synthex`,
    tags: [
      'cross platform',
      'social media strategy',
      'multi channel',
      'comparison',
      'Synthex',
    ],
    compositionId: 'ComparisonSlide',
    voiceoverScript:
      'Single-platform focus: master one channel before expanding. ' +
      'Lower complexity, deeper community, and easier to track what works. ' +
      'Best for small teams and businesses just starting out. ' +
      'Cross-platform publishing: larger audience reach, reduced risk from algorithm changes, ' +
      'and multiple touchpoints with the same customer. Requires more content volume and coordination. ' +
      'The answer? Start with one, then expand as you grow. ' +
      'Synthex makes cross-platform effortless at synthex dot social.',
    durationInFrames: 750,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'compare-daily-vs-weekly-posting',
    title: 'Daily Posting vs Weekly Batching: Which Is Better? | Synthex',
    description: `Posting every day vs batching your content once a week. The comparison.

#ContentCalendar #Scheduling #SocialMedia #Synthex`,
    tags: [
      'daily posting',
      'content batching',
      'content calendar',
      'scheduling',
      'Synthex',
    ],
    compositionId: 'ComparisonSlide',
    voiceoverScript:
      'Daily posting: keeps your brand top of mind, signals consistency to algorithms, ' +
      'and provides more data points for optimisation. But it is exhausting if done manually. ' +
      'Weekly batching: one dedicated creative session, all posts scheduled in advance, ' +
      'lower mental load, and more strategic content planning. ' +
      'With AI automation, you get the benefits of daily posting without the daily effort. ' +
      'Synthex handles both approaches at synthex dot social.',
    durationInFrames: 750,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'compare-niche-vs-broad-content',
    title: 'Niche Content vs Broad Content: What Grows Faster? | Synthex',
    description: `Trying to appeal to everyone appeals to no one. Here's the niche vs broad debate.

#NicheMarketing #ContentStrategy #AudienceBuilding #Synthex`,
    tags: [
      'niche marketing',
      'content strategy',
      'audience building',
      'comparison',
      'Synthex',
    ],
    compositionId: 'ComparisonSlide',
    voiceoverScript:
      'Broad content: appeals to a wide audience on the surface, but often resonates deeply with no one. ' +
      'High competition, hard to stand out, difficult to monetise. ' +
      'Niche content: speaks directly to a specific audience with specific problems. ' +
      'Lower total reach, but dramatically higher engagement, trust, and conversion. ' +
      'The riches are in the niches — the more specific you are, the more powerful your marketing becomes. ' +
      'Find your niche and own it with Synthex at synthex dot social.',
    durationInFrames: 750,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'compare-diy-vs-agency-marketing',
    title: "DIY Marketing vs Agency: What's Right for Your Business? | Synthex",
    description: `Managing social media yourself vs hiring an agency. The honest comparison.

#DIYMarketing #MarketingAgency #SmallBusiness #Synthex`,
    tags: [
      'DIY marketing',
      'marketing agency',
      'small business',
      'comparison',
      'Synthex',
    ],
    compositionId: 'ComparisonSlide',
    voiceoverScript:
      'DIY marketing: maximum control over your brand, low cost but high time investment, ' +
      'and steep learning curve. Works well for solopreneurs who enjoy the creative process. ' +
      'Agency marketing: professional expertise and execution, but expensive — ' +
      'typically three to ten thousand dollars per month — and slow to iterate. ' +
      'AI-powered platforms like Synthex offer a third way: agency-quality output at DIY prices. ' +
      'Full control, professional results, no retainer. Discover it at synthex dot social.',
    durationInFrames: 750,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'compare-scheduling-vs-live-posting',
    title: 'Scheduling Posts vs Posting Live: Which Is Better? | Synthex',
    description: `Scheduled content or posting in the moment? Here's when each approach wins.

#ContentScheduling #SocialMedia #Strategy #Synthex`,
    tags: [
      'content scheduling',
      'live posting',
      'social media',
      'strategy',
      'Synthex',
    ],
    compositionId: 'ComparisonSlide',
    voiceoverScript:
      'Live posting: captures real-time moments and trends, feels authentic and spontaneous, ' +
      'but relies on you being available at the right time. Impossible to sustain consistently. ' +
      'Scheduled posting: allows careful crafting and review, hits optimal times automatically, ' +
      'and removes the daily pressure of "what do I post today?" ' +
      'Best approach: schedule your evergreen content, go live for breaking news and moments. ' +
      'Synthex handles your scheduled content at synthex dot social.',
    durationInFrames: 750,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  // ── ListicleVideo (16:9 · 900f / 30s · 1920×1080) ───────────────────────────

  {
    id: 'list-5-social-media-mistakes',
    title: '5 Social Media Mistakes Killing Your Growth | Synthex',
    description: `Are you making these common social media mistakes? Most businesses are.

Start free: https://synthex.social

#SocialMediaMistakes #GrowthTips #Marketing #Synthex`,
    tags: [
      'social media mistakes',
      'growth tips',
      'marketing',
      'social media',
      'Synthex',
    ],
    compositionId: 'ListicleVideo',
    voiceoverScript:
      'Five social media mistakes that are silently killing your growth. ' +
      'Mistake one: posting without a strategy — random content produces random results. ' +
      'Mistake two: ignoring your analytics — data tells you exactly what to do more of. ' +
      'Mistake three: only promoting, never educating or entertaining — the three to one rule keeps audiences engaged. ' +
      'Mistake four: inconsistent posting — algorithms punish absence and reward consistency. ' +
      'Mistake five: treating every platform the same — LinkedIn content does not belong on TikTok. ' +
      'Fix all five automatically with Synthex at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'list-7-types-of-social-content',
    title: '7 Types of Social Media Content You Should Be Creating | Synthex',
    description: `Not sure what to post? Here are 7 proven content types that build audiences.

Start free: https://synthex.social

#ContentTypes #SocialMedia #ContentStrategy #Synthex`,
    tags: [
      'content types',
      'social media',
      'content strategy',
      'content ideas',
      'Synthex',
    ],
    compositionId: 'ListicleVideo',
    voiceoverScript:
      'Seven content types every business should be creating. ' +
      "One: educational posts that solve your audience's problems. " +
      'Two: behind-the-scenes content that builds genuine connection. ' +
      'Three: testimonials and social proof that drive conversions. ' +
      'Four: entertaining content that shows your personality. ' +
      'Five: industry news commentary that establishes authority. ' +
      'Six: product or service spotlights done in a helpful, non-salesy way. ' +
      'And seven: engagement posts — polls, questions, and challenges that invite participation. ' +
      'Synthex creates all seven types automatically at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'list-5-metrics-to-track',
    title: '5 Social Media Metrics That Actually Matter | Synthex',
    description: `Stop obsessing over vanity metrics. These 5 numbers tell the real story.

Start free: https://synthex.social

#SocialMediaMetrics #Analytics #MarketingKPIs #Synthex`,
    tags: [
      'social media metrics',
      'analytics',
      'marketing KPIs',
      'data',
      'Synthex',
    ],
    compositionId: 'ListicleVideo',
    voiceoverScript:
      'Five social media metrics that actually matter for your business. ' +
      'One: engagement rate — likes and comments divided by reach, not followers. ' +
      'Two: reach — the unique people who see your content each week. ' +
      'Three: click-through rate — how many people take action on your posts. ' +
      'Four: follower growth rate — are you growing, stagnating, or declining? ' +
      'Five: conversion rate from social — how many leads or sales come from social media. ' +
      'Follower count alone means nothing without these five. ' +
      'Synthex tracks them all automatically at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'list-6-instagram-growth-hacks',
    title: '6 Instagram Growth Tactics That Work in 2026 | Synthex',
    description: `Grow your Instagram following with these 6 tactics that work right now.

Start free: https://synthex.social

#InstagramGrowth #InstagramTips #SocialMedia #Synthex`,
    tags: [
      'Instagram growth',
      'Instagram tips',
      'social media',
      'growth tactics',
      'Synthex',
    ],
    compositionId: 'ListicleVideo',
    voiceoverScript:
      'Six Instagram growth tactics that work in 2026. ' +
      'One: post Reels daily — the algorithm still rewards video above all else. ' +
      'Two: use the first line of your caption as a hook — most people read only that. ' +
      "Three: reply to every comment within the first hour — it boosts your post's algorithmic ranking. " +
      'Four: collaborate with complementary accounts for cross-promotion. ' +
      'Five: use location tags and three to five niche hashtags, not thirty generic ones. ' +
      'Six: share your Reels to Stories for a second wave of reach. ' +
      'Synthex helps you implement all six consistently at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'list-5-linkedin-best-practices',
    title: '5 LinkedIn Best Practices for Business Growth | Synthex',
    description: `LinkedIn is the most powerful B2B platform. Are you using it correctly?

Start free: https://synthex.social

#LinkedInMarketing #B2BMarketing #LinkedIn #Synthex`,
    tags: [
      'LinkedIn marketing',
      'B2B marketing',
      'LinkedIn tips',
      'professional network',
      'Synthex',
    ],
    compositionId: 'ListicleVideo',
    voiceoverScript:
      'Five LinkedIn best practices for business growth. ' +
      'One: post three to five times per week — consistency drives the LinkedIn algorithm. ' +
      'Two: lead with a bold first line that cuts off mid-thought to force the "see more" click. ' +
      'Three: share opinions, not just information — your perspective is what builds a following. ' +
      "Four: engage meaningfully on others' posts — comments drive more profile visits than your own posts. " +
      'Five: use LinkedIn articles for long-form thought leadership that establishes authority. ' +
      'Synthex creates LinkedIn content tailored to your industry at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'list-4-content-pillars',
    title: '4 Content Pillars Every Business Needs | Synthex',
    description: `Content pillars give your social media strategy structure and consistency.

Start free: https://synthex.social

#ContentPillars #ContentStrategy #SocialMedia #Synthex`,
    tags: [
      'content pillars',
      'content strategy',
      'social media',
      'brand content',
      'Synthex',
    ],
    compositionId: 'ListicleVideo',
    voiceoverScript:
      'Four content pillars every business should build its social media strategy around. ' +
      'Pillar one: education — teach your audience something valuable related to your industry. ' +
      "Pillar two: entertainment — show your brand's personality and keep people coming back. " +
      'Pillar three: inspiration — share success stories, quotes, and behind-the-scenes moments. ' +
      'Pillar four: promotion — showcase your products, services, offers, and results. ' +
      'The winning ratio: sixty percent education and inspiration, twenty percent entertainment, twenty percent promotion. ' +
      'Synthex balances all four pillars automatically at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'list-5-tools-for-marketers',
    title: '5 Tools Every Social Media Marketer Needs in 2026 | Synthex',
    description: `The essential toolkit for social media marketing in 2026.

Start free: https://synthex.social

#MarketingTools #SocialMediaTools #Productivity #Synthex`,
    tags: [
      'marketing tools',
      'social media tools',
      'productivity',
      'marketing tech',
      'Synthex',
    ],
    compositionId: 'ListicleVideo',
    voiceoverScript:
      'Five tools every social media marketer needs in 2026. ' +
      'One: an AI content platform for generating on-brand posts at scale — Synthex covers this. ' +
      'Two: a social media scheduling tool integrated with all your platforms. ' +
      'Three: a design tool for creating visuals — Canva remains the go-to. ' +
      'Four: an analytics dashboard that consolidates data from all platforms in one view. ' +
      'Five: a CRM or email tool to convert social followers into customers. ' +
      'Synthex connects to most of these at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'list-3-secrets-viral-content',
    title: '3 Secrets Behind Viral Social Media Content | Synthex',
    description: `Viral content is not luck. It follows specific patterns. Here are 3 of them.

Start free: https://synthex.social

#ViralContent #SocialMedia #ContentStrategy #Synthex`,
    tags: [
      'viral content',
      'social media',
      'content strategy',
      'engagement',
      'Synthex',
    ],
    compositionId: 'ListicleVideo',
    voiceoverScript:
      'Three secrets behind viral social media content. ' +
      'Secret one: emotional resonance. Viral content makes you feel something — ' +
      'curiosity, amusement, inspiration, or surprise. Logic informs, emotion spreads. ' +
      'Secret two: simplicity. The most viral ideas are instantly understandable. ' +
      'If your message requires explanation, simplify it until it does not. ' +
      'Secret three: identity signal. People share content that says something about who they are. ' +
      'Make your content shareable by making it feel like a badge of identity for your audience. ' +
      'Apply these principles with Synthex at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'list-7-ways-to-increase-engagement',
    title: '7 Ways to Increase Social Media Engagement | Synthex',
    description: `More engagement means more reach. Here are 7 proven tactics.

Start free: https://synthex.social

#SocialMediaEngagement #GrowthTips #ContentMarketing #Synthex`,
    tags: [
      'social media engagement',
      'growth tips',
      'content marketing',
      'community building',
      'Synthex',
    ],
    compositionId: 'ListicleVideo',
    voiceoverScript:
      'Seven ways to increase your social media engagement. ' +
      'One: ask a question at the end of every caption. ' +
      'Two: reply to every comment within the first hour of posting. ' +
      'Three: use carousel posts — they have the highest average engagement on Instagram. ' +
      'Four: post consistently — audiences engage with accounts they see regularly. ' +
      'Five: tag relevant accounts and use location tags where appropriate. ' +
      'Six: run polls, quizzes, and "this or that" posts on Stories. ' +
      'Seven: share content that makes your audience look good when they share it. ' +
      'Synthex implements all seven at synthex dot social.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'list-5-automation-wins',
    title: '5 Marketing Tasks You Should Automate Right Now | Synthex',
    description: `Stop doing these 5 things manually. Automate them instead.

Start free: https://synthex.social

#MarketingAutomation #Productivity #SmallBusiness #Synthex`,
    tags: [
      'marketing automation',
      'productivity',
      'small business',
      'automation',
      'Synthex',
    ],
    compositionId: 'ListicleVideo',
    voiceoverScript:
      'Five marketing tasks you should automate immediately. ' +
      'One: social media content creation — AI can generate weeks of posts in minutes. ' +
      'Two: post scheduling — no more logging in at 8am every day. ' +
      'Three: performance reporting — dashboards should update themselves, not require manual pulls. ' +
      'Four: content repurposing — one piece of content should auto-adapt to every platform format. ' +
      'Five: trend research — let AI scan social platforms overnight and surface what is working. ' +
      'Synthex automates all five of these — visit synthex dot social to get started.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  // ── HowToVideo (16:9 · 1200f / 40s · 1920×1080) ─────────────────────────────

  {
    id: 'howto-set-up-social-media-strategy',
    title: 'How to Build a Social Media Strategy From Scratch | Synthex',
    description: `Step-by-step: build a social media strategy that actually drives results.

Start free: https://synthex.social

#SocialMediaStrategy #ContentStrategy #Marketing #Synthex`,
    tags: [
      'social media strategy',
      'content strategy',
      'marketing',
      'how to',
      'Synthex',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'Building a social media strategy from scratch in five steps. ' +
      'Step one: define your goals. Are you building brand awareness, generating leads, or driving sales? ' +
      'Every tactic should trace back to one of these. ' +
      'Step two: identify your audience. Build a detailed picture of who they are, what they care about, and which platforms they use. ' +
      'Step three: choose your platforms. Focus on two channels maximum until you have mastered them. ' +
      'Step four: plan your content mix. Use the sixty-twenty-twenty rule: ' +
      'sixty percent educational and inspirational, twenty percent entertaining, twenty percent promotional. ' +
      'Step five: set a publishing cadence and stick to it. Consistency beats perfection every time. ' +
      'Review your analytics monthly and adjust. ' +
      'Synthex can build and execute this strategy automatically — visit synthex dot social.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'howto-create-brand-voice-guide',
    title: 'How to Write a Brand Voice Guide in 30 Minutes | Synthex',
    description: `Your brand voice guide is the foundation of all your content. Here's how to write one.

Start free: https://synthex.social

#BrandVoice #ContentMarketing #Branding #Synthex`,
    tags: [
      'brand voice',
      'content marketing',
      'branding',
      'brand guide',
      'Synthex',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'How to write a brand voice guide in thirty minutes — five steps. ' +
      'Step one: describe your brand as a person. If your brand were a person, how would they talk? ' +
      'Formal or casual? Serious or playful? Expert or approachable? Write five adjectives. ' +
      'Step two: define your audience. Who are you talking to and what do they care about? ' +
      'Step three: list ten words you always use and ten words you never use. ' +
      'These guardrails keep every piece of content on-brand. ' +
      'Step four: write three sample posts — one educational, one promotional, one entertaining. ' +
      'These become your reference examples. ' +
      'Step five: document it and share it with everyone who creates content for your brand. ' +
      'Synthex learns your brand voice automatically and applies it to every post — visit synthex dot social.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'howto-write-engaging-captions',
    title: 'How to Write Social Media Captions That Drive Engagement | Synthex',
    description: `The anatomy of a caption that makes people stop, read, and respond.

Start free: https://synthex.social

#CaptionWriting #Copywriting #SocialMedia #Synthex`,
    tags: [
      'caption writing',
      'copywriting',
      'social media',
      'engagement',
      'Synthex',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'How to write social media captions that drive real engagement — five steps. ' +
      'Step one: nail your hook. Your first line must earn the click to "see more." ' +
      'Use a bold claim, surprising statistic, or question that your audience is already thinking. ' +
      'Step two: deliver the value. Keep it scannable — short paragraphs, line breaks, and bullet points. ' +
      'Step three: add social proof or specificity. Exact numbers always outperform vague claims. ' +
      'Step four: close with a clear call to action. "Save this," "comment below," or "link in bio." ' +
      'Step five: add hashtags at the bottom, never in the body. Three to five is the sweet spot. ' +
      'Synthex writes high-converting captions automatically — start at synthex dot social.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'howto-grow-instagram-organically',
    title: 'How to Grow Instagram Organically in 2026 | Synthex',
    description: `Organic Instagram growth without ads. The step-by-step playbook.

Start free: https://synthex.social

#InstagramGrowth #OrganicGrowth #SocialMedia #Synthex`,
    tags: [
      'Instagram growth',
      'organic growth',
      'social media',
      'Instagram tips',
      'Synthex',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'How to grow Instagram organically in 2026 — five steps. ' +
      'Step one: optimise your profile. Your bio, photo, and link should immediately communicate ' +
      'who you are, who you help, and what action to take. ' +
      "Step two: post Reels five to seven times per week. Instagram's algorithm still heavily favours Reels. " +
      'Step three: engage before and after posting. Spend fifteen minutes engaging with accounts in your niche ' +
      'before you post — this warms the algorithm and drives profile visits. ' +
      'Step four: reply to every comment in the first sixty minutes. Early engagement signals quality to Instagram. ' +
      'Step five: collaborate. Joint posts and Story takeovers expose your account to entirely new audiences. ' +
      'Synthex keeps your Instagram consistently active at synthex dot social.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'howto-build-content-calendar',
    title: 'How to Build a Monthly Content Calendar | Synthex',
    description: `A content calendar keeps you consistent, reduces stress, and improves quality. Here's how to build one.

Start free: https://synthex.social

#ContentCalendar #ContentPlanning #SocialMedia #Synthex`,
    tags: [
      'content calendar',
      'content planning',
      'social media',
      'productivity',
      'Synthex',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'How to build a monthly content calendar in five steps. ' +
      'Step one: decide your posting frequency for each platform. Three to five times per week is the sweet spot for most. ' +
      'Step two: plan your content pillars. ' +
      'Divide your posts between educational, promotional, entertaining, and inspiring content. ' +
      'Step three: map out key dates. Note public holidays, industry events, and product launches. ' +
      'Build content around moments that are naturally relevant to your audience. ' +
      'Step four: batch your content creation. Dedicate one day per month to creating all your content. ' +
      'This produces better quality content in less total time. ' +
      'Step five: schedule everything in advance and review performance weekly. ' +
      'Synthex builds and populates your content calendar automatically — visit synthex dot social.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'howto-analyse-social-analytics',
    title: 'How to Read Your Social Media Analytics | Synthex',
    description: `Analytics are only valuable if you know how to read them. Here's your guide.

Start free: https://synthex.social

#SocialMediaAnalytics #DataDriven #Marketing #Synthex`,
    tags: [
      'social media analytics',
      'data driven',
      'marketing',
      'metrics',
      'Synthex',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'How to read your social media analytics and turn data into decisions — five steps. ' +
      'Step one: focus on the right metrics. Reach, engagement rate, click-through rate, and follower growth. ' +
      'Ignore vanity metrics like raw follower count unless growth rate is also strong. ' +
      'Step two: identify your top three posts from the past month. What do they have in common? ' +
      'Format, topic, time of posting, or tone? Do more of what worked. ' +
      'Step three: identify your three worst performing posts. What can you learn to avoid? ' +
      'Step four: track trends over time, not single data points. One bad week means nothing — a three-month decline is a signal. ' +
      'Step five: set a monthly review date and document your findings. ' +
      'Synthex gives you a unified analytics dashboard across all platforms — start at synthex dot social.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'howto-create-linkedin-presence',
    title: 'How to Build a LinkedIn Presence That Attracts Clients | Synthex',
    description: `LinkedIn is the most powerful B2B platform. Here's how to build a presence that converts.

Start free: https://synthex.social

#LinkedInMarketing #B2BMarketing #ThoughtLeadership #Synthex`,
    tags: [
      'LinkedIn marketing',
      'B2B marketing',
      'thought leadership',
      'professional presence',
      'Synthex',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'How to build a LinkedIn presence that attracts clients — five steps. ' +
      'Step one: optimise your profile as a landing page, not a resume. ' +
      'Your headline should describe who you help and how, not just your job title. ' +
      'Step two: post consistently — three to five times per week. ' +
      'Consistency on LinkedIn builds trust faster than any other platform. ' +
      'Step three: write from personal experience. Frameworks and takes that come from real situations outperform generic advice every time. ' +
      'Step four: engage in the comments of influential posts in your niche. ' +
      'Thoughtful comments on popular posts drive significant profile traffic. ' +
      'Step five: share case studies and specific results. LinkedIn audiences respond to proof over claims. ' +
      'Synthex creates LinkedIn-optimised content automatically — visit synthex dot social.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'howto-repurpose-blog-content',
    title: 'How to Repurpose One Blog Post Into 10 Social Posts | Synthex',
    description: `Maximum output from minimum input. The content repurposing playbook.

Start free: https://synthex.social

#ContentRepurposing #ContentMarketing #Blogging #Synthex`,
    tags: [
      'content repurposing',
      'content marketing',
      'blogging',
      'social media',
      'Synthex',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'How to turn one blog post into ten social media posts — five steps. ' +
      'Step one: extract the key points. Every blog post contains five to ten standalone insights ' +
      'that each deserve their own social post. ' +
      'Step two: create a quote card from the most powerful sentence in the article. ' +
      'Step three: write a short-form summary for LinkedIn — the full argument in three to five paragraphs. ' +
      'Step four: create a TipCard video for the single most actionable tip in the piece. ' +
      'Step five: record a sixty-second Reel or TikTok where you explain the main takeaway in your own words. ' +
      'One blog post, published across five platforms in five formats, ' +
      'becomes an entire week of content. ' +
      'Synthex does this repurposing automatically — start at synthex dot social.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'howto-run-social-media-campaign',
    title: 'How to Run a Social Media Campaign From Start to Finish | Synthex',
    description: `Launch, execute, and measure a social media campaign that actually delivers results.

Start free: https://synthex.social

#SocialMediaCampaign #CampaignMarketing #DigitalMarketing #Synthex`,
    tags: [
      'social media campaign',
      'campaign marketing',
      'digital marketing',
      'how to',
      'Synthex',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'How to run a social media campaign that delivers real results — five steps. ' +
      'Step one: define a clear campaign goal. Not "more followers" — something measurable ' +
      'like "one hundred new leads" or "five hundred link clicks." ' +
      'Step two: set a campaign duration. Four to six weeks allows enough time for momentum to build. ' +
      'Step three: build your content plan. Map out every post, every platform, and every date in advance. ' +
      'Step four: launch with a strong opening — a hook post that frames the campaign and invites your audience in. ' +
      'Step five: monitor daily and adjust weekly. If something is outperforming, allocate more posts to that format. ' +
      'After the campaign, document your results against your goal. ' +
      'Synthex manages campaigns end-to-end at synthex dot social.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'howto-use-ai-for-content',
    title: 'How to Use AI for Social Media Content Creation | Synthex',
    description: `A practical guide to getting the most from AI content tools in your marketing workflow.

Start free: https://synthex.social

#AIMarketing #AIContent #ContentCreation #Synthex`,
    tags: [
      'AI marketing',
      'AI content',
      'content creation',
      'workflow',
      'Synthex',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'How to use AI effectively in your social media content workflow — five steps. ' +
      'Step one: set up your brand profile. Give the AI your tone, vocabulary, audience, and goals. ' +
      'The more context it has, the better the output. ' +
      'Step two: use AI to generate a content calendar — topics, themes, and post ideas for the entire month at once. ' +
      'Step three: review and edit AI drafts. AI provides a strong starting point — ' +
      'add your personal voice, specific examples, and current references. ' +
      'Step four: let AI adapt content for each platform. ' +
      'What works on LinkedIn reads differently on Instagram. ' +
      'Step five: use AI analytics to identify what performed best and why, then brief the AI to create more like it. ' +
      'This creates a self-improving content engine. ' +
      'Synthex is built for exactly this workflow at synthex dot social.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  // ── QuoteCard (1:1 · 600f / 20s · 1080×1080) ────────────────────────────────

  {
    id: 'quote-marketing-automation-future',
    title: '"Automation Amplifies Human Creativity" | Synthex',
    description: `Marketing automation doesn't replace creativity — it amplifies it.

#MarketingAutomation #AIMarketing #Synthex`,
    tags: [
      'marketing automation',
      'AI marketing',
      'creativity',
      'quote',
      'Synthex',
    ],
    compositionId: 'QuoteCard',
    voiceoverScript:
      '"Automation does not replace human creativity — it amplifies it." ' +
      'When repetitive tasks are handled by AI, marketers are freed to focus on strategy, storytelling, and relationships. ' +
      'The future of marketing is not AI or human — it is AI and human, working together. ' +
      'That future is available today at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1080,
    height: 1080,
  },

  {
    id: 'quote-content-is-king',
    title: '"Content is King — But Consistency is the Crown" | Synthex',
    description: `Everyone knows content is king. But consistency is what actually wins.

#ContentMarketing #SocialMedia #Synthex`,
    tags: [
      'content marketing',
      'social media',
      'consistency',
      'quote',
      'Synthex',
    ],
    compositionId: 'QuoteCard',
    voiceoverScript:
      '"Content is king — but consistency is the crown." ' +
      'Publishing one great post a month will not build an audience. ' +
      'Publishing useful, on-brand content every week for twelve months will. ' +
      'Consistency is the compounding force that turns content into a business asset. ' +
      'Synthex makes consistency effortless at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1080,
    height: 1080,
  },

  {
    id: 'quote-engagement-over-followers',
    title: '"1,000 Engaged Followers Beat 100,000 Passive Ones" | Synthex',
    description: `Follower count is a vanity metric. Engagement is the real measure of social media success.

#SocialMedia #EngagementRate #Synthex`,
    tags: ['engagement', 'followers', 'social media', 'community', 'Synthex'],
    compositionId: 'QuoteCard',
    voiceoverScript:
      '"One thousand engaged followers will always beat one hundred thousand passive ones." ' +
      'An audience that reads, responds, and shares your content is infinitely more valuable ' +
      'than a large audience that scrolls past. ' +
      'Build depth before width. Build trust before scale. ' +
      'Synthex helps you build the right audience at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1080,
    height: 1080,
  },

  {
    id: 'quote-consistency-in-branding',
    title: '"Your Brand is a Promise — Keep It" | Synthex',
    description: `Every time your brand shows up inconsistently, it breaks a small promise. Here's why that matters.

#Branding #BrandConsistency #Synthex`,
    tags: ['branding', 'brand consistency', 'trust', 'marketing', 'Synthex'],
    compositionId: 'QuoteCard',
    voiceoverScript:
      '"Your brand is a promise. Every post is an opportunity to keep it or break it." ' +
      'Inconsistent colours, tone, or quality erodes trust — even subconsciously. ' +
      'Brands that show up the same way every time build recognition, and recognition builds trust. ' +
      'Trust is what ultimately drives purchase decisions. ' +
      'Synthex keeps your brand consistent at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1080,
    height: 1080,
  },

  {
    id: 'quote-data-driven-decisions',
    title: '"Without Data, You\'re Just Guessing" | Synthex',
    description: `Intuition has a place in marketing — but it must be backed by data.

#DataDrivenMarketing #Analytics #SocialMedia #Synthex`,
    tags: [
      'data driven marketing',
      'analytics',
      'social media',
      'metrics',
      'Synthex',
    ],
    compositionId: 'QuoteCard',
    voiceoverScript:
      '"Without data, you are just guessing — and guessing is expensive." ' +
      'Your analytics tell you exactly what content your audience wants, when they want it, and in what format. ' +
      'Every week without looking at your data is a week of missed optimisation. ' +
      'Synthex surfaces your most important insights automatically at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1080,
    height: 1080,
  },

  {
    id: 'quote-brand-voice-importance',
    title: '"Your Brand Voice is Your Most Underrated Asset" | Synthex',
    description: `Logos and colours get all the attention. But your brand voice does more work.

#BrandVoice #ContentMarketing #Branding #Synthex`,
    tags: ['brand voice', 'content marketing', 'branding', 'quote', 'Synthex'],
    compositionId: 'QuoteCard',
    voiceoverScript:
      '"Your brand voice is your most underrated asset. ' +
      'It is working in every caption, every email, every conversation — building trust or eroding it." ' +
      'A distinctive brand voice sets you apart in a feed full of identical-sounding competitors. ' +
      'Define yours once. Let Synthex apply it everywhere at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1080,
    height: 1080,
  },

  {
    id: 'quote-social-proof-power',
    title: '"People Trust People, Not Brands" | Synthex',
    description: `Social proof is the most powerful conversion tool in marketing. Use it.

#SocialProof #Testimonials #Marketing #Synthex`,
    tags: [
      'social proof',
      'testimonials',
      'conversion',
      'marketing',
      'Synthex',
    ],
    compositionId: 'QuoteCard',
    voiceoverScript:
      '"People trust people — not brands. Your customers\' voices are more powerful than yours." ' +
      'Collect reviews, amplify success stories, and let your customers do your marketing. ' +
      'Social proof is free, authentic, and converts better than any ad. ' +
      'Synthex helps you build it at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1080,
    height: 1080,
  },

  {
    id: 'quote-ai-and-creativity',
    title: '"AI is the Paintbrush, You\'re Still the Artist" | Synthex',
    description: `AI tools do not replace creativity. They give creatives a better set of tools.

#AICreativity #ContentCreation #AIMarketing #Synthex`,
    tags: [
      'AI creativity',
      'content creation',
      'AI marketing',
      'marketing tools',
      'Synthex',
    ],
    compositionId: 'QuoteCard',
    voiceoverScript:
      '"AI is the paintbrush. You are still the artist." ' +
      'The best marketers in 2026 are not those who resist AI — they are those who direct it most effectively. ' +
      'Your strategy, your voice, your judgment remain irreplaceable. ' +
      'AI just removes the bottleneck between your ideas and their execution. ' +
      'Paint faster at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1080,
    height: 1080,
  },

  {
    id: 'quote-audience-first-marketing',
    title: '"The Best Marketing Feels Like Help" | Synthex',
    description: `When your marketing helps people, it doesn't feel like marketing at all.

#ContentMarketing #AudienceFirst #Marketing #Synthex`,
    tags: [
      'content marketing',
      'audience first',
      'helpful marketing',
      'education',
      'Synthex',
    ],
    compositionId: 'QuoteCard',
    voiceoverScript:
      '"The best marketing does not feel like marketing — it feels like help." ' +
      'Teach your audience something useful. Solve a problem they have right now. ' +
      'Answer the question they were about to Google. ' +
      'When your content helps people, they trust your brand before you ever make an offer. ' +
      'That is the only form of marketing that compounds. Start at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1080,
    height: 1080,
  },

  {
    id: 'quote-test-and-learn',
    title: '"Every Post is an Experiment. Run More of Them." | Synthex',
    description: `The marketers who grow fastest are those who test the most.

#GrowthMarketing #Testing #SocialMedia #Synthex`,
    tags: [
      'growth marketing',
      'testing',
      'social media',
      'experimentation',
      'Synthex',
    ],
    compositionId: 'QuoteCard',
    voiceoverScript:
      '"Every post is an experiment. The more experiments you run, the faster you learn what works." ' +
      'Perfectionism is the enemy of growth. ' +
      'Publish consistently, test formats relentlessly, and let data — not instinct — guide your strategy. ' +
      'Volume of testing beats quality of guessing every time. ' +
      'Synthex lets you publish more, learn faster at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1080,
    height: 1080,
  },

  // ── CountdownCTA (16:9 · 450f / 15s · 1920×1080) ────────────────────────────

  {
    id: 'cta-start-free-trial',
    title: 'Start Your Free Synthex Trial Today',
    description: `No credit card. No commitment. Just better marketing, starting now.

Start free: https://synthex.social

#FreeTrial #AIMarketing #Synthex`,
    tags: [
      'free trial',
      'AI marketing',
      'Synthex',
      'get started',
      'marketing automation',
    ],
    compositionId: 'CountdownCTA',
    voiceoverScript:
      'Stop doing your social media the hard way. ' +
      'Synthex creates, schedules, and optimises your content automatically — ' +
      'using your brand voice, your goals, and your audience. ' +
      'Start your free trial today. No credit card required. ' +
      'Visit synthex dot social.',
    durationInFrames: 450,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'cta-book-demo',
    title: 'Book a Live Synthex Demo | See It in Action',
    description: `See Synthex create real content for your business in a live 20-minute demo.

Book now: https://synthex.social

#Demo #AIMarketing #Synthex`,
    tags: [
      'demo',
      'AI marketing',
      'Synthex',
      'product demo',
      'marketing automation',
    ],
    compositionId: 'CountdownCTA',
    voiceoverScript:
      'Want to see Synthex create real content for your specific business in real time? ' +
      'Book a twenty-minute live demo with the Synthex team. ' +
      'We will show you exactly how it works with your brand, your voice, and your goals. ' +
      'Book your demo at synthex dot social.',
    durationInFrames: 450,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'cta-join-community',
    title: 'Join the Synthex Community',
    description: `You're not alone in figuring out AI marketing. Join the Synthex community.

Join free: https://synthex.social

#Community #AIMarketing #Synthex`,
    tags: [
      'community',
      'AI marketing',
      'Synthex',
      'business owners',
      'social media',
    ],
    compositionId: 'CountdownCTA',
    voiceoverScript:
      'Synthex helps business owners plan, approve and publish their social media marketing in one place. ' +
      'You approve every post before it goes live. ' +
      'Get started today. ' +
      'Visit synthex dot social.',
    durationInFrames: 450,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'cta-download-guide',
    title: 'Download: The Social Media Strategy Guide | Synthex',
    description: `Free download: The complete social media strategy guide for small businesses.

Get it free: https://synthex.social

#FreeGuide #SocialMediaStrategy #Synthex`,
    tags: [
      'free guide',
      'social media strategy',
      'Synthex',
      'small business',
      'download',
    ],
    compositionId: 'CountdownCTA',
    voiceoverScript:
      'Download the free Synthex Social Media Strategy Guide — ' +
      'twenty pages of actionable frameworks for growing your business through social media in 2026. ' +
      'Completely free. No email required. ' +
      'Get your copy at synthex dot social.',
    durationInFrames: 450,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'cta-upgrade-plan',
    title: 'Upgrade to Synthex Pro — Unlock Full AI Power',
    description: `More platforms, more content, more insights. Upgrade your Synthex plan today.

Upgrade: https://synthex.social

#Upgrade #AIMarketing #Synthex`,
    tags: [
      'upgrade',
      'AI marketing',
      'Synthex Pro',
      'premium plan',
      'marketing automation',
    ],
    compositionId: 'CountdownCTA',
    voiceoverScript:
      'Ready to unlock the full power of Synthex? ' +
      'Pro gives you unlimited content generation, all nine social platforms, ' +
      'advanced analytics, and priority support. ' +
      'Upgrade today and experience the difference that full automation makes. ' +
      'Visit synthex dot social.',
    durationInFrames: 450,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'cta-connect-platforms',
    title: 'Connect All Your Social Platforms in 60 Seconds | Synthex',
    description: `Synthex connects to Instagram, LinkedIn, TikTok, Facebook, and 5 more platforms instantly.

Connect now: https://synthex.social

#SocialMedia #Integration #Synthex`,
    tags: [
      'social media integration',
      'platforms',
      'Synthex',
      'connect',
      'automation',
    ],
    compositionId: 'CountdownCTA',
    voiceoverScript:
      'Connect all your social media platforms to Synthex in sixty seconds. ' +
      'Instagram, LinkedIn, TikTok, Facebook, Twitter, Pinterest, and more — ' +
      'all managed from one AI-powered dashboard. ' +
      'One platform to rule them all. ' +
      'Connect yours at synthex dot social.',
    durationInFrames: 450,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'cta-schedule-content',
    title: 'Schedule a Month of Content in Minutes | Synthex',
    description: `Stop posting manually every day. Let Synthex schedule everything for you.

Start free: https://synthex.social

#ContentScheduling #Automation #Synthex`,
    tags: [
      'content scheduling',
      'automation',
      'Synthex',
      'social media',
      'time saving',
    ],
    compositionId: 'CountdownCTA',
    voiceoverScript:
      'What if you could plan an entire month of social media content in one sitting? ' +
      'Synthex generates your content, adapts it for every platform, ' +
      'and schedules it automatically at the optimal time for each audience. ' +
      'Start at synthex dot social.',
    durationInFrames: 450,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'cta-get-brand-audit',
    title: 'Get a Free AI Brand Audit | Synthex',
    description: `Find out how your brand looks online — for free. Synthex scans your social presence and tells you exactly what to improve.

Get yours: https://synthex.social

#BrandAudit #AIMarketing #Synthex`,
    tags: [
      'brand audit',
      'AI marketing',
      'Synthex',
      'social media audit',
      'free',
    ],
    compositionId: 'CountdownCTA',
    voiceoverScript:
      'How does your brand actually look online? ' +
      "Synthex's free AI brand audit scans your social profiles, analyses your content, " +
      'and tells you exactly what to improve — in minutes. ' +
      'No charge. No commitment. Just clarity. ' +
      'Get your free audit at synthex dot social.',
    durationInFrames: 450,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'cta-year-end-review',
    title: 'Your 2026 Social Media Performance Report | Synthex',
    description: `See exactly how your social media performed this year — and what to do differently next year.

Start now: https://synthex.social

#YearInReview #SocialMedia #Synthex`,
    tags: [
      'year in review',
      'social media',
      'performance report',
      'analytics',
      'Synthex',
    ],
    compositionId: 'CountdownCTA',
    voiceoverScript:
      'What did your social media actually achieve this year? ' +
      'Synthex generates a complete annual performance report — ' +
      'growth, engagement, top posts, and strategic recommendations for next year. ' +
      'Know what worked, understand what did not, and go into the next year with a clear plan. ' +
      'Get your report at synthex dot social.',
    durationInFrames: 450,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  // ── DefinitionCard (16:9 · 600f / 20s · 1920×1080) ──────────────────────────

  {
    id: 'def-content-marketing',
    title: 'What is Content Marketing? | Synthex Glossary',
    description: `The plain English definition of content marketing — and why it matters for your business.

#ContentMarketing #MarketingGlossary #Synthex`,
    tags: [
      'content marketing',
      'definition',
      'marketing glossary',
      'education',
      'Synthex',
    ],
    compositionId: 'DefinitionCard',
    voiceoverScript:
      'Content marketing is the practice of creating and sharing valuable, relevant content ' +
      'to attract and retain a clearly defined audience — with the goal of driving profitable action. ' +
      'Unlike traditional advertising, content marketing educates and informs rather than interrupting. ' +
      'Example: a financial adviser who publishes weekly tips on saving money is doing content marketing. ' +
      'When a reader needs financial advice, they think of the person who has been helping them for free. ' +
      'Synthex automates your content marketing at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'def-engagement-rate',
    title: 'What is Engagement Rate? | Synthex Glossary',
    description: `Engagement rate is the most important social media metric you're probably ignoring.

#EngagementRate #SocialMediaMetrics #Synthex`,
    tags: [
      'engagement rate',
      'social media metrics',
      'definition',
      'marketing glossary',
      'Synthex',
    ],
    compositionId: 'DefinitionCard',
    voiceoverScript:
      'Engagement rate is the percentage of people who interact with your content after seeing it. ' +
      'It is calculated as total interactions — likes, comments, shares, saves — ' +
      'divided by total reach, multiplied by one hundred. ' +
      'A good engagement rate signals that your content resonates with your audience. ' +
      'Example: one hundred interactions on a post seen by two thousand people equals a five percent engagement rate. ' +
      'Track yours automatically with Synthex at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'def-brand-voice',
    title: 'What is Brand Voice? | Synthex Glossary',
    description: `Brand voice is how your business sounds. It's more important than your logo.

#BrandVoice #Branding #ContentMarketing #Synthex`,
    tags: [
      'brand voice',
      'branding',
      'content marketing',
      'definition',
      'Synthex',
    ],
    compositionId: 'DefinitionCard',
    voiceoverScript:
      'Brand voice is the consistent personality and tone a brand uses in all of its communication. ' +
      'It encompasses word choice, sentence structure, level of formality, and emotional register. ' +
      'A strong brand voice makes your content instantly recognisable — even without a logo. ' +
      'Example: Apple is minimal and confident. Old Spice is absurd and bold. Dove is warm and empowering. ' +
      'Synthex captures and applies your brand voice automatically at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'def-social-proof',
    title: 'What is Social Proof? | Synthex Glossary',
    description: `Social proof is why people follow the crowd — and why you need more of it in your marketing.

#SocialProof #ConversionMarketing #Synthex`,
    tags: [
      'social proof',
      'conversion marketing',
      'definition',
      'marketing psychology',
      'Synthex',
    ],
    compositionId: 'DefinitionCard',
    voiceoverScript:
      "Social proof is the psychological phenomenon where people look to others' behaviour " +
      'to determine the correct action in a given situation. ' +
      'In marketing, social proof includes testimonials, reviews, star ratings, follower counts, and case studies. ' +
      'When potential customers see that others trust and value your product, they become more likely to do the same. ' +
      'Example: a verified customer review on your website is social proof. ' +
      'Build yours at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'def-conversion-rate',
    title: 'What is Conversion Rate? | Synthex Glossary',
    description: `Conversion rate is the metric that connects your marketing effort to actual business results.

#ConversionRate #DigitalMarketing #Synthex`,
    tags: [
      'conversion rate',
      'digital marketing',
      'definition',
      'marketing metrics',
      'Synthex',
    ],
    compositionId: 'DefinitionCard',
    voiceoverScript:
      'Conversion rate is the percentage of people who complete a desired action ' +
      'out of all those who had the opportunity to do so. ' +
      'That action could be clicking a link, signing up for a newsletter, making a purchase, or booking a call. ' +
      'Formula: conversions divided by total visitors, multiplied by one hundred. ' +
      'Example: ten sign-ups from five hundred link clicks equals a two percent conversion rate. ' +
      'Improve your conversion rate with better content at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'def-organic-reach',
    title: 'What is Organic Reach? | Synthex Glossary',
    description: `Organic reach is the foundation of sustainable social media growth.

#OrganicReach #SocialMedia #ContentMarketing #Synthex`,
    tags: [
      'organic reach',
      'social media',
      'content marketing',
      'definition',
      'Synthex',
    ],
    compositionId: 'DefinitionCard',
    voiceoverScript:
      'Organic reach is the number of unique people who see your content without any paid promotion. ' +
      'It is driven by your followers, their shares, and the platform algorithm recommending your content to new users. ' +
      'Organic reach has declined on most platforms as they prioritise paid advertising — ' +
      'but high-quality, engaging content still earns significant organic distribution. ' +
      'Example: a post seen by three thousand people without any boosting has a reach of three thousand. ' +
      'Maximise your organic reach with Synthex at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'def-content-pillars',
    title: 'What are Content Pillars? | Synthex Glossary',
    description: `Content pillars give your social media strategy structure, direction, and consistency.

#ContentPillars #ContentStrategy #SocialMedia #Synthex`,
    tags: [
      'content pillars',
      'content strategy',
      'social media',
      'definition',
      'Synthex',
    ],
    compositionId: 'DefinitionCard',
    voiceoverScript:
      'Content pillars are the core themes or categories that define what a brand posts about on social media. ' +
      'They give your content strategy structure and ensure variety without losing focus. ' +
      'Most businesses operate with three to five pillars. ' +
      'Example: a fitness brand might use education, motivation, transformation stories, and nutrition tips as their four pillars. ' +
      'Every piece of content fits into one of these, keeping the feed coherent and purposeful. ' +
      'Define your content pillars with Synthex at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'def-a-b-testing',
    title: 'What is A/B Testing in Marketing? | Synthex Glossary',
    description: `A/B testing removes the guesswork from marketing. Here's exactly what it means.

#ABTesting #DataDrivenMarketing #Synthex`,
    tags: [
      'A/B testing',
      'data driven marketing',
      'definition',
      'marketing testing',
      'Synthex',
    ],
    compositionId: 'DefinitionCard',
    voiceoverScript:
      'A slash B testing, or split testing, is the practice of publishing two versions of content ' +
      'to determine which performs better, then adopting the winner as your standard. ' +
      'In social media, you might test two different caption hooks, two visual styles, or two posting times. ' +
      'The version with the higher engagement rate wins. ' +
      'Example: posting the same content with two different opening lines to two audience segments, ' +
      'then measuring which drives more clicks. ' +
      'Test smarter with Synthex at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'def-influencer-marketing',
    title: 'What is Influencer Marketing? | Synthex Glossary',
    description: `Influencer marketing is one of the fastest-growing channels in digital marketing. Here's what it means.

#InfluencerMarketing #DigitalMarketing #Synthex`,
    tags: [
      'influencer marketing',
      'digital marketing',
      'definition',
      'marketing channels',
      'Synthex',
    ],
    compositionId: 'DefinitionCard',
    voiceoverScript:
      'Influencer marketing is a form of social media marketing that involves partnering with individuals ' +
      'who have established credibility and audiences in a specific niche. ' +
      'The influencer promotes your product or service to their followers in exchange for payment or product. ' +
      "It is effective because audiences trust the influencer's recommendations more than direct brand advertising. " +
      'Example: a skincare brand partnering with a dermatologist who has two hundred thousand Instagram followers. ' +
      'Pair influencer content with Synthex at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  {
    id: 'def-marketing-automation',
    title: 'What is Marketing Automation? | Synthex Glossary',
    description: `Marketing automation is the technology that lets businesses scale their marketing without scaling their team.

#MarketingAutomation #AIMarketing #Synthex`,
    tags: [
      'marketing automation',
      'AI marketing',
      'definition',
      'marketing technology',
      'Synthex',
    ],
    compositionId: 'DefinitionCard',
    voiceoverScript:
      'Marketing automation is the use of technology to perform marketing tasks automatically, ' +
      'reducing manual effort while maintaining or improving quality and consistency. ' +
      'This includes automated content creation, post scheduling, performance reporting, and audience segmentation. ' +
      'Modern AI-powered marketing automation goes further — ' +
      'learning from data to continuously improve content strategy over time. ' +
      'Example: Synthex automatically generating, scheduling, and optimising your social media content. ' +
      'Experience it at synthex dot social.',
    durationInFrames: 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },

  // ── HelpVideo placements (SYN-431) ────────────────────────────────────────

  {
    id: 'how-to-schedule-posts',
    title: 'How to Schedule Posts | Synthex Tutorial',
    description:
      'Learn how to schedule social media posts across all platforms using the Synthex content calendar.\n\n#SocialMedia #ContentScheduling #Synthex',
    tags: [
      'scheduling',
      'content calendar',
      'social media',
      'Synthex',
      'tutorial',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'Welcome to Synthex. In this tutorial, we cover how to schedule posts across all your connected platforms. ' +
      'Open the Schedule page and you will see your content calendar. ' +
      'Click any time slot to create a new post, or drag an existing draft onto the calendar. ' +
      'Choose your platforms, set your preferred time, and Synthex will handle the rest. ' +
      'You can also use our optimal-times feature to let AI suggest the best publishing windows for each platform. ' +
      'Your audience gets the right content at the right time, every time.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },
  HELP_VIDEO_BY_ID['how-to-create-content'],
  {
    id: 'feature-tour-analytics',
    title: 'Analytics Feature Tour | Synthex',
    description:
      'Explore the Synthex analytics dashboard — track engagement, reach, and growth across all platforms.\n\n#Analytics #SocialMediaMetrics #Synthex',
    tags: ['analytics', 'metrics', 'engagement', 'social media', 'Synthex'],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'The Synthex analytics dashboard gives you a unified view of performance across every platform. ' +
      'Track engagement rate, follower growth, reach, and top-performing content from one screen. ' +
      'Use the campaign selector to compare performance across different time periods. ' +
      'The AI insights panel surfaces actionable recommendations — like the best time to post or which content format resonates most. ' +
      'Data updates regularly so you always have a current picture of your social presence.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },
  HELP_VIDEO_BY_ID['feature-tour-brand-voice'],
  HELP_VIDEO_BY_ID['platform-guide-instagram'],
  HELP_VIDEO_BY_ID['ai-capability-chat'],
  HELP_VIDEO_BY_ID['feature-tour-research'],
  HELP_VIDEO_BY_ID['workflow-overview'],

  // ── Auth + Onboarding how-tos (UNI-1639) ────────────────────────────────

  HELP_VIDEO_BY_ID['how-to-sign-up'],

  HELP_VIDEO_BY_ID['how-to-sign-in'],

  HELP_VIDEO_BY_ID['onboarding-connect-social'],

  HELP_VIDEO_BY_ID['onboarding-connect-gmb'],

  HELP_VIDEO_BY_ID['onboarding-setup-ai'],

  {
    id: 'use-case-content-creation',
    title: 'Creating AI-Powered Social Media Content | Synthex',
    description:
      'See how Synthex turns a single prompt into a full week of platform-tailored social media content in seconds.\n\n#ContentCreation #AIWriting #SocialMedia #Synthex',
    tags: ['content creation', 'AI writing', 'social media posts', 'use case'],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      "Synthex's Content Studio turns a simple prompt into a full week of social media " +
      'content in seconds. Navigate to Content, then click Generate. Describe your topic ' +
      'or paste a URL, choose your platforms, and select your tone. Synthex generates ' +
      "multiple variations tailored to each platform's format — a LinkedIn article, " +
      'an Instagram caption with hashtags, a punchy X post, and a Facebook update — ' +
      'all from one brief. Review, edit, and either schedule or publish immediately. ' +
      'The AI learns your brand voice over time, getting sharper with every piece of ' +
      'content you approve.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
    youtubeVideoId: 'e3UZQ_OwEtw',
  },

  {
    id: 'use-case-review-management',
    title: 'Managing Google Reviews with AI | Synthex',
    description:
      'Learn how Synthex automates Google review responses with AI-generated, on-brand replies — and helps you collect new testimonials.\n\n#Reviews #ReputationManagement #GoogleReviews #Synthex',
    tags: [
      'reviews',
      'Google reviews',
      'reputation management',
      'AI replies',
      'use case',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Responding to every Google review builds trust and improves your local search ' +
      "ranking — but it's time-consuming. Synthex automates this with AI-generated reply " +
      "suggestions tailored to each review's tone. Navigate to Google Business, then " +
      'Reviews. For each unanswered review, click AI Suggest and Synthex drafts a ' +
      'personalised, on-brand response in seconds. Review it, adjust if needed, and ' +
      'click Send. You can also collect new testimonials by generating a shareable link ' +
      '— customers submit text, photos, or video, and approved testimonials post directly ' +
      'to your Google listing as a Google Post.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
    youtubeVideoId: 'GibdVExEn-c',
  },

  {
    id: 'use-case-campaign-scheduling',
    title: 'Scheduling a Month of Content in Minutes | Synthex',
    description:
      'Discover how the Synthex Campaign Planner generates a 30-day content calendar across all your platforms — then schedules everything automatically.\n\n#Scheduling #ContentCalendar #Automation #Synthex',
    tags: [
      'scheduling',
      'content calendar',
      'campaign',
      'automation',
      'use case',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Planning a month of content used to take days. With Synthex, it takes minutes. ' +
      'Open Campaign Planner, enter your campaign goal and target audience, and Synthex ' +
      'generates a 30-day content calendar — one post per day, across all your connected ' +
      'platforms, with themes, hooks, and calls to action pre-planned. Review the calendar, ' +
      'tweak any posts you want to customise, then click Schedule All. Every post queues ' +
      'automatically at the optimal posting time for each platform. Your content runs ' +
      'on autopilot while you focus on the work that actually needs you.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
    youtubeVideoId: 'j7Vyf8OLbAc',
  },
];
